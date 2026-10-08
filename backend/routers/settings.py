"""Settings endpoints for API keys and privacy mode."""

from __future__ import annotations

import os
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

BACKEND_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BACKEND_DIR / ".env"

_KEY_NAMES = {"GROQ_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY"}
_VALID_MODES = {"offline", "local", "cloud"}


class KeysPayload(BaseModel):
    keys: dict[str, str]


class PrivacyPayload(BaseModel):
    mode: str


router = APIRouter()


def _write_env(key: str, value: str) -> None:
    """Upsert a KEY=value pair in the .env file.

    If the key already exists, its value is replaced. Otherwise the pair is
    appended. Blank values are treated as removals (the line is deleted).
    """
    lines: list[str] = []
    if ENV_FILE.is_file():
        lines = ENV_FILE.read_text(encoding="utf-8").splitlines()

    pattern = re.compile(rf"^{re.escape(key)}=")
    new_lines: list[str] = []
    replaced = False
    for line in lines:
        if pattern.match(line):
            if value:
                new_lines.append(f"{key}={value}")
            replaced = True
        else:
            new_lines.append(line)

    if value and not replaced:
        new_lines.append(f"{key}={value}")

    ENV_FILE.write_text("\n".join(new_lines) + "\n", encoding="utf-8")


@router.post("/settings/keys")
async def save_keys(payload: KeysPayload) -> dict[str, dict[str, str]]:
    """Save API keys to backend/.env. Only known key names are accepted."""
    saved: dict[str, str] = {}
    for k, v in payload.keys.items():
        if k in _KEY_NAMES:
            _write_env(k, v.strip())
            os.environ[k] = v.strip()
            saved[k] = "saved"
    return {"saved": saved}


@router.post("/settings/privacy")
async def save_privacy(payload: PrivacyPayload) -> dict[str, str]:
    """Save privacy mode (AI_MODE) to backend/.env."""
    mode = payload.mode.strip().lower()
    if mode not in _VALID_MODES:
        raise HTTPException(status_code=400, detail=f"Invalid mode '{mode}'. Must be one of: {', '.join(_VALID_MODES)}")
    _write_env("AI_MODE", mode)
    os.environ["AI_MODE"] = mode
    return {"mode": mode}