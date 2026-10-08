"""Reusable incremental indexing for approved local folders and web sources."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path
from threading import RLock
from typing import Any, Callable

from .document_parser import is_supported_document, parse_document, parse_document_chunks
from .file_policy import FileCategory, FilePolicyError, classify_file, should_skip_directory, validate_index_root
from .scraper import ScrapeError, scrape_page
from .vector_db import DocumentChunk, db

CHUNK_WORDS = 250
CHUNK_OVERLAP_WORDS = 40
MIN_TEXT_LENGTH = 30
PROGRESS_EVERY_FILES = 25
ProgressCallback = Callable[[dict[str, Any]], None]
_indexing_lock = RLock()


class IndexingError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def index_folder_path(
    raw_path: str,
    *,
    replace: bool = False,
    register_root: bool = True,
    progress_callback: ProgressCallback | None = None,
) -> dict[str, Any]:
    """Incrementally index safe documents and catalogue safe unsupported files.

    A user-selected folder becomes an approved automatic-index root. Supported
    documents are searchable; regular unsupported files are metadata-only
    discoverable entries; secrets, hidden data, and system files are never
    catalogued or read.
    """
    folder_path = resolve_folder_path(raw_path)
    _emit_progress(
        progress_callback,
        phase="started",
        message="Started scanning the approved folder.",
        folder=str(folder_path),
    )

    with _indexing_lock:
        if replace:
            _emit_progress(
                progress_callback,
                phase="resetting",
                message="Replacing the current local index.",
                folder=str(folder_path),
            )
            db.clear()
        if register_root:
            db.register_root(folder_path)

        chunks_added = 0
        files_updated = 0
        files_unchanged = 0
        files_discoverable = 0
        skipped_files = 0
        files_seen = 0
        seen_sources: set[str] = set()
        seen_catalog_paths: set[str] = set()

        for root, directories, files in os.walk(folder_path, followlinks=False):
            directories[:] = [
                directory
                for directory in directories
                if not should_skip_directory(Path(root) / directory)
            ]

            for filename in files:
                files_seen += 1
                file_path = Path(root) / filename
                if files_seen % PROGRESS_EVERY_FILES == 0:
                    _emit_progress(
                        progress_callback,
                        phase="scanning",
                        message="Scanning local files.",
                        folder=str(folder_path),
                        files_seen=files_seen,
                        files_indexed=files_updated,
                        files_discoverable=files_discoverable,
                        skipped_files=skipped_files,
                    )
                decision = classify_file(file_path, supported=is_supported_document(file_path))
                if decision.category in {FileCategory.PROTECTED, FileCategory.IGNORED}:
                    skipped_files += 1
                    continue

                try:
                    resolved_file = file_path.resolve(strict=True)
                    stats = resolved_file.stat()
                except (OSError, RuntimeError):
                    skipped_files += 1
                    continue

                source = str(resolved_file)
                seen_catalog_paths.add(source)
                db.upsert_catalog_file(
                    resolved_file,
                    folder_path,
                    category=decision.category.value,
                    reason=decision.reason,
                    size_bytes=stats.st_size,
                    modified_ns=stats.st_mtime_ns,
                )

                if decision.category == FileCategory.DISCOVERABLE:
                    # A file can be located/opened later, but its contents never
                    # enter the RAG corpus until an appropriate parser is added.
                    db.delete_source(source)
                    files_discoverable += 1
                    continue

                seen_sources.add(source)
                if not replace and db.source_is_current(source, stats.st_mtime_ns, stats.st_size):
                    files_unchanged += 1
                    continue

                file_chunks = parse_document_chunks(resolved_file, source)
                if file_chunks is None:
                    text = parse_document(resolved_file) or ""
                    if not text or len(text.strip()) <= MIN_TEXT_LENGTH:
                        db.delete_source(source)
                        db.upsert_catalog_file(
                            resolved_file,
                            folder_path,
                            category=FileCategory.DISCOVERABLE.value,
                            reason="The file could not be extracted as readable text.",
                            size_bytes=stats.st_size,
                            modified_ns=stats.st_mtime_ns,
                        )
                        files_discoverable += 1
                        continue

                    file_chunks = chunk_text(text, source=source, source_type="file")
                    if not file_chunks:
                        db.delete_source(source)
                        skipped_files += 1
                        continue
                else:
                    text = "\n".join(chunk.text for chunk in file_chunks)

                chunks_added += db.upsert_source(
                    source,
                    "file",
                    file_chunks,
                    content_hash=_content_hash(text),
                    modified_ns=stats.st_mtime_ns,
                    size_bytes=stats.st_size,
                )
                files_updated += 1


        removed_files = db.remove_sources_not_seen_under_root(folder_path, seen_sources)
        removed_catalog_files = db.remove_catalog_not_seen_under_root(folder_path, seen_catalog_paths)
        db.mark_root_scanned(folder_path)

    if files_updated == 0 and files_unchanged == 0 and files_discoverable == 0:
        summary = {
            "status": "warning",
            "message": "No readable supported documents or discoverable files were found.",
            "folder": str(folder_path),
            "files_indexed": 0,
            "files_updated": 0,
            "files_unchanged": 0,
            "files_discoverable": 0,
            "files_removed": removed_files,
            "catalog_files_removed": removed_catalog_files,
            "chunks_added": 0,
            "total_chunks": db.count,
            "skipped_files": skipped_files,
        }
    else:
        summary = {
            "status": "success",
            "folder": str(folder_path),
            "files_indexed": files_updated,
            "files_updated": files_updated,
            "files_unchanged": files_unchanged,
            "files_discoverable": files_discoverable,
            "files_removed": removed_files,
            "catalog_files_removed": removed_catalog_files,
            "chunks_added": chunks_added,
            "total_chunks": db.count,
            "skipped_files": skipped_files,
        }

    _emit_progress(
        progress_callback,
        phase="complete",
        message="Folder scan complete.",
        folder=str(folder_path),
        files_seen=files_seen,
        files_indexed=files_updated,
        files_unchanged=files_unchanged,
        files_discoverable=files_discoverable,
        skipped_files=skipped_files,
        chunks_added=chunks_added,
    )
    return summary


def index_web_url(url: str, *, progress_callback: ProgressCallback | None = None) -> dict[str, Any]:
    """Fetch a page, extract readable text, and persist it in the RAG index."""
    _emit_progress(
        progress_callback,
        phase="fetching",
        message="Fetching the requested web page.",
        url=url.strip(),
    )
    try:
        scraped = scrape_page(url)
    except ScrapeError as exc:
        raise IndexingError(exc.message, status_code=exc.status_code) from exc

    _emit_progress(
        progress_callback,
        phase="extracting",
        message="Extracting readable text from the web page.",
        url=url.strip(),
    )
    if len(scraped.text.strip()) <= MIN_TEXT_LENGTH:
        raise IndexingError("The page did not contain enough text to index.", status_code=422)

    chunks = chunk_text(scraped.text, source=url.strip(), source_type="web")
    chunks_added = db.upsert_source(
        url.strip(),
        "web",
        chunks,
        content_hash=_content_hash(scraped.text),
        size_bytes=len(scraped.text.encode("utf-8")),
    )
    if not chunks_added:
        raise IndexingError("The page did not contain readable text to index.", status_code=422)

    summary = {
        "status": "success",
        "message": f"Successfully scraped and indexed {url.strip()}",
        "chunks_added": chunks_added,
        "total_chunks": db.count,
        "used_selenium": scraped.used_selenium,
    }
    _emit_progress(
        progress_callback,
        phase="complete",
        message="Web-page indexing is complete.",
        url=url.strip(),
        chunks_added=chunks_added,
    )
    return summary


def sync_registered_roots() -> list[dict[str, Any]]:
    """Refresh every explicitly approved root without re-reading unchanged files."""
    summaries: list[dict[str, Any]] = []
    for root in db.registered_roots():
        path = root["path"]
        if not path:
            continue
        try:
            summaries.append(index_folder_path(path, register_root=False))
        except IndexingError as exc:
            if exc.status_code in {400, 403}:
                # A root that vanished, became a non-directory, or now resolves
                # into a protected location must not retain stale local data or
                # remain eligible for automatic retries.
                removed_files = db.remove_sources_under_root(Path(path))
                removed_catalog_files = db.remove_catalog_under_root(Path(path))
                db.unregister_root(path)
                summaries.append(
                    {
                        "status": "error",
                        "folder": path,
                        "message": exc.message,
                        "files_removed": removed_files,
                        "catalog_files_removed": removed_catalog_files,
                    }
                )
                continue
            summaries.append({"status": "error", "folder": path, "message": exc.message})
    return summaries


def _emit_progress(
    progress_callback: ProgressCallback | None,
    *,
    phase: str,
    message: str,
    **data: object,
) -> None:
    """Best-effort callback for a live transport; never affects indexing."""
    if progress_callback is None:
        return
    try:
        progress_callback({"event_type": "index_progress", "phase": phase, "message": message, **data})
    except Exception:
        pass


def resolve_folder_path(raw_path: str) -> Path:
    try:
        return validate_index_root(Path(raw_path))
    except FilePolicyError as exc:
        raise IndexingError(exc.message, status_code=exc.status_code) from exc


def should_skip_file(path: Path) -> bool:
    """Compatibility helper: true when a file is not eligible for RAG content."""
    return classify_file(path, supported=is_supported_document(path)).category != FileCategory.INDEXED


def chunk_text(text: str, *, source: str, source_type: str) -> list[DocumentChunk]:
    words = text.split()
    chunks: list[DocumentChunk] = []
    step = max(1, CHUNK_WORDS - CHUNK_OVERLAP_WORDS)

    for start in range(0, len(words), step):
        chunk_words = words[start : start + CHUNK_WORDS]
        if not chunk_words:
            continue
        chunks.append(
            DocumentChunk(
                text=" ".join(chunk_words),
                source=source,
                source_type=source_type,
                chunk_index=len(chunks),
            )
        )
        if start + CHUNK_WORDS >= len(words):
            break
    return chunks


def _content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()
