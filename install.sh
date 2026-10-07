#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "=== James Installer ==="
echo ""

# ── Python backend ──────────────────────────────────────────────
echo "[1/4] Creating Python virtual environment..."
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  echo "      Created .venv"
else
  echo "      .venv already exists, skipping"
fi

echo "[2/4] Installing backend dependencies..."
.venv/bin/pip install --quiet --upgrade pip
.venv/bin/pip install --quiet -r requirements.txt

read -rp "      Install voice support (whisper.cpp transcription)? [y/N] " voice
if [[ "${voice:-n}" =~ ^[Yy]$ ]]; then
  .venv/bin/pip install --quiet -r requirements-voice.txt
fi

read -rp "      Install extras (additional integrations)? [y/N] " extras
if [[ "${extras:-n}" =~ ^[Yy]$ ]]; then
  .venv/bin/pip install --quiet -r requirements-extras.txt
fi

# ── Frontend ────────────────────────────────────────────────────
echo "[3/4] Installing frontend dependencies..."
cd frontend
npm install
cd ..

# ── Data directory ──────────────────────────────────────────────
echo "[4/4] Setting up data directories..."
mkdir -p ~/.james/generated_images
mkdir -p ~/.james/history

echo ""
echo "=== Installation complete ==="
echo ""
echo "To start James:"
echo "  ./start-all.sh"
echo ""
echo "Or manually:"
echo "  Backend:  source .venv/bin/activate && uvicorn backend.main:app --host 127.0.0.1 --port 8000"
echo "  Frontend: cd frontend && npm run dev"
