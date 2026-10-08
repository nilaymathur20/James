"""Free-tier neural Text-to-Speech (TTS) engine using edge-tts.

Provides natural voice synthesis with over 50+ languages and accents,
streaming MP3 audio directly to the frontend client.
"""

from __future__ import annotations

import asyncio
import io
import logging
from typing import Any, List, Optional

logger = logging.getLogger(__name__)

DEFAULT_VOICE = "en-US-ChristopherNeural"


async def synthesize_speech(text: str, voice: str = DEFAULT_VOICE, rate: str = "+0%", volume: str = "+0%") -> bytes:
    """Synthesize text to MP3 audio bytes using edge-tts."""
    clean_text = text.strip()
    if not clean_text:
        return b""

    try:
        import edge_tts

        communicate = edge_tts.Communicate(clean_text, voice=voice, rate=rate, volume=volume)
        mp3_buffer = io.BytesIO()

        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                mp3_buffer.write(chunk["data"])

        return mp3_buffer.getvalue()
    except ImportError:
        logger.warning("edge-tts library not installed. Falling back to empty audio.")
        return b""
    except Exception as exc:
        logger.error(f"Failed to synthesize speech with voice {voice}: {exc}")
        raise RuntimeError(f"TTS synthesis error: {exc}") from exc


async def list_available_voices() -> List[dict[str, Any]]:
    """List popular supported neural voices."""
    try:
        import edge_tts
        voices = await edge_tts.list_voices()
        return [
            {
                "name": v["ShortName"],
                "gender": v["Gender"],
                "locale": v["Locale"],
                "friendly_name": v["FriendlyName"],
            }
            for v in voices
            if v["Locale"].startswith("en-") or v["Locale"].startswith("es-") or v["Locale"].startswith("fr-")
        ][:50]
    except Exception:
        return [
            {"name": "en-US-ChristopherNeural", "gender": "Male", "locale": "en-US", "friendly_name": "Christopher (US)"},
            {"name": "en-US-JennyNeural", "gender": "Female", "locale": "en-US", "friendly_name": "Jenny (US)"},
            {"name": "en-GB-RyanNeural", "gender": "Male", "locale": "en-GB", "friendly_name": "Ryan (UK)"},
            {"name": "en-GB-SoniaNeural", "gender": "Female", "locale": "en-GB", "friendly_name": "Sonia (UK)"},
        ]
