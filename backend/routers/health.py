"""Health and local-index status endpoint."""

from __future__ import annotations

from fastapi import APIRouter

from ..services.llm import configured_provider, local_llm_status
from ..services.privacy_config import history_feature_enabled
from ..services.whisper_transcriber import whisper_status
from ..services.vector_db import db

router = APIRouter()


@router.get("/health")
def health() -> dict[str, object]:
    """Return local capability state without exposing keys or file contents."""
    return {
        "status": "ok",
        "indexed_chunks": db.count,
        "catalogued_files": db.catalog_count,
        "chat_provider": configured_provider(),
        "local_model": local_llm_status(),
        "history": {
            "feature_enabled": history_feature_enabled(),
            "requires_request_opt_in": True,
        },
        "persistent_index": True,
        "registered_roots": db.registered_root_count,
        "index_database": str(db.database_path),
        "voice": whisper_status(),
    }
