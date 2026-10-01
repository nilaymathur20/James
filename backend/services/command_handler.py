"""Deterministic command handler for the assistant flow.

Commands are handled without LLM generation — intent detection routes
known commands here before the agentic path is ever invoked.
"""

from __future__ import annotations

from typing import Any, Callable, Optional

from ..schemas import AssistantRequest
from .errors import AssistantFlowError
from .file_tools import search_files
from .indexer import IndexingError, index_folder_path, index_web_url
from .intent_router import command_help, detect_intent, resolve_folder_reference
from .retrieval import build_retrieval_response, retrieve_matches, serialize_match

ProgressCallback = Callable[[dict[str, Any]], None]


def _emit(
    progress_callback: Optional[Callable[[dict[str, Any]], None]],
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


def handle_command(
    intent_name: str,
    argument: str,
    text: str,
    *,
    history_dir: Any,
    use_history: bool,
    progress_callback: Optional[Callable[[dict[str, Any]], None]] = None,
) -> Optional[dict[str, Any]]:
    """Handle a deterministic command. Returns result dict or None if not a command."""

    # Help — always deterministic
    if intent_name == "help":
        _emit(progress_callback, "assistant_status", "complete", "Command help is ready.")
        return {
            "kind": "help",
            "response": command_help(),
            "results": [],
            "file_candidates": [],
        }

    # Folder indexing
    if intent_name == "index_folder":
        folder_reference = resolve_folder_reference(argument)
        if not folder_reference:
            return {
                "kind": "clarification",
                "response": "Tell me which folder to index. Example: index ~/Documents",
                "results": [],
                "file_candidates": [],
            }
        _emit(progress_callback, "assistant_status", "validating_folder", "Checking the requested folder policy.")
        try:
            summary = index_folder_path(folder_reference, progress_callback=progress_callback)
        except IndexingError as exc:
            raise AssistantFlowError(exc.message, status_code=exc.status_code) from exc
        return {
            "kind": "index_folder",
            "response": _folder_index_response(summary),
            "results": [],
            "file_candidates": [],
            "data": summary,
        }

    # Web indexing
    if intent_name == "index_web":
        _emit(progress_callback, "assistant_status", "validating_url", "Checking the supplied web address.")
        try:
            summary = index_web_url(argument, progress_callback=progress_callback)
        except IndexingError as exc:
            raise AssistantFlowError(exc.message, status_code=exc.status_code) from exc
        return {
            "kind": "index_web",
            "response": summary.get("message", "Web page indexing completed."),
            "results": [],
            "file_candidates": [],
            "data": summary,
        }

    # File search / open / preview / edit candidates
    if intent_name in {"search", "open_candidates", "preview_candidates", "edit_candidates"}:
        if not argument:
            verb = intent_name.replace("_candidates", "")
            return {
                "kind": "clarification",
                "response": f"Tell me which file or words you would like to {verb}. For example: {verb} README",
                "results": [],
                "file_candidates": [],
            }
        _emit(progress_callback, "assistant_status", "retrieving", "Searching local indexed sources.")
        matches = retrieve_matches(
            argument,
            history_dir,
            include_history=use_history,
            document_top_k=5,
            history_top_k=3,
        )[:5]
        candidates = search_files(argument, limit=10)
        response = build_retrieval_response(matches)
        return {
            "kind": intent_name,
            "response": response,
            "results": [serialize_match(match) for match in matches],
            "file_candidates": candidates,
            "history_opted_in": use_history,
            "history_used": sum(1 for match in matches if match.chunk.source_type == "history"),
        }

    return None


def _folder_index_response(summary: dict[str, Any]) -> str:
    if summary.get("status") == "warning":
        return summary.get("message", "No readable supported documents were found.")
    return (
        f"Indexed {summary['files_indexed']} changed file(s) from {summary['folder']}. "
        f"Added or updated {summary['chunks_added']} searchable chunks. "
        f"{summary.get('files_discoverable', 0)} safe unsupported file(s) were catalogued by name only."
    )

