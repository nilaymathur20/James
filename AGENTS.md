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
python -m pip install -r requirements-test.txt   # empty — see pitfalls
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

## Pitfalls

- `requirements.txt` at the project root holds the real dependencies (fastapi, uvicorn, vosk, selenium, PyAutoGUI, …) — **not** `backend/requirements.txt`, which does not exist.
- `requirements-test.txt`, `requirements-voice.txt`, `requirements-extras.txt` are all at the project root and are **empty (0 bytes)** — `pip install -r` succeeds but installs nothing; test deps (`pytest`, `fastapi.testclient`) must be installed manually.
- `backend/.env.example` ships as a template — copy to `backend/.env` and fill in real values.
- No auth on the backend — keep bound to `127.0.0.1`; do not expose to LAN.
- Vosk needs `ffmpeg` + a downloaded model; `VOSK_KEEP_LOADED=false` (default) unloads after each request (~4 GB RAM).
- Docker `compose.yaml` mounts `./runtime/*` dirs — create them manually with `chmod 700` before `docker compose up` or Docker creates root-owned folders.
- `DO_NOT` put secrets into an indexed folder — they get ingested into the SQLite FTS index.
- Two frontend dirs: `frontend/` (PWA/dev) and `James/` (Electron desktop) — don't confuse their `package.json` scripts.
- `AI_MODE=offline` is the default (from `backend/.env.example`); cloud generation requires `AI_MODE=cloud` explicitly, and local llama.cpp needs `AI_MODE=local` + a loopback server. A failed local model falls back to SQLite retrieval — never to a cloud provider.
- Chat history is opt-in per request (`use_history: true`); disable globally with `CHAT_HISTORY_ENABLED=false`.
