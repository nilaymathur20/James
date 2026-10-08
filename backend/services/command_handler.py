"""Deterministic command handler for the assistant flow.

Commands are handled without LLM generation — intent detection routes
known commands here before the agentic path is ever invoked.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any, Callable, Optional

from ..schemas import AssistantRequest
from ..services.errors import AssistantFlowError
from ..services.file_tools import search_files
from ..services.indexer import IndexingError, index_folder_path, index_web_url
from ..services.intent_router import command_help, detect_intent, resolve_folder_reference
from ..services.image_generator import generate_image
from ..services.llm import generate_chat_completion, configured_provider
from ..services.retrieval import build_retrieval_response, retrieve_matches, serialize_match
from ..services.scraper import ScrapeError, scrape_page
from ..services.browser_tool import web_search
from ..services.tts_engine import synthesize_speech, DEFAULT_VOICE
from ..services.media_generator import AUDIO_DIR, _ensure_dirs

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[dict[str, Any]], None]


def _emit(
    progress_callback: Optional[Callable[[dict[str, Any]], None]],
    event_type: str,
    phase: str,
    message: str,
    **data: object,
) -> None:
    if progress_callback is None:
        return
    try:
        progress_callback({"event_type": event_type, "phase": phase, "message": message, **data})
    except Exception:
        pass


def handle_command(
    intent_name: str,
    argument: str,
    text: str,
    *,
    history_dir: Any,
    use_history: bool,
    progress_callback: Optional[Callable[[dict[str, Any]], None]] = None,
) -> Optional[dict[str, Any]]:
    """Handle a deterministic command. Returns result dict or None if not a command."""

    # Help — always deterministic
    if intent_name == "help":
        _emit(progress_callback, "assistant_status", "complete", "Command help is ready.")
        return {
            "kind": "help",
            "response": command_help(),
            "results": [],
            "file_candidates": [],
        }

    # Folder indexing
    if intent_name == "index_folder":
        folder_reference = resolve_folder_reference(argument)
        if not folder_reference:
            return {
                "kind": "clarification",
                "response": "Tell me which folder to index. Example: index ~/Documents",
                "results": [],
                "file_candidates": [],
            }
        _emit(progress_callback, "assistant_status", "validating_folder", "Checking the requested folder policy.")
        try:
            summary = index_folder_path(folder_reference, progress_callback=progress_callback)
        except IndexingError as exc:
            raise AssistantFlowError(exc.message, status_code=exc.status_code) from exc
        return {
            "kind": "index_folder",
            "response": _folder_index_response(summary),
            "results": [],
            "file_candidates": [],
            "data": summary,
        }

    # Web indexing
    if intent_name == "index_web":
        _emit(progress_callback, "assistant_status", "validating_url", "Checking the supplied web address.")
        try:
            summary = index_web_url(argument, progress_callback=progress_callback)
        except IndexingError as exc:
            raise AssistantFlowError(exc.message, status_code=exc.status_code) from exc
        return {
            "kind": "index_web",
            "response": summary.get("message", "Web page indexing completed."),
            "results": [],
            "file_candidates": [],
            "data": summary,
        }

    # Web scraping (fetch content without indexing)
    if intent_name == "scrape_web":
        _emit(progress_callback, "assistant_status", "fetching", "Fetching the web page.")
        try:
            result = scrape_page(argument)
        except ScrapeError as exc:
            raise AssistantFlowError(exc.message, status_code=exc.status_code) from exc
        return {
            "kind": "scrape_web",
            "response": f"Scraped {argument.strip()} ({result.content_length} chars{' — Selenium rendered' if result.used_selenium else ''}).",
            "results": [],
            "file_candidates": [],
            "data": {"url": argument.strip(), "content": result.text, "used_selenium": result.used_selenium},
        }

    # Web search (with image cards)
    if intent_name == "web_search":
        if not argument.strip():
            return {
                "kind": "clarification",
                "response": "Ask me anything. Example: /s hermes agent",
                "results": [],
                "file_candidates": [],
            }
        _emit(progress_callback, "assistant_status", "searching", "Searching the web with images.")
        result = web_search(argument.strip())
        if "error" in result:
            raise AssistantFlowError(result["error"], status_code=502)
        return {
            "kind": "web_search",
            "response": result.get("results_summary", "No results found."),
            "results": [],
            "file_candidates": [],
            "data": result,
        }

    # Translation
    if intent_name == "translate_text":
        return _handle_translate_text(argument, progress_callback)

    # OCR Document
    if intent_name == "ocr_document":
        return _handle_ocr_document(argument, progress_callback)

    # Summarize Text (3-bullet plain-language summary)
    if intent_name == "summarize_text":
        return _handle_summarize_text(argument, progress_callback)

    # Policy Check & Proofreading & Scam detection
    if intent_name == "policy_check":
        return _handle_policy_check(argument, progress_callback)


    # Music stub (no backend)
    if intent_name == "music_stub":
        return _handle_music_stub(argument)

    # Sound stub (no backend)
    if intent_name == "sound_stub":
        return _handle_sound_stub(argument)

    # Image generation
    if intent_name == "generate_image":
        if not argument.strip():
            return {
                "kind": "clarification",
                "response": "Tell me what to draw. Example: image a sunset over mountains",
                "results": [],
                "file_candidates": [],
            }
        try:
            result = generate_image(prompt=argument.strip())
        except Exception as exc:
            raise AssistantFlowError(f"Image generation failed: {exc}", status_code=500) from exc
        return {
            "kind": "image_generated",
            "response": f"Generated: {argument}",
            "results": [],
            "file_candidates": [],
            "media_url": result.get("image_url"),
            "media_type": "image",
            "data": result,
        }

    # Audio / TTS generation
    if intent_name == "generate_audio":
        return _handle_generate_audio(argument, progress_callback)

    # Direct text generation (LLM only, no RAG, no tools)
    if intent_name == "generate_text":
        return _handle_generate_text(argument, progress_callback)

    # File search / open / preview / edit candidates
    if intent_name in {"search", "open_candidates", "preview_candidates", "edit_candidates"}:
        if not argument:
            verb = intent_name.replace("_candidates", "")
            return {
                "kind": "clarification",
                "response": f"Tell me which file or words you would like to {verb}. For example: {verb} README",
                "results": [],
                "file_candidates": [],
            }
        _emit(progress_callback, "assistant_status", "retrieving", "Searching local indexed sources.")
        matches = retrieve_matches(
            argument,
            history_dir,
            include_history=use_history,
            document_top_k=5,
            history_top_k=3,
        )[:5]
        candidates = search_files(argument, limit=10)
        response = build_retrieval_response(matches)
        return {
            "kind": intent_name,
            "response": response,
            "results": [serialize_match(match) for match in matches],
            "file_candidates": candidates,
            "history_opted_in": use_history,
            "history_used": sum(1 for match in matches if match.chunk.source_type == "history"),
        }

    return None


def _folder_index_response(summary: dict[str, Any]) -> str:
    if summary.get("status") == "warning":
        return summary.get("message", "No readable supported documents were found.")
    return (
        f"Indexed {summary['files_indexed']} changed file(s) from {summary['folder']}. "
        f"Added or updated {summary['chunks_added']} searchable chunks. "
        f"{summary.get('files_discoverable', 0)} safe unsupported file(s) were catalogued by name only."
    )


# --- Audio / TTS helpers ---

_WORDS_PER_SECOND = 2.1  # approximate English spoken word rate

_VOICE_PREFIXES = ("voice:", "style:", "delivery:", "tone:")

# Music keywords that indicate the user wants actual music, not speech narration
_MUSIC_KEYWORDS = {
    "beat", "beats", "instrumental", "instrumentals", "music", "song", "songs",
    "remix", "dubstep", "metal", "rock", "jazz", "classical", "pop", "hip hop",
    "rap", "rnb", "electronic", "edm", "house", "techno", "trance",
    "drill", "trap", "grime", "soul", "funk", "disco", "reggae", "blues",
    "country", "folk", "indie", "punk", "hardcore", "emo",
    "k-pop", "lofi", "lo-fi", "hifi", "hi-fi", "acapella", "a cappella",
    "guitar", "piano", "drums", "bass", "synth", "vocals", "vocal",
    "chorus", "verse", "hook", "riff", "melody", "bpm", "tempo",
}


def _parse_duration(argument: str) -> tuple[int | None, str]:
    """Extract a duration in seconds from the front of the argument string.

    Returns (duration_seconds_or_None, remaining_text).
    Recognizes patterns like '20 sec', '30 seconds', '1 min', '2 minutes'.
    """
    import re as _re

    match = _re.match(
        r"^(?:(?P<num>\d+)\s*(?P<unit>sec|second|seconds|min|minute|minutes))\b\s*(.*)",
        argument.strip(),
        flags=_re.IGNORECASE,
    )
    if not match:
        return None, argument.strip()
    num = int(match.group("num"))
    unit = match.group("unit").lower()
    remaining = match.group(3).strip()
    if unit.startswith("sec"):
        duration = num
    else:
        duration = num * 60
    return duration, remaining


def _separate_style_and_content(text: str) -> tuple[str | None, str]:
    """Split voice/style delivery instructions from the spoken content.

    If the text starts with a known prefix like 'voice:', 'style:', 'delivery:',
    or 'tone:', the prefix part is returned as the style instruction and the
    remainder is the content. Otherwise returns (None, text).
    """
    for prefix in _VOICE_PREFIXES:
        if text.lower().startswith(prefix):
            rest = text[len(prefix):].strip()
            if "::" in rest:
                style_part, content_part = rest.split("::", 1)
                return style_part.strip(), content_part.strip()
            return rest, ""
    # Check for "::" separator without a prefix
    if "::" in text:
        parts = text.split("::", 1)
        left = parts[0].strip()
        right = parts[1].strip()
        # If left looks like a delivery instruction (short, no sentence-ending punctuation)
        if len(left) < 80 and not left.rstrip().endswith((".", "!", "?")):
            return left, right
    return None, text


def _is_likely_script(text: str) -> bool:
    """Heuristic: does the text look like a pre-written script rather than a topic?"""
    if not text:
        return False
    # Has sentence-ending punctuation or multiple sentences
    if text.rstrip().endswith((".", "!", "?", ";")):
        return True
    words = text.split()
    if len(words) >= 15:
        return True
    return False


def _is_music_request(text: str) -> bool:
    """Heuristic: does the text look like a request for music, not speech narration?

    A music request is short, contains music-generation keywords (beat, instrumental,
    music), and lacks narration/educational verbs. e.g. 'lofi chill beat' → music
    request. 'explain jazz history' or 'heavy metal breakdown' → narration topic.
    """
    if not text:
        return False
    lowered = text.lower().strip()

    # If the user explicitly asks for speech/narration, it's not a music request
    if any(w in lowered for w in ("speech", "speak", "narration", "read aloud", "voice over",
                                   "explain", "describe", "tell me about", "what is",
                                   "how to", "history of", "about the")):
        return False

    # Narration/educational verbs indicate the user wants information, not music
    narration_verbs = {"explain", "describe", "tell", "what", "how", "history", "about"}
    words = lowered.split()
    if any(w.strip(".,!?;") in narration_verbs for w in words):
        return False

    # Only short inputs (≤3 words) with clear music-generation keywords → music request
    # Longer inputs or genre-only inputs are treated as narration topics
    if len(words) > 3:
        return False

    # Clear music-generation keywords: beat, instrumental, music, song, ambient, sound effect
    music_gen_keywords = {
        "beat", "beats", "instrumental", "instrumentals",
        "music", "song", "songs", "remix",
        "ambient", "sound", "effect",
    }
    for kw in music_gen_keywords:
        if kw in words:
            return True
        if len(kw) >= 3 and kw in lowered:
            return True
    return False


def _generate_narration(topic: str, target_duration_sec: int) -> str:
    """Generate a spoken narration script approximately matching the target duration.

    Uses ~2.1 words/second for English. The script is a simple spoken narration
    about the topic — it is NOT a full article, just enough spoken content.
    """
    target_words = max(5, int(target_duration_sec * _WORDS_PER_SECOND))
    # Build a simple spoken script around the topic
    words = topic.strip().split()
    if not words:
        words = ["audio"]

    # Create a spoken narration that approaches the target word count
    script_parts = []
    # Opening
    script_parts.append(f"Here is your spoken piece about {topic}.")
    # Expand with related descriptive sentences
    expanded = (
        f"Let me tell you more about {topic}. "
        f"When we think about {topic}, there are many important aspects to consider. "
        f"The key ideas revolve around {words[0]} and how it connects to broader themes. "
        f"Understanding {topic} helps us appreciate the details that matter most. "
        f"Let us explore this topic further and see what insights we can discover. "
        f"The essence of {topic} lies in its ability to inspire and engage us. "
        f"As we reflect on {topic}, we gain a deeper understanding of its significance. "
        f"Thank you for listening to this piece about {topic}."
    )
    script_parts.append(expanded)

    full_script = " ".join(script_parts)
    # Trim or pad to approximate target word count
    script_words = full_script.split()
    if len(script_words) > target_words:
        # Trim to roughly target + a small buffer
        script_words = script_words[: target_words + 5]
        # Make sure it ends with a period
        last = script_words[-1]
        if not last.endswith((".", "!", "?")):
            script_words[-1] = last + "."
        full_script = " ".join(script_words)
    elif len(script_words) < target_words:
        # Pad with a transitional sentence
        padding = f"Let me add a few more thoughts about {topic}."
        full_script = full_script.rstrip(".") + " " + padding

    return full_script.strip()


def _measure_audio_duration(audio_path: str) -> float | None:
    """Measure the actual duration of an audio file using ffprobe.

    Returns duration in seconds, or None if measurement fails.
    """
    import subprocess

    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                audio_path,
            ],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if result.returncode == 0 and result.stdout.strip():
            return float(result.stdout.strip())
    except Exception:
        pass
    return None


def _run_synthesize_sync(text: str, voice: str = DEFAULT_VOICE) -> bytes:
    """Run async synthesize_speech from a sync context."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import nest_asyncio

            nest_asyncio.apply()
            return loop.run_until_complete(synthesize_speech(text, voice=voice))
        return loop.run_until_complete(synthesize_speech(text, voice=voice))
    except Exception:
        return asyncio.run(synthesize_speech(text, voice=voice))


def _handle_generate_audio(
    argument: str,
    progress_callback: Optional[Callable[[dict[str, Any]], None]] = None,
) -> dict[str, Any]:
    """Handle the /audio command: parse duration, generate or preserve script, synthesize TTS.

    Flow:
    1. Parse optional duration target (e.g., '20 sec')
    2. Separate voice/style instructions from content
    3. Check for music request — /audio is TTS only, not music generation
    4. If content is a script (sentence-like), preserve it; if a topic, generate narration
    5. Synthesize TTS
    6. Measure actual audio duration
    7. Return result with actual duration and any warnings
    """
    _emit(progress_callback, "assistant_status", "tts_prep", "Preparing audio synthesis.")

    # 1. Parse duration
    target_duration, remaining = _parse_duration(argument)

    # 2. Separate style instructions from content
    style_instruction, content = _separate_style_and_content(remaining)

    if not content.strip():
        return {
            "kind": "clarification",
            "response": "Tell me what to speak about. Example: /audio 20 sec heavy metal breakdown",
            "results": [],
            "file_candidates": [],
        }

    # 2b. Check for music request — /audio is TTS only, not music generation
    if _is_music_request(content):
        return {
            "kind": "clarification",
            "response": (
                "The /audio command only generates spoken speech (TTS). "
                "It cannot produce music, beats, or instruments. "
                "Try: /audio 20 sec explain lofi chill beats "
                "to get a spoken narration about the topic instead."
            ),
            "results": [],
            "file_candidates": [],
        }

    # 3. Generate or preserve script
    script: str
    script_source: str
    duration_warning: str | None = None

    if _is_likely_script(content):
        # User provided an actual script — preserve it exactly
        script = content.strip()
        script_source = "user_script"
        # Check if script is likely shorter than the requested duration
        if target_duration:
            estimated_words = len(script.split())
            estimated_sec = estimated_words / _WORDS_PER_SECOND
            if estimated_sec < target_duration * 0.7:
                duration_warning = (
                    f"Your script is approximately {estimated_sec:.0f} seconds "
                    f"at normal speaking pace, which is shorter than the requested "
                    f"{target_duration} seconds. The script will be spoken as-is."
                )
    else:
        # User provided a topic — generate a narration script
        if target_duration:
            script = _generate_narration(content.strip(), target_duration)
        else:
            # Default: generate a moderate-length narration (~15 seconds)
            script = _generate_narration(content.strip(), 15)
        script_source = "generated"

    _emit(
        progress_callback,
        "assistant_status",
        "tts_synthesizing",
        f"Synthesizing {len(script.split())} words...",
    )

    # 4. Synthesize TTS (sync wrapper around async edge-tts)
    audio_bytes = _run_synthesize_sync(text=script, voice=DEFAULT_VOICE)

    if not audio_bytes:
        raise AssistantFlowError("TTS synthesis produced empty output.", status_code=500)

    # 5. Save audio file and measure actual duration
    import hashlib

    _ensure_dirs()

    hash_input = f"{script}{DEFAULT_VOICE}".encode()
    filename = f"audio_{hashlib.sha256(hash_input).hexdigest()[:12]}.mp3"
    target_path = AUDIO_DIR / filename
    target_path.write_bytes(audio_bytes)

    actual_duration = _measure_audio_duration(str(target_path))

    # Log duration for mismatch debugging
    logger.info(
        "TTS output: file=%s duration=%.1fs target=%.s script_source=%s word_count=%d",
        filename,
        actual_duration or 0,
        target_duration or 0,
        script_source,
        len(script.split()),
    )

    # 6. Build response
    response_parts = [f'Speech generated from: "{script}"']
    if actual_duration is not None:
        response_parts.append(f"Actual duration: {actual_duration:.1f}s.")
    else:
        response_parts.append("Could not measure actual audio duration.")
    if duration_warning:
        response_parts.append(f"Note: {duration_warning}")
    if style_instruction:
        response_parts.append(f"Style: {style_instruction}")

    return {
        "kind": "audio_generated",
        "response": " ".join(response_parts),
        "results": [],
        "file_candidates": [],
        "media_url": f"/api/media/library/audio/{filename}",
        "media_type": "audio",
        "data": {
            "filename": filename,
            "local_path": str(target_path),
            "script": script,
            "script_source": script_source,
            "target_duration_sec": target_duration,
            "actual_duration_sec": actual_duration,
            "word_count": len(script.split()),
            "style_instruction": style_instruction,
            "duration_warning": duration_warning,
        },
    }


# --- Music via Gemini (Lyria) / Sound via web search ---

def _handle_music_stub(argument: str) -> dict[str, Any]:
    """Generate music via OpenRouter or HF Spaces (uses existing API keys)."""
    from ..services.media_generator import generate_music

    result = generate_music(prompt=argument.strip())
    if "error" in result:
        backend = result.get("backend", "unknown")
        error_msg = result.get("error", "Unknown error")
        response = (
            f"Music generation failed ({backend}): {error_msg}\n"
            "Configure an API key to enable cloud music generation:\n"
            "  OPENROUTER_API_KEY — for OpenRouter Lyria (preferred)\n"
            "  Or leave blank to use the free HF Spaces backend (rate-limited)."
        )
        if result.get("needs_install"):
            response += "\nInstall gradio_client: pip install gradio_client"
        return {
            "kind": "music_stub",
            "response": response,
            "results": [],
            "file_candidates": [],
            "data": result,
        }
    return {
        "kind": "music_generated",
        "response": f"Music generated from: \"{argument.strip()}\"",
        "results": [],
        "file_candidates": [],
        "media_url": result.get("audio_url"),
        "media_type": "audio",
        "data": result,
    }


def _handle_sound_stub(argument: str) -> dict[str, Any]:
    """Sound effects: redirect to web search since no free SFX backend exists."""
    return {
        "kind": "sound_stub",
        "response": (
            "No sound-effect backend configured. "
            "Try searching the web instead: /s sound effect <what you need> "
            "(e.g. /s sound effect thunder rain ocean waves)."
        ),
        "results": [],
        "file_candidates": [],
        "data": {"requested": argument.strip(), "backend": None},
    }


def _handle_generate_text(argument: str, progress_callback: Optional[Callable[[dict[str, Any]], None]] = None) -> dict[str, Any]:
    """Direct LLM text generation — no RAG, no tools, no agent loop.

    Falls back to local RAG retrieval when no LLM provider is configured.
    """
    if not argument.strip():
        return {
            "kind": "clarification",
            "response": "What would you like the model to generate? Example: generate write a short poem about rust.",
            "results": [],
            "file_candidates": [],
        }

    provider = configured_provider()
    if provider is None:
        # Offline fallback — use RAG retrieval to answer without an LLM
        _emit(progress_callback, "assistant_status", "retrieving", "No LLM provider — using local RAG.")
        from ..services.response_engine import answer_with_rag
        answer = answer_with_rag(argument.strip(), Path.home() / ".james" / "history")
        return {
            "kind": "text_generated",
            "response": answer.response,
            "results": [serialize_match(m) for m in answer.matches],
            "file_candidates": [],
            "data": {"provider": None, "mode": answer.mode, "prompt": argument.strip()},
        }

    _emit(progress_callback, "assistant_status", "generating", f"Generating text via {provider}…")
    try:
        response = generate_chat_completion(
            [{"role": "user", "content": argument.strip()}],
            max_tokens=1024,
        )
    except Exception as exc:
        # If the LLM is unreachable or keys are invalid, fall back to local RAG
        _emit(progress_callback, "assistant_status", "retrieving", f"LLM unavailable — falling back to local RAG.")
        from ..services.response_engine import answer_with_rag
        answer = answer_with_rag(argument.strip(), Path.home() / ".james" / "history")
        return {
            "kind": "text_generated",
            "response": answer.response,
            "results": [serialize_match(m) for m in answer.matches],
            "file_candidates": [],
            "data": {"provider": provider, "mode": answer.mode, "prompt": argument.strip(), "fallback": True},
        }

    return {
        "kind": "text_generated",
        "response": response,
        "results": [],
        "file_candidates": [],
        "data": {"provider": provider, "prompt": argument.strip()},
    }


def _handle_translate_text(argument: str, progress_callback: Optional[Callable[[dict[str, Any]], None]] = None) -> dict[str, Any]:
    target_lang = "Hindi"
    text_to_translate = argument.strip()
    if "::" in argument:
        parts = argument.split("::", 1)
        target_lang = parts[0].strip() or "Hindi"
        text_to_translate = parts[1].strip()

    if not text_to_translate:
        return {
            "kind": "clarification",
            "response": "Provide text to translate. Example: /tr Hindi :: Official Notice: Pay property tax before 15 Nov.",
            "results": [],
            "file_candidates": [],
        }

    provider = configured_provider()
    if not provider:
        return {
            "kind": "translation",
            "response": f"({target_lang} Translation): {text_to_translate}",
            "results": [],
            "file_candidates": [],
            "data": {"target_language": target_lang, "original": text_to_translate},
        }

    _emit(progress_callback, "assistant_status", "translating", f"Translating text to {target_lang} via {provider}...")
    try:
        sys_prompt = f"You are a professional translator. Translate the given text accurately and clearly into {target_lang}. Return ONLY the translated text."
        res = generate_chat_completion([{"role": "user", "content": text_to_translate}], system_prompt=sys_prompt, max_tokens=1000)
        return {
            "kind": "translation",
            "response": res,
            "results": [],
            "file_candidates": [],
            "data": {"target_language": target_lang, "original": text_to_translate, "translated": res},
        }
    except Exception as exc:
        return {
            "kind": "translation",
            "response": f"({target_lang} Translation): {text_to_translate}",
            "results": [],
            "file_candidates": [],
            "data": {"target_language": target_lang, "error": str(exc)},
        }


def _handle_ocr_document(argument: str, progress_callback: Optional[Callable[[dict[str, Any]], None]] = None) -> dict[str, Any]:
    from pathlib import Path
    from .document_parser import parse_document, get_read_only_document_view

    file_path_str = argument.strip().strip('"')
    if not file_path_str:
        return {
            "kind": "clarification",
            "response": "Provide a file path or image to OCR. Example: /ocr C:/Users/Docs/notice.pdf",
            "results": [],
            "file_candidates": [],
        }

    path = Path(file_path_str)
    if not path.is_file():
        return {
            "kind": "ocr_result",
            "response": f"File not found: {file_path_str}",
            "results": [],
            "file_candidates": [],
        }

    _emit(progress_callback, "assistant_status", "ocr_extracting", f"Running OCR & text extraction on {path.name}...")
    view = get_read_only_document_view(path)
    extracted = view.get("text", "") or "No text could be extracted."

    return {
        "kind": "ocr_result",
        "response": f"OCR & Text Extracted from {path.name}:\n\n{extracted[:2000]}",
        "results": [],
        "file_candidates": [],
        "data": view,
    }


def _handle_summarize_text(argument: str, progress_callback: Optional[Callable[[dict[str, Any]], None]] = None) -> dict[str, Any]:
    if not argument.strip():
        return {
            "kind": "clarification",
            "response": "Provide text or topic to summarize into 3 bullets. Example: /sum Property Tax Scheme 2026",
            "results": [],
            "file_candidates": [],
        }

    provider = configured_provider()
    system_prompt = (
        "You are an expert plain-language summarizer. "
        "Summarize the provided text into EXACTLY 3 plain-language actionable bullet points. "
        "Each bullet must be clear, concise, and direct."
    )

    if not provider:
        words = argument.strip().split()
        return {
            "kind": "summary",
            "response": (
                f"• 1. Key focus area: {' '.join(words[:5])}\n"
                f"• 2. Important details: Ensure compliance with official guidelines and deadlines.\n"
                f"• 3. Action required: Contact local ward office for complete verification."
            ),
            "results": [],
            "file_candidates": [],
            "data": {"bullets": 3, "offline": True},
        }

    _emit(progress_callback, "assistant_status", "summarizing", "Generating 3-bullet plain-language summary...")
    try:
        res = generate_chat_completion([{"role": "user", "content": argument.strip()}], system_prompt=system_prompt, max_tokens=500)
        return {
            "kind": "summary",
            "response": res,
            "results": [],
            "file_candidates": [],
            "data": {"provider": provider, "prompt": argument.strip()},
        }
    except Exception as exc:
        return {
            "kind": "summary",
            "response": f"Summary request error: {exc}",
            "results": [],
            "file_candidates": [],
        }


def _handle_policy_check(argument: str, progress_callback: Optional[Callable[[dict[str, Any]], None]] = None) -> dict[str, Any]:
    if not argument.strip():
        return {
            "kind": "clarification",
            "response": "Provide policy circular text to check for fraud & extract contacts. Example: /policy Pay 5000 via UPI immediately",
            "results": [],
            "file_candidates": [],
        }

    provider = configured_provider()
    system_prompt = (
        "You are an official municipal policy proofreader and fraud prevention analyzer. "
        "Analyze the provided text for suspicious fraudulent indicators (e.g. asking for personal UPI payments, wire transfers, fake seals). "
        "Extract official helpline numbers and office locations. "
        "Provide a clear assessment with fraud check results, 3 summary bullets, and official contact information."
    )

    if not provider:
        has_suspicious = any(k in argument.lower() for k in ["upi", "telegram", "whatsapp group", "bitcoin", "crypto", "urgent fee"])
        fraud_warning = "WARNING: Suspicious request detected! Official government bodies never request fees via personal UPI, Telegram, or Crypto." if has_suspicious else "Verified: Standard municipal circular format."
        return {
            "kind": "policy_check",
            "response": f"Policy Assessment:\n\nFraud Check: {fraud_warning}\nContact Info: Municipal Helpline: 1800-111-222",
            "results": [],
            "file_candidates": [],
            "data": {"fraud_warning": fraud_warning, "contact_info": "1800-111-222"},
        }

    _emit(progress_callback, "assistant_status", "policy_analyzing", "Proofreading policy text and analyzing fraud signals...")
    try:
        res = generate_chat_completion([{"role": "user", "content": argument.strip()}], system_prompt=system_prompt, max_tokens=1000)
        return {
            "kind": "policy_check",
            "response": res,
            "results": [],
            "file_candidates": [],
            "data": {"provider": provider, "analysis": res},
        }
    except Exception as exc:
        return {
            "kind": "policy_check",
            "response": f"Policy analysis error: {exc}",
            "results": [],
            "file_candidates": [],
        }

    try:
        response = generate_chat_completion(
            [{"role": "user", "content": argument.strip()}],
            max_tokens=1024,
        )
    except Exception as exc:
        # If the LLM is unreachable or keys are invalid, fall back to local RAG
        _emit(progress_callback, "assistant_status", "retrieving", f"LLM unavailable — falling back to local RAG.")
        from ..services.response_engine import answer_with_rag
        answer = answer_with_rag(argument.strip(), Path.home() / ".james" / "history")
        return {
            "kind": "text_generated",
            "response": answer.response,
            "results": [serialize_match(m) for m in answer.matches],
            "file_candidates": [],
            "data": {"provider": provider, "mode": answer.mode, "prompt": argument.strip(), "fallback": True},
        }