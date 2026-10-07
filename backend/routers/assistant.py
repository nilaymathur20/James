"""HTTP transport for the unified one-box assistant workflow."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from ..schemas import AssistantRequest
from ..services.assistant_flow import AssistantFlowError, run_assistant_request

router = APIRouter()


@router.post("/assistant")
def assistant(payload: AssistantRequest, request: Request) -> dict[str, Any]:
    """Handle a typed or Vosk-transcribed request from the one unified composer."""
    try:
        return run_assistant_request(payload, history_dir=Path(request.app.state.history_dir))
    except AssistantFlowError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
