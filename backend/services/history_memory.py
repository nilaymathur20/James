"""Controlled searchable memory over the assistant's local chat-history files."""

from __future__ import annotations

from pathlib import Path
from threading import RLock

from .privacy_config import history_feature_enabled
from .vector_db import DocumentChunk, NumpyVectorDB, SearchResult

# Keep historical context useful on lower-RAM machines. Recent chats are usually
# the most valuable, and a bounded cache avoids indexing an unlimited archive.
MAX_HISTORY_FILES = 100
MAX_HISTORY_FILE_BYTES = 256 * 1024
MAX_HISTORY_CHUNKS = 600
HISTORY_CHUNK_WORDS = 180


class HistoryMemory:
    """Caches relevant local Markdown chat logs in a separate TF-IDF collection."""

    def __init__(self, history_dir: Path) -> None:
        self.history_dir = history_dir.expanduser().resolve()
        self._db = NumpyVectorDB()
        self._fingerprint: tuple[tuple[str, int, int], ...] | None = None
        self._lock = RLock()

    def search(self, query: str, top_k: int = 2) -> list[SearchResult]:
        if not history_feature_enabled():
            self._clear_if_disabled()
            return []
        self.refresh()
        return self._db.search_results(query, top_k=top_k)

    @property
    def count(self) -> int:
        if not history_feature_enabled():
            self._clear_if_disabled()
            return 0
        self.refresh()
        return self._db.count

    def _clear_if_disabled(self) -> None:
        with self._lock:
            self._db.clear()
            self._fingerprint = None

    def refresh(self) -> None:
        """Rebuild only when the set or timestamps of history files changed."""
        with self._lock:
            entries = self._history_entries()
            fingerprint = tuple((str(path), modified_ns, size) for path, modified_ns, size in entries)
            if fingerprint == self._fingerprint:
                return

            chunks: list[DocumentChunk] = []
            for path, _, _ in entries:
                text = _read_history_file(path)
                if not text:
                    continue
                chunks.extend(_chunk_history(text, path.name))
                if len(chunks) >= MAX_HISTORY_CHUNKS:
                    chunks = chunks[:MAX_HISTORY_CHUNKS]
                    break

            self._db.clear()
            self._db.ingest(chunks)
            self._fingerprint = fingerprint

    def _history_entries(self) -> list[tuple[Path, int, int]]:
        try:
            if not self.history_dir.is_dir():
                return []
        except OSError:
            return []

        entries: list[tuple[Path, int, int]] = []
        try:
            candidates = self.history_dir.glob("chat_*.md")
            for path in candidates:
                try:
                    if not path.is_file() or path.is_symlink():
                        continue
                    stats = path.stat()
                except OSError:
                    continue
                if 0 < stats.st_size <= MAX_HISTORY_FILE_BYTES:
                    entries.append((path, stats.st_mtime_ns, stats.st_size))
        except OSError:
            return []

        entries.sort(key=lambda entry: entry[1], reverse=True)
        return entries[:MAX_HISTORY_FILES]


def _read_history_file(path: Path) -> str | None:
    try:
        text = path.read_text(encoding="utf-8", errors="ignore").strip()
    except OSError:
        return None
    return text or None


def _chunk_history(text: str, source: str) -> list[DocumentChunk]:
    words = text.split()
    chunks: list[DocumentChunk] = []
    for start in range(0, len(words), HISTORY_CHUNK_WORDS):
        chunk_words = words[start : start + HISTORY_CHUNK_WORDS]
        if chunk_words:
            chunks.append(
                DocumentChunk(
                    text=" ".join(chunk_words),
                    source=source,
                    source_type="history",
                    chunk_index=len(chunks),
                )
            )
    return chunks


_memory_instances: dict[Path, HistoryMemory] = {}
_memory_instances_lock = RLock()


def get_history_memory(history_dir: Path) -> HistoryMemory:
    """Return one history cache per directory for the life of the API process."""
    normalized_path = history_dir.expanduser().resolve()
    with _memory_instances_lock:
        memory = _memory_instances.get(normalized_path)
        if memory is None:
            memory = HistoryMemory(normalized_path)
            _memory_instances[normalized_path] = memory
        return memory
