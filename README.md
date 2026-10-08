# CivicAI: Municipal Intelligence & Accessibility Assistant

> **Municipal Policy Assistant & Native Mobile AI Solution**

CivicAI is a privacy-first, unified AI platform for citizens and municipal staff. It provides source-grounded answers to policy questions, translates complex government notices into plain language, and ships as a native Android app with full document-scanning capability.

---

## What it Does

| # | Feature | Details |
|---|---|---|
| 1 | **Source-Grounded Policy FAQ** | Answers policy questions strictly using uploaded government documents — with page/paragraph citations. |
| 2 | **Multilingual Notice Translator** | OCR extracts text from notices, translates into regional Indian languages, explains jargon, and flags fraud. |
| 3 | **Native Android App** | Kotlin + Jetpack Compose + CameraX + Material 3 client — scan physical notices with your camera. |
| 4 | **Bring Your Own Key (BYOK)** | Plug in Gemini, Groq, OpenRouter, or a local Llama.cpp/Ollama server. |

---

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│              Client Layer                   │
│  Android App   Web (React/Vite)   Electron  │
└────────────────────┬────────────────────────┘
                     │ REST / WebSocket
┌────────────────────▼────────────────────────┐
│         FastAPI Backend (backend/)          │
│  ReAct Agent · RAG · OCR Pipeline · LLM    │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│          Data & AI Layer                    │
│  SQLite FTS5 (RAG)   LLM Providers   STT   │
└─────────────────────────────────────────────┘
```

| Layer | Technology |
|---|---|
| **Android** | Kotlin 2.x, Jetpack Compose, CameraX, Material 3, Retrofit 2, OkHttp 4 |
| **Web Frontend** | React 18, Vite, TailwindCSS (`frontend/`) |
| **Desktop** | Electron (`James/`) |
| **Backend** | FastAPI, Python 3.10+ (`backend/`) |
| **RAG Database** | SQLite FTS5 (`data/rag_index.db`) |
| **LLM Providers** | Gemini, Groq, OpenRouter, Local Llama.cpp, Ollama |
| **OCR** | PyMuPDF (PDFs), Pytesseract (images) |
| **STT** | whisper.cpp (primary), Vosk (legacy) |
| **TTS** | edge-tts |

---

## Project Layout

```
James-master/
├── android/          # Native Android app (Kotlin + Compose)
├── backend/          # FastAPI backend (main.py, routers, services)
├── frontend/         # React + Vite PWA (port 5173)
├── James/            # Electron desktop wrapper
├── mobile/           # React Native (Expo SDK 57)
├── data/             # SQLite FTS5 index (rag_index.db)
├── runtime/          # Backups, history, output files (create manually)
├── docs/             # Extended documentation
│   └── ANDROID_MIGRATION.md
├── requirements.txt          # Backend dependencies
├── requirements-test.txt     # pytest + httpx
├── backend/.env.example      # Config template — copy to backend/.env
└── compose.yaml              # Docker Compose (binds 127.0.0.1:8000 only)
```

---

## Android App — Quick Start

### Prerequisites
| Tool | Version |
|---|---|
| JDK | 17+ (Eclipse Adoptium Temurin recommended) |
| Android SDK | Platform 35, Build-Tools 35.0.0 |
| Gradle | 8.11.1 (managed by wrapper) |

### 1. Set JAVA_HOME (PowerShell)
```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.10.7-hotspot"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
```

### 2. Configure SDK path — `android/local.properties`
```properties
sdk.dir=C:\\Users\\<YourName>\\android-sdk
```

### 3. Build the debug APK
```powershell
cd android
.\gradlew.bat assembleDebug --no-daemon
```

**Output:** `android/app/build/outputs/apk/debug/app-debug.apk` (~20 MB)

### 4. Install on emulator or device
```powershell
adb install android\app\build\outputs\apk\debug\app-debug.apk
```

> **Emulator backend URL:** The debug build connects to `http://10.0.2.2:8000/api/` (loopback to your host machine).
> For a physical device on LAN, update `BASE_URL` in `android/app/.../core/network/NetworkModule.kt` to your machine's IP.

> **Windows file-lock fix:** If Gradle clean fails, run `.\gradlew.bat --stop` then `Remove-Item -Recurse -Force app\build` before rebuilding.

See [`docs/ANDROID_MIGRATION.md`](docs/ANDROID_MIGRATION.md) for full build environment setup, all configuration changes, and troubleshooting.

---

## Backend Setup

```bash
# 1. Create virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1       # Windows
# source .venv/bin/activate       # Linux/macOS

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
copy backend\.env.example backend\.env   # Windows
# cp backend/.env.example backend/.env   # Linux/macOS
# Edit backend/.env and set AI_MODE + your API key
```

**`backend/.env` example:**
```env
AI_MODE=cloud
GROQ_API_KEY=your_key_here
# or for local:
# AI_MODE=local
```

---

## Running the Application

### Backend (FastAPI)
```bash
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### Web Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

### Desktop (Electron)
```bash
cd James
npm install
npm run electron:dev
```

### Docker (full stack)
```bash
# Create required runtime dirs first
mkdir runtime\backups runtime\history runtime\output_files
docker compose build && docker compose up -d
# Backend available at http://127.0.0.1:8000
```

---

## Testing

```bash
# Activate virtual environment first
.venv\Scripts\Activate.ps1

# Install test dependencies
pip install -r requirements-test.txt

# Run backend test suite (57 tests, 0 failures)
python -m unittest discover -s backend/tests -v

# Frontend build check
cd frontend && npm run build
```

---

## Security Notes

- Backend binds to `127.0.0.1` only — **do not expose to LAN without auth**.
- Android app stores API keys in Android Keystore (AES-256 GCM) — never in SharedPreferences plain text.
- Never index a folder containing secrets — they will be ingested into the SQLite FTS index.
- `.env` files are gitignored; never commit credentials.

---

## LLM Provider Modes

| `AI_MODE` | Provider | Notes |
|---|---|---|
| `offline` | SQLite RAG only | Default — no LLM call, retrieval-only answers |
| `cloud` | Groq / Gemini / OpenRouter | Requires API key in `.env` |
| `local` | Llama.cpp loopback | Requires local server running; falls back to RAG on failure |

---

## Documentation

| Document | Description |
|---|---|
| [`docs/ANDROID_MIGRATION.md`](docs/ANDROID_MIGRATION.md) | Full Android build guide, config changes, APK output, known warnings |
| [`backend/.env.example`](backend/.env.example) | All available environment variables |
