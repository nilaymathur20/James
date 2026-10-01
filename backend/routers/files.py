"""Safe local-file discovery and confirmed file-operation HTTP endpoints."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from ..schemas import (
    ApplyEditRequest,
    EditProposalRequest,
    FilePreviewRequest,
    FileSearchRequest,
    OpenFileRequest,
    UndoEditRequest,
)
from ..services.file_tools import (
    FileToolError,
    apply_edit,
    list_file_audit,
    open_file,
    preview_file,
    propose_edit,
    search_files,
    undo_edit,
)

router = APIRouter()


@router.post("/files/search")
def find_files(payload: FileSearchRequest) -> dict[str, Any]:
    return {"status": "success", "results": search_files(payload.query, payload.limit)}


@router.get("/files/audit")
def file_audit(limit: int = Query(default=50, ge=1, le=200)) -> dict[str, Any]:
    """Show content-free records of completed assistant file operations."""
    return {"status": "success", "results": list_file_audit(limit)}


@router.post("/files/preview")
def file_preview(payload: FilePreviewRequest) -> dict[str, Any]:
    try:
        return preview_file(payload.file_id, max_chars=payload.max_chars)
    except FileToolError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/files/open")
def file_open(payload: OpenFileRequest) -> dict[str, Any]:
    try:
        return open_file(payload.file_id, confirmed=payload.confirmed)
    except FileToolError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/files/propose-edit")
def file_propose_edit(payload: EditProposalRequest) -> dict[str, Any]:
    try:
        return propose_edit(payload.file_id, payload.old_text, payload.new_text)
    except FileToolError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/files/apply-edit")
def file_apply_edit(payload: ApplyEditRequest, request: Request) -> dict[str, Any]:
    try:
        return apply_edit(
            payload.proposal_id,
            confirmed=payload.confirmed,
            backup_dir=Path(request.app.state.backup_dir),
        )
    except FileToolError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/files/undo-edit")
def file_undo_edit(payload: UndoEditRequest, request: Request) -> dict[str, Any]:
    try:
        return undo_edit(
            payload.backup_id,
            confirmed=payload.confirmed,
            backup_dir=Path(request.app.state.backup_dir),
        )
    except FileToolError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
