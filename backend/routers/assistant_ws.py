"""Live WebSocket transport for the unified one-box assistant and ReAct agent workflow.

The socket streams status, agent thought steps, tool execution events, confirmation gates,
and token deltas using structured JSON messages.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import threading
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from pydantic import ValidationError

from ..schemas import AssistantRequest
from ..services.assistant_flow import AssistantFlowError, run_assistant_request

router = APIRouter()
logger = logging.getLogger(__name__)

_PROTOCOL = "james.assistant.v1"
MAX_SOCKET_MESSAGE_CHARS = 32_000
_REQUEST_ID_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,99}")
_LOCAL_ORIGIN_HOSTS = {"localhost", "127.0.0.1", "::1"}
_ALLOWED_STREAMING_EVENTS = {
    "assistant_status",
    "index_progress",
    "agent_thought",
    "tool_call",
    "tool_result",
    "confirmation_required",
    "token_delta",
    "error",
}


@router.websocket("/ws/assistant")
async def assistant_socket(websocket: WebSocket) -> None:
    """Serve one local live-assistant session using explicit JSON messages."""
    origin = websocket.headers.get("origin")
    if not _is_allowed_origin(origin):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    await websocket.send_json(
        {
            "type": "ready",
            "protocol": _PROTOCOL,
            "message": "Live assistant channel connected.",
        }
    )

    try:
        while True:
            try:
                raw_message = await websocket.receive_text()
            except (KeyError, RuntimeError, ValueError):
                await _send_error(websocket, None, "invalid_json", "Send a JSON object over the live assistant channel.")
                continue
            if len(raw_message) > MAX_SOCKET_MESSAGE_CHARS:
                await _send_error(
                    websocket,
                    None,
                    "message_too_large",
                    "Live assistant messages are limited to 32,000 characters.",
                    status_code=413,
                )
                continue
            try:
                incoming = json.loads(raw_message)
            except json.JSONDecodeError:
                await _send_error(websocket, None, "invalid_json", "Send a JSON object over the live assistant channel.")
                continue

            if not isinstance(incoming, dict):
                await _send_error(websocket, None, "invalid_message", "Each WebSocket message must be a JSON object.")
                continue

            message_type = incoming.get("type")
            if message_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue
            if message_type != "assistant_message":
                await _send_error(
                    websocket,
                    None,
                    "unsupported_message",
                    "Use type 'assistant_message' for one-box text, or 'ping' for a connection check.",
                )
                continue

            request_id = _request_id(incoming.get("request_id"))
            if request_id is None:
                await _send_error(
                    websocket,
                    None,
                    "invalid_request_id",
                    "request_id must contain 1-100 letters, numbers, dots, underscores, colons, or hyphens.",
                )
                continue

            try:
                request_payload = AssistantRequest(
                    text=incoming.get("text"),
                    use_history=incoming.get("use_history", True),
                    source=incoming.get("source", "typed"),
                )
            except ValidationError:
                await _send_error(
                    websocket,
                    request_id,
                    "invalid_request",
                    "text must be a non-empty message up to 20,000 characters; use_history must be a boolean.",
                )
                continue

            await websocket.send_json(
                {
                    "type": "assistant_status",
                    "request_id": request_id,
                    "phase": "accepted",
                    "message": "Request accepted by the local assistant.",
                }
            )
            await _run_request_with_progress(websocket, request_id, request_payload)
    except WebSocketDisconnect:
        return


async def _run_request_with_progress(
    websocket: WebSocket,
    request_id: str,
    payload: AssistantRequest,
) -> None:
    """Keep the event loop responsive while a synchronous RAG/agent task runs."""
    loop = asyncio.get_running_loop()
    progress_queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
    connection_active = threading.Event()
    connection_active.set()

    def report_progress(event: dict[str, Any]) -> None:
        if connection_active.is_set():
            loop.call_soon_threadsafe(progress_queue.put_nowait, event)

    history_dir = Path(getattr(websocket.app.state, "history_dir", Path.home() / ".james" / "history"))

    worker = asyncio.create_task(
        asyncio.to_thread(
            run_assistant_request,
            payload,
            history_dir=history_dir,
            progress_callback=report_progress,
        )
    )

    try:
        while not worker.done():
            try:
                event = await asyncio.wait_for(progress_queue.get(), timeout=0.15)
            except TimeoutError:
                continue
            await _send_progress(websocket, request_id, event)

        result = await worker
        while not progress_queue.empty():
            await _send_progress(websocket, request_id, progress_queue.get_nowait())
        await websocket.send_json({"type": "assistant_result", "request_id": request_id, "result": result})
    except AssistantFlowError as exc:
        await _send_error(websocket, request_id, "assistant_error", exc.message, status_code=exc.status_code)
    except WebSocketDisconnect:
        worker.cancel()
        raise
    except asyncio.CancelledError:
        worker.cancel()
        raise
    except Exception:
        logger.exception("Live assistant request failed")
        await _send_error(
            websocket,
            request_id,
            "internal_error",
            "The local assistant could not complete that request.",
            status_code=500,
        )
    finally:
        connection_active.clear()


async def _send_progress(websocket: WebSocket, request_id: str, event: dict[str, Any]) -> None:
    event_type = event.get("event_type", "assistant_status")
    if event_type not in _ALLOWED_STREAMING_EVENTS:
        event_type = "assistant_status"
    safe_event = {
        key: value
        for key, value in event.items()
        if key != "event_type" and isinstance(key, str) and key not in {"type", "request_id"}
    }
    await websocket.send_json({"type": event_type, "request_id": request_id, **safe_event})


async def _send_error(
    websocket: WebSocket,
    request_id: str | None,
    code: str,
    message: str,
    *,
    status_code: int = 400,
) -> None:
    payload: dict[str, object] = {
        "type": "error",
        "code": code,
        "message": message,
        "status_code": status_code,
    }
    if request_id is not None:
        payload["request_id"] = request_id
    await websocket.send_json(payload)


def _request_id(value: object) -> str | None:
    if value is None:
        return f"ws_{uuid.uuid4().hex}"
    if not isinstance(value, str) or not _REQUEST_ID_PATTERN.fullmatch(value):
        return None
    return value


def _is_allowed_origin(origin: str | None) -> bool:
    # Allow missing origin in development / mobile companion mode
    if origin is None:
        return os.getenv("WS_ALLOW_MISSING_ORIGIN", "true").strip().lower() in {"1", "true", "yes", "on"}

    normalized_origin = _normalize_origin(origin)
    if normalized_origin is None:
        return False

    configured_origins = {
        normalized
        for value in os.getenv("WS_ALLOWED_ORIGINS", "").split(",")
        if (normalized := _normalize_origin(value)) is not None
    }
    if configured_origins:
        return normalized_origin in configured_origins

    parsed = urlparse(normalized_origin)
    hostname = parsed.hostname.lower() if parsed.hostname else ""
    # Allow localhost, loopback, and LAN addresses for local development
    return (
        hostname in _LOCAL_ORIGIN_HOSTS
        or hostname == "localhost"
        or hostname.endswith(".local")
        or hostname.startswith("192.168.")
        or hostname.startswith("10.")
        or hostname.startswith("172.")
    )


def _normalize_origin(value: str) -> str | None:
    try:
        parsed = urlparse(value.strip())
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.path not in {"", "/"}:
            return None
        if parsed.params or parsed.query or parsed.fragment or parsed.username or parsed.password:
            return None
        port = f":{parsed.port}" if parsed.port is not None else ""
        host = parsed.hostname.lower()
    except ValueError:
        return None
    bracketed_host = f"[{host}]" if ":" in host and not host.startswith("[") else host
    return f"{parsed.scheme.lower()}://{bracketed_host}{port}"
