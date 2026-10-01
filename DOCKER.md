# Docker guide — James local assistant

This guide runs James as a **single-user, local-only** container. It builds the React frontend into the FastAPI image, so the browser, HTTP API, and WebSocket all use one same-origin address:

```text
Browser → http://127.0.0.1:8000 → James container
```

The supplied Compose configuration is deliberately conservative:

- the published port is bound to `127.0.0.1`, not the LAN;
- the container has no Linux capabilities and cannot gain new privileges;
- the container root filesystem is read-only except for a small temporary filesystem;
- no personal folder is mounted by default;
- the default Compose network is internal, so the running container has no ordinary outbound internet route;
- assistant data is persisted only in explicit `./runtime/` directories;
- generation remains `AI_MODE=offline` unless you deliberately change it.

> **Important:** Docker is isolation, not encryption or authentication. Anyone who can access your unlocked desktop account, Docker daemon, or mounted runtime/data folders may still be able to access the data. Keep the project out of cloud-sync folders, use a locked account and full-disk encryption, and do not expose this app to an untrusted LAN or the internet.

## Included Docker files

| File | Purpose |
| --- | --- |
| `Dockerfile` | Multi-stage build: Vite builds the UI; a small Python image serves the UI and FastAPI API. |
| `compose.yaml` | Local single-container configuration with restrictive defaults. |
| `.dockerignore` | Prevents credentials, indexes, history, local models, and build artefacts from entering the Docker build context. |

The base image intentionally does **not** include Vosk, `ffmpeg`, a GGUF model, llama.cpp, or cloud credentials. This keeps normal offline RAG lightweight and avoids loading unnecessary models on a machine with limited RAM.

---

## Prerequisites

- Docker Engine with Docker Compose v2 (`docker compose`, not the retired `docker-compose` v1 command).
- At least 1 GB of free disk space for the initial image build. The exact size varies with Python/Node base image updates.
- A local checkout containing `Dockerfile`, `compose.yaml`, `backend/`, and `frontend/`.

Verify Docker before continuing:

```bash
docker --version
docker compose version
```

Docker is not required for ordinary local Python/Vite development.

---

## Quick start: offline retrieval-only container

Run these commands from the project root:

```bash
cd ~/Desktop/projects/james

# Create local configuration from the example template.
cp backend/.env.example backend/.env

# POSIX only: keep environment settings readable by your account only.
chmod 600 backend/.env

# Create persistent, user-owned data locations before Docker starts. This avoids
# Docker creating root-owned host directories.
mkdir -p runtime/data runtime/history runtime/backups runtime/output_files
chmod 700 runtime runtime/data runtime/history runtime/backups runtime/output_files

# Linux: map the process in the container to your own user so that an explicitly
# mounted private document folder can retain restrictive host permissions.
export JAMES_UID="$(id -u)"
export JAMES_GID="$(id -g)"

# Build once, then start in the background.
docker compose build
docker compose up -d
```

Open the local UI:

```text
http://127.0.0.1:8000/
```

Check the container and API:

```bash
docker compose ps
curl http://127.0.0.1:8000/api/health
docker compose logs -f james
```

A healthy default response reports an offline provider mode. No model download or cloud request is required for folder indexing and SQLite FTS retrieval. The supplied Compose network also blocks normal outbound traffic, so **URL ingestion and cloud mode are intentionally unavailable in this default container profile**.

### Windows and Docker Desktop

On Windows/macOS, the default `JAMES_UID`/`JAMES_GID` values in `compose.yaml` are normally sufficient for Docker Desktop file sharing. If a mounted folder reports a permissions error, see [Permissions and ownership](#permissions-and-ownership). Do not run the setup through `sudo` on Linux; doing so can create root-owned `runtime/` folders.

---

## Configuration and WebSocket origins

Compose loads `backend/.env` into the container. The safe starting values are:

```dotenv
AI_MODE=offline
CHAT_HISTORY_ENABLED=true
```

With the supplied Docker setup, FastAPI serves the built frontend at port 8000, so the browser page origin is normally `http://localhost:8000` or `http://127.0.0.1:8000`. You can leave `WS_ALLOWED_ORIGINS` unset: those local browser origins are accepted by default.

To make the local WebSocket allow-list explicit, put this in `backend/.env`:

```dotenv
WS_ALLOWED_ORIGINS=http://localhost:8000,http://127.0.0.1:8000
WS_ALLOW_MISSING_ORIGIN=false
```

`WS_ALLOWED_ORIGINS` is the **browser page origin**. Do not put the `/ws/assistant` path in it, do not use `*`, and do not enable `WS_ALLOW_MISSING_ORIGIN` merely to work around a browser error.

If you deliberately change the published port, update the exact origin too:

```bash
JAMES_PORT=8010 docker compose up -d
```

```dotenv
WS_ALLOWED_ORIGINS=http://localhost:8010,http://127.0.0.1:8010
```

### Developing the frontend outside Docker

If the backend runs in Docker but you run `npm run dev` on the host at port 5173, Vite proxies `/api` and `/ws` to the Docker-published API. In that case use:

```dotenv
WS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
WS_ALLOW_MISSING_ORIGIN=false
```

The browser should still use relative `/api` and `/ws/assistant` URLs; do not hard-code a localhost backend address in frontend code.

---

## Indexing host files safely

A container cannot see host documents unless you mount them. This is intentional. The default `compose.yaml` contains **no** personal-file mount.

### Read-only mount — recommended

Create a local override file named `compose.files.yaml` beside `compose.yaml`. Replace the sample `source` path with one specific folder you are comfortable exposing to James.

```yaml
services:
  james:
    volumes:
      - type: bind
        source: /absolute/path/to/your/Documents
        target: /workspace/documents
        read_only: true
```

Start with both files:

```bash
docker compose -f compose.yaml -f compose.files.yaml up -d
```

Then use the container path in James:

```text
index /workspace/documents
```

Use a narrow, read-only mount whenever possible. Do **not** mount any of the following merely for convenience:

```text
/
/home
/Users
C:\Users
/etc
/root
/var/run/docker.sock
~/.ssh
~/.config
credential, key, browser-profile, or cloud-sync directories
```

The application still applies its own protected-file and system-root policy, but Docker mounts are the first and strongest boundary: an unmounted path cannot be read at all.

### Allowing confirmed edits

A read-only mount permits indexing, retrieval, and preview but prevents edits. If you deliberately need James to apply confirmed edits to a particular working folder, change only that mount to writable:

```yaml
services:
  james:
    volumes:
      - type: bind
        source: /absolute/path/to/a/disposable-or-versioned-working-folder
        target: /workspace/work
        read_only: false
```

Use a dedicated Git working tree or a disposable copy, review every diff, and retain ordinary backups. The application’s confirmation, proposal, hash-check, backup, and undo controls remain active, but a writable bind mount means an approved change is written to the host folder.

### What does not work in a container

Desktop-open actions are designed for a local desktop session. A container normally has no host GUI association, so do not rely on **Open** to launch a host application. Use the guarded preview flow, or open the host file yourself. Indexing, retrieval, candidate discovery, previews, edit proposals, and confirmed edits to a writable bind mount remain supported.

---

## Persistence, backup, and reset

The following host directories hold local state and are excluded from Git:

| Directory | Contents |
| --- | --- |
| `runtime/data/` | SQLite FTS index, indexed-root records, file catalog, edit proposal records, and content-free audit records. |
| `runtime/history/` | Opted-in local chat history only. |
| `runtime/backups/` | Assistant-created file-edit backups. |
| `runtime/output_files/` | Assistant output files, if used by a feature. |

On POSIX filesystems, James makes its database/history/backup locations owner-only where permissions permit. Docker volume permissions and Docker Desktop file-sharing semantics can differ, so also protect the host `runtime/` directory.

### Back up state

Stop the service before copying SQLite data so its main database and WAL state stay consistent:

```bash
docker compose stop james
tar -czf james-runtime-backup-"$(date +%Y%m%d-%H%M%S)".tar.gz runtime/
docker compose start james
```

Store the archive securely; it can contain indexed document excerpts and opted-in chat history.

### Reset local assistant data

This permanently discards the selected category of local state. Stop the container first.

```bash
docker compose stop james

# Rebuild only the searchable index/catalog.
rm -f runtime/data/rag_index.db runtime/data/rag_index.db-shm runtime/data/rag_index.db-wal

# Optional: erase opted-in chat history and edit backups as well.
# rm -rf runtime/history/* runtime/backups/* runtime/output_files/*

docker compose start james
```

### Upgrade the image without deleting data

`docker compose down` does not delete the `runtime/` bind directories. Avoid `down -v` if you later switch to named volumes.

```bash
docker compose down
docker compose build --pull
docker compose up -d
```

Review the Dockerfile and dependency changes before rebuilding. Building requires access to package registries for base images, Python packages, and frontend packages; the standard Compose runtime has no ordinary outbound internet route and does not make cloud model calls.

---

## Optional local llama.cpp model

The Docker image starts in `AI_MODE=offline` and does not contain a model. This is the recommended configuration for about 4 GB RAM when retrieval is sufficient.

The backend intentionally accepts a local LLM endpoint only on `127.0.0.1`, `localhost`, or `::1`. Under the default Docker Compose internal bridge network, `127.0.0.1` means **the container itself**, not the host and not a sidecar service. This guard prevents a supposedly local model setting from silently sending prompts to another machine.

### Linux-only host-network option

If you independently run a trusted `llama-server` on the Linux host at `127.0.0.1:8081`, you can run the James container with host networking. This is an advanced option; bind James itself to host loopback in this mode.

1. Start your verified llama.cpp server on the host, for example:

   ```bash
   llama-server -m ~/models/qwen-small-instruct-q4.gguf \
     --host 127.0.0.1 --port 8081 -c 2048 -ngl 0
   ```

2. Set only the local model values in `backend/.env`:

   ```dotenv
   AI_MODE=local
   LOCAL_LLM_BASE_URL=http://127.0.0.1:8081/v1
   LOCAL_LLM_MODEL=qwen-small-instruct-q4
   LOCAL_LLM_MAX_TOKENS=384
   LOCAL_LLM_TIMEOUT_SECONDS=90
   ```

3. Stop the Compose service and use this Linux Docker Engine command instead of the standard Compose network:

   ```bash
   docker compose down
   docker run --rm --network host \
     --user "$(id -u):$(id -g)" \
     --read-only \
     --tmpfs /tmp:rw,noexec,nosuid,size=64m \
     --cap-drop ALL \
     --security-opt no-new-privileges:true \
     --env-file backend/.env \
     -e HOME=/workspace \
     -e RAG_DB_PATH=/app/data/rag_index.db \
     -v "$PWD/runtime/data:/app/data:rw" \
     -v "$PWD/runtime/history:/app/history:rw" \
     -v "$PWD/runtime/backups:/app/backups:rw" \
     -v "$PWD/runtime/output_files:/app/output_files:rw" \
     james-local-assistant:local \
     python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
   ```

With `--network host`, do **not** add `-p`; the final Uvicorn command binds James to `127.0.0.1` on the host. This pattern is for Linux Docker Engine. Docker Desktop host networking has different semantics and is not recommended for this local-model configuration. Host networking also removes the default Compose egress boundary, so use it only for the reviewed host-local model arrangement and keep `AI_MODE=local` rather than cloud mode.

Do not replace the URL above with `http://host.docker.internal:8081` or `http://llama:8081`; the privacy guard correctly rejects non-loopback endpoints. A failed local model remains a local retrieval fallback and never switches to a cloud model.

Do not run a 7B model alongside Vosk on a roughly 4 GB machine. Start with a small, verified Q4 GGUF-class model such as Qwen2.5 0.5B Instruct, and verify its publisher, license, and checksum before use.

---

## Optional Vosk push-to-talk

The base image excludes Vosk and `ffmpeg`. If you need offline transcription in Docker, create a local `Dockerfile.voice` (do not commit downloaded models):

```dockerfile
FROM james-local-assistant:local
USER root
COPY backend/requirements.txt backend/requirements-voice.txt /tmp/
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && python -m pip install --no-cache-dir -r /tmp/requirements-voice.txt \
    && rm -rf /var/lib/apt/lists/* /tmp/requirements.txt /tmp/requirements-voice.txt
USER james
```

Build it locally:

```bash
docker build -t james-local-assistant:voice -f Dockerfile.voice .
```

Mount an already downloaded, unpacked Vosk model read-only with a small Compose override named `compose.voice.yaml`:

```yaml
services:
  james:
    volumes:
      - type: bind
        source: /absolute/path/to/unpacked-vosk-model
        target: /models/vosk
        read_only: true
    environment:
      VOSK_MODEL_PATH: /models/vosk
      VOSK_KEEP_LOADED: "false"
```

Then run the voice image through the same restrictive Compose profile:

```bash
JAMES_IMAGE=james-local-assistant:voice \
  docker compose -f compose.yaml -f compose.voice.yaml up -d --no-build
```

This retains the loopback port binding, read-only container root, capability drop, internal network, and persistent runtime mounts from `compose.yaml`. `VOSK_KEEP_LOADED=false` is the lower-RAM choice. Vosk only transcribes a push-to-talk recording into the same command box; it does not gain file execution or reasoning capabilities.

---

## Privacy and security checklist

Before using James with real files, verify all of the following:

- [ ] The port mapping is `127.0.0.1:...:8000`, not `0.0.0.0:...:8000`.
- [ ] `AI_MODE=offline` remains set unless you consciously configured an approved loopback llama.cpp server.
- [ ] `AI_MODE=cloud` is not set for sensitive material.
- [ ] `backend/.env`, `runtime/`, local models, and any backup archive are not committed or uploaded.
- [ ] Only the smallest necessary host folder is bind-mounted at `/workspace/...`.
- [ ] The host folder mount is read-only unless you have a specific, reviewed editing workflow.
- [ ] `/var/run/docker.sock`, system folders, private keys, browser profiles, cloud-sync folders, and all of your home directory are never mounted.
- [ ] The `local_only` internal Docker network remains enabled for offline use; it blocks URL ingestion and cloud mode by default.
- [ ] Chat history remains unchecked in the UI unless you explicitly want James to read/save local prior conversation. Set `CHAT_HISTORY_ENABLED=false` to prohibit it globally.
- [ ] You understand that URL ingestion is an explicitly online operation. It is unavailable in the default Compose profile and should not be enabled for private URLs.

---

## Troubleshooting

### `permission denied` for `/app/data`, history, or a mounted folder

On Linux, recreate the runtime directories as your regular user and export matching numeric IDs before starting Compose:

```bash
docker compose down
rm -rf runtime
mkdir -p runtime/data runtime/history runtime/backups runtime/output_files
chmod 700 runtime runtime/data runtime/history runtime/backups runtime/output_files
export JAMES_UID="$(id -u)"
export JAMES_GID="$(id -g)"
docker compose up -d --build
```

For a mounted document folder, the host user must already be able to read it. Do not solve that by making the folder world-readable; use your own numeric UID mapping or mount a safe copy instead.

### The assistant cannot find the folder I asked it to index

Paths inside the container are not host paths. First add a bind mount, then use the target path (for example, `/workspace/documents`) in the command. The container cannot index an unmounted host folder, by design.

### WebSocket closes with policy code `1008`

Check the browser page’s exact scheme, host, and port. For the standard Compose UI, either leave `WS_ALLOWED_ORIGINS` unset or use the local port-8000 values shown above. For a host Vite UI, allow port 5173 instead. Restart after changing `backend/.env`:

```bash
docker compose up -d --force-recreate
```

### Port 8000 is already in use

Choose a different loopback host port:

```bash
JAMES_PORT=8010 docker compose up -d
```

Then open `http://127.0.0.1:8010/`. If you configured an explicit WebSocket allow-list, include port `8010` as shown in [Configuration and WebSocket origins](#configuration-and-websocket-origins).

### URL ingestion or cloud mode cannot connect

That is expected in the default Compose profile: its `local_only` internal Docker network has no ordinary outbound route. Keep the profile as-is for private offline retrieval. If you decide to create a separate network-enabled deployment, treat it as a privacy-changing choice, keep mounts minimal, set `AI_MODE=cloud` only deliberately, and use an exact WebSocket-origin allow-list.

### The container starts but local-model generation is unavailable

Check `/api/health`. In the default internal bridge mode, a host llama.cpp process is intentionally not reachable as container loopback. Use normal offline retrieval, or follow the Linux host-network instructions exactly. Never relax the backend’s loopback-only local-model validation just to reach a remote/sidecar service.

### I need more diagnostic output

```bash
docker compose logs --tail=200 james
docker compose ps
curl -i http://127.0.0.1:8000/api/health
```

Do not paste `.env`, indexed excerpts, history files, or backup archives into public issue trackers or chat messages.
