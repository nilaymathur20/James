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
    address: str = ""
    primary_ip_hash: str = ""  # Primary client IP hash for this device


@dataclass(frozen=True)
class LinkedIP:
    device_id: str
    ip_hash: str
    nickname: str
    added_at: str

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
                    revoked BOOLEAN NOT NULL DEFAULT 0,
                    address TEXT NOT NULL DEFAULT '',
                    primary_ip_hash TEXT NOT NULL DEFAULT ''
                )
                """
            )
            # Table for linking multiple hashed IPs to a device
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS linked_ips (
                    ip_hash TEXT PRIMARY KEY,
                    device_id TEXT NOT NULL,
                    nickname TEXT NOT NULL,
                    added_at TEXT NOT NULL,
                    FOREIGN KEY (device_id) REFERENCES trusted_devices(device_id)
                )
                """
            )

    def add_device(self, device_id: str, public_key: str, nickname: str, address: str = "", primary_ip_hash: str = "") -> None:
        with self._lock, self._connection() as connection:
            connection.execute(
                """
                INSERT OR REPLACE INTO trusted_devices (device_id, public_key, nickname, last_seen, revoked, address, primary_ip_hash)
                VALUES (?, ?, ?, ?, 0, ?, ?)
                """,
                (device_id, public_key, nickname, datetime.now(timezone.utc).isoformat(), address, primary_ip_hash),
            )
            # Also add the primary IP to the linked IPs table if provided
            if primary_ip_hash:
                connection.execute(
                    """
                    INSERT OR REPLACE INTO linked_ips (ip_hash, device_id, nickname, added_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (primary_ip_hash, device_id, nickname, datetime.now(timezone.utc).isoformat()),
                )

    def link_ip(self, device_id: str, ip_hash: str, nickname: str = "") -> bool:
        """Link a new IP hash to an existing trusted device."""
        with self._lock, self._connection() as connection:
            # Check if device exists
            row = connection.execute(
                "SELECT * FROM trusted_devices WHERE device_id = ? AND revoked = 0", (device_id,)
            ).fetchone()
            if not row:
                return False

            connection.execute(
                """
                INSERT OR REPLACE INTO linked_ips (ip_hash, device_id, nickname, added_at)
                VALUES (?, ?, ?, ?)
                """,
                (ip_hash, device_id, nickname or row["nickname"], datetime.now(timezone.utc).isoformat()),
            )
            return True

    def get_device_by_ip(self, ip_hash: str) -> Optional[TrustedDevice]:
        """Find a trusted device by any of its linked IP hashes."""
        with self._lock, self._connection() as connection:
            # Check linked_ips table first
            row = connection.execute(
                """
                SELECT td.* FROM trusted_devices td
                JOIN linked_ips li ON td.device_id = li.device_id
                WHERE li.ip_hash = ? AND td.revoked = 0
                """,
                (ip_hash,),
            ).fetchone()
            if row:
                return TrustedDevice(**dict(row))

            # Check primary_ip_hash directly
            row = connection.execute(
                "SELECT * FROM trusted_devices WHERE primary_ip_hash = ? AND revoked = 0",
                (ip_hash,),
            ).fetchone()
            if row:
                return TrustedDevice(**dict(row))

            return None

    def list_linked_ips(self, device_id: str) -> list[LinkedIP]:
        """List all IP hashes linked to a device."""
        with self._lock, self._connection() as connection:
            rows = connection.execute(
                "SELECT * FROM linked_ips WHERE device_id = ?", (device_id,)
            ).fetchall()
            return [LinkedIP(**dict(row)) for row in rows]

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
