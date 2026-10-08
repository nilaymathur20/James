"""One reusable RAG answer pipeline for chat and unified assistant commands."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from .llm import LLMError, answer_question, configured_provider
from .privacy_config import history_feature_enabled
from .retrieval import build_retrieval_response, format_context, retrieve_matches
from .vector_db import SearchResult


@dataclass(frozen=True)
class AssistantAnswer:
    response: str
    mode: str
    provider: str | None
    provider_error: str | None
    matches: list[SearchResult]


def answer_with_rag(prompt: str, history_dir: Path, *, use_history: bool = False) -> AssistantAnswer:
    """Answer through a configured provider or return a fully local RAG response."""
    # History is local but privacy-sensitive. It is used and persisted only
    # when the caller explicitly opted in and the installation has not disabled
    # the feature globally.
    history_opted_in = use_history and history_feature_enabled()
    matches = retrieve_matches(
        prompt,
        history_dir,
        include_history=history_opted_in,
        document_top_k=3,
        history_top_k=2,
    )
    provider = configured_provider()
    provider_error: str | None = None

    if provider is None:
        mode = "retrieval"
        answer = build_retrieval_response(matches)
    else:
        try:
            answer = answer_question(prompt, format_context(matches))
            mode = "llm"
        except LLMError as exc:
            # Preserve a working offline assistant if the network, credits, or
            # configured provider is unavailable.
            mode = "retrieval_fallback"
            provider_error = exc.message
            answer = (
                "The configured chat provider is unavailable, so I searched your local sources instead.\n\n"
                f"{build_retrieval_response(matches)}"
            )

    if history_opted_in:
        write_history_entry(history_dir, prompt, answer, mode)
    return AssistantAnswer(
        response=answer,
        mode=mode,
        provider=provider,
        provider_error=provider_error,
        matches=matches,
    )


def write_history_entry(history_dir: Path, prompt: str, answer: str, mode: str) -> None:
    """Archive an already opted-in answer; history I/O never fails a request."""
    if not history_feature_enabled():
        return
    try:
        history_dir.mkdir(parents=True, exist_ok=True)
        if os.name != "nt":
            history_dir.chmod(0o700)
        timestamp = datetime.now().astimezone().strftime("%Y-%m-%d_%H-%M-%S_%f")
        history_path = history_dir / f"chat_{timestamp}.md"
        history_path.write_text(
            f"# Prompt\n{prompt}\n\n## Response\n{answer}\n\n## Mode\n{mode}\n",
            encoding="utf-8",
        )
        if os.name != "nt":
            history_path.chmod(0o600)
    except OSError:
        pass
