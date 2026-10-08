"""HTTP transport for the unified one-box assistant workflow."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from ..schemas import AssistantRequest
from ..services.assistant_flow import AssistantFlowError, run_assistant_request

router = APIRouter()


from ..services.auth import get_or_create_user_token


@router.post("/assistant")
def assistant(payload: AssistantRequest, request: Request) -> dict[str, Any]:
    """Handle a typed or transcribed request from the composer."""
    token, hashed_ip = get_or_create_user_token(request)
    try:
        res = run_assistant_request(payload, history_dir=Path(request.app.state.history_dir))
        
        # Persist conversation if history is enabled
        if payload.use_history and hasattr(request.app.state, "history_persistence"):
            response_text = res.get("response", "")
            if response_text:
                request.app.state.history_persistence.add_conversation(
                    hashed_ip, payload.text, response_text
                )
        
        res["token"] = token
        res["hashed_ip"] = hashed_ip
        return res
    except AssistantFlowError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

