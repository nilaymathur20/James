"""HTTP routes for manual and automatic folder/web indexing."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from ..schemas import IndexFolderRequest, ScrapeRequest
from ..services.indexer import IndexingError, index_folder_path, index_web_url
from ..services.vector_db import db

router = APIRouter()


@router.get("/index-status")
def index_status() -> dict[str, Any]:
    """Show the persisted index and folders approved for automatic refresh."""
    return {
        "indexed_chunks": db.count,
        "catalogued_files": db.catalog_count,
        "database": str(db.database_path),
        "registered_roots": db.registered_roots(),
    }


@router.post("/index-folder")
def index_folder(payload: IndexFolderRequest) -> dict[str, Any]:
    try:
        return index_folder_path(payload.path, replace=payload.replace)
    except IndexingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/scrape-web")
def scrape_web(payload: ScrapeRequest) -> dict[str, Any]:
    try:
        return index_web_url(payload.url)
    except IndexingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
