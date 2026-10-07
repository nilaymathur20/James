"""Text-to-Speech (TTS) REST router using edge-tts."""

from __future__ import annotations

import logging
from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field

from ..services.tts_engine import DEFAULT_VOICE, list_available_voices, synthesize_speech

router = APIRouter()
logger = logging.getLogger(__name__)


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000, description="Text to synthesize to speech")
    voice: str = Field(default=DEFAULT_VOICE, description="Neural voice identifier")
    rate: str = Field(default="+0%", description="Speech speed adjustment (e.g. '+10%', '-5%')")
    volume: str = Field(default="+0%", description="Speech volume adjustment")


@router.post("/tts/synthesize")
async def synthesize_speech_endpoint(payload: TTSRequest) -> Response:
    """Synthesize text into MP3 audio and stream bytes directly."""
    try:
        audio_bytes = await synthesize_speech(
            text=payload.text,
            voice=payload.voice,
            rate=payload.rate,
            volume=payload.volume,
        )
        if not audio_bytes:
            raise HTTPException(status_code=500, detail="Failed to synthesize speech audio.")
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as exc:
        logger.exception("TTS synthesis failed")
        raise HTTPException(status_code=500, detail=f"TTS synthesis error: {exc}") from exc


@router.get("/tts/voices")
async def list_voices_endpoint() -> List[dict[str, Any]]:
    """List available high-quality neural voices."""
    return await list_available_voices()
