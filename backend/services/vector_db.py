"""Lightweight history retrieval plus persistent SQLite FTS5 file RAG storage."""

from __future__ import annotations

import hashlib
import math
import os
import re
import sqlite3
import uuid
from collections import Counter
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import RLock
from typing import Iterable, Iterator

import numpy as np


@dataclass(frozen=True)
class DocumentChunk:
    """One searchable unit of local knowledge."""

    text: str
    source: str = "Unknown source"
    source_type: str = "file"
    chunk_index: int = 0
    document_id: str | None = None
    page: int | None = None
    paragraph: int | None = None
    section: str | None = None
    heading: str | None = None

    def as_context(self) -> str:
        source_kind = self.source_type.replace("_", " ").title()
        return f"[{source_kind}: {self.source}]\n{self.text}"


@dataclass(frozen=True)
class SearchResult:
    """A chunk together with a normalized relevance score."""

    chunk: DocumentChunk
    score: float


class NumpyVectorDB:
    """Bounded in-memory TF-IDF cache used only for chat-history memory."""

    def __init__(self) -> None:
        self.documents: list[DocumentChunk] = []
        self.vocab: dict[str, int] = {}
        self.idf: dict[str, float] = {}
        self.tf_idf_matrix: np.ndarray | None = None
        self._lock = RLock()

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        return re.findall(r"\b\w+\b", text.lower())

    def _rebuild(self) -> None:
        if not self.documents:
            self.vocab = {}
            self.idf = {}
            self.tf_idf_matrix = None
            return

        tokenized_documents = [self._tokenize(f"{chunk.source}\n{chunk.text}") for chunk in self.documents]
        document_count = len(tokenized_documents)
        document_frequency: Counter[str] = Counter()
        for tokens in tokenized_documents:
            document_frequency.update(set(tokens))

        self.vocab = {word: index for index, word in enumerate(document_frequency)}
        self.idf = {
            word: math.log((1 + document_count) / (1 + frequency)) + 1.0
            for word, frequency in document_frequency.items()
        }

        matrix = np.zeros((document_count, len(self.vocab)), dtype=np.float32)
        for row, tokens in enumerate(tokenized_documents):
            if not tokens:
                continue
            frequencies = Counter(tokens)
            for word, count in frequencies.items():
                matrix[row, self.vocab[word]] = (count / len(tokens)) * self.idf[word]
        self.tf_idf_matrix = matrix

    def ingest(self, documents: Iterable[DocumentChunk | str]) -> int:
        chunks = [chunk for value in documents if (chunk := _coerce_chunk(value)) is not None]
        if not chunks:
            return 0
        with self._lock:
            self.documents.extend(chunks)
            self._rebuild()
        return len(chunks)

    def clear(self) -> None:
        with self._lock:
            self.documents.clear()
            self._rebuild()

    def search_results(self, query: str, top_k: int = 3) -> list[SearchResult]:
        if top_k < 1:
            return []
        with self._lock:
            if not self.documents or self.tf_idf_matrix is None:
                return []
            tokens = self._tokenize(query)
            if not tokens:
                return []

            query_vector = np.zeros(len(self.vocab), dtype=np.float32)
            frequencies = Counter(tokens)
            for word, count in frequencies.items():
                column = self.vocab.get(word)
                if column is not None:
                    query_vector[column] = (count / len(tokens)) * self.idf[word]
            query_norm = np.linalg.norm(query_vector)
            if query_norm == 0:
                return []

            document_norms = np.linalg.norm(self.tf_idf_matrix, axis=1)
            document_norms[document_norms == 0] = 1e-12
            similarities = (self.tf_idf_matrix @ query_vector) / (document_norms * query_norm)

            matches: list[SearchResult] = []
            for index in np.argsort(similarities)[::-1]:
                score = float(similarities[index])
                if score <= 0:
                    break
                matches.append(SearchResult(self.documents[int(index)], score))
                if len(matches) == top_k:
                    break
            return matches

    def search(self, query: str, top_k: int = 3) -> list[str]:
        return [match.chunk.as_context() for match in self.search_results(query, top_k)]

    @property
    def count(self) -> int:
        with self._lock:
            return len(self.documents)


class SQLiteFTSIndex:
    """Persistent low-RAM RAG index and safe local-file catalog.

    ``rag_chunks`` provides FTS5 lexical search. ``file_catalog`` holds only
    safe metadata for indexed and discoverable files, enabling source previews
    and guarded open/edit actions without exposing protected file names.
    """

    def __init__(self, database_path: Path | None = None) -> None:
        self._explicit_path = Path(database_path).expanduser().resolve() if database_path else None
        self._initialized_path: Path | None = None
        self._lock = RLock()
        self._ensure_initialized()

    @property
    def database_path(self) -> Path:
        if self._explicit_path is not None:
            return self._explicit_path
        configured_path = os.getenv("RAG_DB_PATH", "").strip()
        if configured_path:
            return Path(configured_path).expanduser().resolve()
        project_root = Path(__file__).resolve().parents[2]
        return (project_root / "data" / "rag_index.db").resolve()

    def _ensure_initialized(self) -> None:
        current_path = self.database_path
        if current_path != self._initialized_path:
            self._initialized_path = current_path
            current_path.parent.mkdir(parents=True, exist_ok=True)
            self._secure_storage_permissions()
            self._initialize()
            self._secure_storage_permissions()

    def _connect(self, *, ensure_initialized: bool = True) -> sqlite3.Connection:
        if ensure_initialized:
            self._ensure_initialized()
        connection = sqlite3.connect(self.database_path, timeout=30)
        connection.row_factory = sqlite3.Row
        return connection

    def _secure_storage_permissions(self) -> None:
        """Best-effort owner-only permissions for local RAG metadata/content."""
        if os.name == "nt":
            return
        try:
            self.database_path.parent.chmod(0o700)
            for path in (
                self.database_path,
                self.database_path.with_name(f"{self.database_path.name}-wal"),
                self.database_path.with_name(f"{self.database_path.name}-shm"),
            ):
                if path.exists():
                    path.chmod(0o600)
        except OSError:
            # A restrictive filesystem/ACL can reject chmod. The app still
            # functions, and the installation owner can inspect permissions.
            pass

    @contextmanager
    def _connection(self) -> Iterator[sqlite3.Connection]:
        """Yield a committed SQLite connection and always close its descriptor."""
        connection = self._connect()
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            try:
                connection.close()
            finally:
                self._secure_storage_permissions()

    @staticmethod
    def _ensure_table_column(connection: sqlite3.Connection, table: str, column: str, definition: str) -> None:
        columns = {str(row["name"]) for row in connection.execute(f"PRAGMA table_info({table})").fetchall()}
        if column not in columns:
            connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

    def _initialize(self) -> None:
        with self._lock, self._connection() as connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute("PRAGMA synchronous=NORMAL")
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS indexed_sources (
                    source TEXT PRIMARY KEY,
                    source_type TEXT NOT NULL,
                    content_hash TEXT,
                    modified_ns INTEGER,
                    size_bytes INTEGER,
                    indexed_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS indexed_roots (
                    path TEXT PRIMARY KEY,
                    added_at TEXT NOT NULL,
                    last_scanned_at TEXT
                )
                """
            )
            connection.execute(
                """
                CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks USING fts5(
                    text,
                    source,
                    source_type UNINDEXED,
                    chunk_index UNINDEXED,
                    document_id UNINDEXED,
                    page UNINDEXED,
                    paragraph UNINDEXED,
                    section UNINDEXED,
                    heading UNINDEXED,
                    tokenize = 'unicode61'
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS file_catalog (
                    file_id TEXT PRIMARY KEY,
                    path TEXT UNIQUE NOT NULL,
                    root_path TEXT NOT NULL,
                    name TEXT NOT NULL,
                    extension TEXT NOT NULL,
                    category TEXT NOT NULL,
                    reason TEXT,
                    size_bytes INTEGER,
                    modified_ns INTEGER,
                    last_seen_at TEXT NOT NULL
                )
                """
            )
            connection.execute("CREATE INDEX IF NOT EXISTS idx_file_catalog_root ON file_catalog(root_path)")
            connection.execute("CREATE INDEX IF NOT EXISTS idx_file_catalog_name ON file_catalog(name)")
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS edit_proposals (
                    proposal_id TEXT PRIMARY KEY,
                    file_id TEXT NOT NULL,
                    path TEXT NOT NULL,
                    original_hash TEXT NOT NULL,
                    old_text TEXT NOT NULL,
                    new_text TEXT NOT NULL,
                    diff TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    applied_at TEXT
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS file_backups (
                    backup_id TEXT PRIMARY KEY,
                    proposal_id TEXT NOT NULL,
                    path TEXT NOT NULL,
                    backup_path TEXT NOT NULL,
                    applied_hash TEXT,
                    created_at TEXT NOT NULL,
                    restored_at TEXT
                )
                """
            )
            # Existing installations may have backups from before undo
            # integrity checking was added; preserve them while adding the
            # nullable migration column.
            self._ensure_table_column(connection, "file_backups", "applied_hash", "TEXT")
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS file_audit_events (
                    event_id TEXT PRIMARY KEY,
                    event_type TEXT NOT NULL,
                    outcome TEXT NOT NULL,
                    file_id TEXT,
                    path TEXT,
                    proposal_id TEXT,
                    backup_id TEXT,
                    created_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_file_audit_events_created_at ON file_audit_events(created_at DESC)"
            )

    # ----- RAG chunks -----------------------------------------------------
    def ingest(self, documents: Iterable[DocumentChunk | str]) -> int:
        """Compatibility helper for callers without filesystem metadata."""
        groups: dict[tuple[str, str], list[DocumentChunk]] = {}
        for value in documents:
            chunk = _coerce_chunk(value)
            if chunk is not None:
                groups.setdefault((chunk.source, chunk.source_type), []).append(chunk)
        return sum(self.upsert_source(source, source_type, chunks) for (source, source_type), chunks in groups.items())

    def upsert_source(
        self,
        source: str,
        source_type: str,
        chunks: Iterable[DocumentChunk | str],
        *,
        content_hash: str | None = None,
        modified_ns: int | None = None,
        size_bytes: int | None = None,
    ) -> int:
        clean_chunks = [chunk for value in chunks if (chunk := _coerce_chunk(value)) is not None]
        normalized_source = source.strip() or "Unknown source"
        if not clean_chunks:
            self.delete_source(normalized_source)
            return 0

        normalized_type = source_type.strip() or "file"
        rows = [
            (
                chunk.text,
                normalized_source,
                normalized_type,
                int(chunk.chunk_index),
                chunk.document_id,
                chunk.page,
                chunk.paragraph,
                chunk.section,
                chunk.heading,
            )
            for chunk in clean_chunks
        ]
        with self._lock, self._connection() as connection:
            connection.execute("DELETE FROM rag_chunks WHERE source = ?", (normalized_source,))
            connection.executemany(
                "INSERT INTO rag_chunks (text, source, source_type, chunk_index, document_id, page, paragraph, section, heading) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", rows
            )
            connection.execute(
                """
                INSERT INTO indexed_sources (source, source_type, content_hash, modified_ns, size_bytes, indexed_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(source) DO UPDATE SET
                    source_type = excluded.source_type,
                    content_hash = excluded.content_hash,
                    modified_ns = excluded.modified_ns,
                    size_bytes = excluded.size_bytes,
                    indexed_at = excluded.indexed_at
                """,
                (normalized_source, normalized_type, content_hash, modified_ns, size_bytes, _utc_now()),
            )
        return len(rows)

    def source_is_current(self, source: str, modified_ns: int, size_bytes: int) -> bool:
        with self._lock, self._connection() as connection:
            row = connection.execute(
                "SELECT modified_ns, size_bytes FROM indexed_sources WHERE source = ? AND source_type = 'file'",
                (source,),
            ).fetchone()
        return bool(row and row["modified_ns"] == modified_ns and row["size_bytes"] == size_bytes)

    def delete_source(self, source: str) -> None:
        with self._lock, self._connection() as connection:
            connection.execute("DELETE FROM rag_chunks WHERE source = ?", (source,))
            connection.execute("DELETE FROM indexed_sources WHERE source = ?", (source,))

    def remove_sources_not_seen_under_root(self, root: Path, seen_sources: set[str]) -> int:
        # Database rows are paths captured at the last approved scan. Compare
        # them lexically so a later symlink replacement cannot redirect stale
        # cleanup toward an unrelated directory.
        root_path = _lexical_absolute_path(root)
        with self._lock, self._connection() as connection:
            rows = connection.execute("SELECT source FROM indexed_sources WHERE source_type = 'file'").fetchall()
            stale = [row["source"] for row in rows if _path_is_within(Path(row["source"]), root_path) and row["source"] not in seen_sources]
            self._delete_sources(connection, stale)
        return len(stale)

    def remove_sources_under_root(self, root: Path) -> int:
        root_path = _lexical_absolute_path(root)
        with self._lock, self._connection() as connection:
            rows = connection.execute("SELECT source FROM indexed_sources WHERE source_type = 'file'").fetchall()
            sources = [row["source"] for row in rows if _path_is_within(Path(row["source"]), root_path)]
            self._delete_sources(connection, sources)
        return len(sources)

    @staticmethod
    def _delete_sources(connection: sqlite3.Connection, sources: Iterable[str]) -> None:
        for source in sources:
            connection.execute("DELETE FROM rag_chunks WHERE source = ?", (source,))
            connection.execute("DELETE FROM indexed_sources WHERE source = ?", (source,))

    def search_results(self, query: str, top_k: int = 3) -> list[SearchResult]:
        if top_k < 1:
            return []
        fts_query = _fts_query(query)
        if not fts_query:
            return []

        try:
            with self._lock, self._connection() as connection:
                rows = connection.execute(
                    """
                    SELECT text, source, source_type, chunk_index,
                           document_id, page, paragraph, section, heading,
                           bm25(rag_chunks, 1.0, 1.8) AS rank
                    FROM rag_chunks
                    WHERE rag_chunks MATCH ?
                    ORDER BY rank
                    LIMIT ?
                    """,
                    (fts_query, top_k),
                ).fetchall()
        except sqlite3.OperationalError:
            return []

        results: list[SearchResult] = []
        for row in rows:
            rank = float(row["rank"])
            score = 1.0 / (1.0 + abs(rank))
            results.append(
                SearchResult(
                    DocumentChunk(
                        text=row["text"],
                        source=row["source"],
                        source_type=row["source_type"],
                        chunk_index=int(row["chunk_index"]),
                        document_id=row["document_id"],
                        page=int(row["page"]) if row["page"] is not None else None,
                        paragraph=int(row["paragraph"]) if row["paragraph"] is not None else None,
                        section=row["section"],
                        heading=row["heading"],
                    ),
                    score,
                )
            )
        return results

    def get_chunk_window(self, source: str, chunk_index: int, window_size: int = 1) -> list[DocumentChunk]:
        with self._lock, self._connection() as connection:
            rows = connection.execute(
                """
                SELECT text, source, source_type, chunk_index,
                       document_id, page, paragraph, section, heading
                FROM rag_chunks
                WHERE source = ? AND chunk_index >= ? AND chunk_index <= ?
                ORDER BY chunk_index
                """,
                (source, chunk_index - window_size, chunk_index + window_size),
            ).fetchall()
        
        return [
            DocumentChunk(
                text=row["text"],
                source=row["source"],
                source_type=row["source_type"],
                chunk_index=int(row["chunk_index"]),
                document_id=row["document_id"],
                page=int(row["page"]) if row["page"] is not None else None,
                paragraph=int(row["paragraph"]) if row["paragraph"] is not None else None,
                section=row["section"],
                heading=row["heading"],
            )
            for row in rows
        ]

    def search(self, query: str, top_k: int = 3) -> list[str]:
        return [match.chunk.as_context() for match in self.search_results(query, top_k)]

    @property
    def count(self) -> int:
        with self._lock, self._connection() as connection:
            row = connection.execute("SELECT COUNT(*) AS total FROM rag_chunks").fetchone()
        return int(row["total"] if row else 0)

    # ----- Approved automatic-index roots --------------------------------
    def register_root(self, root: Path) -> None:
        path = str(root.resolve())
        with self._lock, self._connection() as connection:
            connection.execute(
                "INSERT OR IGNORE INTO indexed_roots (path, added_at, last_scanned_at) VALUES (?, ?, NULL)",
                (path, _utc_now()),
            )

    def mark_root_scanned(self, root: Path) -> None:
        path = str(root.resolve())
        with self._lock, self._connection() as connection:
            connection.execute("UPDATE indexed_roots SET last_scanned_at = ? WHERE path = ?", (_utc_now(), path))

    def unregister_root(self, root: str | Path) -> None:
        # Prefer the stored lexical path. Resolving a path after its directory
        # was replaced with a symlink could otherwise point at (and fail to
        # delete) an unrelated system location.
        path = str(_lexical_absolute_path(Path(root)))
        with self._lock, self._connection() as connection:
            result = connection.execute("DELETE FROM indexed_roots WHERE path = ?", (path,))
            if result.rowcount > 0:
                return
            try:
                resolved_path = str(Path(root).expanduser().resolve())
            except (OSError, RuntimeError):
                return
            if resolved_path != path:
                connection.execute("DELETE FROM indexed_roots WHERE path = ?", (resolved_path,))

    def registered_roots(self) -> list[dict[str, str | None]]:
        with self._lock, self._connection() as connection:
            rows = connection.execute("SELECT path, added_at, last_scanned_at FROM indexed_roots ORDER BY added_at").fetchall()
        return [dict(row) for row in rows]

    @property
    def registered_root_count(self) -> int:
        with self._lock, self._connection() as connection:
            row = connection.execute("SELECT COUNT(*) AS total FROM indexed_roots").fetchone()
        return int(row["total"] if row else 0)

    # ----- Safe metadata-only file catalog --------------------------------
    def upsert_catalog_file(
        self,
        path: Path,
        root: Path,
        *,
        category: str,
        reason: str | None,
        size_bytes: int,
        modified_ns: int,
    ) -> dict[str, object]:
        normalized_path = str(path.resolve())
        normalized_root = str(root.resolve())
        file_id = _stable_file_id(normalized_path)
        name = path.name
        extension = path.suffix.lower()
        with self._lock, self._connection() as connection:
            connection.execute(
                """
                INSERT INTO file_catalog
                    (file_id, path, root_path, name, extension, category, reason, size_bytes, modified_ns, last_seen_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(path) DO UPDATE SET
                    file_id = excluded.file_id,
                    root_path = excluded.root_path,
                    name = excluded.name,
                    extension = excluded.extension,
                    category = excluded.category,
                    reason = excluded.reason,
                    size_bytes = excluded.size_bytes,
                    modified_ns = excluded.modified_ns,
                    last_seen_at = excluded.last_seen_at
                """,
                (file_id, normalized_path, normalized_root, name, extension, category, reason, size_bytes, modified_ns, _utc_now()),
            )
        entry = self.get_catalog_file(file_id)
        if entry is None:  # Defensive; the insert above should always succeed.
            raise RuntimeError("Could not store local file metadata.")
        return entry

    def get_catalog_file(self, file_id: str) -> dict[str, object] | None:
        with self._lock, self._connection() as connection:
            row = connection.execute("SELECT * FROM file_catalog WHERE file_id = ?", (file_id,)).fetchone()
        return dict(row) if row else None

    def get_catalog_file_by_path(self, path: str) -> dict[str, object] | None:
        with self._lock, self._connection() as connection:
            row = connection.execute("SELECT * FROM file_catalog WHERE path = ?", (path,)).fetchone()
        return dict(row) if row else None

    def search_catalog(self, query: str, limit: int = 10) -> list[dict[str, object]]:
        """Find safe filename/path metadata without scanning a capped row subset."""
        terms = [term.lower() for term in re.findall(r"\w+", query, flags=re.UNICODE)[:12]]
        safe_limit = max(1, min(limit, 50))
        clauses: list[str] = []
        parameters: list[object] = []
        for term in terms:
            # Treat user punctuation as literal text rather than SQL LIKE
            # wildcards. Search both name and full stored path metadata.
            pattern = f"%{_escape_like(term)}%"
            clauses.append("(LOWER(name) LIKE ? ESCAPE '\\' OR LOWER(path) LIKE ? ESCAPE '\\')")
            parameters.extend((pattern, pattern))

        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        sql = f"""
            SELECT * FROM file_catalog
            {where}
            ORDER BY CASE category WHEN 'indexed' THEN 0 ELSE 1 END, name
            LIMIT ?
        """
        parameters.append(safe_limit)
        with self._lock, self._connection() as connection:
            rows = connection.execute(sql, parameters).fetchall()
        return [dict(row) for row in rows]

    def delete_catalog_file(self, file_id: str) -> None:
        with self._lock, self._connection() as connection:
            connection.execute("DELETE FROM file_catalog WHERE file_id = ?", (file_id,))

    def delete_catalog_file_by_path(self, path: str) -> None:
        with self._lock, self._connection() as connection:
            connection.execute("DELETE FROM file_catalog WHERE path = ?", (path,))

    def remove_catalog_not_seen_under_root(self, root: Path, seen_paths: set[str]) -> int:
        root_path = _lexical_absolute_path(root)
        with self._lock, self._connection() as connection:
            rows = connection.execute("SELECT path FROM file_catalog").fetchall()
            stale = [row["path"] for row in rows if _path_is_within(Path(row["path"]), root_path) and row["path"] not in seen_paths]
            for path in stale:
                connection.execute("DELETE FROM file_catalog WHERE path = ?", (path,))
        return len(stale)

    def remove_catalog_under_root(self, root: Path) -> int:
        root_path = _lexical_absolute_path(root)
        with self._lock, self._connection() as connection:
            rows = connection.execute("SELECT path FROM file_catalog").fetchall()
            paths = [row["path"] for row in rows if _path_is_within(Path(row["path"]), root_path)]
            for path in paths:
                connection.execute("DELETE FROM file_catalog WHERE path = ?", (path,))
        return len(paths)

    @property
    def catalog_count(self) -> int:
        with self._lock, self._connection() as connection:
            row = connection.execute("SELECT COUNT(*) AS total FROM file_catalog").fetchone()
        return int(row["total"] if row else 0)

    # ----- Confirmed edit proposals and backups ---------------------------
    def create_edit_proposal(
        self,
        *,
        file_id: str,
        path: str,
        original_hash: str,
        old_text: str,
        new_text: str,
        diff: str,
        expires_in_minutes: int = 15,
    ) -> dict[str, object]:
        proposal_id = f"edit_{uuid.uuid4().hex}"
        created_at = _utc_now()
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes)).isoformat(timespec="seconds")
        with self._lock, self._connection() as connection:
            connection.execute(
                """
                INSERT INTO edit_proposals
                    (proposal_id, file_id, path, original_hash, old_text, new_text, diff, status, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
                """,
                (proposal_id, file_id, path, original_hash, old_text, new_text, diff, created_at, expires_at),
            )
        proposal = self.get_edit_proposal(proposal_id)
        if proposal is None:
            raise RuntimeError("Could not store edit proposal.")
        return proposal

    def get_edit_proposal(self, proposal_id: str) -> dict[str, object] | None:
        with self._lock, self._connection() as connection:
            row = connection.execute("SELECT * FROM edit_proposals WHERE proposal_id = ?", (proposal_id,)).fetchone()
        return dict(row) if row else None

    def mark_edit_proposal_applied(self, proposal_id: str) -> None:
        with self._lock, self._connection() as connection:
            connection.execute(
                "UPDATE edit_proposals SET status = 'applied', applied_at = ? WHERE proposal_id = ?",
                (_utc_now(), proposal_id),
            )

    def create_backup_record(
        self,
        *,
        proposal_id: str,
        path: str,
        backup_path: str,
        applied_hash: str,
    ) -> dict[str, object]:
        backup_id = f"backup_{uuid.uuid4().hex}"
        with self._lock, self._connection() as connection:
            connection.execute(
                """
                INSERT INTO file_backups
                    (backup_id, proposal_id, path, backup_path, applied_hash, created_at, restored_at)
                VALUES (?, ?, ?, ?, ?, ?, NULL)
                """,
                (backup_id, proposal_id, path, backup_path, applied_hash, _utc_now()),
            )
        backup = self.get_backup(backup_id)
        if backup is None:
            raise RuntimeError("Could not store backup record.")
        return backup

    def get_backup(self, backup_id: str) -> dict[str, object] | None:
        with self._lock, self._connection() as connection:
            row = connection.execute("SELECT * FROM file_backups WHERE backup_id = ?", (backup_id,)).fetchone()
        return dict(row) if row else None

    def mark_backup_restored(self, backup_id: str) -> None:
        with self._lock, self._connection() as connection:
            connection.execute("UPDATE file_backups SET restored_at = ? WHERE backup_id = ?", (_utc_now(), backup_id))

    def record_file_audit(
        self,
        *,
        event_type: str,
        file_id: str | None = None,
        path: str | None = None,
        proposal_id: str | None = None,
        backup_id: str | None = None,
        outcome: str = "success",
    ) -> dict[str, object]:
        """Persist a content-free audit event for a completed file capability."""
        event_id = f"audit_{uuid.uuid4().hex}"
        with self._lock, self._connection() as connection:
            connection.execute(
                """
                INSERT INTO file_audit_events
                    (event_id, event_type, outcome, file_id, path, proposal_id, backup_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (event_id, event_type, outcome, file_id, path, proposal_id, backup_id, _utc_now()),
            )
        event = self.get_file_audit_event(event_id)
        if event is None:
            raise RuntimeError("Could not persist file audit metadata.")
        return event

    def get_file_audit_event(self, event_id: str) -> dict[str, object] | None:
        with self._lock, self._connection() as connection:
            row = connection.execute("SELECT * FROM file_audit_events WHERE event_id = ?", (event_id,)).fetchone()
        return dict(row) if row else None

    def list_file_audit_events(self, limit: int = 50) -> list[dict[str, object]]:
        safe_limit = max(1, min(limit, 200))
        with self._lock, self._connection() as connection:
            rows = connection.execute(
                """
                SELECT event_id, event_type, outcome, file_id, path, proposal_id, backup_id, created_at
                FROM file_audit_events
                ORDER BY created_at DESC, rowid DESC
                LIMIT ?
                """,
                (safe_limit,),
            ).fetchall()
        return [dict(row) for row in rows]

    def clear(self) -> None:
        """Clear index/catalog/root state for explicit replace=true rebuilds."""
        with self._lock, self._connection() as connection:
            connection.execute("DELETE FROM rag_chunks")
            connection.execute("DELETE FROM indexed_sources")
            connection.execute("DELETE FROM indexed_roots")
            connection.execute("DELETE FROM file_catalog")
            connection.execute("DELETE FROM edit_proposals")


def _coerce_chunk(document: DocumentChunk | str) -> DocumentChunk | None:
    if isinstance(document, DocumentChunk):
        text = document.text.strip()
        if not text:
            return None
        return DocumentChunk(
            text=text,
            source=document.source.strip() or "Unknown source",
            source_type=document.source_type.strip() or "file",
            chunk_index=max(0, int(document.chunk_index)),
            document_id=document.document_id,
            page=document.page,
            paragraph=document.paragraph,
            section=document.section,
            heading=document.heading,
        )
    if not isinstance(document, str):
        return None
    text = document.strip()
    if not text:
        return None
    match = re.match(r"^\[(?P<label>[^:\]]+):\s*(?P<source>[^\]]+)\]\s*\n(?P<text>.*)$", text, re.DOTALL)
    if match and match.group("text").strip():
        source_type = "web" if "web" in match.group("label").lower() else "file"
        return DocumentChunk(match.group("text").strip(), match.group("source").strip(), source_type)
    return DocumentChunk(text)


def _fts_query(query: str) -> str:
    terms = re.findall(r"\w+", query, flags=re.UNICODE)[:20]
    # Escape double quotes in terms to prevent FTS5 syntax errors.
    # FTS5 uses doubled quotes for escaping inside quoted strings.
    return " OR ".join(f'"{term.replace(chr(34), chr(34)+chr(34))}"' for term in terms)


def _stable_file_id(path: str) -> str:
    return f"file_{hashlib.sha256(path.encode('utf-8')).hexdigest()[:24]}"


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _lexical_absolute_path(path: Path) -> Path:
    """Normalize a path without resolving symlinks or requiring it to exist."""
    return Path(os.path.abspath(os.fspath(path.expanduser())))


def _path_is_within(path: Path, root: Path) -> bool:
    """Lexical containment for cleanup of previously stored source paths."""
    try:
        _lexical_absolute_path(path).relative_to(_lexical_absolute_path(root))
        return True
    except (OSError, RuntimeError, ValueError):
        return False


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# File/web RAG data survives FastAPI restarts in data/rag_index.db.
db = SQLiteFTSIndex()
