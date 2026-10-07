# James local assistant backend

For the full architectural roadmap and feature specifications, see [ARCHITECTURE.md](ARCHITECTURE.md).

A small, privacy-conscious FastAPI backend for the one-composer React UI. It uses a hybrid transport: a live same-origin WebSocket streams command/indexing status, while guarded file confirmations and uploads remain explicit HTTP requests. Local retrieval stays lightweight: selected folders are indexed into a persistent SQLite FTS5 database, and normal local search does **not** require an LLM, cloud API, vector server, or a large local model.

## What stays local

- Folder indexing, incremental refresh, lexical RAG search, and optional prior-chat retrieval.
- Live same-origin command status and indexing progress over `/ws/assistant`; final results use the same shape as the HTTP assistant endpoint.
- The SQLite index at `data/rag_index.db` by default (override with `RAG_DB_PATH`).
- A metadata-only catalog for safe, unsupported files, so names/paths can be found without ingesting their contents.
- Preview, edit proposals, confirmed atomic edits, backups, confirmed undo, and content-free audit records.
- Optional whisper.cpp speech-to-text when configured. It converts a short push-to-talk recording to text locally; it is not used for reasoning, RAG, code generation, or file execution.

A configured OpenRouter or Gemini key is optional and only affects chat-generation requests. Local folder search and file actions still work without either key.

## Safety model

Only folders explicitly submitted to `POST /api/index-folder` (or `index ~/Documents` through `POST /api/assistant`) are approved for refresh.

| Category | Stored | Permitted actions |
| --- | --- | --- |
| `indexed` | Filename/path metadata plus extracted supported text chunks | Search, preview, edit proposal, confirmed edit, confirmed open |
| `discoverable` | Filename/path metadata only | Search and confirmed desktop open; never RAG content, preview, or edit |
| `protected` / `ignored` | Not normally catalogued or listed | No index, preview, open, edit, or normal search result |

The policy refuses filesystem roots, OS/system paths, another user’s home, protected credential/application-data locations, hidden/cache/build roots, sensitive filenames and key material, symlinks, executable files, and installer/launch descriptors. During a recursive scan it skips hidden folders, `node_modules`, virtual environments, build/cache folders, secrets, symlinks, and non-regular filesystem entries. The same policy is checked again immediately before a preview, open, edit, or undo; changed/protected file chunks are also withheld from retrieval until a safe reindex occurs. `validate_index_root()` rejects system roots and protected home directories before traversal begins.

No assistant route accepts an arbitrary client path for an action: action routes take a server-generated `file_id`, `proposal_id`, or `backup_id` from the approved catalog. Desktop open, apply-edit, and undo-edit require a separate `confirmed: true` request. Indexed source-code files may still be previewed or edited through the guarded flow, but are deliberately not passed to an OS desktop-open association because some platforms execute them on double-click.

## Minimal setup

Use Python 3.10+ with SQLite built with FTS5 support. From the project root (the folder containing both `backend/` and `frontend/`):

```bash
cd ~/Desktop/projects/james
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

### Starting both services

**Single command:**
```bash
./start-all.sh
```

This starts the backend on `http://127.0.0.1:8000` and the Vite dev server on `http://localhost:5173`.

Or start them separately:

```bash
# Backend: http://127.0.0.1:8000
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload

# Frontend: http://localhost:5173
cd frontend && npm install && npm run dev
```

Keep the API bound to `127.0.0.1`: this local backend has no multi-user authentication and can carry out separately confirmed file operations. If a trusted deployment truly needs another interface, set `HOST` deliberately; do not expose it directly to an untrusted LAN or the public internet.

Check it in a second terminal:

```bash
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/api/index-status
```

The API works without a model/API key for indexing, retrieval, catalog search, previews, edit proposals, and file confirmations. Do not put secrets into an indexed folder.

### Optional cloud chat generation

Create `backend/.env` (or project-root `.env`) with **one** provider, if wanted:

```dotenv
OPENROUTER_API_KEY=your_key
OPENROUTER_MODEL=google/gemini-2.5-flash
OPENROUTER_MAX_TOKENS=4096
```

or:

```dotenv
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-2.5-flash
```

or (ultra-low-latency Llama 3.3):

```dotenv
GROQ_API_KEY=your_key
GROQ_MODEL=llama-3.3-70b-versatile
```

Keys are read by the backend only. They are never intended for the browser. Any request answered through one of these providers is online; offline retrieval itself remains local.

## Optional offline speech-to-text (whisper.cpp)

Install the voice extra only when you are ready to use it:

```bash
. .venv/bin/activate
python -m pip install -r requirements-voice.txt
# Debian/Ubuntu:
sudo apt install ffmpeg
```

Download and unpack a small whisper.cpp model (e.g. `ggml-medium.en.bin`) from <https://huggingface.co/ggerganov/whisper.cpp>, then configure its directory:

```dotenv
WHISPER_MODEL_PATH=/absolute/path/to/ggml-medium.en.bin
```

Restart the API and check:

```bash
curl http://127.0.0.1:8000/api/transcribe/status
```

`POST /api/transcribe` expects multipart form field `audio`. Browser WebM/Ogg recordings are converted to 16 kHz mono WAV with `ffmpeg`. whisper.cpp loads the model per invocation and unloads afterward by default — no persistent RAM cost.

### Text-to-speech (edge-tts)

Text-to-speech is available out of the box with Microsoft's edge-tts library (no API key needed, works offline):

```bash
. .venv/bin/activate
python -m pip install edge-tts
```

No additional configuration needed — uses neural voices like `en-US-ChristopherNeural`. Available voices listed via `POST /api/tts/voices`.

## Image generation

Generate images through Pollinations.ai (zero-auth, works offline):

```bash
curl -X POST http://127.0.0.1:8000/api/media/generate-image \
  -H "Content-Type: application/json" \
  -d '{"prompt":"a sunset over mountains","width":512,"height":512}'
```

Response includes `image_url` for direct access and `local_path` for cached download.

Open the UI and click the image icon in the header to use the built-in generator.

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

Only one-box text and `ping` are accepted over this socket. It **does not** accept `open`, `apply`, `undo`, or arbitrary file-action messages. Keep using the guarded HTTP file routes for preview, desktop open, edit proposals, confirmation, apply, undo, and multipart audio upload.

### Origin and Vite proxy safety

The backend defaults to accepting browser WebSocket origins only from `localhost`, `127.0.0.1`, or `::1`; a missing `Origin` header is allowed in development (set `WS_ALLOW_MISSING_ORIGIN=false` to deny it). This reduces cross-site access to a local file-capable service. For a trusted non-local deployment, configure exact origins — never a wildcard:

```dotenv
WS_ALLOWED_ORIGINS=https://your-trusted-ui.example
# Keep true for development; set false for trusted non-browser local clients only.
WS_ALLOW_MISSING_ORIGIN=true
```

`frontend/vite.config.ts` proxies both `/api` and `/ws` to the local FastAPI process during `npm run dev` or `npm run preview`. Its target is controlled by the Vite-server-only `VITE_BACKEND_TARGET` setting, defaulting to `http://127.0.0.1:8000`; the browser itself continues to use relative paths. If a trusted development preview hostname must be allowed by Vite, use a comma-separated `VITE_ALLOWED_HOSTS` value with those exact hosts rather than enabling all hosts.

## API quick reference

### Retrieval, indexing, and live events

| Endpoint | Purpose |
| --- | --- |
| `WS /ws/assistant` | Live one-box command status, index progress, and final assistant results |
| `POST /api/assistant` | HTTP fallback for unified typed/voice-text command flow, chat, retrieval, indexing, and safe file candidates |
| `POST /api/index-folder` | Explicitly index/refresh one safe folder |
| `POST /api/scrape-web` | Index a supplied URL (online) |
| `GET /api/index-status` | Persisted chunk count, catalog count, DB path, approved roots |
| `GET /api/health` | Backend, provider, index, and whisper.cpp transcription status |
| `POST /api/search` | Direct offline retrieval endpoint |
| `POST /api/chat` | Chat completion (local or cloud provider) |
| `POST /api/system-action` | Tool execution action |

### Generative media & TTS

| Endpoint | Purpose |
| --- | --- |
| `POST /api/media/generate-image` | Generate image via Pollinations.ai |
| `POST /api/media/analyze-vision` | Vision analysis of an image |
| `POST /api/media/fetch-page` | Browser-rendered page fetch |
| `POST /api/media/web-search` | Web search |
| `POST /api/tts/synthesize` | Text-to-speech synthesis |
| `GET /api/tts/voices` | List available TTS voices |

### Device pairing

| Endpoint | Purpose |
| --- | --- |
| `POST /api/pair` | Pair a new device |
| `GET /api/devices` | List paired devices |
| `POST /api/revoke/{device_id}` | Revoke a paired device |
| `POST /api/heartbeat/{device_id}` | Device heartbeat |

### Guarded local files

| Endpoint | Purpose |
| --- | --- |
| `GET /api/files/audit` | Content-free audit records for completed file operations |
| `POST /api/files/preview` | Preview an indexed readable document |
| `POST /api/files/open` | Return confirmation state, then open one catalogue file with the OS default app |
| `POST /api/files/propose-edit` | Produce and persist a diff proposal only; never writes |
| `POST /api/files/apply-edit` | Requires a non-expired proposal and `confirmed: true`; creates backup, then writes atomically |
| `POST /api/files/undo-edit` | Requires `confirmed: true`; restores an assistant-created backup once |

### Voice

| Endpoint | Purpose |
| --- | --- |
| `GET /api/transcribe/status` | Check whether whisper.cpp binary and model are available |
| `POST /api/transcribe` | Upload a short `audio` form field for local whisper.cpp transcription |
| `POST /api/transcribe/unload` | No-op — whisper.cpp loads per invocation and unloads automatically |

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
python -m pip install -r requirements-test.txt
python -m unittest discover -s backend/tests -v
```

## Optional extras

`requirements-extras.txt` installs Selenium’s browser-rendered web-scrape fallback and the legacy explicit PyAutoGUI alert action. Neither is needed for the core backend:

```bash
python -m pip install -r requirements-extras.txt
```

## Validation completed

The backend was checked with Python compilation and local FastAPI request tests covering: system/hidden/cache root refusal; protected secrets, symlink, and executable exclusion; indexed versus metadata-only discovery; persistent SQLite restart behavior; stale chunk/catalog pruning, vanished/symlink-replaced root cleanup, and dynamic changed-file suppression; catalog search; preview; confirmation before desktop open/apply/undo; diff proposal; atomic apply with backup; undo; content-free audit persistence; expiry guard; unified assistant candidates; whisper.cpp transcription status/error behavior; and WebSocket origin policy, protocol validation, live indexing progress, and final retrieval results.

Test suite: 12 pass, 0 failures.
