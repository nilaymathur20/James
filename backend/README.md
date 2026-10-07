# James local assistant backend

A small, privacy-conscious FastAPI backend for the one-composer React UI. It uses a hybrid transport: a live same-origin WebSocket streams command/indexing status, while guarded file confirmations and uploads remain explicit HTTP requests. Local retrieval stays lightweight: selected folders are indexed into a persistent SQLite FTS5 database, and normal local search does **not** require an LLM, cloud API, vector server, or a large local model.

## What stays local

- Folder indexing, incremental refresh, lexical RAG search, and optional prior-chat retrieval.
- Live same-origin command status and indexing progress over `/ws/assistant`; final results use the same shape as the HTTP assistant endpoint.
- The SQLite index at `data/rag_index.db` by default (override with `RAG_DB_PATH`).
- A metadata-only catalog for safe, unsupported files, so names/paths can be found without ingesting their contents.
- Preview, edit proposals, confirmed atomic edits, backups, confirmed undo, and content-free audit records.
- Optional Vosk speech-to-text when configured. It converts a short push-to-talk recording to text locally; it is not used for reasoning, RAG, code generation, or file execution.

Generation defaults to **offline retrieval-only** even if cloud API keys happen to exist in the environment. A local llama.cpp provider is available only when explicitly enabled; cloud generation requires a separate explicit opt-in and is never a fallback from local mode.

## Safety model

Only folders explicitly submitted to `POST /api/index-folder` (or `index ~/Documents` through `POST /api/assistant`) are approved for refresh.

| Category | Stored | Permitted actions |
| --- | --- | --- |
| `indexed` | Filename/path metadata plus extracted supported text chunks | Search, preview, edit proposal, confirmed edit, confirmed open |
| `discoverable` | Filename/path metadata only | Search and confirmed desktop open; never RAG content, preview, or edit |
| `protected` / `ignored` | Not normally catalogued or listed | No index, preview, open, edit, or normal search result |

The policy refuses filesystem roots, OS/system paths, another user’s home, protected credential/application-data locations, hidden/cache/build roots, sensitive filenames and key material, symlinks, executable files, and installer/launch descriptors. During a recursive scan it skips hidden folders, `node_modules`, virtual environments, build/cache folders, secrets, symlinks, and non-regular filesystem entries. The same policy is checked again immediately before a preview, open, edit, or undo; changed/protected file chunks are also withheld from retrieval until a safe reindex occurs.

No assistant route accepts an arbitrary client path for an action: action routes take a server-generated `file_id`, `proposal_id`, or `backup_id` from the approved catalog. Desktop open, apply-edit, and undo-edit require a separate `confirmed: true` request. Indexed source-code files may still be previewed or edited through the guarded flow, but are deliberately not passed to an OS desktop-open association because some platforms execute them on double-click.

## Privacy defaults and local-history opt-in

- `AI_MODE=offline` is the default. No cloud model is selected merely because an API key exists.
- `AI_MODE=local` accepts only a loopback (`127.0.0.1`, `localhost`, or `::1`) llama.cpp-compatible server. A remote URL is rejected before any request is sent.
- A failed or unavailable local model falls back to local SQLite retrieval — **never** to a cloud provider.
- Chat history is available locally but is not read or saved unless a request sends `use_history: true`. The React composer exposes this as an unchecked **Save/use local history** opt-in.
- Set `CHAT_HISTORY_ENABLED=false` to disable all history reads and writes at the installation level.
- The RAG database directory is made owner-only (`0700`) and database/WAL files, chat-history files, and assistant backups are made owner-readable/writable (`0600`) on POSIX systems where permissions allow it.

These permissions are an access-control layer, not encryption. Keep the project outside cloud-sync folders, use full-disk encryption and a locked OS account, and do not run untrusted software under the same user account. The root `.gitignore` excludes local indexes, history, backups, generated output, and `.env` credentials from source control. Existing history or index data created before these settings remains local; delete it manually if you no longer want to retain it.

## Minimal setup

Use Python 3.10+ with SQLite built with FTS5 support. From the project root (the folder containing both `backend/` and `frontend/`):

```bash
cd ~/Desktop/projects/james
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
```

Start the API:

```bash
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

Keep the API bound to `127.0.0.1`: this local backend has no multi-user authentication and can carry out separately confirmed file operations. If a trusted deployment truly needs another interface, set `HOST` deliberately; do not expose it directly to an untrusted LAN or the public internet.

Check it in a second terminal:

```bash
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/api/index-status
```

The API works without a model/API key for indexing, retrieval, catalog search, previews, edit proposals, and file confirmations. Do not put secrets into an indexed folder.

### Optional local pretrained model: llama.cpp

The backend does **not** download, load, or update a model itself. Run a trusted local `llama-server` binary separately, bound only to loopback, and configure the backend to call it. For a roughly 4 GB RAM machine, start with a small quantized GGUF such as a Qwen2.5 0.5B Instruct Q4 model; do not attempt a 7B model.

```bash
# Example only: use your verified local GGUF path and a current llama.cpp build.
llama-server -m ~/models/qwen-small-instruct-q4.gguf \
  --host 127.0.0.1 --port 8081 -c 2048 -ngl 0
```

Create `backend/.env` with owner-only permissions:

```bash
cp backend/.env.example backend/.env
chmod 600 backend/.env
```

Then enable only the local provider:

```dotenv
AI_MODE=local
LOCAL_LLM_BASE_URL=http://127.0.0.1:8081/v1
LOCAL_LLM_MODEL=qwen-small-instruct-q4
LOCAL_LLM_MAX_TOKENS=384
LOCAL_LLM_TIMEOUT_SECONDS=90

# The UI/request flag must still opt in before any chat history is read/saved.
CHAT_HISTORY_ENABLED=true
```

The backend caps local context at 6,000 characters and the question at 4,000 characters to keep a small model responsive. It posts only to the validated loopback URL with redirects disabled. Verify a model download’s publisher, license, checksum/signature where available, and keep the model directory read-only after setup.

### Explicit cloud chat generation (not a fallback)

Cloud generation is disabled unless you deliberately set `AI_MODE=cloud`. This sends the selected RAG context and question to the provider, so do not enable it for sensitive data:

```dotenv
AI_MODE=cloud
OPENROUTER_API_KEY=your_key
OPENROUTER_MODEL=google/gemini-2.5-flash
OPENROUTER_MAX_TOKENS=4096
```

or:

```dotenv
AI_MODE=cloud
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-2.5-flash
```

## Optional offline Vosk push-to-talk

Install the voice extra only when you are ready to use it:

```bash
. .venv/bin/activate
python -m pip install -r backend/requirements-voice.txt
# Debian/Ubuntu:
sudo apt install ffmpeg
```

Download and unpack a small Vosk model appropriate for the command language from <https://alphacephei.com/vosk/models>, then configure its directory (not the archive):

```dotenv
VOSK_MODEL_PATH=/absolute/path/to/vosk-model-small-en-us-0.15
# Default false: unload after each request, recommended for about 4 GB RAM.
VOSK_KEEP_LOADED=false
```

Restart the API and check:

```bash
curl http://127.0.0.1:8000/api/transcribe/status
```

`POST /api/transcribe` expects multipart form field `audio`. Browser WebM/Ogg recordings are converted to 16 kHz mono WAV with `ffmpeg`. With no configured model, the route clearly reports that configuration is missing; Vosk is loaded only when transcription is requested and unloads afterward by default.

## One-box command flow

Typed or transcribed text can use either transport. `POST /api/assistant` remains the simple request/response fallback:

```json
{"text":"index ~/Documents"}
```

The React composer now prefers the same-origin live WebSocket at `/ws/assistant`, which maps to `ws://127.0.0.1:8000/ws/assistant` only after the Vite development proxy or production server resolves the relative path. Browser code does not hard-code a localhost backend address.

Useful commands:

```text
search invoice policy
open annual-report.pdf
preview README
edit notes.md
index ~/Documents
index https://example.com/docs
```

`open`, `preview`, and `edit` return safe candidate records first. The UI selects a candidate and calls the relevant file endpoint; it never treats natural-language text as permission to open or edit a path.

## Live WebSocket channel

The endpoint is:

```text
/ws/assistant
```

It accepts one request at a time per browser connection. Send an explicit JSON envelope:

```json
{
  "type": "assistant_message",
  "request_id": "optional-client-id",
  "text": "index ~/Documents",
  "source": "typed",
  "use_history": true
}
```

The server sends small status/progress messages before one final result whose `result` object matches `POST /api/assistant`:

```text
ready                 connection accepted; protocol james.assistant.v1
assistant_status      routing, retrieval, validation, or completion state
index_progress        low-frequency folder/web-indexing counters
assistant_result      final response/candidates/results
error                 validation, policy, or internal error
pong                  reply to {"type":"ping"}
```

Only one-box text and `ping` are accepted over this socket. It **does not** accept `open`, `apply`, `undo`, or arbitrary file-action messages. Keep using the guarded HTTP file routes for preview, desktop open, edit proposals, confirmation, apply, undo, and multipart Vosk audio upload.

### Origin and Vite proxy safety

The backend defaults to accepting browser WebSocket origins only from `localhost`, `127.0.0.1`, or `::1`; a missing `Origin` header is denied by default. This reduces cross-site access to a local file-capable service. For a trusted non-local deployment, configure exact origins — never a wildcard:

```dotenv
WS_ALLOWED_ORIGINS=https://your-trusted-ui.example
# Keep false unless a trusted non-browser local client genuinely needs it.
WS_ALLOW_MISSING_ORIGIN=false
```

`frontend/vite.config.js` proxies both `/api` and `/ws` to the local FastAPI process during `npm run dev` or `npm run preview`. Its target is controlled by the Vite-server-only `VITE_BACKEND_TARGET` setting, defaulting to `http://127.0.0.1:8000`; the browser itself continues to use relative paths. If a trusted development preview hostname must be allowed by Vite, use a comma-separated `VITE_ALLOWED_HOSTS` value with those exact hosts rather than enabling all hosts.

## API quick reference

### Retrieval, indexing, and live events

| Endpoint | Purpose |
| --- | --- |
| `WS /ws/assistant` | Live one-box command status, index progress, and final assistant results |
| `POST /api/assistant` | HTTP fallback for unified typed/voice-text command flow, chat, retrieval, indexing, and safe file candidates |
| `POST /api/index-folder` | Explicitly index/refresh one safe folder |
| `POST /api/scrape-web` | Index a supplied URL (online) |
| `GET /api/index-status` | Persisted chunk count, catalog count, DB path, approved roots |
| `GET /api/health` | Backend, provider, index, and optional Vosk status |
| `POST /api/search` | Direct offline retrieval endpoint |

### Guarded local files

| Endpoint | Purpose |
| --- | --- |
| `POST /api/files/search` | Search safe catalog metadata |
| `GET /api/files/audit` | Content-free audit records for completed file operations |
| `POST /api/files/preview` | Preview an indexed readable document |
| `POST /api/files/open` | Return confirmation state, then open one catalogue file with the OS default app |
| `POST /api/files/propose-edit` | Produce and persist a diff proposal only; never writes |
| `POST /api/files/apply-edit` | Requires a non-expired proposal and `confirmed: true`; creates backup, then writes atomically |
| `POST /api/files/undo-edit` | Requires `confirmed: true`; restores an assistant-created backup once |

### Voice

| Endpoint | Purpose |
| --- | --- |
| `GET /api/transcribe/status` | Check whether Vosk package/model is available and loaded |
| `POST /api/transcribe` | Upload a short `audio` form field for local Vosk transcription |
| `POST /api/transcribe/unload` | Explicitly free Vosk model memory |

## File-operation examples

Search a catalogued file:

```bash
curl -X POST http://127.0.0.1:8000/api/files/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"README"}'
```

Preview uses the returned `file_id`:

```bash
curl -X POST http://127.0.0.1:8000/api/files/preview \
  -H 'Content-Type: application/json' \
  -d '{"file_id":"file_example"}'
```

Make a proposal and inspect its unified diff before any write:

```bash
curl -X POST http://127.0.0.1:8000/api/files/propose-edit \
  -H 'Content-Type: application/json' \
  -d '{"file_id":"file_example","old_text":"old wording","new_text":"new wording"}'
```

Then apply only after the UI/user has shown and accepted the diff:

```bash
curl -X POST http://127.0.0.1:8000/api/files/apply-edit \
  -H 'Content-Type: application/json' \
  -d '{"proposal_id":"edit_example","confirmed":true}'
```

Backups are created under `backups/<proposal_id>/` by default and their records are persisted. A proposal expires after 15 minutes, detects external file changes by content hash, and cannot be applied twice. Undo also verifies that the file still matches the assistant-applied version, so it refuses to overwrite later manual changes.

## Run the backend tests

The checked-in suite uses a disposable SQLite database and temporary folders; it does not touch an indexed folder or database you already use.

```bash
. .venv/bin/activate
python -m pip install -r backend/requirements-test.txt
python -m unittest discover -s backend/tests -v
```

## Optional extras

`requirements-extras.txt` installs Selenium’s browser-rendered web-scrape fallback and the legacy explicit PyAutoGUI alert action. Neither is needed for the core backend:

```bash
python -m pip install -r backend/requirements-extras.txt
```

## Validation completed

The backend was checked with Python compilation and local FastAPI request tests covering: system/hidden/cache root refusal; protected secrets, symlink, and executable exclusion; indexed versus metadata-only discovery; persistent SQLite restart behavior; stale chunk/catalog pruning, vanished/symlink-replaced root cleanup, and dynamic changed-file suppression; catalog search; preview; confirmation before desktop open/apply/undo; diff proposal; atomic apply with backup; undo; content-free audit persistence; expiry guard; unified assistant candidates; optional Vosk status/error behavior; WebSocket origin policy, protocol validation, live indexing progress, and final retrieval results; local-model loopback-only enforcement; bounded local context; request-level history opt-in; and owner-only local storage permissions.
