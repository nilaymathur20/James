"""Settings endpoints for API keys and privacy mode."""

from __future__ import annotations

import os
import re
import stat
import tempfile
from pathlib import Path
from time import monotonic

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from ..services.llm import (
    LLMError,
    configured_provider,
    key_source,
    local_llm_status,
    mask_key,
)
from ..services.privacy_config import ai_mode

BACKEND_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BACKEND_DIR / ".env"

_KEY_NAMES = {"GROQ_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY", "NEMOTRON_API_KEY"}
_VALID_MODES = {"offline", "local", "cloud"}

# Provider display metadata for the Setup screen
_PROVIDER_META = {
    "groq": {"label": "Groq", "key_env": "GROQ_API_KEY", "model_env": "GROQ_MODEL", "default_model": "llama-3.3-70b-versatile"},
    "openrouter": {"label": "OpenRouter", "key_env": "OPENROUTER_API_KEY", "model_env": "OPENROUTER_MODEL", "default_model": "google/gemini-2.5-flash"},
    "gemini": {"label": "Google Gemini", "key_env": "GEMINI_API_KEY", "model_env": "GEMINI_MODEL", "default_model": "gemini-2.5-flash"},
    "nemotron": {"label": "NVIDIA Nemotron", "key_env": "NEMOTRON_API_KEY", "model_env": "NEMOTRON_MODEL", "default_model": "nvidia/nemotron-3-ultra-550b-a55b"},
    "llama.cpp": {"label": "Local llama.cpp", "key_env": None, "model_env": "LOCAL_LLM_MODEL", "default_model": None},
}


class KeysPayload(BaseModel):
    keys: dict[str, str]


class PrivacyPayload(BaseModel):
    mode: str


class ProviderTestPayload(BaseModel):
    provider: str
    api_key: str | None = None
    model: str | None = None


router = APIRouter()


def _write_env_atomically(key: str, value: str) -> None:
    """Upsert a KEY=value pair in the .env file with atomic write + chmod 600."""
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

    new_content = "\n".join(new_lines) + "\n"

    # Atomic write: write to temp file, then rename
    tmp_fd, tmp_path = tempfile.mkstemp(dir=str(ENV_FILE.parent), prefix=".env.tmp.")
    try:
        with os.fdopen(tmp_fd, "w", encoding="utf-8") as tmp:
            tmp.write(new_content)
        os.chmod(tmp_path, 0o600)
        os.replace(tmp_path, str(ENV_FILE))
    except BaseException:
        # Clean up temp file on failure
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


def _hot_reload_key(key: str, value: str) -> None:
    """Update the running process environment so the next request uses the new key."""
    if value:
        os.environ[key] = value
    else:
        os.environ.pop(key, None)


@router.post("/settings/keys")
async def save_keys(payload: KeysPayload) -> dict[str, dict[str, str]]:
    """Save API keys to backend/.env with atomic write + chmod 600, hot-reload."""
    saved: dict[str, str] = {}
    for k, v in payload.keys.items():
        if k in _KEY_NAMES:
            stripped = v.strip()
            _write_env_atomically(k, stripped)
            _hot_reload_key(k, stripped)
            saved[k] = "saved"
    return {"saved": saved}


@router.post("/settings/privacy")
async def save_privacy(payload: PrivacyPayload) -> dict[str, str]:
    """Save privacy mode (AI_MODE) to backend/.env."""
    mode = payload.mode.strip().lower()
    if mode not in _VALID_MODES:
        raise HTTPException(status_code=400, detail=f"Invalid mode '{mode}'. Must be one of: {', '.join(_VALID_MODES)}")
    _write_env_atomically("AI_MODE", mode)
    _hot_reload_key("AI_MODE", mode)
    return {"mode": mode}


@router.get("/providers/status")
async def providers_status() -> dict[str, object]:
    """Report which providers have keys, where those keys live, and current mode."""
    mode = ai_mode()
    result: dict[str, object] = {
        "mode": mode,
        "provider": configured_provider(),
        "providers": {},
    }
    for name, meta in _PROVIDER_META.items():
        key_env = meta["key_env"]
        key = _env(key_env) if key_env else None
        result["providers"][name] = {
            "label": meta["label"],
            "configured": bool(key),
            "key_source": key_source(key_env) if key_env else ("local" if name == "llama.cpp" else "none"),
            "masked_key": mask_key(key) if key else None,
            "model": _env(meta["model_env"]) if meta["model_env"] else None,
        }
    return result


@router.post("/providers/test")
async def test_provider(payload: ProviderTestPayload) -> dict[str, object]:
    """Make a tiny real request to the named provider and return structured result.

    Never echoes the key. Returns {provider, ok, error_code, message, latency_ms}.
    """
    from ..services.llm import (
        _chat_via_gemini,
        _chat_via_groq,
        _chat_via_nemotron,
        _chat_via_openrouter,
    )

    provider = payload.provider
    api_key = (payload.api_key or "").strip()
    model = payload.model or None
    t0 = monotonic()

    # Resolve the actual key: prefer the passed key, then the env var
    key_env_map = {
        "groq": "GROQ_API_KEY",
        "openrouter": "OPENROUTER_API_KEY",
        "gemini": "GEMINI_API_KEY",
        "nemotron": "NEMOTRON_API_KEY",
    }
    resolved_key = api_key or os.getenv(key_env_map.get(provider, ""), "")

    # KEY_MISSING check
    if not resolved_key:
        return {
            "provider": provider,
            "ok": False,
            "error_code": "KEY_MISSING",
            "message": f"No API key found for {provider}. Add it to backend/.env or pass it in the request.",
            "latency_ms": round((monotonic() - t0) * 1000, 1),
            "key_source": key_source(key_env_map.get(provider, "")),
        }

    # KEY_FORMAT_INVALID check — basic prefix/length validation
    if provider == "groq" and not resolved_key.startswith("gsk_"):
        return {
            "provider": provider,
            "ok": False,
            "error_code": "KEY_FORMAT_INVALID",
            "message": "Groq keys start with 'gsk_'. Check your key format.",
            "latency_ms": round((monotonic() - t0) * 1000, 1),
            "key_source": key_source(key_env_map.get(provider, "")),
        }
    if provider == "openrouter" and not resolved_key.startswith("sk-or-v1-"):
        return {
            "provider": provider,
            "ok": False,
            "error_code": "KEY_FORMAT_INVALID",
            "message": "OpenRouter keys start with 'sk-or-v1-'. Check your key format.",
            "latency_ms": round((monotonic() - t0) * 1000, 1),
            "key_source": key_source(key_env_map.get(provider, "")),
        }
    if provider == "gemini" and not resolved_key.startswith("AIza"):
        return {
            "provider": provider,
            "ok": False,
            "error_code": "KEY_FORMAT_INVALID",
            "message": "Gemini keys start with 'AIza'. Check your key format.",
            "latency_ms": round((monotonic() - t0) * 1000, 1),
            "key_source": key_source(key_env_map.get(provider, "")),
        }
    if provider == "nemotron" and not resolved_key.startswith("nvapi_"):
        return {
            "provider": provider,
            "ok": False,
            "error_code": "KEY_FORMAT_INVALID",
            "message": "Nemotron/NVIDIA keys start with 'nvapi_'. Check your key format.",
            "latency_ms": round((monotonic() - t0) * 1000, 1),
            "key_source": key_source(key_env_map.get(provider, "")),
        }
    if len(resolved_key) < 10:
        return {
            "provider": provider,
            "ok": False,
            "error_code": "KEY_FORMAT_INVALID",
            "message": "API key looks too short. Paste the full key.",
            "latency_ms": round((monotonic() - t0) * 1000, 1),
            "key_source": key_source(key_env_map.get(provider, "")),
        }

    # MODE_MISMATCH check
    current_mode = ai_mode()
    if provider in ("groq", "openrouter", "gemini", "nemotron") and current_mode == "offline":
        return {
            "provider": provider,
            "ok": False,
            "error_code": "MODE_MISMATCH",
            "message": f"{provider} requires AI_MODE=cloud. Switch to cloud mode first.",
            "latency_ms": round((monotonic() - t0) * 1000, 1),
            "switch_command": "settings/privacy",
        }

    if provider not in _PROVIDER_META:
        return {
            "provider": provider,
            "ok": False,
            "error_code": "KEY_FORMAT_INVALID",
            "message": f"Unknown provider '{provider}'.",
            "latency_ms": round((monotonic() - t0) * 1000, 1),
        }

    meta = _PROVIDER_META[provider]
    test_model = model or meta.get("default_model") or ""

    # Minimal test payload
    test_messages = [{"role": "user", "content": "hi"}]
    test_sys = "You are a test assistant."

    try:
        if provider == "groq":
            _chat_via_groq(test_messages, test_sys, max_tokens=1)
        elif provider == "openrouter":
            _chat_via_openrouter(test_messages, test_sys, max_tokens=1)
        elif provider == "gemini":
            _chat_via_gemini(test_messages, test_sys, max_tokens=1)
        elif provider == "nemotron":
            _chat_via_nemotron(test_messages, test_sys, max_tokens=1)
        else:
            return {
                "provider": provider,
                "ok": False,
                "error_code": "KEY_FORMAT_INVALID",
                "message": f"Provider '{provider}' does not support test.",
                "latency_ms": round((monotonic() - t0) * 1000, 1),
            }
    except LLMError as exc:
        from ..services.llm import classify_provider_error
        import requests as _req

        # Extract retry-after from the response if available
        _retry_after = None
        try:
            _resp = getattr(exc, "_response", None)
            if _resp is not None:
                _retry_after = int(_resp.headers.get("retry-after", 0)) or None
        except (ValueError, TypeError):
            pass

        err = classify_provider_error(
            _resp, meta["label"],
            timeout_occurred=exc.status_code == 504,
            connection_error=exc.status_code == 502,
            status_code=exc.status_code,
            retry_after=_retry_after,
        )
        return {
            "provider": provider,
            "ok": False,
            "error_code": err.code,
            "message": err.message,
            "latency_ms": round((monotonic() - t0) * 1000, 1),
            "retry_after": err.retry_after,
        }
    except _req.Timeout:
        from ..services.llm import classify_provider_error
        err = classify_provider_error(None, meta["label"], timeout_occurred=True)
        return {
            "provider": provider,
            "ok": False,
            "error_code": err.code,
            "message": err.message,
            "latency_ms": round((monotonic() - t0) * 1000, 1),
        }
    except _req.RequestException as exc:
        from ..services.llm import classify_provider_error
        err = classify_provider_error(None, meta["label"], connection_error=True)
        return {
            "provider": provider,
            "ok": False,
            "error_code": err.code,
            "message": err.message,
            "latency_ms": round((monotonic() - t0) * 1000, 1),
        }

    latency = (monotonic() - t0) * 1000
    return {
        "provider": provider,
        "ok": True,
        "error_code": None,
        "message": f"{meta['label']} connected successfully.",
        "latency_ms": round(latency, 1),
    }


def _env(name: str) -> str:
    return os.getenv(name, "").strip()