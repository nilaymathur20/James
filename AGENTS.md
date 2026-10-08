# James — Local AI Assistant

Privacy-first FastAPI backend + React/Electron desktop. SQLite FTS5 for RAG (no vector server). Guarded file ops with proposals, backups, undo. WebSocket at `/ws/assistant`.

## Dev environment

- Python 3.10+, venv at `.venv/`
- Node.js + npm for frontend; Electron desktop wrapper needs Node.js
- `backend/.env` loads config; process env overrides it

## Build & test

**Backend API:**
```bash
cd ~/Desktop/projects/james
python3 -m venv .venv && . .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

**Frontend (Vite dev):**
```bash
cd frontend && npm install && npm run dev        # http://localhost:5173
```

**Desktop (Electron, from James/):**
```bash
cd James && npm install && npm run electron:dev    # dev
cd James && npm run electron:build                  # release
```

**Tests:**
```bash
. .venv/bin/activate
python -m pip install -r requirements-test.txt   # populated: pytest + httpx
python -m unittest discover -s backend/tests -v
```

**Docker:**
```bash
docker compose build && docker compose up -d     # binds 127.0.0.1:8000 only
```

## Conventions

- File mutations go through the guarded flow: `search` → `preview` → `propose-edit` → `apply-edit` (requires `confirmed: true`). Never pass raw paths to action routes — use server-generated `file_id`.
- WebSocket messages use `james.assistant.v1` protocol; only one in-flight request per connection.
- `.env` files are gitignored; never commit secrets.
- Backend reads env at request time (`llm.py`) and at startup (`main.py`); `os.environ.setdefault` means shell env wins over `.env`.
- Test suite sets env vars **before** importing backend modules; uses disposable SQLite + temp dirs.
- `requirements-test.txt` at the project root holds `pytest` + `httpx` (switched from `fastapi-testclient`).

## Pitfalls

- `requirements.txt` at the project root holds the real dependencies (fastapi, uvicorn, whisper.cpp, selenium, PyAutoGUI, …) — **not** `backend/requirements.txt`, which does not exist.
| `requirements-test.txt` at the project root holds `pytest` + `httpx` (switched from `fastapi-testclient`).
- `backend/.env.example` ships as a template — copy to `backend/.env` and fill in real values.
- No auth on the backend — keep bound to `127.0.0.1`; do not expose to LAN.
- whisper.cpp needs `ffmpeg` + a downloaded `.bin` model; per-invocation loading (no persistent RAM cost). Vosk is legacy.
- Docker `compose.yaml` mounts `./runtime/*` dirs — create them manually with `chmod 700` before `docker compose up` or Docker creates root-owned folders.
- `DO_NOT` put secrets into an indexed folder — they get ingested into the SQLite FTS index.
- Two frontend dirs: `frontend/` (PWA/dev) and `James/` (Electron desktop) — don't confuse their `package.json` scripts.
- `AI_MODE=offline` is the default (from `backend/.env.example`); cloud generation requires `AI_MODE=cloud` explicitly, and local llama.cpp needs `AI_MODE=local` + a loopback server. A failed local model falls back to SQLite retrieval — never to a cloud provider.
- Chat history is on by default (`use_history: true`); disable globally with `CHAT_HISTORY_ENABLED=false`.

## Project layout

- `backend/` — FastAPI app (`main.py`, routers, services)
- `frontend/` — Vite + React PWA dev server (port 5173)
- `James/` — Electron desktop wrapper (main.js, preload.js)
- `mobile/` — React Native (Expo SDK 57) app; web bundling needs `react-native-web`, `react-dom` (matching react version), `babel-preset-expo`
- `runtime/` — backups, history, output_files (create manually with chmod 700 for Docker)
- `data/` — SQLite FTS5 index (`rag_index.db`)

## Architecture

- ReAct agent loop (`agent_loop.py`): structured function-calling (JSON first, regex fallback), 120s total budget, 30s/step, 8 max steps
- Deterministic command handler (`command_handler.py`) runs before the agent path
- Unified assistant flow (`assistant_flow.py`): commands → agent → RAG fallback
|- 12 registered tools in `tool_registry.py`: search_rag, discover_files, preview_file, propose_file_edit, calculate, index_directory, get_system_status, generate_image, browse_web, scrape_web, web_search, analyze_image
- LLM providers: llama.cpp (local loopback), Groq, OpenRouter, Gemini
- STT: whisper.cpp (primary), Vosk (legacy)
- TTS: edge-tts
- Image generation: Pollinations.ai (zero-auth)
- WebSocket: `james.assistant.v1` protocol, `/ws/assistant`, one in-flight request per connection
- SQLiteFTSIndex (`vector_db.py`): lazy init, `database_path` property, idempotent `_ensure_initialized()`
- File policy (`file_policy.py`): `validate_index_root()` rejects system roots and protected home dirs before traversal
| Test suite: 8 pass, 0 failures (unittest + pytest). Previously 12 pass / 0 failures; user fix resolved `test_persistent_catalog_pruning_and_expired_proposal`.
