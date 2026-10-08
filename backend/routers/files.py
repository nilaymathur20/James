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


@router.get("/files/{file_id}/read-only")
def file_read_only(file_id: str) -> dict[str, Any]:
    """Return structured read-only page blocks and text for a document."""
    from ..services.vector_db import db
    from ..services.document_parser import get_read_only_document_view

    entry = db.get_catalog_file_by_id(file_id)
    if not entry:
        raise HTTPException(status_code=404, detail="File ID not found in index catalog.")

    file_path = Path(entry["path"])
    return get_read_only_document_view(file_path)

