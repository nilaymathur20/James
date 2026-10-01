"""Management of trusted P2P devices and cryptographic pairing.
This service manages a SQLite table of known peers and handles the verification of pairing requests.
"""

from __future__ import annotations

import sqlite3
import time
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from typing import Iterator, Optional

@dataclass(frozen=True)
class TrustedDevice:
    device_id: str
    public_key: str
    nickname: str
    last_seen: str
    revoked: bool

class TrustStore:
    def __init__(self, db_path: Path):
        self._db_path = db_path
        self._lock = RLock()
        self._initialize()

    @contextmanager
    def _connection(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self._db_path)
        connection.row_factory = sqlite3.Row
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def _initialize(self) -> None:
        with self._lock, self._connection() as connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS trusted_devices (
                    device_id TEXT PRIMARY KEY,
                    public_key TEXT NOT NULL,
                    nickname TEXT NOT NULL,
                    last_seen TEXT NOT NULL,
                    revoked BOOLEAN NOT NULL DEFAULT 0
                )
                """
            )

    def add_device(self, device_id: str, public_key: str, nickname: str) -> None:
        with self._lock, self._connection() as connection:
            connection.execute(
                """
                INSERT OR REPLACE INTO trusted_devices (device_id, public_key, nickname, last_seen, revoked)
                VALUES (?, ?, ?, ?, 0)
                """,
                (device_id, public_key, nickname, datetime.now(timezone.utc).isoformat()),
            )

    def get_device(self, device_id: str) -> Optional[TrustedDevice]:
        with self._lock, self._connection() as connection:
            row = connection.execute(
                "SELECT * FROM trusted_devices WHERE device_id = ?", (device_id,)
            ).fetchone()
            if row:
                return TrustedDevice(**dict(row))
            return None

    def list_devices(self) -> list[TrustedDevice]:
        with self._lock, self._connection() as connection:
            rows = connection.execute("SELECT * FROM trusted_devices").fetchall()
            return [TrustedDevice(**dict(row)) for row in rows]

    def revoke_device(self, device_id: str) -> None:
        with self._lock, self._connection() as connection:
            connection.execute(
                "UPDATE trusted_devices SET revoked = 1 WHERE device_id = ?", (device_id,)
            )

    def update_last_seen(self, device_id: str) -> None:
        with self._lock, self._connection() as connection:
            connection.execute(
                "UPDATE trusted_devices SET last_seen = ? WHERE device_id = ?",
                (datetime.now(timezone.utc).isoformat(), device_id),
            )
