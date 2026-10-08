"""Shared retrieval and no-model response helpers for offline RAG."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

from .file_policy import FileCategory, FilePolicyError, validate_catalog_access
from .history_memory import get_history_memory
from .vector_db import DocumentChunk, SearchResult, db


def retrieve_matches(
    query: str,
    history_dir: Path,
    *,
    include_history: bool = False,
    document_top_k: int = 3,
    history_top_k: int = 2,
) -> list[SearchResult]:
    """Retrieve relevant indexed documents and, optionally, old chat context."""
    # Fetch extra candidates because a file can change between background scans.
    # Invalid or stale file chunks are filtered below rather than exposed from
    # a formerly approved path.
    raw_document_matches = db.search_results(query, top_k=max(document_top_k * 10, 20))
    document_matches: list[SearchResult] = []
    stale_sources: list[str] = []
    stale_entries: list[dict[str, object]] = []
    for match in raw_document_matches:
        if match.chunk.source_type == "file" and not _is_current_safe_file_match(match):
            # Collect stale entries for deletion after iteration.
            source = match.chunk.source
            entry = db.get_catalog_file_by_path(source)
            if entry is not None:
                stale_entries.append(entry)
            else:
                stale_sources.append(source)
            continue
        document_matches.append(match)
        if len(document_matches) >= document_top_k:
            break
    # Delete stale entries after iteration to avoid modifying the DB during traversal.
    for entry in stale_entries:
        db.delete_source(str(entry["path"]))
        db.delete_catalog_file(str(entry["file_id"]))
    for source in stale_sources:
        db.delete_source(source)
    history_matches: list[SearchResult] = []
    if include_history:
        history_matches = get_history_memory(history_dir).search(query, top_k=history_top_k)

    # Cosine scores from the two local collections are comparable enough for a
    # small RAG app. Deduplicate a source/chunk pair if it somehow appears twice.
    combined = document_matches + history_matches
    combined.sort(key=lambda match: match.score, reverse=True)

    unique_matches: list[SearchResult] = []
    seen: set[tuple[str, str, int]] = set()
    for match in combined:
        key = (match.chunk.source_type, match.chunk.source, match.chunk.chunk_index)
        if key in seen:
            continue
        
        # Apply sentence-window retrieval for local files
        if match.chunk.source_type == "file":
            window = db.get_chunk_window(match.chunk.source, match.chunk.chunk_index, window_size=1)
            if window:
                # Combine text from window chunks to provide context
                combined_text = "\n".join(chunk.text for chunk in window)
                # Ensure we use metadata from the original matched chunk or the first one
                expanded_chunk = DocumentChunk(
                    text=combined_text,
                    source=match.chunk.source,
                    source_type=match.chunk.source_type,
                    chunk_index=match.chunk.chunk_index,
                    document_id=match.chunk.document_id,
                    page=match.chunk.page,
                    paragraph=match.chunk.paragraph,
                    section=match.chunk.section,
                    heading=match.chunk.heading,
                )
                match = SearchResult(expanded_chunk, match.score)
                # Mark neighboring chunks as seen so we don't return redundant context
                for chunk in window:
                    seen.add((chunk.source_type, chunk.source, chunk.chunk_index))
        
        seen.add(key)
        unique_matches.append(match)
    return unique_matches


def _is_current_safe_file_match(match: SearchResult) -> bool:
    """Suppress stale/protected chunks until an explicit safe reindex occurs.

    Returns True if the match is safe to use.
    """
    source = match.chunk.source
    try:
        resolved_path = Path(source).resolve()
        if not resolved_path.is_file():
            return False
    except Exception:
        return False

    resolved_source = str(resolved_path)
    entry = db.get_catalog_file_by_path(source) or db.get_catalog_file_by_path(resolved_source)
    
    if entry is None:
        # If file exists on disk and is inside an approved root or data dir, auto-catalogue it as safe
        from .file_policy import classify_file
        decision = classify_file(resolved_path, supported=True)
        if decision.category == FileCategory.INDEXED:
            try:
                stats = resolved_path.stat()
                db.upsert_catalog_file(
                    resolved_path,
                    resolved_path.parent,
                    category=decision.category.value,
                    reason=decision.reason,
                    size_bytes=stats.st_size,
                    modified_ns=stats.st_mtime_ns,
                )
                return True
            except Exception:
                return False
        return False

    if entry.get("category") != FileCategory.INDEXED.value:
        return False

    try:
        stats = resolved_path.stat()
    except (OSError, RuntimeError):
        return False

    if stats.st_mtime_ns != entry["modified_ns"] or stats.st_size != entry["size_bytes"]:
        return False

    from .file_policy import classify_file
    decision = classify_file(resolved_path, supported=True)
    if decision.category != FileCategory.INDEXED:
        return False

    return True




def format_context(matches: Iterable[SearchResult]) -> list[str]:
    """Return source-marked chunks suitable for an LLM prompt."""
    return [match.chunk.as_context() for match in matches]


def serialize_match(match: SearchResult, snippet_length: int = 700) -> dict[str, object]:
    """Return a compact JSON-safe search result for the React client."""
    return {
        "source": match.chunk.source,
        "source_type": match.chunk.source_type,
        "chunk_index": match.chunk.chunk_index,
        "document_id": match.chunk.document_id,
        "page": match.chunk.page,
        "paragraph": match.chunk.paragraph,
        "section": match.chunk.section,
        "heading": match.chunk.heading,
        "snippet": _compact_text(match.chunk.text, snippet_length),
        "score": round(match.score, 4),
    }


def build_retrieval_response(matches: Iterable[SearchResult], max_items: int = 5) -> str:
    """Create a useful extractive answer when no generative model is available."""
    selected_matches = list(matches)[:max_items]
    if not selected_matches:
        return (
            "I could not find a relevant indexed file or saved conversation. "
            "Try indexing a folder, using different keywords, or enabling history context."
        )

    lines = ["I found these relevant local sources:"]
    for position, match in enumerate(selected_matches, start=1):
        kind = "Past conversation" if match.chunk.source_type == "history" else match.chunk.source_type.title()
        lines.append(
            f"\n{position}. {kind}: {match.chunk.source}\n"
            f"{_compact_text(match.chunk.text, 500)}"
        )
    return "\n".join(lines)


def _compact_text(text: str, limit: int) -> str:
    compact = " ".join(text.split())
    if len(compact) <= limit:
        return compact
    return f"{compact[: max(0, limit - 1)].rstrip()}…"
