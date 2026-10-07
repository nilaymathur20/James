"""Central capability policy for local indexing, discovery, preview, and edits."""

from __future__ import annotations

import os
import stat
import sys
from dataclasses import dataclass
from enum import Enum
from pathlib import Path


class FileCategory(str, Enum):
    INDEXED = "indexed"
    DISCOVERABLE = "discoverable"
    PROTECTED = "protected"
    IGNORED = "ignored"


@dataclass(frozen=True)
class FileDecision:
    category: FileCategory
    reason: str

    @property
    def is_catalogued(self) -> bool:
        return self.category in {FileCategory.INDEXED, FileCategory.DISCOVERABLE}

    @property
    def can_preview(self) -> bool:
        return self.category == FileCategory.INDEXED

    @property
    def can_edit(self) -> bool:
        return self.category == FileCategory.INDEXED


class FilePolicyError(Exception):
    def __init__(self, message: str, status_code: int = 403) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


HOME = Path.home().resolve()
HOME_PARENT = HOME.parent

# Absolute operating-system paths. A project folder called "etc" is not blocked
# merely because it has that name; only the actual OS path is denied. Platform
# additions avoid accidentally treating system/application folders as normal
# user data when the backend is run outside Linux.
def _system_root_paths() -> tuple[Path, ...]:
    roots = {
        "/bin",
        "/boot",
        "/dev",
        "/etc",
        "/lib",
        "/lib32",
        "/lib64",
        "/lost+found",
        "/opt",
        "/proc",
        "/root",
        "/run",
        "/sbin",
        "/snap",
        "/sys",
        "/tmp",
        "/usr",
        "/var",
    }
    if sys.platform == "darwin":
        roots.update({"/Applications", "/Library", "/System", "/private"})
    if os.name == "nt":
        roots.update(
            value
            for value in (
                os.getenv("SystemRoot"),
                os.getenv("ProgramFiles"),
                os.getenv("ProgramFiles(x86)"),
                os.getenv("ProgramData"),
            )
            if value
        )
    return tuple(Path(path) for path in roots)


SYSTEM_ROOTS = _system_root_paths()

# These can contain credentials, browser data, cloud tokens, or machine config.
def _protected_home_roots() -> tuple[Path, ...]:
    names = {
        ".ssh",
        ".gnupg",
        ".pki",
        ".aws",
        ".kube",
        ".docker",
        ".config",
        ".mozilla",
    }
    if sys.platform == "darwin":
        names.add("Library")
    if os.name == "nt":
        names.add("AppData")
    return tuple(HOME / name for name in names)


PROTECTED_HOME_ROOTS = _protected_home_roots()

SKIPPED_DIRECTORY_NAMES = {
    "__pycache__",
    "node_modules",
    ".venv",
    "venv",
    "dist",
    "build",
    "coverage",
    "target",
    "history",  # accessed only through the dedicated history-memory service
    "output_files",
}
SENSITIVE_FILENAMES = {
    ".env",
    ".envrc",
    ".netrc",
    ".netrc.gpg",
    ".npmrc",
    ".pypirc",
    ".credentials",
    "config.json",
    "id_dsa",
    "id_ecdsa",
    "id_ed25519",
    "id_rsa",
    "known_hosts",
    "authorized_keys",
    "credentials.json",
    "cookies.sqlite",
    "login data",
}
SENSITIVE_FILE_STEMS = {
    "api-key",
    "api-keys",
    "api_key",
    "api_keys",
    "apikey",
    "credentials",
    "password",
    "passwords",
    "passwd",
    "private-key",
    "private_key",
    "secret",
    "secrets",
    "service-account",
    "service_account",
    "token",
    "tokens",
}
SENSITIVE_DIRECTORY_NAMES = {"credentials", "keyrings", "keys", "secrets"}
SENSITIVE_SUFFIXES = {".pem", ".key", ".p12", ".pfx", ".kdbx", ".keystore"}
# Unsupported files in this group are not merely non-indexable; asking the OS
# to open them may execute an installer, shell script, or application payload.
NON_OPENABLE_SUFFIXES = {
    ".app",
    ".appimage",
    ".apk",
    ".bash",
    ".bat",
    ".bin",
    ".cmd",
    ".cjs",
    ".com",
    ".command",
    ".cpl",
    ".deb",
    ".desktop",
    ".dll",
    ".dmg",
    ".exe",
    ".fish",
    ".gadget",
    ".hta",
    ".jar",
    ".js",
    ".jse",
    ".lnk",
    ".lua",
    ".mjs",
    ".msi",
    ".msp",
    ".php",
    ".pkg",
    ".pl",
    ".ps1",
    ".reg",
    ".rb",
    ".rpm",
    ".run",
    ".scpt",
    ".scr",
    ".sh",
    ".so",
    ".url",
    ".vbe",
    ".vbs",
    ".webloc",
    ".wsf",
    ".zsh",
}
# These text/code formats can still be indexed, previewed, or edited after the
# relevant checks, but must never be passed to an operating-system "open"
# association because some platforms execute them on double-click.
DESKTOP_OPEN_BLOCKED_SUFFIXES = NON_OPENABLE_SUFFIXES | {
    ".cjs",
    ".coffee",
    ".lua",
    ".mjs",
    ".perl",
    ".php",
    ".pl",
    ".py",
    ".pyw",
    ".rb",
    ".r",
    ".tcl",
}


def is_desktop_open_allowed(path: Path) -> bool:
    """Whether invoking the platform default app is safe for this extension."""
    return path.suffix.lower() not in DESKTOP_OPEN_BLOCKED_SUFFIXES


def validate_index_root(path: Path) -> Path:
    """Validate a user-selected folder before recursive traversal begins."""
    if _is_in_any(path, SYSTEM_ROOTS):
        raise FilePolicyError("Refusing to index an operating-system directory.")
    if _is_in_any(path, PROTECTED_HOME_ROOTS):
        raise FilePolicyError("Refusing to index a protected credentials or application-data directory.")

    try:
        resolved = path.expanduser().resolve(strict=True)
    except (OSError, RuntimeError) as exc:
        raise FilePolicyError("Invalid folder path.", status_code=400) from exc

    if not resolved.is_dir():
        raise FilePolicyError("Path must be an existing folder.", status_code=400)
    if resolved == Path(resolved.anchor):
        raise FilePolicyError(
            "Refusing to index the filesystem root. Choose a folder inside your home directory or a mounted data drive."
        )
    if _is_in_any(resolved, SYSTEM_ROOTS):
        raise FilePolicyError("Refusing to index an operating-system directory.")
    if _is_in_any(resolved, PROTECTED_HOME_ROOTS):
        raise FilePolicyError("Refusing to index a protected credentials or application-data directory.")
    if _has_restricted_directory_component(resolved):
        raise FilePolicyError("Refusing to index a hidden, cache, build, or assistant-internal directory.")
    if resolved == HOME_PARENT:
        raise FilePolicyError("Choose your own home folder or a specific folder, not every user home directory.")
    if _is_within(resolved, HOME_PARENT) and not _is_within(resolved, HOME):
        raise FilePolicyError("Refusing to index another user's home directory.")
    return resolved


def classify_file(path: Path, *, supported: bool) -> FileDecision:
    """Classify a file without reading its contents.

    Indexed files may be read and searched. Discoverable files are safe to show
    by name/path and open after confirmation, but their contents are not added
    to RAG. Protected and ignored files are not shown in ordinary search.
    """
    try:
        if path.is_symlink():
            return FileDecision(FileCategory.PROTECTED, "Symbolic links are not indexed or opened.")
        resolved = path.resolve(strict=True)
    except (OSError, RuntimeError):
        return FileDecision(FileCategory.IGNORED, "File is unavailable.")

    name = resolved.name
    lowered_name = name.lower()
    if _is_in_any(resolved, SYSTEM_ROOTS) or _is_in_any(resolved, PROTECTED_HOME_ROOTS):
        return FileDecision(FileCategory.PROTECTED, "Protected system or credential location.")
    if (
        name.startswith(".")
        or lowered_name in SENSITIVE_FILENAMES
        or lowered_name.startswith(".env.")
        or Path(lowered_name).stem in SENSITIVE_FILE_STEMS
    ):
        return FileDecision(FileCategory.PROTECTED, "Sensitive or hidden file.")
    if resolved.suffix.lower() in SENSITIVE_SUFFIXES:
        return FileDecision(FileCategory.PROTECTED, "Sensitive file type.")
    try:
        file_mode = resolved.stat().st_mode
    except OSError:
        return FileDecision(FileCategory.IGNORED, "File is unavailable.")
    if not stat.S_ISREG(file_mode):
        return FileDecision(FileCategory.IGNORED, "Only regular files are eligible for cataloguing.")
    if file_mode & (stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH):
        return FileDecision(FileCategory.PROTECTED, "Executable files are not indexed or opened.")
    if resolved.suffix.lower() in NON_OPENABLE_SUFFIXES:
        return FileDecision(FileCategory.PROTECTED, "Executable, installer, or OS launch descriptor.")
    if not supported:
        return FileDecision(FileCategory.DISCOVERABLE, "File type is not enabled for text indexing.")
    return FileDecision(FileCategory.INDEXED, "Supported readable document.")


def should_skip_directory(path: Path) -> bool:
    """Return true before ``os.walk`` descends into a child directory."""
    name = path.name
    if name.startswith(".") or name.lower() in SKIPPED_DIRECTORY_NAMES or name.lower() in SENSITIVE_DIRECTORY_NAMES:
        return True
    return _is_in_any(path, SYSTEM_ROOTS) or _is_in_any(path, PROTECTED_HOME_ROOTS)


def should_skip_file(path: Path, *, supported: bool) -> bool:
    """Legacy boolean helper used by callers that only need index eligibility."""
    return classify_file(path, supported=supported).category != FileCategory.INDEXED


def validate_catalog_access(path: Path, root: Path, *, require_indexed: bool = False) -> tuple[Path, FileDecision]:
    """Revalidate a catalogued path immediately before preview/open/edit actions."""
    safe_root = validate_index_root(root)
    try:
        expanded = path.expanduser()
        if expanded.is_symlink():
            raise FilePolicyError("Symbolic links cannot be accessed by the assistant.")
        resolved = expanded.resolve(strict=True)
    except FilePolicyError:
        raise
    except (OSError, RuntimeError) as exc:
        raise FilePolicyError("The selected file no longer exists.", status_code=404) from exc
    if not resolved.is_file():
        raise FilePolicyError("The selected path is not a file.", status_code=422)
    if not _is_within(resolved, safe_root):
        raise FilePolicyError("The selected file is outside its approved index folder.")
    try:
        relative_to_root = resolved.relative_to(safe_root)
    except ValueError as exc:  # Defensive; the containment check above should cover this.
        raise FilePolicyError("The selected file is outside its approved index folder.") from exc
    if _has_restricted_directory_component(relative_to_root.parent):
        raise FilePolicyError("This file is inside a hidden, cache, or excluded directory.")

    decision = classify_file(resolved, supported=resolved.suffix.lower() in _editable_or_indexable_suffixes())
    if not decision.is_catalogued:
        raise FilePolicyError("This file is protected and cannot be accessed by the assistant.")
    if require_indexed and decision.category != FileCategory.INDEXED:
        raise FilePolicyError("Only indexed text documents can be previewed or edited.", status_code=422)
    return resolved, decision


def _editable_or_indexable_suffixes() -> set[str]:
    # Imported lazily to avoid module coupling at import time.
    from .document_parser import SUPPORTED_SUFFIXES

    return SUPPORTED_SUFFIXES


def _has_restricted_directory_component(path: Path) -> bool:
    """Reject hidden/cache/build segments even when a nested child was supplied.

    ``Path.name`` alone is insufficient for a request such as
    ``~/project/.cache/nested``. The filesystem anchor and ordinary home path
    components are harmless; the directory names below them are evaluated.
    """
    return any(
        part.startswith(".") or part.lower() in SKIPPED_DIRECTORY_NAMES or part.lower() in SENSITIVE_DIRECTORY_NAMES
        for part in path.parts
        if part not in {path.anchor, "/"}
    )


def _is_in_any(path: Path, roots: tuple[Path, ...]) -> bool:
    return any(_is_within(path, root) for root in roots)


def _is_within(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except (OSError, RuntimeError, ValueError):
        return False
