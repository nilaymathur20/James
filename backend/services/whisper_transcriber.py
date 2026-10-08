"""Local Whisper.cpp speech-to-text for push-to-talk commands.

Uses the whisper.cpp binary (C++) via subprocess — lightweight,
runs on mobile (Termux / standalone builds), fully offline.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
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


_transcription_lock = RLock()


def whisper_status() -> dict[str, object]:
    configured_path = _configured_model_path()
    binary = _whisper_binary()
    return {
        "provider": "whisper",
        "binary_found": binary is not None,
        "model_configured": bool(configured_path and Path(configured_path).is_file()),
        "model_path": str(configured_path) if configured_path else None,
        "offline": True,
    }


def transcribe_audio(audio_bytes: bytes, filename: str | None = None) -> dict[str, object]:
    """Convert uploaded audio into a short local transcript via whisper.cpp."""
    if not audio_bytes:
        raise TranscriptionError("No audio was uploaded.")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise TranscriptionError("Audio is too large. Keep push-to-talk recordings short.", status_code=413)

    suffix = _audio_suffix(filename)
    with _transcription_lock:
        binary = _whisper_binary()
        if binary is None:
            raise TranscriptionError(
                "whisper.cpp not found. Install it from https://github.com/ggerganov/whisper.cpp",
                status_code=501,
            )
        model_path = _configured_model_path()
        if model_path is None:
            raise TranscriptionError(
                "Whisper model not configured. Set WHISPER_MODEL_PATH to a .bin model file.",
                status_code=503,
            )
        try:
            with tempfile.TemporaryDirectory(prefix="james-whisper-") as tmp:
                tmp_path = Path(tmp)
                input_path = tmp_path / f"raw_input{suffix}"
                wav_path = tmp_path / "recording.wav"
                input_path.write_bytes(audio_bytes)
                _convert_to_mono_wav(input_path, wav_path)
                transcript = _recognize_wav(binary, model_path, wav_path)
        finally:
            pass  # whisper.cpp has no persistent model to unload

    # Clean up any non-speech artifacts
    cleaned = transcript.strip()
    if cleaned in {"[BLANK_AUDIO]", "[MUSIC]", "[SOUND]", "(beep)", "[applause]"}:
        cleaned = ""

    if not cleaned:
        raise TranscriptionError("No speech was recognized. Try a shorter, clearer command.")
    return {"text": cleaned, "engine": "whisper", "offline": True}


def unload_model() -> None:
    """No-op — whisper.cpp loads the model per invocation."""


def _whisper_binary() -> Path | None:
    """Find the whisper.cpp binary."""
    binary_names = ["whisper-cli", "whisper", "main"]

    # Check environment variable first
    env_bin = os.getenv("WHISPER_BIN", "").strip()
    if env_bin:
        env_path = Path(env_bin).expanduser().resolve()
        if env_path.is_file() and os.access(str(env_path), os.X_OK):
            return env_path

    # Check common whisper.cpp build locations
    candidates = [
        Path.home() / "root" / "vendor" / "whisper.cpp" / "build" / "bin" / "whisper-cli",
        Path.home() / "whisper.cpp" / "build" / "bin" / "whisper-cli",
        Path.home() / ".local" / "bin" / "whisper-cli",
        Path("/usr/local/bin/whisper-cli"),
    ]

    for candidate in candidates:
        if candidate.is_file() and os.access(str(candidate), os.X_OK):
            return candidate
        # Also check for other whisper.cpp binary names in the same directory
        for name in binary_names:
            sibling = candidate.parent / name
            if sibling.is_file() and os.access(str(sibling), os.X_OK):
                return sibling

    # Fallback: search PATH for any known binary name
    for name in binary_names:
        found = shutil.which(name)
        if found:
            return Path(found)
    return None


def _recognize_wav(binary: Path, model_path: Path, wav_path: Path) -> str:
    """Run whisper.cpp on a WAV file and return the transcript."""
    output_prefix = wav_path.parent / f"whisper_out_{wav_path.stem}"
    try:
        result = subprocess.run(
            [
                str(binary),
                "-m", str(model_path),
                str(wav_path),
                "-of", str(output_prefix),
                "-otxt",
                "-t", "4",
                "--no-timestamps",
                "-l", "en",
            ],
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
        # Read the output text file
        txt_path = output_prefix.with_suffix('.txt')
        if txt_path.exists():
            content = txt_path.read_text().strip()
            # Clean up the output file
            try:
                txt_path.unlink()
            except Exception:
                pass
            return content
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise TranscriptionError(f"Whisper recognition failed: {exc}", status_code=500) from exc

    if result.returncode != 0:
        raise TranscriptionError(
            f"Whisper error: {result.stderr.strip() or 'unknown error'}",
            status_code=500,
        )

    # Fallback to stdout if file was not created
    return result.stdout.strip()


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
            [
                ffmpeg, "-y", "-i", str(input_path),
                "-ar", str(SAMPLE_RATE), "-ac", "1", "-f", "wav", str(wav_path),
            ],
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
        import wave
        with wave.open(str(path), "rb") as audio_file:
            return audio_file.getnchannels() == 1 and audio_file.getframerate() == SAMPLE_RATE
    except (OSError, wave.Error):
        return False


def _audio_suffix(filename: str | None) -> str:
    suffix = Path(filename or "recording.webm").suffix.lower()
    return suffix if suffix in ALLOWED_AUDIO_SUFFIXES else ".webm"


def _configured_model_path() -> Path | None:
    # Check environment variable first
    configured = os.getenv("WHISPER_MODEL_PATH", "").strip()
    if configured:
        model_path = Path(configured).expanduser().resolve()
        if model_path.is_file():
            return model_path

    # Check common whisper model locations
    candidates = [
        Path.home() / "root" / "vendor" / "whisper.cpp" / "models" / "ggml-base.en.bin",
        Path.home() / "whisper.cpp" / "models" / "ggml-base.en.bin",
        Path.home() / ".james" / "whisper" / "ggml-base.en.bin",
    ]

    for candidate in candidates:
        if candidate.is_file():
            return candidate

    return None