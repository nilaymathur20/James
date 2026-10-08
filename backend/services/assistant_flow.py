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
TokenCallback = Callable[[str], None]


def run_assistant_request(
    payload: AssistantRequest,
    *,
    history_dir: Path,
    progress_callback: ProgressCallback | None = None,
    token_callback: TokenCallback | None = None,
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
        from .tool_registry import get_tool_registry
        agent = ReActAgent(registry=get_tool_registry())
        context = {
            "history_dir": history_dir,
            "use_history": payload.use_history,
            "source": payload.source,
        }
        import asyncio
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None
        provider_failed = False
        provider_error_msg = None
        if loop and loop.is_running():
            # We're inside an async context (e.g. WebSocket path) — run in a thread
            # to avoid nested event loop errors.
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                try:
                    agent_result = pool.submit(
                        lambda: asyncio.run(agent.run(payload.text, context=context, event_callback=progress_callback, token_callback=token_callback))
                    ).result()
                except Exception as exc:
                    provider_failed = True
                    provider_error_msg = str(exc)
        else:
            try:
                agent_result = asyncio.run(agent.run(payload.text, context=context, event_callback=progress_callback, token_callback=token_callback))
            except Exception as exc:
                provider_failed = True
                provider_error_msg = str(exc)

        # Fallback rule: provider failed → SQLite retrieval ONLY, never silently to another cloud
        if provider_failed:
            _emit(progress_callback, "assistant_status", "fallback", f"Provider {provider} failed: {provider_error_msg}. Falling back to local retrieval.")
            answer = answer_with_rag(payload.text, history_dir, use_history=payload.use_history)
            agent_result = {
                "kind": "agent_fallback",
                "response": answer.response,
                "mode": answer.mode,
                "provider": answer.provider,
                "provider_error": provider_error_msg,
                "results": [serialize_match(match) for match in answer.matches],
                "file_candidates": [],
                "history_opted_in": payload.use_history and history_feature_enabled(),
                "history_used": sum(1 for match in answer.matches if match.chunk.source_type == "history"),
                "fallback_notice": f"Provider '{provider}' failed ({provider_error_msg}). Using local SQLite retrieval only — no cloud fallback.",
            }
            _emit(progress_callback, "assistant_status", "complete", "Response is ready (fallback).", mode=answer.mode)
            return agent_result

        _emit(progress_callback, "assistant_status", "complete", "Agent processing complete.")
        return agent_result

    # 3. Default Grounded RAG (fallback — surface in metadata)
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
        "fallback_notice": "No cloud provider available — using local SQLite retrieval only.",
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