"""Guarded local-file discovery, preview, open, edit, backup, and undo tools."""

from __future__ import annotations

import difflib
import hashlib
import os
import shutil
import stat
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from typing import Any

from .document_parser import parse_document
from .file_policy import FileCategory, FilePolicyError, is_desktop_open_allowed, validate_catalog_access
from .indexer import chunk_text
from .vector_db import db

MAX_PREVIEW_CHARS = 20_000
MAX_EDIT_BYTES = 1 * 1024 * 1024
EDITABLE_SUFFIXES = {".txt", ".md", ".py", ".json", ".ipynb", ".html", ".htm"}
_file_operation_lock = RLock()


class FileToolError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def search_files(query: str, limit: int = 10) -> list[dict[str, object]]:
    """Search only catalog entries that still pass the current access policy."""
    safe_entries: list[dict[str, object]] = []
    stale_entries: list[dict[str, object]] = []
    for entry in db.search_catalog(query, limit=50):
        try:
            _validate_catalog_entry(entry, require_indexed=False)
        except FileToolError:
            # A file may have been deleted, replaced with a symlink, made
            # executable, or moved into a now-invalid root after the scan.
            # Never keep returning metadata or stale RAG content in that case.
            stale_entries.append(entry)
            continue
        safe_entries.append(entry)
        if len(safe_entries) >= max(1, min(limit, 50)):
            break
    # Delete stale entries after iteration to avoid modifying the DB during traversal.
    for entry in stale_entries:
        db.delete_source(str(entry["path"]))
        db.delete_catalog_file(str(entry["file_id"]))
    return [serialize_file_entry(entry) for entry in safe_entries]


def list_file_audit(limit: int = 50) -> list[dict[str, object]]:
    """Return content-free audit records without re-exposing a stored path."""
    records: list[dict[str, object]] = []
    for event in db.list_file_audit_events(limit=limit):
        stored_path = str(event["path"] or "")
        records.append(
            {
                "event_id": event["event_id"],
                "event_type": event["event_type"],
                "outcome": event["outcome"],
                "file_id": event["file_id"],
                "file_name": Path(stored_path).name if stored_path else None,
                "proposal_id": event["proposal_id"],
                "backup_id": event["backup_id"],
                "created_at": event["created_at"],
            }
        )
    return records


def preview_file(file_id: str, *, max_chars: int = MAX_PREVIEW_CHARS) -> dict[str, object]:
    entry, path = _get_catalogued_file(file_id, require_indexed=True)
    _ensure_current(entry, path)

    text = parse_document(path)
    if not text:
        raise FileToolError("The selected file could not be rendered as readable text.", status_code=422)

    limit = max(1, min(max_chars, MAX_PREVIEW_CHARS))
    audit = db.record_file_audit(
        event_type="preview",
        file_id=str(entry["file_id"]),
        path=str(path),
    )
    return {
        "file": serialize_file_entry(entry),
        "content": text[:limit],
        "truncated": len(text) > limit,
        "audit_id": audit["event_id"],
    }


def open_file(file_id: str, *, confirmed: bool) -> dict[str, object]:
    """Open one catalogued non-protected file only after an explicit confirmation."""
    entry, path = _get_catalogued_file(file_id, require_indexed=False, require_desktop_open=True)
    file_info = serialize_file_entry(entry)
    if not confirmed:
        return {
            "status": "confirmation_required",
            "requires_confirmation": True,
            "message": f"Ready to open {path.name}. Confirm this action to continue.",
            "file": file_info,
        }

    try:
        _open_with_system_default(path)
    except OSError as exc:
        raise FileToolError("Could not ask the operating system to open this file.", status_code=503) from exc

    audit = db.record_file_audit(
        event_type="open",
        file_id=str(entry["file_id"]),
        path=str(path),
    )
    return {
        "status": "success",
        "message": f"Opening {path.name} with the system default application.",
        "file": file_info,
        "audit_id": audit["event_id"],
    }


def propose_edit(file_id: str, old_text: str, new_text: str) -> dict[str, object]:
    """Create a diff-only edit proposal; this function never writes the file."""
    if not old_text:
        raise FileToolError("old_text cannot be empty. Include unique surrounding text for a safe edit.", status_code=422)

    entry, path = _get_catalogued_file(file_id, require_indexed=True)
    if path.suffix.lower() not in EDITABLE_SUFFIXES:
        raise FileToolError("This file type is indexed but is not safely editable by this assistant.", status_code=422)

    current_text = _read_editable_text(path)
    _ensure_current(entry, path)
    occurrences = current_text.count(old_text)
    if occurrences == 0:
        raise FileToolError("The requested old_text was not found in the current file.", status_code=422)
    if occurrences > 1:
        raise FileToolError(
            "The requested old_text occurs more than once. Include more surrounding text so the edit is unambiguous.",
            status_code=409,
        )

    updated_text = current_text.replace(old_text, new_text, 1)
    diff = "".join(
        difflib.unified_diff(
            current_text.splitlines(keepends=True),
            updated_text.splitlines(keepends=True),
            fromfile=f"a/{path.name}",
            tofile=f"b/{path.name}",
        )
    )
    proposal = db.create_edit_proposal(
        file_id=file_id,
        path=str(path),
        original_hash=_text_hash(current_text),
        old_text=old_text,
        new_text=new_text,
        diff=diff,
    )
    audit = db.record_file_audit(
        event_type="edit_proposed",
        file_id=file_id,
        path=str(path),
        proposal_id=str(proposal["proposal_id"]),
    )
    return {
        "status": "proposal_ready",
        "requires_confirmation": True,
        "proposal_id": proposal["proposal_id"],
        "expires_at": proposal["expires_at"],
        "file": serialize_file_entry(entry),
        "diff": diff,
        "audit_id": audit["event_id"],
    }


def apply_edit(proposal_id: str, *, confirmed: bool, backup_dir: Path) -> dict[str, object]:
    """Apply one approved, non-expired proposal atomically and create a backup."""
    proposal = _get_pending_proposal(proposal_id)
    entry, path = _get_catalogued_file(str(proposal["file_id"]), require_indexed=True)
    if str(path) != proposal["path"]:
        raise FileToolError("The proposed file path no longer matches its approved catalog entry.", status_code=409)

    if not confirmed:
        return {
            "status": "confirmation_required",
            "requires_confirmation": True,
            "proposal_id": proposal_id,
            "expires_at": proposal["expires_at"],
            "file": serialize_file_entry(entry),
            "diff": proposal["diff"],
        }

    with _file_operation_lock:
        current_text = _read_editable_text(path)
        if _text_hash(current_text) != proposal["original_hash"]:
            raise FileToolError("The file changed after this proposal was created. Create a new proposal before editing.", status_code=409)
        if current_text.count(str(proposal["old_text"])) != 1:
            raise FileToolError("The proposed target text is no longer uniquely present in the file.", status_code=409)

        updated_text = current_text.replace(str(proposal["old_text"]), str(proposal["new_text"]), 1)
        backup_path = _create_backup(path, backup_dir, proposal_id)
        _atomic_write_text(path, updated_text)
        backup = db.create_backup_record(
            proposal_id=proposal_id,
            path=str(path),
            backup_path=str(backup_path),
            applied_hash=_text_hash(updated_text),
        )
        db.mark_edit_proposal_applied(proposal_id)
        _refresh_indexed_file(entry, path)
        audit = db.record_file_audit(
            event_type="edit_applied",
            file_id=str(entry["file_id"]),
            path=str(path),
            proposal_id=proposal_id,
            backup_id=str(backup["backup_id"]),
        )

    return {
        "status": "success",
        "message": f"Applied the approved edit to {path.name}.",
        "file": serialize_file_entry(entry),
        "backup_id": backup["backup_id"],
        "backup_path": backup["backup_path"],
        "audit_id": audit["event_id"],
    }


def undo_edit(backup_id: str, *, confirmed: bool, backup_dir: Path) -> dict[str, object]:
    """Restore one local backup after explicit confirmation."""
    backup = db.get_backup(backup_id)
    if backup is None:
        raise FileToolError("Backup not found.", status_code=404)
    if backup["restored_at"]:
        raise FileToolError("This backup has already been restored.", status_code=409)

    entry, path = _get_catalogued_file_by_path(str(backup["path"]), require_indexed=True)
    backup_path = Path(str(backup["backup_path"])).resolve()
    _validate_backup_location(backup_path, backup_dir)

    if not confirmed:
        return {
            "status": "confirmation_required",
            "requires_confirmation": True,
            "backup_id": backup_id,
            "message": f"Ready to restore the backup of {path.name}. Confirm this action to continue.",
            "file": serialize_file_entry(entry),
        }

    with _file_operation_lock:
        applied_hash = backup.get("applied_hash")
        if not isinstance(applied_hash, str) or not applied_hash:
            raise FileToolError(
                "This legacy backup has no applied-edit integrity record and cannot be safely restored automatically.",
                status_code=409,
            )
        current_text = _read_editable_text(path)
        if _text_hash(current_text) != applied_hash:
            raise FileToolError(
                "The file changed after the assistant edit. Refusing to overwrite newer changes during undo.",
                status_code=409,
            )
        try:
            original_text = backup_path.read_text(encoding="utf-8")
        except OSError as exc:
            raise FileToolError("The backup file is unavailable.", status_code=404) from exc
        _atomic_write_text(path, original_text)
        db.mark_backup_restored(backup_id)
        _refresh_indexed_file(entry, path)
        audit = db.record_file_audit(
            event_type="edit_undone",
            file_id=str(entry["file_id"]),
            path=str(path),
            backup_id=backup_id,
        )

    return {
        "status": "success",
        "message": f"Restored the backup of {path.name}.",
        "file": serialize_file_entry(entry),
        "backup_id": backup_id,
        "audit_id": audit["event_id"],
    }


def serialize_file_entry(entry: dict[str, object]) -> dict[str, object]:
    category = str(entry["category"])
    return {
        "file_id": entry["file_id"],
        "name": entry["name"],
        "path": entry["path"],
        "extension": entry["extension"],
        "category": category,
        "reason": entry["reason"],
        "size_bytes": entry["size_bytes"],
        "can_open": (
            category in {FileCategory.INDEXED.value, FileCategory.DISCOVERABLE.value}
            and is_desktop_open_allowed(Path(str(entry["name"])))
        ),
        "can_preview": category == FileCategory.INDEXED.value,
        "can_edit": category == FileCategory.INDEXED.value and str(entry["extension"]).lower() in EDITABLE_SUFFIXES,
    }


def _get_catalogued_file(
    file_id: str,
    *,
    require_indexed: bool,
    require_desktop_open: bool = False,
) -> tuple[dict[str, object], Path]:
    entry = db.get_catalog_file(file_id)
    if entry is None:
        raise FileToolError("File not found in the approved local catalog.", status_code=404)
    return _validate_catalog_entry(
        entry,
        require_indexed=require_indexed,
        require_desktop_open=require_desktop_open,
    )


def _get_catalogued_file_by_path(
    path: str,
    *,
    require_indexed: bool,
    require_desktop_open: bool = False,
) -> tuple[dict[str, object], Path]:
    entry = db.get_catalog_file_by_path(path)
    if entry is None:
        raise FileToolError("The backup target is no longer in the approved local catalog.", status_code=404)
    return _validate_catalog_entry(
        entry,
        require_indexed=require_indexed,
        require_desktop_open=require_desktop_open,
    )


def _validate_catalog_entry(
    entry: dict[str, object],
    *,
    require_indexed: bool,
    require_desktop_open: bool = False,
) -> tuple[dict[str, object], Path]:
    try:
        path, decision = validate_catalog_access(
            Path(str(entry["path"])),
            Path(str(entry["root_path"])),
            require_indexed=require_indexed,
        )
    except FilePolicyError as exc:
        raise FileToolError(exc.message, status_code=exc.status_code) from exc

    if require_indexed and entry["category"] != FileCategory.INDEXED.value:
        raise FileToolError("Only indexed text documents can be previewed or edited.", status_code=422)
    if require_desktop_open and not is_desktop_open_allowed(path):
        raise FileToolError(
            "This file can be previewed or edited when eligible, but the assistant will not open a potentially executable file type.",
            status_code=422,
        )
    return entry, path


def _ensure_current(entry: dict[str, object], path: Path) -> None:
    try:
        stats = path.stat()
    except OSError as exc:
        raise FileToolError("The selected file no longer exists.", status_code=404) from exc
    if stats.st_mtime_ns != entry["modified_ns"] or stats.st_size != entry["size_bytes"]:
        raise FileToolError("The file changed since it was indexed. Reindex it before previewing or editing.", status_code=409)


def _read_editable_text(path: Path) -> str:
    try:
        if path.stat().st_size > MAX_EDIT_BYTES:
            raise FileToolError("This file is too large for a safe assistant edit.", status_code=413)
        raw = path.read_bytes()
    except FileToolError:
        raise
    except OSError as exc:
        raise FileToolError("Could not read the selected file.", status_code=500) from exc
    if b"\x00" in raw:
        raise FileToolError("Binary files cannot be edited through this endpoint.", status_code=422)
    return raw.decode("utf-8", errors="strict")


def _get_pending_proposal(proposal_id: str) -> dict[str, object]:
    proposal = db.get_edit_proposal(proposal_id)
    if proposal is None:
        raise FileToolError("Edit proposal not found.", status_code=404)
    if proposal["status"] != "pending":
        raise FileToolError("This edit proposal has already been applied or is no longer available.", status_code=409)
    try:
        expires_at = datetime.fromisoformat(str(proposal["expires_at"]))
    except ValueError as exc:
        raise FileToolError("Edit proposal has invalid expiry data.", status_code=500) from exc
    if expires_at <= datetime.now(timezone.utc):
        raise FileToolError("This edit proposal expired. Create a new proposal.", status_code=410)
    return proposal


def _create_backup(path: Path, backup_dir: Path, proposal_id: str) -> Path:
    try:
        resolved_backup_root = backup_dir.resolve()
        destination_dir = resolved_backup_root / proposal_id
        destination_dir.mkdir(parents=True, exist_ok=False)
        if os.name != "nt":
            resolved_backup_root.chmod(0o700)
            destination_dir.chmod(0o700)
        backup_path = destination_dir / path.name
        shutil.copy2(path, backup_path)
        if os.name != "nt":
            backup_path.chmod(0o600)
    except OSError as exc:
        raise FileToolError("Could not create a backup before editing.", status_code=500) from exc
    return backup_path


def _atomic_write_text(path: Path, content: str) -> None:
    try:
        original_mode = stat.S_IMODE(path.stat().st_mode)
        descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
        temporary_path = Path(temporary_name)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8", newline="") as handle:
                handle.write(content)
                handle.flush()
                os.fsync(handle.fileno())
            os.chmod(temporary_path, original_mode)
            os.replace(temporary_path, path)
        except Exception:
            temporary_path.unlink(missing_ok=True)
            raise
    except OSError as exc:
        raise FileToolError("Could not write the approved file change.", status_code=500) from exc


def _refresh_indexed_file(entry: dict[str, object], path: Path) -> None:
    """Update RAG immediately after an approved edit instead of waiting for a scan."""
    text = parse_document(path)
    if not text:
        raise FileToolError("The edited file could not be re-indexed.", status_code=500)
    stats = path.stat()
    chunks = chunk_text(text, source=str(path), source_type="file")
    db.upsert_source(
        str(path),
        "file",
        chunks,
        content_hash=_text_hash(text),
        modified_ns=stats.st_mtime_ns,
        size_bytes=stats.st_size,
    )
    db.upsert_catalog_file(
        path,
        Path(str(entry["root_path"])),
        category=FileCategory.INDEXED.value,
        reason="Supported readable document.",
        size_bytes=stats.st_size,
        modified_ns=stats.st_mtime_ns,
    )


def _validate_backup_location(backup_path: Path, backup_dir: Path) -> None:
    try:
        backup_path.relative_to(backup_dir.resolve())
    except ValueError as exc:
        raise FileToolError("Backup path is outside the assistant backup directory.", status_code=403) from exc
    if not backup_path.is_file():
        raise FileToolError("The backup file is unavailable.", status_code=404)


def _open_with_system_default(path: Path) -> None:
    if sys.platform.startswith("linux"):
        if shutil.which("xdg-open") is None:
            raise OSError("xdg-open is unavailable")
        subprocess.Popen(
            ["xdg-open", str(path)],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        return
    if sys.platform == "darwin":
        subprocess.Popen(["open", str(path)], start_new_session=True)
        return
    if os.name == "nt":
        os.startfile(str(path))  # type: ignore[attr-defined]
        return
    raise OSError("No safe system file opener is configured for this platform")


def _text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()
