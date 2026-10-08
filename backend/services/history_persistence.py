"""Chat history persistence by user (hashed IP).

This module stores chat sessions per user, allowing chat history to persist
across browser sessions when the JWT token is reused.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from threading import RLock
from typing import Optional

HISTORY_VERSION = 1


@dataclass
class ChatMessage:
    role: str  # "user" or "assistant"
    content: str
    timestamp: float = field(default_factory=time.time)


@dataclass
class ChatSession:
    user_hash: str
    messages: list[ChatMessage] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)


class HistoryPersistence:
    """File-based chat history storage per user."""

    def __init__(self, storage_dir: Path):
        self._storage_dir = storage_dir
        self._storage_dir.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()

    def _get_user_file(self, user_hash: str) -> Path:
        """Get the storage file path for a user."""
        return self._storage_dir / f"chat_{user_hash[:16]}.json"

    def _load_session(self, user_hash: str) -> ChatSession:
        """Load a user's chat session from disk."""
        filepath = self._get_user_file(user_hash)
        if not filepath.exists():
            return ChatSession(user_hash=user_hash)

        try:
            with filepath.open("r", encoding="utf-8") as f:
                data = json.load(f)
                messages = [
                    ChatMessage(role=m["role"], content=m["content"], timestamp=m.get("timestamp", 0))
                    for m in data.get("messages", [])
                ]
                return ChatSession(
                    user_hash=user_hash,
                    messages=messages,
                    created_at=data.get("created_at", time.time()),
                    updated_at=data.get("updated_at", time.time()),
                )
        except (json.JSONDecodeError, KeyError, IOError):
            return ChatSession(user_hash=user_hash)

    def _save_session(self, session: ChatSession) -> None:
        """Save a user's chat session to disk."""
        filepath = self._get_user_file(session.user_hash)
        data = {
            "version": HISTORY_VERSION,
            "user_hash": session.user_hash,
            "messages": [
                {"role": m.role, "content": m.content, "timestamp": m.timestamp}
                for m in session.messages
            ],
            "created_at": session.created_at,
            "updated_at": session.updated_at,
        }
        with filepath.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def get_history(self, user_hash: str) -> list[dict]:
        """Get chat history for a user.

        Args:
            user_hash: The hashed IP identifier for the user

        Returns:
            List of message dicts with role, content, and timestamp
        """
        with self._lock:
            session = self._load_session(user_hash)
            return [
                {"role": m.role, "content": m.content, "timestamp": m.timestamp}
                for m in session.messages
            ]

    def add_message(self, user_hash: str, role: str, content: str) -> None:
        """Add a message to a user's chat history.

        Args:
            user_hash: The hashed IP identifier for the user
            role: "user" or "assistant"
            content: The message content
        """
        with self._lock:
            session = self._load_session(user_hash)
            session.messages.append(ChatMessage(role=role, content=content))
            session.updated_at = time.time()
            self._save_session(session)

    def add_conversation(self, user_hash: str, user_message: str, assistant_message: str) -> None:
        """Add a user-assistant message pair to history.

        Args:
            user_hash: The hashed IP identifier for the user
            user_message: The user's message
            assistant_message: The assistant's response
        """
        with self._lock:
            session = self._load_session(user_hash)
            session.messages.append(ChatMessage(role="user", content=user_message))
            session.messages.append(ChatMessage(role="assistant", content=assistant_message))
            session.updated_at = time.time()
            self._save_session(session)

    def clear_history(self, user_hash: str) -> None:
        """Clear all history for a user.

        Args:
            user_hash: The hashed IP identifier for the user
        """
        with self._lock:
            session = ChatSession(user_hash=user_hash)
            self._save_session(session)

    def get_history_count(self, user_hash: str) -> int:
        """Get the number of messages in a user's history.

        Args:
            user_hash: The hashed IP identifier for the user
        """
        with self._lock:
            session = self._load_session(user_hash)
            return len(session.messages)