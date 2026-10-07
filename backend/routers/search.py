"""Offline structured document and history search endpoint."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request

from ..schemas import SearchRequest
from ..services.privacy_config import history_feature_enabled
from ..services.retrieval import build_retrieval_response, retrieve_matches, serialize_match
from ..services.vector_db import db

router = APIRouter()


@router.post("/search")
def search(payload: SearchRequest, request: Request) -> dict[str, Any]:
    """Search local indexed documents and optionally relevant chat history.

    This route works with no internet, no API key, and no local LLM.
    """
    history_opted_in = payload.include_history and history_feature_enabled()
    matches = retrieve_matches(
        payload.query,
        Path(request.app.state.history_dir),
        include_history=history_opted_in,
        document_top_k=payload.top_k,
        history_top_k=payload.top_k if history_opted_in else 0,
    )[: payload.top_k]

    return {
        "status": "success",
        "mode": "retrieval",
        "query": payload.query,
        "response": build_retrieval_response(matches),
        "results": [serialize_match(match) for match in matches],
        "indexed_chunks": db.count,
        "history_included": history_opted_in,
        "history_matches": sum(1 for match in matches if match.chunk.source_type == "history"),
    }
