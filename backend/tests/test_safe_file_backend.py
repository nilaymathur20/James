"""Integration tests for the lightweight safe local-file backend.

Run from the project root:
    python -m pip install -r backend/requirements-test.txt
    python -m unittest discover -s backend/tests -v

The environment variables are set before importing backend modules so this
suite always uses one disposable SQLite index and disables background scans.
"""

from __future__ import annotations

import atexit
import os
import sqlite3
import stat
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

_TEST_WORKSPACE = tempfile.TemporaryDirectory(prefix="james_backend_tests_", dir=Path.home())
atexit.register(_TEST_WORKSPACE.cleanup)
os.environ["RAG_DB_PATH"] = str(Path(_TEST_WORKSPACE.name) / "rag_index.db")
os.environ["AUTO_INDEX_ENABLED"] = "false"
os.environ["AI_MODE"] = "offline"
os.environ["CHAT_HISTORY_ENABLED"] = "true"
os.environ["LOCAL_LLM_BASE_URL"] = ""
os.environ["WS_ALLOWED_ORIGINS"] = ""
os.environ["WS_ALLOW_MISSING_ORIGIN"] = "false"

from fastapi.testclient import TestClient  # noqa: E402
from starlette.websockets import WebSocketDisconnect  # noqa: E402

from backend.main import app  # noqa: E402
from backend.routers.assistant_ws import _is_allowed_origin  # noqa: E402
from backend.services.file_policy import FilePolicyError, validate_index_root  # noqa: E402
from backend.services.file_tools import FileToolError, apply_edit, open_file, search_files  # noqa: E402
from backend.services.indexer import index_folder_path, sync_registered_roots  # noqa: E402
from backend.services.llm import answer_question, configured_provider, local_llm_status  # noqa: E402
from backend.services.response_engine import answer_with_rag  # noqa: E402
from backend.services.retrieval import retrieve_matches  # noqa: E402
from backend.services.vector_db import SQLiteFTSIndex, db  # noqa: E402


class SafeFileBackendTests(unittest.TestCase):
    def setUp(self) -> None:
        db.clear()
        self.temp_dir = tempfile.TemporaryDirectory(prefix="case_", dir=_TEST_WORKSPACE.name)
        self.base = Path(self.temp_dir.name)
        self.docs = self.base / "docs"
        self.docs.mkdir()
        self.history = self.base / "history"
        self.history.mkdir()
        app.state.backup_dir = self.base / "backups"

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def _write_fixture_files(self) -> None:
        (self.docs / "guide.md").write_text(
            "FastAPI keeps this local assistant private and searchable.\n", encoding="utf-8"
        )
        (self.docs / "reference.pdf").write_bytes(b"PDF placeholder")
        (self.docs / ".env").write_text("TOKEN=never-indexed", encoding="utf-8")
        (self.docs / "secrets.md").write_text("secret content is never-indexed", encoding="utf-8")
        (self.docs / "keys").mkdir()
        (self.docs / "keys" / "key.md").write_text("key material is never-indexed", encoding="utf-8")
        (self.docs / "payload.exe").write_bytes(b"never-open")

    def test_http_file_lifecycle_confirmation_audit_and_voice_status(self) -> None:
        self._write_fixture_files()
        with TestClient(app) as client:
            health = client.get("/api/health")
            self.assertEqual(health.status_code, 200)
            self.assertEqual(health.json()["local_model"]["mode"], "offline")
            self.assertTrue(health.json()["history"]["requires_request_opt_in"])
            self.assertEqual(client.post("/api/index-folder", json={"path": "/etc"}).status_code, 403)
            # The unified one-box route uses the exact same root policy.
            self.assertEqual(client.post("/api/assistant", json={"text": "index /etc"}).status_code, 403)
            self.assertEqual(client.post("/api/assistant", json={"text": "index /"}).status_code, 403)

            indexed = client.post("/api/index-folder", json={"path": str(self.docs)})
            self.assertEqual(indexed.status_code, 200, indexed.text)
            self.assertEqual(indexed.json()["files_updated"], 1)
            self.assertEqual(indexed.json()["files_discoverable"], 1)
            self.assertEqual(client.get("/api/index-status").json()["catalogued_files"], 2)

            # Sensitive and executable names are neither indexed nor catalogued.
            self.assertEqual(client.post("/api/files/search", json={"query": "env"}).json()["results"], [])
            self.assertEqual(client.post("/api/files/search", json={"query": "secrets"}).json()["results"], [])
            self.assertEqual(client.post("/api/files/search", json={"query": "payload"}).json()["results"], [])

            pdf = client.post("/api/files/search", json={"query": "reference"}).json()["results"][0]
            self.assertEqual(pdf["category"], "discoverable")
            self.assertTrue(pdf["can_open"])
            self.assertEqual(
                client.post("/api/files/open", json={"file_id": pdf["file_id"]}).json()["status"],
                "confirmation_required",
            )

            candidate_response = client.post("/api/assistant", json={"text": "preview guide"})
            self.assertEqual(candidate_response.status_code, 200, candidate_response.text)
            guide = candidate_response.json()["file_candidates"][0]
            preview = client.post("/api/files/preview", json={"file_id": guide["file_id"]})
            self.assertEqual(preview.status_code, 200, preview.text)
            self.assertIn("private", preview.json()["content"])
            self.assertTrue(preview.json()["audit_id"].startswith("audit_"))

            proposal = client.post(
                "/api/files/propose-edit",
                json={"file_id": guide["file_id"], "old_text": "private", "new_text": "offline-first"},
            )
            self.assertEqual(proposal.status_code, 200, proposal.text)
            proposal_id = proposal.json()["proposal_id"]
            self.assertEqual(
                client.post("/api/files/apply-edit", json={"proposal_id": proposal_id}).json()["status"],
                "confirmation_required",
            )
            applied = client.post(
                "/api/files/apply-edit", json={"proposal_id": proposal_id, "confirmed": True}
            )
            self.assertEqual(applied.status_code, 200, applied.text)
            self.assertIn("offline-first", (self.docs / "guide.md").read_text(encoding="utf-8"))

            backup_id = applied.json()["backup_id"]
            self.assertEqual(
                client.post("/api/files/undo-edit", json={"backup_id": backup_id}).json()["status"],
                "confirmation_required",
            )
            # Undo must not overwrite a later manual change, even after a
            # separate confirmation has been shown.
            (self.docs / "guide.md").write_text("manual newer edit", encoding="utf-8")
            self.assertEqual(
                client.post("/api/files/undo-edit", json={"backup_id": backup_id, "confirmed": True}).status_code,
                409,
            )
            (self.docs / "guide.md").write_text(
                "FastAPI keeps this local assistant offline-first and searchable.\n", encoding="utf-8"
            )
            undone = client.post("/api/files/undo-edit", json={"backup_id": backup_id, "confirmed": True})
            self.assertEqual(undone.status_code, 200, undone.text)
            self.assertIn("private", (self.docs / "guide.md").read_text(encoding="utf-8"))

            audit = client.get("/api/files/audit?limit=10")
            self.assertEqual(audit.status_code, 200, audit.text)
            events = audit.json()["results"]
            self.assertTrue({"preview", "edit_proposed", "edit_applied", "edit_undone"} <= {e["event_type"] for e in events})
            self.assertTrue(all("path" not in event for event in events))

            voice = client.get("/api/transcribe/status")
            self.assertEqual(voice.status_code, 200)
            self.assertEqual(voice.json()["provider"], "whisper")
            self.assertEqual(
                client.post("/api/transcribe", files={"audio": ("clip.webm", b"")}).status_code,
                422,
            )

    def test_local_llama_cpp_provider_is_loopback_only_and_context_bounded(self) -> None:
        with patch.dict(
            os.environ,
            {
                "AI_MODE": "offline",
                "OPENROUTER_API_KEY": "would-be-ignored",
                "LOCAL_LLM_BASE_URL": "",
            },
            clear=False,
        ):
            self.assertIsNone(configured_provider())

        with patch.dict(
            os.environ,
            {"AI_MODE": "local", "LOCAL_LLM_BASE_URL": "https://model.example/v1"},
            clear=False,
        ):
            self.assertIsNone(configured_provider())
            self.assertFalse(local_llm_status()["configured"])

        class FakeResponse:
            ok = True
            status_code = 200

            @staticmethod
            def json() -> dict[str, object]:
                return {"choices": [{"message": {"content": "Local answer only."}}]}

        with patch.dict(
            os.environ,
            {
                "AI_MODE": "local",
                "LOCAL_LLM_BASE_URL": "http://127.0.0.1:8081/v1",
                "LOCAL_LLM_MODEL": "qwen-small-local",
                "OPENROUTER_API_KEY": "would-be-ignored",
            },
            clear=False,
        ), patch("backend.services.llm.requests.post", return_value=FakeResponse()) as post:
            self.assertEqual(configured_provider(), "llama.cpp")
            answer = answer_question("Q" * 5_000, ["C" * 7_000])
            self.assertEqual(answer, "Local answer only.")
            self.assertEqual(post.call_args.args[0], "http://127.0.0.1:8081/v1/chat/completions")
            self.assertFalse(post.call_args.kwargs["allow_redirects"])
            local_prompt = post.call_args.kwargs["json"]["messages"][1]["content"]
            self.assertLessEqual(len(local_prompt), 8_000 + 4_000 + 31)

    def test_history_is_request_opt_in_and_local_storage_is_owner_only(self) -> None:
        answer_with_rag("Do not save this exchange.", self.history, use_history=False)
        self.assertEqual(list(self.history.glob("chat_*.md")), [])

        answer_with_rag("Save this local exchange.", self.history, use_history=True)
        saved_files = list(self.history.glob("chat_*.md"))
        self.assertEqual(len(saved_files), 1)
        if os.name != "nt":
            self.assertEqual(stat.S_IMODE(self.history.stat().st_mode) & 0o077, 0)
            self.assertEqual(stat.S_IMODE(saved_files[0].stat().st_mode) & 0o077, 0)
            self.assertEqual(stat.S_IMODE(db.database_path.stat().st_mode) & 0o077, 0)

        with patch.dict(os.environ, {"CHAT_HISTORY_ENABLED": "false"}, clear=False):
            answer_with_rag("Global privacy setting blocks this save.", self.history, use_history=True)
        self.assertEqual(list(self.history.glob("chat_*.md")), saved_files)

    def test_live_socket_streams_progress_and_preserves_http_safe_actions(self) -> None:
        (self.docs / "socket.md").write_text(
            "WebSocket progress is local and safely searchable after indexing.", encoding="utf-8"
        )
        self.assertTrue(_is_allowed_origin("http://localhost:5173"))
        self.assertFalse(_is_allowed_origin("https://untrusted.example"))

        with TestClient(app) as client:
            with self.assertRaises(WebSocketDisconnect) as denied_socket:
                with client.websocket_connect("/ws/assistant", headers={"origin": "https://untrusted.example"}):
                    pass
            self.assertEqual(denied_socket.exception.code, 1008)

            with client.websocket_connect("/ws/assistant", headers={"origin": "http://localhost:5173"}) as socket:
                ready = socket.receive_json()
                self.assertEqual(ready["type"], "ready")
                self.assertEqual(ready["protocol"], "james.assistant.v1")

                socket.send_json({"type": "ping"})
                self.assertEqual(socket.receive_json()["type"], "pong")

                socket.send_json({"type": "file_confirmation", "confirmed": True})
                self.assertEqual(socket.receive_json()["code"], "unsupported_message")

                socket.send_text("not json")
                self.assertEqual(socket.receive_json()["code"], "invalid_json")
                socket.send_text("x" * 32_001)
                self.assertEqual(socket.receive_json()["code"], "message_too_large")

                socket.send_json({"type": "assistant_message", "request_id": "blocked-1", "text": "index /etc"})
                while True:
                    event = socket.receive_json()
                    if event["type"] in {"assistant_result", "error"}:
                        break
                self.assertEqual(event["type"], "error")
                self.assertEqual(event["status_code"], 403)

                socket.send_json(
                    {
                        "type": "assistant_message",
                        "request_id": "index-1",
                        "text": f"index {self.docs}",
                        "source": "typed",
                    }
                )
                progress_types: list[str] = []
                while True:
                    event = socket.receive_json()
                    progress_types.append(event["type"])
                    if event["type"] in {"assistant_result", "error"}:
                        break
                self.assertEqual(event["type"], "assistant_result", event)
                self.assertEqual(event["result"]["kind"], "index_folder")
                self.assertIn("index_progress", progress_types)

                socket.send_json(
                    {
                        "type": "assistant_message",
                        "request_id": "search-1",
                        "text": "search WebSocket progress",
                        "source": "typed",
                    }
                )
                while True:
                    event = socket.receive_json()
                    if event["type"] in {"assistant_result", "error"}:
                        break
                self.assertEqual(event["type"], "assistant_result", event)
                self.assertTrue(event["result"]["results"])

    def test_confirmed_desktop_open_is_mocked_and_audited(self) -> None:
        (self.docs / "notes.md").write_text("Local document for safe opening.", encoding="utf-8")
        (self.docs / "script.py").write_text("print('This code stays previewable but is not desktop-openable')", encoding="utf-8")
        index_folder_path(str(self.docs))
        entry = search_files("notes")[0]
        script = search_files("script")[0]
        self.assertTrue(script["can_preview"])
        self.assertTrue(script["can_edit"])
        self.assertFalse(script["can_open"])
        with self.assertRaises(FileToolError) as blocked_open:
            open_file(script["file_id"], confirmed=True)
        self.assertEqual(blocked_open.exception.status_code, 422)

        with patch("backend.services.file_tools._open_with_system_default") as opener:
            self.assertEqual(open_file(entry["file_id"], confirmed=False)["status"], "confirmation_required")
            opener.assert_not_called()
            result = open_file(entry["file_id"], confirmed=True)
            opener.assert_called_once_with((self.docs / "notes.md").resolve())

        self.assertEqual(result["status"], "success")
        self.assertTrue(result["audit_id"].startswith("audit_"))
        self.assertEqual(db.list_file_audit_events(limit=1)[0]["event_type"], "open")

    def test_stale_dynamic_files_are_withheld_and_invalid_roots_are_cleaned(self) -> None:
        stale = self.docs / "stale.md"
        executable = self.docs / "executable.md"
        stale.write_text("old retrieval phrase is safely indexed at first", encoding="utf-8")
        executable.write_text("an executable file must not remain in local RAG", encoding="utf-8")
        pipe = self.docs / "pipe.md"
        if hasattr(os, "mkfifo"):
            os.mkfifo(pipe)
        index_folder_path(str(self.docs))
        self.assertEqual(db.count, 2)
        if pipe.exists():
            self.assertIsNone(db.get_catalog_file_by_path(str(pipe)))

        stale.write_text("new retrieval phrase needs a safe reindex", encoding="utf-8")
        self.assertEqual(retrieve_matches("old retrieval phrase", self.history, include_history=False), [])
        self.assertEqual(db.count, 1)
        index_folder_path(str(self.docs))
        self.assertTrue(retrieve_matches("new retrieval phrase", self.history, include_history=False))

        executable.chmod(executable.stat().st_mode | 0o111)
        if executable.stat().st_mode & 0o111:
            self.assertEqual(retrieve_matches("executable file", self.history, include_history=False), [])
            self.assertEqual(search_files("executable"), [])
        else:
            real_stat = Path.stat
            def fake_stat(path_obj, *args, **kwargs):
                st = real_stat(path_obj, *args, **kwargs)
                if path_obj.resolve() == executable.resolve():
                    return os.stat_result((st.st_mode | stat.S_IXUSR, *st[1:]))
                return st
            with patch.object(Path, "stat", fake_stat):
                self.assertEqual(retrieve_matches("executable file", self.history, include_history=False), [])
                self.assertEqual(search_files("executable"), [])

        hidden_child = self.docs / ".hidden" / "nested"
        cache_child = self.docs / "node_modules" / "nested"
        secret_child = self.docs / "secrets" / "nested"
        hidden_child.mkdir(parents=True)
        cache_child.mkdir(parents=True)
        secret_child.mkdir(parents=True)
        for unsafe_root in (hidden_child, cache_child, secret_child):
            with self.assertRaises(FilePolicyError):
                validate_index_root(unsafe_root)

        # A deleted approved root has its stale state and registration removed.
        cleanup_root = self.base / "cleanup-root"
        cleanup_root.mkdir()
        (cleanup_root / "note.md").write_text("temporary root content", encoding="utf-8")
        index_folder_path(str(cleanup_root))
        (cleanup_root / "note.md").unlink()
        cleanup_root.rmdir()
        summaries = sync_registered_roots()
        self.assertTrue(any(summary.get("folder") == str(cleanup_root) for summary in summaries))
        self.assertNotIn(str(cleanup_root), [root["path"] for root in db.registered_roots()])

    def test_symlink_replaced_root_is_unregistered_and_purged_lexically(self) -> None:
        replacement_root = self.base / "replacement-root"
        replacement_root.mkdir()
        note = replacement_root / "note.md"
        note.write_text("safe indexed text before root replacement", encoding="utf-8")
        index_folder_path(str(replacement_root))
        source = str(note.resolve())
        self.assertEqual(db.count, 1)

        moved_root = self.base / "moved-root"
        replacement_root.rename(moved_root)
        try:
            replacement_root.symlink_to(Path.home().parent, target_is_directory=True)
        except OSError as exc:  # pragma: no cover - Windows may disallow symlinks without elevation.
            self.skipTest(f"Could not create a test symlink: {exc}")

        summaries = sync_registered_roots()
        self.assertTrue(any(summary.get("folder") == str(replacement_root) for summary in summaries))
        self.assertIsNone(db.get_catalog_file_by_path(source))
        self.assertEqual(db.search_results("safe indexed text", top_k=5), [])
        self.assertNotIn(str(replacement_root), [root["path"] for root in db.registered_roots()])

    def test_persistent_catalog_pruning_and_expired_proposal(self) -> None:
        text_file = self.docs / "alpha.md"
        pdf_file = self.docs / "manual.pdf"
        text_file.write_text("alpha local assistant documentation", encoding="utf-8")
        pdf_file.write_bytes(b"PDF placeholder")
        index_folder_path(str(self.docs))
        self.assertEqual((db.count, db.catalog_count), (1, 2))

        pdf_file.unlink()
        summary = index_folder_path(str(self.docs))
        self.assertEqual(summary["catalog_files_removed"], 1)
        text_file.unlink()
        summary = index_folder_path(str(self.docs))
        self.assertEqual(summary["files_removed"], 1)
        self.assertEqual((db.count, db.catalog_count), (0, 0))

        text_file.write_text("alpha local assistant documentation", encoding="utf-8")
        index_folder_path(str(self.docs))
        reopened = SQLiteFTSIndex(Path(os.environ["RAG_DB_PATH"]))
        self.assertEqual((reopened.count, reopened.catalog_count, reopened.registered_root_count), (1, 1, 1))

        entry = search_files("alpha")[0]
        from backend.services.file_tools import propose_edit

        proposal = propose_edit(entry["file_id"], "alpha", "beta")
        connection = sqlite3.connect(os.environ["RAG_DB_PATH"])
        try:
            connection.execute(
                "UPDATE edit_proposals SET expires_at = ? WHERE proposal_id = ?",
                ("2000-01-01T00:00:00+00:00", proposal["proposal_id"]),
            )
            connection.commit()
        finally:
            connection.close()
        with self.assertRaises(FileToolError) as error:
            apply_edit(proposal["proposal_id"], confirmed=True, backup_dir=self.base / "backups")
        self.assertEqual(error.exception.status_code, 410)
        self.assertEqual(text_file.read_text(encoding="utf-8"), "alpha local assistant documentation")


if __name__ == "__main__":
    unittest.main(verbosity=2)
