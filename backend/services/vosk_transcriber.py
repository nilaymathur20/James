"""Optional low-RAM, local Vosk speech-to-text service for push-to-talk commands."""

from __future__ import annotations

import importlib.util
import json
import os
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path
from threading import RLock
from typing import Any

MAX_AUDIO_BYTES = 15 * 1024 * 1024
SAMPLE_RATE = 16_000
ALLOWED_AUDIO_SUFFIXES = {".wav", ".webm", ".ogg", ".mp3", ".m4a", ".aac", ".flac"}


class TranscriptionError(Exception):
    def __init__(self, message: str, status_code: int = 422) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


_model: Any | None = None
_model_path: Path | None = None
_transcription_lock = RLock()


def vosk_status() -> dict[str, object]:
    configured_path = _configured_model_path()
    return {
        "provider": "vosk",
        "package_installed": importlib.util.find_spec("vosk") is not None,
        "model_configured": bool(configured_path and configured_path.is_dir()),
        "model_loaded": _model is not None,
        "keep_loaded": _keep_model_loaded(),
    }


def transcribe_audio(audio_bytes: bytes, filename: str | None = None) -> dict[str, object]:
    """Convert uploaded browser audio into a short local command transcript."""
    if not audio_bytes:
        raise TranscriptionError("No audio was uploaded.")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise TranscriptionError("Audio is too large. Keep push-to-talk recordings short.", status_code=413)

    suffix = _audio_suffix(filename)
    with _transcription_lock:
        model = _get_model()
        try:
            with tempfile.TemporaryDirectory(prefix="james-vosk-") as temporary_dir:
                temporary_path = Path(temporary_dir)
                input_path = temporary_path / f"recording{suffix}"
                wav_path = temporary_path / "recording.wav"
                input_path.write_bytes(audio_bytes)
                _convert_to_mono_wav(input_path, wav_path)
                transcript = _recognize_wav(model, wav_path)
        finally:
            # On a 4 GB PC, keeping a model unloaded while idle is safer. Set
            # VOSK_KEEP_LOADED=true later if startup latency becomes annoying.
            if not _keep_model_loaded():
                unload_model()

    if not transcript:
        raise TranscriptionError("No speech was recognized. Try a shorter, clearer command.")
    return {"text": transcript, "engine": "vosk", "offline": True}


def unload_model() -> None:
    global _model, _model_path
    with _transcription_lock:
        _model = None
        _model_path = None


def _get_model() -> Any:
    global _model, _model_path
    model_path = _configured_model_path()
    if model_path is None:
        raise TranscriptionError(
            "Vosk model is not configured. Set VOSK_MODEL_PATH to an unpacked local Vosk model directory.",
            status_code=503,
        )
    if not model_path.is_dir():
        raise TranscriptionError("The configured Vosk model folder does not exist.", status_code=503)

    if _model is not None and _model_path == model_path:
        return _model

    try:
        from vosk import Model
    except ImportError as exc:
        raise TranscriptionError("Vosk is not installed. Run: pip install vosk", status_code=501) from exc

    try:
        _model = Model(str(model_path))
        _model_path = model_path
    except Exception as exc:
        raise TranscriptionError("Could not load the configured Vosk model.", status_code=500) from exc
    return _model


def _recognize_wav(model: Any, wav_path: Path) -> str:
    try:
        from vosk import KaldiRecognizer
    except ImportError as exc:
        raise TranscriptionError("Vosk is not installed. Run: pip install vosk", status_code=501) from exc

    try:
        with wave.open(str(wav_path), "rb") as audio_file:
            if audio_file.getnchannels() != 1 or audio_file.getframerate() != SAMPLE_RATE:
                raise TranscriptionError("Audio conversion did not produce 16 kHz mono WAV audio.", status_code=500)
            recognizer = KaldiRecognizer(model, SAMPLE_RATE)
            recognized_parts: list[str] = []
            while True:
                frames = audio_file.readframes(4_000)
                if not frames:
                    break
                if recognizer.AcceptWaveform(frames):
                    recognized_parts.append(_result_text(recognizer.Result()))
            recognized_parts.append(_result_text(recognizer.FinalResult()))
    except TranscriptionError:
        raise
    except (OSError, wave.Error) as exc:
        raise TranscriptionError("The uploaded audio could not be read.", status_code=422) from exc

    return " ".join(part for part in recognized_parts if part).strip()


def _convert_to_mono_wav(input_path: Path, wav_path: Path) -> None:
    if input_path.suffix.lower() == ".wav" and _is_compatible_wav(input_path):
        shutil.copyfile(input_path, wav_path)
        return

    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        raise TranscriptionError(
            "ffmpeg is required to convert browser audio. Install it with: sudo apt install ffmpeg",
            status_code=501,
        )

    try:
        completed = subprocess.run(
            [ffmpeg, "-y", "-i", str(input_path), "-ar", str(SAMPLE_RATE), "-ac", "1", "-f", "wav", str(wav_path)],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            timeout=90,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise TranscriptionError("Audio conversion failed.", status_code=500) from exc

    if completed.returncode != 0 or not wav_path.is_file():
        raise TranscriptionError("Audio conversion failed. Use a standard browser audio recording.", status_code=422)


def _is_compatible_wav(path: Path) -> bool:
    try:
        with wave.open(str(path), "rb") as audio_file:
            return audio_file.getnchannels() == 1 and audio_file.getframerate() == SAMPLE_RATE
    except (OSError, wave.Error):
        return False


def _result_text(result_json: str) -> str:
    try:
        result = json.loads(result_json)
    except json.JSONDecodeError:
        return ""
    text = result.get("text", "")
    return text.strip() if isinstance(text, str) else ""


def _configured_model_path() -> Path | None:
    configured = os.getenv("VOSK_MODEL_PATH", "").strip()
    return Path(configured).expanduser().resolve() if configured else None


def _keep_model_loaded() -> bool:
    return os.getenv("VOSK_KEEP_LOADED", "false").strip().lower() in {"1", "true", "yes", "on"}


def _audio_suffix(filename: str | None) -> str:
    suffix = Path(filename or "recording.webm").suffix.lower()
    return suffix if suffix in ALLOWED_AUDIO_SUFFIXES else ".webm"
