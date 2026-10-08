"""Small, explicit privacy switches shared by local assistant services."""

from __future__ import annotations

import os

_TRUE_VALUES = {"1", "true", "yes", "on"}
_VALID_AI_MODES = {"offline", "local", "cloud"}


def ai_mode() -> str:
    """Return the explicitly selected generation mode; default is offline."""
    value = os.getenv("AI_MODE", "offline").strip().lower()
    return value if value in _VALID_AI_MODES else "offline"


def history_feature_enabled() -> bool:
    """Allow an installation owner to disable all local chat-history handling."""
    return os.getenv("CHAT_HISTORY_ENABLED", "true").strip().lower() in _TRUE_VALUES
