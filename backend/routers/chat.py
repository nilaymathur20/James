"""Standard RAG chat route, sharing the unified response engine."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request

from ..schemas import ChatRequest
from ..services.response_engine import answer_with_rag
from ..services.retrieval import serialize_match

router = APIRouter()


@router.post("/chat")
def chat(payload: ChatRequest, request: Request) -> dict[str, Any]:
    answer = answer_with_rag(
        payload.prompt,
        Path(request.app.state.history_dir),
        use_history=payload.use_history,
    )
    return {
        "response": answer.response,
        "mode": answer.mode,
        "provider": answer.provider,
        "provider_error": answer.provider_error,
        "sources": [serialize_match(match) for match in answer.matches],
        "history_used": sum(1 for match in answer.matches if match.chunk.source_type == "history"),
    }
