"""Shared error classes for the assistant flow."""

from __future__ import annotations


class AssistantFlowError(Exception):
    """A transport-neutral error that routers can map to their own protocol."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code