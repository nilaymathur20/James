"""Transport-independent one-box assistant workflow with ReAct agent routing.

HTTP and WebSocket routes call this module so intent routing, local retrieval,
agent tool orchestration, and guarded policy checks behave identically on either transport.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable, Optional

from ..schemas import AssistantRequest
from .agent_loop import ReActAgent
from .command_handler import handle_command
from .errors import AssistantFlowError
from .file_tools import search_files
from .indexer import IndexingError, index_folder_path, index_web_url
from .intent_router import command_help, detect_intent, resolve_folder_reference
from .llm import configured_provider
from .privacy_config import ai_mode, history_feature_enabled
from .response_engine import answer_with_rag
from .retrieval import build_retrieval_response, retrieve_matches, serialize_match

ProgressCallback = Callable[[dict[str, Any]], None]


def run_assistant_request(
    payload: AssistantRequest,
    *,
    history_dir: Path,
    progress_callback: ProgressCallback | None = None,
) -> dict[str, Any]:
    """Execute one typed, transcribed, or multimodal request through the unified flow."""
    intent = detect_intent(payload.text)
    _emit(progress_callback, "assistant_status", "routing", "Understanding your request.", intent=intent.name)

    # 1. Deterministic command path (no LLM needed)
    command_result = handle_command(
        intent.name,
        intent.argument,
        payload.text,
        history_dir=history_dir,
        use_history=payload.use_history,
        progress_callback=progress_callback,
    )
    if command_result is not None:
        _emit(progress_callback, "assistant_status", "complete", "Command processing complete.")
        return command_result

    # 2. Check if LLM provider is active -> Use ReAct Agent loop
    provider = configured_provider()
    if provider is not None and ai_mode() in {"local", "cloud"}:
        _emit(progress_callback, "assistant_status", "agent_start", f"Invoking James ReAct agent ({provider})…")
        agent = ReActAgent()
        context = {
            "history_dir": history_dir,
            "use_history": payload.use_history,
            "source": payload.source,
        }
        import asyncio
        loop = asyncio.new_event_loop()
        try:
            agent_result = loop.run_until_complete(agent.run(payload.text, context=context, event_callback=progress_callback))
        finally:
            loop.close()
        _emit(progress_callback, "assistant_status", "complete", "Agent processing complete.")
        return agent_result

    # 3. Default Grounded RAG
    _emit(progress_callback, "assistant_status", "answering", "Retrieving local context and preparing a response.")
    answer = answer_with_rag(payload.text, history_dir, use_history=payload.use_history)
    result = {
        "kind": "chat",
        "response": answer.response,
        "mode": answer.mode,
        "provider": answer.provider,
        "provider_error": answer.provider_error,
        "results": [serialize_match(match) for match in answer.matches],
        "file_candidates": [],
        "history_opted_in": payload.use_history and history_feature_enabled(),
        "history_used": sum(1 for match in answer.matches if match.chunk.source_type == "history"),
    }
    _emit(progress_callback, "assistant_status", "complete", "Response is ready.", mode=answer.mode)
    return result


def _emit(
    progress_callback: ProgressCallback | None,
    event_type: str,
    phase: str,
    message: str,
    **data: object,
) -> None:
    if progress_callback is None:
        return
    try:
        progress_callback({"event_type": event_type, "phase": phase, "message": message, **data})
    except Exception:
        pass