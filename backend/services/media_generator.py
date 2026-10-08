"""Unified Media Generation via Pollinations.ai.

Generates images, audio, and video using Pollinations.ai free zero-auth endpoints.
All generated media is cached locally in ~/.james/generated_media/.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import subprocess
import tempfile
import urllib.parse
from pathlib import Path
from typing import Any, Optional

import requests
from .tts_engine import synthesize_speech

logger = logging.getLogger(__name__)

OUTPUT_DIR = Path.home() / ".james" / "generated_media"
IMAGE_DIR = OUTPUT_DIR / "images"
AUDIO_DIR = OUTPUT_DIR / "audio"
VIDEO_DIR = OUTPUT_DIR / "videos"


def _ensure_dirs() -> None:
    """Ensure all media directories exist."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)


def _fetch_pollinations_image(
    prompt: str,
    width: int = 1024,
    height: int = 1024,
    model: str = "flux",
    seed: Optional[int] = None,
    init_image: Optional[str] = None,
) -> tuple[Optional[bytes], str]:
    """Fetch an image from Pollinations with automatic fallback across models."""
    candidate_models = [model, "flux", "flux-realism", "turbo", "sana"]
    # Deduplicate while preserving order
    seen = set()
    models_to_try = []
    for m in candidate_models:
        if m and m not in seen:
            seen.add(m)
            models_to_try.append(m)

    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    }

    last_error = ""
    for try_model in models_to_try:
        try:
            encoded_prompt = urllib.parse.quote(prompt)
            params = {
                "width": min(2048, max(256, width)),
                "height": min(2048, max(256, height)),
                "model": try_model,
                "nologo": "true",
            }
            if seed is not None:
                params["seed"] = str(seed)
            if init_image:
                params["image"] = init_image

            query_string = urllib.parse.urlencode(params)
            url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?{query_string}"

            response = requests.get(url, headers=headers, timeout=45)
            if response.ok and "image" in response.headers.get("content-type", "") and len(response.content) > 1000:
                return response.content, try_model
            else:
                last_error = f"Model {try_model} returned {response.status_code}"
        except Exception as exc:
            last_error = f"Model {try_model} request failed: {exc}"

    return None, last_error


def generate_image(
    prompt: str,
    width: int = 1024,
    height: int = 1024,
    model: str = "flux",
    seed: Optional[int] = None,
    init_image: Optional[str] = None,
) -> dict[str, Any]:
    """Generate an image from a text prompt via Pollinations.ai."""
    _ensure_dirs()

    clean_prompt = prompt.strip()
    if not clean_prompt:
        return {"error": "Prompt cannot be empty."}

    enhanced_prompt = f"{clean_prompt}, high quality, detailed, 4k, professional"
    local_path_str: Optional[str] = None

    try:
        hash_input = f"{clean_prompt}{width}x{height}{model}{init_image or ''}".encode()
        filename = f"gen_{hashlib.sha256(hash_input).hexdigest()[:12]}_{width}x{height}.jpg"
        target_path = IMAGE_DIR / filename

        if not target_path.exists():
            image_bytes, used_model = _fetch_pollinations_image(
                prompt=enhanced_prompt,
                width=width,
                height=height,
                model=model,
                seed=seed,
                init_image=init_image,
            )
            if image_bytes:
                target_path.write_bytes(image_bytes)
                local_path_str = str(target_path)
            else:
                return {"error": f"Failed to generate image: {used_model}"}
        else:
            local_path_str = str(target_path)
    except Exception as exc:
        logger.warning(f"Could not cache generated image locally: {exc}")
        return {"error": str(exc)}

    return {
        "prompt": clean_prompt,
        "image_url": f"/api/media/library/image/{Path(local_path_str).name if local_path_str else filename}",
        "local_path": local_path_str,
        "filename": Path(local_path_str).name if local_path_str else filename,
        "model": model,
        "dimensions": f"{width}x{height}",
        "type": "image",
        "is_edit": init_image is not None,
        "success": True,
    }


def generate_audio(
    prompt: str,
    model: str = "audio",
) -> dict[str, Any]:
    """Generate audio from a text prompt using edge-tts or neural synthesis."""
    _ensure_dirs()

    clean_prompt = prompt.strip()
    if not clean_prompt:
        return {"error": "Prompt cannot be empty."}

    local_path_str: Optional[str] = None
    hash_input = f"{clean_prompt}{model}".encode()
    filename = f"audio_{hashlib.sha256(hash_input).hexdigest()[:12]}.mp3"
    target_path = AUDIO_DIR / filename

    try:
        if not target_path.exists():
            # Generate speech / audio with edge-tts
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    import nest_asyncio
                    nest_asyncio.apply()
                    audio_bytes = loop.run_until_complete(synthesize_speech(clean_prompt))
                else:
                    audio_bytes = loop.run_until_complete(synthesize_speech(clean_prompt))
            except Exception:
                audio_bytes = asyncio.run(synthesize_speech(clean_prompt))

            if audio_bytes and len(audio_bytes) > 0:
                target_path.write_bytes(audio_bytes)
                local_path_str = str(target_path)
            else:
                return {"error": "Audio synthesis produced empty output."}
        else:
            local_path_str = str(target_path)
    except Exception as exc:
        logger.warning(f"Could not generate or cache audio: {exc}")
        return {"error": str(exc)}

    return {
        "prompt": clean_prompt,
        "audio_url": f"/api/media/library/audio/{filename}",
        "local_path": local_path_str,
        "filename": Path(local_path_str).name if local_path_str else filename,
        "model": model,
        "type": "audio",
        "success": True,
    }


def generate_music_audio(
    prompt: str,
    model: str = "elevenlabs/music-v2",
) -> dict[str, Any]:
    """Generate music or sound effects via Pollinations.ai unified API.

    Requires POLLINATIONS_KEY in environment (sk_* secret key).
    Falls back to a clear error message if no key is configured.
    """
    import os

    api_key = os.getenv("POLLINATIONS_KEY", "").strip()
    if not api_key:
        return {
            "error": (
                "No Pollinations API key configured. "
                "Set POLLINATIONS_KEY in backend/.env (get one at enter.pollinations.ai). "
                "Without a key, /music and /sound cannot generate audio."
            ),
            "backend": "pollinations",
            "needs_key": True,
        }

    _ensure_dirs()

    clean_prompt = prompt.strip()
    if not clean_prompt:
        return {"error": "Prompt cannot be empty.", "backend": "pollinations"}

    encoded_prompt = urllib.parse.quote(clean_prompt)
    url = f"https://gen.pollinations.ai/audio/{encoded_prompt}?model={urllib.parse.quote(model)}&key={api_key}"

    try:
        resp = requests.get(url, timeout=60)
        if resp.status_code == 401:
            return {"error": "Invalid Pollinations API key. Get one at enter.pollinations.ai.", "backend": "pollinations"}
        if resp.status_code != 200:
            return {"error": f"Pollinations returned status {resp.status_code}.", "backend": "pollinations", "status": resp.status_code}
        if len(resp.content) < 1000:
            return {"error": "Pollinations returned too little data — check the prompt and model.", "backend": "pollinations"}

        audio_bytes = resp.content
        hash_input = f"{clean_prompt}{model}".encode()
        filename = f"music_{hashlib.sha256(hash_input).hexdigest()[:12]}.mp3"
        target_path = AUDIO_DIR / filename
        target_path.write_bytes(audio_bytes)

        return {
            "prompt": clean_prompt,
            "audio_url": f"/api/media/library/audio/{filename}",
            "local_path": str(target_path),
            "filename": filename,
            "model": model,
            "type": "audio",
            "backend": "pollinations",
            "success": True,
        }
    except requests.RequestException as exc:
        logger.warning(f"Pollinations audio request failed: {exc}")
        return {"error": f"Network error: {exc}", "backend": "pollinations"}
    except Exception as exc:
        logger.warning(f"Could not generate music audio: {exc}")
        return {"error": str(exc), "backend": "pollinations"}


def generate_music_openrouter(
    prompt: str,
    model: str = "google/lyria-3-clip-preview",
) -> dict[str, Any]:
    """Generate music via OpenRouter Lyria — uses your existing OPENROUTER_API_KEY.

    No extra API key needed if OPENROUTER_API_KEY is already configured.
    Generates 30-second clips (lyria-3-clip) or full songs (lyria-3-pro).
    """
    import os
    import json as _json
    import base64 as _b64

    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        return {
            "error": "No OPENROUTER_API_KEY configured. Add it to backend/.env to use /music.",
            "backend": "openrouter",
            "needs_key": True,
        }

    _ensure_dirs()

    clean_prompt = prompt.strip()
    if not clean_prompt:
        return {"error": "Prompt cannot be empty.", "backend": "openrouter"}

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://127.0.0.1:8000",
        "X-OpenRouter-Title": "James Assistant",
    }
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": clean_prompt}],
        "modalities": ["text", "audio"],
        "audio": {"format": "mp3"},
        "stream": True,
        "max_tokens": 4096,
    }

    audio_chunks = []
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=180, stream=True)
        if resp.status_code == 401:
            return {"error": "Invalid OPENROUTER_API_KEY. Check your key in backend/.env.", "backend": "openrouter"}
        if resp.status_code != 200:
            return {
                "error": f"OpenRouter returned status {resp.status_code}: {resp.text[:200]}",
                "backend": "openrouter",
                "status": resp.status_code,
            }

        # Parse SSE stream for audio chunks
        for line in resp.iter_lines(decode_unicode=True):
            if not line or not line.startswith("data: "):
                continue
            data = line[len("data: "):]
            if data == "[DONE]":
                break
            try:
                chunk = _json.loads(data)
            except _json.JSONDecodeError:
                continue
            # Navigate SSE → choices → delta → audio
            try:
                delta = chunk["choices"][0]["delta"]
                if "audio" in delta and "data" in delta["audio"]:
                    audio_chunks.append(delta["audio"]["data"])
            except (KeyError, IndexError, TypeError):
                continue

        if not audio_chunks:
            return {
                "error": "No audio received from OpenRouter. Try a different prompt or model.",
                "backend": "openrouter",
            }

        audio_bytes = _b64.b64decode("".join(audio_chunks))
        if len(audio_bytes) < 1000:
            return {"error": "OpenRouter returned too little audio data.", "backend": "openrouter"}

        hash_input = f"{clean_prompt}{model}".encode()
        filename = f"music_{hashlib.sha256(hash_input).hexdigest()[:12]}.mp3"
        target_path = AUDIO_DIR / filename
        target_path.write_bytes(audio_bytes)

        return {
            "prompt": clean_prompt,
            "audio_url": f"/api/media/library/audio/{filename}",
            "local_path": str(target_path),
            "filename": filename,
            "model": model,
            "type": "audio",
            "backend": "openrouter",
            "success": True,
        }
    except requests.RequestException as exc:
        logger.warning(f"OpenRouter music request failed: {exc}")
        return {"error": f"Network error: {exc}", "backend": "openrouter"}
    except Exception as exc:
        logger.warning(f"Could not generate music via OpenRouter: {exc}")
        return {"error": str(exc), "backend": "openrouter"}


def generate_music_unlimited(
    prompt: str,
    model: str = "stereo-medium",
    duration: int = 30,
) -> dict[str, Any]:
    """Generate music via Surn/UnlimitedMusicGen on Hugging Face Spaces.

    Free, no API key needed. Uses the Gradio client for reliable API access
    (Gradio 5.x spaces no longer support the old /api/predict_simple HTTP endpoint).
    """
    try:
        from gradio_client import Client
    except ImportError:
        return {
            "error": (
                "gradio_client is not installed. "
                "Run: pip install gradio_client"
            ),
            "backend": "hf-spaces",
            "needs_install": True,
        }

    _ensure_dirs()

    clean_prompt = prompt.strip()
    if not clean_prompt:
        return {"error": "Prompt cannot be empty.", "backend": "hf-spaces"}

    try:
        client = Client("Surn/UnlimitedMusicGen")
        result = client.predict(
            model=model,
            text=clean_prompt,
            duration=min(60, max(1, duration)),
            topk=250,
            topp=0,
            temperature=0.8,
            cfg_coef=4.0,
            seed=-1,
            overlap=2,
            video_orientation="Landscape",
            api_name="/predict_simple",
        )
        # result is a tuple: (audio_url, title, subtitle)
        if not result or not result[0]:
            return {
                "error": "HF Spaces generated no audio. Try a different prompt.",
                "backend": "hf-spaces",
            }

        audio_url = result[0]
        # Download the audio file
        audio_resp = requests.get(audio_url, timeout=60)
        if audio_resp.status_code != 200:
            return {
                "error": f"Could not download audio from HF Spaces: {audio_url}",
                "backend": "hf-spaces",
            }

        audio_bytes = audio_resp.content
        if len(audio_bytes) < 1000:
            return {
                "error": "HF Spaces returned too little audio data.",
                "backend": "hf-spaces",
            }

        hash_input = f"{clean_prompt}{model}{duration}".encode()
        filename = f"music_{hashlib.sha256(hash_input).hexdigest()[:12]}.mp3"
        target_path = AUDIO_DIR / filename
        target_path.write_bytes(audio_bytes)

        return {
            "prompt": clean_prompt,
            "audio_url": f"/api/media/library/audio/{filename}",
            "local_path": str(target_path),
            "filename": filename,
            "model": model,
            "type": "audio",
            "backend": "hf-spaces",
            "success": True,
        }
    except Exception as exc:
        logger.warning(f"HF Spaces music request failed: {exc}")
        return {"error": f"HF Spaces error: {exc}", "backend": "hf-spaces"}


def generate_music_gemini(
    prompt: str,
    model: str = "lyria-3-clip-preview",
) -> dict[str, Any]:
    """Generate music via Gemini API (Lyria) — uses your existing GEMINI_API_KEY."""
    import os as _os
    import json as _json
    import base64 as _b64

    api_key = _os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return {
            "error": "No GEMINI_API_KEY configured. Add it to backend/.env to use /music with Gemini.",
            "backend": "gemini",
            "needs_key": True,
        }

    _ensure_dirs()

    clean_prompt = prompt.strip()
    if not clean_prompt:
        return {"error": "Prompt cannot be empty.", "backend": "gemini"}

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": clean_prompt}]}],
        "generationConfig": {"responseModalities": ["AUDIO"]},
    }

    try:
        resp = requests.post(url, json=payload, timeout=120)
        if resp.status_code == 401:
            return {"error": "Invalid GEMINI_API_KEY. Check your key in backend/.env.", "backend": "gemini"}
        if resp.status_code != 200:
            return {
                "error": f"Gemini returned status {resp.status_code}: {resp.text[:200]}",
                "backend": "gemini",
                "status": resp.status_code,
            }

        data = resp.json()
        audio_parts = []
        for candidate in data.get("candidates", []):
            for part in candidate.get("content", {}).get("parts", []):
                if "inline_data" in part and part["inline_data"].get("mime_type", "").startswith("audio/"):
                    audio_parts.append(part["inline_data"]["data"])

        if not audio_parts:
            return {
                "error": "Gemini returned no audio data. Try a different prompt or model.",
                "backend": "gemini",
                "response_preview": _json.dumps(data, indent=2)[:500],
            }

        audio_bytes = _b64.b64decode(audio_parts[0])
        hash_input = f"{clean_prompt}{model}".encode()
        filename = f"music_{hashlib.sha256(hash_input).hexdigest()[:12]}.mp3"
        target_path = AUDIO_DIR / filename
        target_path.write_bytes(audio_bytes)

        return {
            "prompt": clean_prompt,
            "audio_url": f"/api/media/library/audio/{filename}",
            "local_path": str(target_path),
            "filename": filename,
            "model": model,
            "type": "audio",
            "backend": "gemini",
            "success": True,
        }
    except requests.RequestException as exc:
        logger.warning(f"Gemini music request failed: {exc}")
        return {"error": f"Network error: {exc}", "backend": "gemini"}
    except Exception as exc:
        logger.warning(f"Could not generate music via Gemini: {exc}")
        return {"error": str(exc), "backend": "gemini"}


def generate_music(
    prompt: str,
    backend: str = "auto",
    model: str = "google/lyria-3-clip-preview",
) -> dict[str, Any]:
    """Generate music via the configured backend (OpenRouter or HF Spaces).

    ``backend`` options: ``openrouter``, ``hf-spaces``, ``auto`` (try both).
    Falls back to the other backend if the primary has no key or fails.
    Set ``MUSIC_BACKEND`` env var to override the default (``auto``).
    """
    import os as _os

    if backend == "auto":
        backend = _os.getenv("MUSIC_BACKEND", "auto")

    if backend == "openrouter":
        result = generate_music_openrouter(prompt=prompt, model=model)
        if "error" not in result:
            return result
        # Fall through to HF Spaces
    if backend == "hf-spaces" or backend == "auto":
        result = generate_music_unlimited(prompt=prompt)
        if "error" not in result:
            return result
        # Both failed — return HF Spaces error (more informative than OpenRouter key error)
        return result
    # Explicit backend selected — return its result even if error
    if backend == "gemini":
        return generate_music_gemini(prompt=prompt, model=model)
    return result


def generate_video(
    prompt: str,
    duration: int = 5,
    width: int = 720,
    height: int = 480,
    model: str = "video",
) -> dict[str, Any]:
    """Generate video from a prompt by creating a keyframe image and rendering cinematic motion via ffmpeg."""
    _ensure_dirs()

    clean_prompt = prompt.strip()
    if not clean_prompt:
        return {"error": "Prompt cannot be empty."}

    duration = min(30, max(1, duration))
    width = min(1920, max(320, width))
    height = min(1080, max(240, height))

    local_path_str: Optional[str] = None
    hash_input = f"{clean_prompt}{duration}x{width}x{height}{model}".encode()
    filename = f"video_{hashlib.sha256(hash_input).hexdigest()[:12]}_{duration}s.mp4"
    target_path = VIDEO_DIR / filename

    try:
        if not target_path.exists():
            logger.info(f"Generating video for: {clean_prompt}")
            # Step 1: Generate visual keyframe image with robust model fallbacks
            enhanced_prompt = f"{clean_prompt}, cinematic landscape, masterpiece, 4k, hyperdetailed"
            image_bytes, used_model = _fetch_pollinations_image(
                prompt=enhanced_prompt,
                width=width,
                height=height,
                model="flux",
            )
            if not image_bytes:
                # Retry with unadorned prompt
                image_bytes, used_model = _fetch_pollinations_image(
                    prompt=clean_prompt,
                    width=width,
                    height=height,
                    model="flux",
                )

            if not image_bytes:
                return {"error": f"Failed to generate video base image: {used_model}"}

            with tempfile.TemporaryDirectory(prefix="james-video-") as tmpdir:
                tmp_img = Path(tmpdir) / "frame.jpg"
                tmp_mp4 = Path(tmpdir) / "output.mp4"
                tmp_img.write_bytes(image_bytes)

                fps = 30
                total_frames = duration * fps
                # Smooth slow cinematic zoompan
                cmd = [
                    "ffmpeg", "-y",
                    "-loop", "1",
                    "-i", str(tmp_img),
                    "-vf", f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},zoompan=z='min(zoom+0.0015,1.25)':d={total_frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}",
                    "-t", str(duration),
                    "-c:v", "libx264",
                    "-pix_fmt", "yuv420p",
                    "-movflags", "+faststart",
                    str(tmp_mp4),
                ]

                proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
                if proc.returncode != 0 or not tmp_mp4.exists():
                    logger.error(f"FFmpeg video encoding failed: {proc.stderr}")
                    return {"error": "Video rendering failed during FFmpeg encoding."}

                target_path.write_bytes(tmp_mp4.read_bytes())
                local_path_str = str(target_path)
        else:
            local_path_str = str(target_path)
            logger.info(f"Video already cached: {target_path}")
    except Exception as exc:
        logger.warning(f"Could not generate or cache video locally: {exc}")
        return {"error": str(exc)}

    return {
        "prompt": clean_prompt,
        "video_url": f"/api/media/library/video/{filename}",
        "local_path": local_path_str,
        "filename": Path(local_path_str).name if local_path_str else filename,
        "model": model,
        "duration": duration,
        "dimensions": f"{width}x{height}",
        "type": "video",
        "success": True,
    }


def list_media_library(media_type: Optional[str] = None) -> dict[str, Any]:
    """List all cached media files.

    Args:
        media_type: Filter by type - 'images', 'audio', 'videos', or None for all
    """
    _ensure_dirs()

    items: list[dict[str, Any]] = []

    # Images
    if media_type is None or media_type == "images":
        for path in sorted(IMAGE_DIR.glob("gen_*.jpg"), key=lambda p: p.stat().st_mtime, reverse=True):
            stat = path.stat()
            items.append({
                "filename": path.name,
                "type": "image",
                "local_path": str(path),
                "url": f"/api/media/library/image/{path.name}",
                "size": stat.st_size,
                "modified": stat.st_mtime,
            })

    # Audio
    if media_type is None or media_type == "audio":
        for path in sorted(AUDIO_DIR.glob("audio_*.mp3"), key=lambda p: p.stat().st_mtime, reverse=True):
            stat = path.stat()
            items.append({
                "filename": path.name,
                "type": "audio",
                "local_path": str(path),
                "url": f"/api/media/library/audio/{path.name}",
                "size": stat.st_size,
                "modified": stat.st_mtime,
            })

    # Videos
    if media_type is None or media_type == "videos":
        for path in sorted(VIDEO_DIR.glob("video_*.mp4"), key=lambda p: p.stat().st_mtime, reverse=True):
            stat = path.stat()
            items.append({
                "filename": path.name,
                "type": "video",
                "local_path": str(path),
                "url": f"/api/media/library/video/{path.name}",
                "size": stat.st_size,
                "modified": stat.st_mtime,
            })

    return {"items": items, "total": len(items)}


def get_media_file(media_type: str, filename: str) -> tuple[Path, str]:
    """Get the path and MIME type for a media file.

    Returns:
        tuple of (file_path, mime_type)
    """
    if media_type == "image":
        directory = IMAGE_DIR
        mime = "image/jpeg"
    elif media_type == "audio":
        directory = AUDIO_DIR
        mime = "audio/mpeg"
    elif media_type == "video":
        directory = VIDEO_DIR
        mime = "video/mp4"
    else:
        raise ValueError(f"Unknown media type: {media_type}")

    file_path = directory / filename
    if not file_path.exists() or not file_path.is_file():
        raise FileNotFoundError(f"Media file not found: {filename}")

    return file_path, mime


def delete_media_file(media_type: str, filename: str) -> dict[str, Any]:
    """Delete a media file."""
    try:
        file_path, _ = get_media_file(media_type, filename)
        file_path.unlink()
        return {"status": "success", "message": f"Deleted {filename}"}
    except FileNotFoundError as exc:
        return {"status": "error", "message": str(exc)}
    except OSError as exc:
        return {"status": "error", "message": f"Could not delete file: {exc}"}