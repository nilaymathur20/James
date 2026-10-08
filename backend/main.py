"""FastAPI application entry point for the Local System RAG Agent.

Run from the project root with:
    uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000

The backend defaults to loopback-only access because it can perform confirmed
local file operations. Set HOST deliberately only when a trusted deployment
requires another bind address.

Configuration is loaded from ``backend/.env`` first, then from project-root
``.env``. Existing process environment variables always take precedence.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
HISTORY_DIR = PROJECT_ROOT / "history"
OUTPUT_DIR = PROJECT_ROOT / "output_files"
BACKUP_DIR = PROJECT_ROOT / "backups"


def load_env(filepath: Path) -> None:
    """Load simple KEY=VALUE lines without adding a python-dotenv dependency."""
    if not filepath.is_file():
        return

    try:
        with filepath.open("r", encoding="utf-8") as env_file:
            for raw_line in env_file:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip("'\"")
                if key:
                    os.environ.setdefault(key, value)
    except OSError as exc:
        # Configuration errors should be surfaced through /api/chat if no key
        # is found, rather than making the whole application fail to start.
        import logging
        logging.getLogger(__name__).warning("Could not load env file %s: %s", filepath, exc)


# backend/.env has priority over project-root/.env; shell environment has
# priority over both because load_env uses setdefault.
load_env(BACKEND_DIR / ".env")
load_env(PROJECT_ROOT / ".env")

# Imports intentionally happen after .env loading because llm.py reads the
# environment at request time and health.py reports configured providers.
from .routers import actions, assistant, assistant_ws, auth, chat, files, health, indexing, media, search, settings, transcription, tts, devices  # noqa: E402
from .services.auto_indexer import start_auto_indexer, stop_auto_indexer  # noqa: E402
from .services.p2p_proxy import P2PProxyMiddleware
from .services.history_persistence import HistoryPersistence  # noqa: E402


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Only folders explicitly indexed by the user are refreshed. The scan runs
    # in a daemon thread so startup stays responsive on a low-RAM machine.
    start_auto_indexer()
    try:
        yield
    finally:
        stop_auto_indexer()


app = FastAPI(title="Local System RAG Agent API", version="1.0.0", lifespan=lifespan)

# CORS: allow local dev frontend/Expo web clients on 5173/8081 to reach the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8000", "http://localhost:5173", "http://localhost:8081"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(P2PProxyMiddleware)
app.state.project_root = PROJECT_ROOT
app.state.history_dir = HISTORY_DIR
app.state.output_dir = OUTPUT_DIR
app.state.backup_dir = BACKUP_DIR
# Initialize history persistence for chat sessions by user
app.state.history_persistence = HistoryPersistence(HISTORY_DIR / "users")

app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(auth.router, prefix="/api", tags=["Authentication"])
app.include_router(assistant.router, prefix="/api", tags=["Unified Assistant"])
app.include_router(chat.router, prefix="/api", tags=["Chat"])
app.include_router(search.router, prefix="/api", tags=["Offline Search"])
app.include_router(indexing.router, prefix="/api", tags=["Indexing"])
app.include_router(files.router, prefix="/api", tags=["Safe Files"])
# Deliberately separate from /api: browser clients use the same-origin
# /ws/assistant path, while mutation/confirmation APIs stay ordinary HTTP.
app.include_router(assistant_ws.router, tags=["Live Assistant"])
app.include_router(transcription.router, prefix="/api", tags=["Voice Commands"])
app.include_router(tts.router, prefix="/api", tags=["Text to Speech"])
app.include_router(media.router, prefix="/api", tags=["Generative Media & Vision"])
app.include_router(actions.router, prefix="/api", tags=["System Actions"])
app.include_router(settings.router, prefix="/api", tags=["Settings"])
app.include_router(devices.router, prefix="/api", tags=["Device Management"])

# Register Hackathon Municipal Router
from .routers import municipal
app.include_router(municipal.router, prefix="/api", tags=["Hackathon"])


def _find_frontend_dist() -> Path | None:
    """Find the Vite production build for either supported project layout."""
    candidates = (
        PROJECT_ROOT / "mobile" / "dist",  # Expo web build
        PROJECT_ROOT / "frontend" / "dist",  # legacy Vite build
        PROJECT_ROOT / "dist",  # legacy single-root Vite build
    )
    for candidate in candidates:
        index_file = candidate / "index.html"
        if index_file.is_file():
            return candidate.resolve()
    return None


FRONTEND_DIST = _find_frontend_dist()

if FRONTEND_DIST is not None:

    @app.get("/", include_in_schema=False)
    def serve_frontend_root() -> FileResponse:
        return FileResponse(FRONTEND_DIST / "index.html")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend_asset_or_route(full_path: str) -> FileResponse:
        # Router endpoints were added before this catch-all. Preserve API 404s
        # rather than responding with the React index page for a typo in /api.
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found.")

        requested = (FRONTEND_DIST / full_path).resolve()
        try:
            requested.relative_to(FRONTEND_DIST)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail="Not found.") from exc

        if requested.is_file():
            return FileResponse(requested)
        if Path(full_path).suffix:
            raise HTTPException(status_code=404, detail="Static asset not found.")

        # Enables React Router paths to be refreshed directly in the browser.
        return FileResponse(FRONTEND_DIST / "index.html")

else:

    @app.get("/", include_in_schema=False)
    def root() -> JSONResponse:
        return JSONResponse(
            {
                "message": "Local System RAG Agent API is running.",
                "frontend": "Build frontend/ with npm run build to serve the React UI here.",
            }
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8000")),
        reload=False,
    )
