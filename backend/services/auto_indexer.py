"""Low-overhead background refresh of user-approved local index roots."""

from __future__ import annotations

import logging
import os
from threading import Event, Lock, Thread

from .indexer import sync_registered_roots

logger = logging.getLogger(__name__)

_thread: Thread | None = None
_stop_event = Event()
_thread_lock = Lock()


def start_auto_indexer() -> None:
    """Start one daemon that syncs approved folders on startup and periodically."""
    global _thread
    if not _enabled():
        logger.info("Automatic indexing is disabled by AUTO_INDEX_ENABLED.")
        return

    with _thread_lock:
        if _thread is not None and _thread.is_alive():
            return
        _stop_event.clear()
        _thread = Thread(target=_run, name="rag-auto-indexer", daemon=True)
        _thread.start()


def stop_auto_indexer() -> None:
    """Request a graceful stop when FastAPI shuts down."""
    _stop_event.set()


def _run() -> None:
    interval = _interval_seconds()
    # Wait one interval before the first scan so startup is not blocked
    # by a large initial index operation.
    _stop_event.wait(interval)
    while not _stop_event.is_set():
        try:
            summaries = sync_registered_roots()
            if summaries:
                updated = sum(summary.get("files_updated", 0) for summary in summaries)
                logger.info("Automatic RAG index scan completed for %s root(s); %s file(s) updated.", len(summaries), updated)
        except Exception:  # pragma: no cover - background safety net
            logger.exception("Automatic RAG index scan failed.")

        # Event.wait avoids an uninterruptible sleep at application shutdown.
        _stop_event.wait(interval)


def _enabled() -> bool:
    return os.getenv("AUTO_INDEX_ENABLED", "true").strip().lower() not in {"0", "false", "no", "off"}


def _interval_seconds() -> int:
    try:
        configured = int(os.getenv("AUTO_INDEX_INTERVAL_SECONDS", "1800"))
    except ValueError:
        configured = 1800
    # Do not allow accidental every-second full scans on a low-RAM local PC.
    return max(60, configured)
