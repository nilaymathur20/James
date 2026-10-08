#!/bin/bash
# Start James backend and frontend together
# Usage: ./start-all.sh

# Kill any existing servers on port 8000 and 5173
echo "Cleaning up existing servers..."
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 5173/tcp 2>/dev/null || true

# Also kill any uvicorn or vite processes
pkill -f "uvicorn backend.main" 2>/dev/null || true
pkill -f "vite.*dev" 2>/dev/null || true
pkill -f "vite build" 2>/dev/null || true
sleep 2

# Export whisper environment variables for voice commands
export WHISPER_MODEL_PATH="/home/nilay/root/vendor/whisper.cpp/models/ggml-base.en.bin"
export WHISPER_BIN="/home/nilay/root/vendor/whisper.cpp/build/bin/whisper-cli"
export WS_ALLOW_MISSING_ORIGIN=true

# Start backend
echo "Starting backend on http://127.0.0.1:8000"
echo "Voice support: enabled (whisper.cpp)"
. .venv/bin/activate
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload &

# Wait for backend to start
sleep 2

# Start frontend (serve built dist statically — Vite dev has rolldown binary bug)
echo "Starting frontend on http://localhost:5173 (built dist)"
python3 -m http.server 5173 --directory frontend/dist > /dev/null 2>&1 &

echo ""
echo "Both servers started. Press Ctrl+C to stop."
echo "Backend: http://127.0.0.1:8000/docs"
echo "Frontend: http://localhost:5173"