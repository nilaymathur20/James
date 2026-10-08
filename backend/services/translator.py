"""Lightweight translation helper supporting zero-auth web translation and LLM translation."""

from __future__ import annotations

import re
import urllib.parse
import requests
from typing import Optional

LANG_MAP = {
    "hindi": "hi",
    "english": "en",
    "marathi": "mr",
    "bengali": "bn",
    "gujarati": "gu",
    "tamil": "ta",
    "telugu": "te",
    "kannada": "kn",
    "spanish": "es",
    "french": "fr",
    "german": "de",
    "punjabi": "pa",
    "urdu": "ur",
}


def translate_text(text: str, target_language: str = "Hindi") -> str:
    """Translate text using configured LLM provider or zero-auth translation fallback."""
    clean_text = text.strip()
    if not clean_text:
        return ""

    from .llm import configured_provider, generate_chat_completion

    provider = configured_provider()
    if provider:
        try:
            sys_prompt = (
                f"You are a professional multilingual translator. "
                f"Translate the following text accurately into {target_language}. "
                f"Maintain legal accuracy, clear formatting, and plain language. "
                f"Return ONLY the translated text without extra commentary."
            )
            res = generate_chat_completion(
                messages=[{"role": "user", "content": clean_text}],
                system_prompt=sys_prompt,
                max_tokens=1500,
            )
            # Clean up model meta headers if present
            cleaned = re.sub(r"^\[.*?\]:\s*", "", res.strip())
            return cleaned if cleaned else res
        except Exception:
            pass

    # Zero-auth free translation fallback
    translated = _free_google_translate(clean_text, target_language)
    return re.sub(r"^\[.*?\]:\s*", "", translated.strip())


def _free_google_translate(text: str, target_language: str) -> str:
    lang_code = LANG_MAP.get(target_language.lower().strip(), "hi")
    try:
        chunks = _chunk_text_for_translate(text, max_len=1200)
        translated_parts = []
        for chunk in chunks:
            params = {
                "client": "gtx",
                "sl": "auto",
                "tl": lang_code,
                "dt": "t",
                "q": chunk,
            }
            resp = requests.get(
                "https://translate.googleapis.com/translate_a/single",
                params=params,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
                timeout=15,
            )
            if resp.ok:
                data = resp.json()
                if isinstance(data, list) and data and isinstance(data[0], list):
                    part = "".join(item[0] for item in data[0] if item and isinstance(item, list) and item[0])
                    translated_parts.append(part.strip())
                else:
                    translated_parts.append(chunk)
            else:
                translated_parts.append(chunk)
        return "\n".join(translated_parts).strip()
    except Exception:
        return text


def _chunk_text_for_translate(text: str, max_len: int = 1000) -> list[str]:
    lines = text.splitlines()
    chunks = []
    current = []
    current_len = 0

    for line in lines:
        if current_len + len(line) > max_len:
            chunks.append("\n".join(current))
            current = [line]
            current_len = len(line)
        else:
            current.append(line)
            current_len += len(line)

    if current:
        chunks.append("\n".join(current))
    return chunks or [text]
