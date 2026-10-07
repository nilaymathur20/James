"""Local Whisper voice-command transcription endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile

from ..services.whisper_transcriber import (
    MAX_AUDIO_BYTES,
    TranscriptionError,
    transcribe_audio,
    unload_model,
    whisper_status,
)

router = APIRouter()


@router.get("/transcribe/status")
def transcription_status() -> dict[str, object]:
    return whisper_status()


@router.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)) -> dict[str, object]:
    """Transcribe a short microphone recording locally via whisper.cpp; no cloud call."""
    try:
        audio_bytes = await audio.read(MAX_AUDIO_BYTES + 1)
        return transcribe_audio(audio_bytes, audio.filename)
    except TranscriptionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    finally:
        await audio.close()


@router.post("/transcribe/unload")
def unload_transcription_model() -> dict[str, Any]:
    """Free whisper model memory (no-op — whisper.cpp loads per invocation)."""
    unload_model()
    return {"status": "success", "message": "Whisper model memory released.", "voice": whisper_status()}