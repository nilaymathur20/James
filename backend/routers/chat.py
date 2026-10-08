"""Standard RAG chat route, sharing the unified response engine."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request, Depends
from pydantic import BaseModel

from ..schemas import ChatRequest
from ..services.response_engine import answer_with_rag
from ..services.retrieval import serialize_match
from ..services.auth import get_or_create_user_token, hash_ip

router = APIRouter()


class HistoryResponse(BaseModel):
    messages: list[dict]
    token: str
    hashed_ip: str


@router.get("/chat/history", response_model=HistoryResponse)
async def get_chat_history(request: Request):
    """Get chat history for the authenticated user."""
    token, hashed_ip = get_or_create_user_token(request)
    history = request.app.state.history_persistence.get_history(hashed_ip)
    return HistoryResponse(messages=history, token=token, hashed_ip=hashed_ip)


@router.post("/chat/clear")
async def clear_chat_history(request: Request):
    """Clear chat history for the authenticated user."""
    token, hashed_ip = get_or_create_user_token(request)
    request.app.state.history_persistence.clear_history(hashed_ip)
    return {"status": "success", "message": "Chat history cleared"}


@router.post("/chat")
def chat(payload: ChatRequest, request: Request) -> dict[str, Any]:
    # Get or create JWT token for the user
    token, hashed_ip = get_or_create_user_token(request)

    answer = answer_with_rag(
        payload.prompt,
        Path(request.app.state.history_dir),
        use_history=payload.use_history,
    )

    # Persist the conversation if use_history is enabled
    if payload.use_history:
        request.app.state.history_persistence.add_conversation(
            hashed_ip, payload.prompt, answer.response
        )

    return {
        "response": answer.response,
        "mode": answer.mode,
        "provider": answer.provider,
        "provider_error": answer.provider_error,
        "sources": [serialize_match(match) for match in answer.matches],
        "history_used": sum(1 for match in answer.matches if match.chunk.source_type == "history"),
        "token": token,
        "hashed_ip": hashed_ip,
    }
