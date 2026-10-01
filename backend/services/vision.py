"""Multimodal Vision reasoning module.

Enables image analysis, screenshot inspection, and document image OCR/Q&A
via Gemini Vision or local vision models (LLaVA / Moondream).
"""

from __future__ import annotations

import base64
import logging
import os
import re
from typing import Any, Optional

import requests

from .llm import LLMError, _env

logger = logging.getLogger(__name__)


def analyze_image_with_vision(image_data_base64: str, prompt: str = "Analyze this image and describe what you see.") -> dict[str, Any]:
    """Analyze an image using Gemini Vision API."""
    api_key = _env("GEMINI_API_KEY")
    if not api_key:
        return {
            "error": "Gemini API key is required for vision reasoning. Configure GEMINI_API_KEY in settings.",
            "response": "Vision capabilities require a Gemini API key.",
        }

    # Extract mime type and clean base64 data
    mime_type = "image/jpeg"
    clean_base64 = image_data_base64

    if "," in image_data_base64:
        header, encoded = image_data_base64.split(",", 1)
        clean_base64 = encoded
        mime_match = re.search(r"data:(image\/[a-zA-Z0-9.+_-]+);base64", header)
        if mime_match:
            mime_type = mime_match.group(1)

    model = _env("GEMINI_VISION_MODEL") or _env("GEMINI_MODEL") or "gemini-2.5-flash"
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": clean_base64,
                        }
                    },
                ]
            }
        ]
    }

    try:
        response = requests.post(endpoint, params={"key": api_key}, json=payload, timeout=(10, 90))
    except requests.Timeout as exc:
        raise LLMError("Vision model request timed out.", status_code=504) from exc
    except requests.RequestException as exc:
        raise LLMError("Could not reach vision model provider.") from exc

    if not response.ok:
        return {"error": f"Vision request failed with status {response.status_code}", "detail": response.text}

    try:
        raw_json = response.json()
        parts = raw_json["candidates"][0]["content"]["parts"]
        text_parts = [p.get("text", "") for p in parts if isinstance(p, dict)]
        answer = "".join(text_parts).strip()
        return {"response": answer, "success": True, "model": model}
    except Exception as exc:
        return {"error": f"Failed to parse vision model response: {exc}"}
