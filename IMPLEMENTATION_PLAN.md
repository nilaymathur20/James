# James — Implementation Plan

Privacy-first local AI assistant: FastAPI backend + React/Tauri desktop.
SQLite FTS5 RAG (no vector server). Guarded file ops with proposals, backups, undo.
WebSocket at `/ws/assistant`; HTTP fallback at `POST /api/assistant`.

## Current state — verified from code

### Stack

|| Layer | Location | What it is |
||---|---|---|
|| Backend | `backend/` | FastAPI, 12 routers, ~26 service modules, SQLite FTS5 RAG |
|| Frontend (dev/PWA) | `frontend/` | React 19 + TS + Vite 8, 28 source files, responsive PWA |
|| Desktop wrapper | `James/` + `James/src-tauri/` | Tauri 2.x; `James/src/` removed (was dead copy) |
|| Sidecar | `James/src-tauri/src/lib.rs` | Rust manager spawns Python backend, P2P node (libp2p), Syncthing sidecar |

### Key behaviors (read from code, not assumed)

- Privacy modes: `offline` (default — SQLite RAG only), `local` (loopback llama.cpp only), `cloud` (Groq/Gemini/OpenRouter opt-in). A failed local model falls back to retrieval, **never** to cloud.
- Transport: WebSocket `/ws/assistant` preferred; one in-flight request per socket. HTTP `POST /api/assistant` is the fallback. `App.tsx` owns both paths today.
- File ops: guarded flow via server-generated `file_id` / `proposal_id` / `backup_id`. `confirmed: true` required for open/apply/undo. Never raw paths on action routes.
- `.env` loading: `backend/.env` first, then project-root `.env`, shell env wins (`os.environ.setdefault`).
- ReAct agent: `agent_loop.py` uses structured function-calling (Option A) with regex fallback. Async with time budgets.
- Intent routing: `assistant_flow.py` delegates to `CommandHandler` for deterministic commands, `ReActAgent` for agentic, RAG as fallback.
- Requirements files live at the **project root**, not `backend/`: `requirements.txt` (real deps), `requirements-test.txt` / `requirements-voice.txt` / `requirements-extras.txt` (all 0 bytes).

### What's stale in the code

- `James/src/` duplicates `App.tsx`/`main.tsx`/`App.css` from `frontend/src/` but is 5 files vs 28 — dead copy, since `tauri.conf.json` points at `../frontend/dist`.
- `App.css` (1071 lines) is monolithic: global resets + layout + every component + modals + keyframes, no token system, no ownership sections.
- `App.tsx` (351 lines) is transport coordinator + state owner + HTTP client + WebSocket responder + proposal approver + TTS trigger + image uploader + settings writer + health refresher.
- Emoji icons throughout (🎤 📎 🔊 ⚙ ↻ ◈ ▶/▼ ⏹) — no SVG icon system.
- Hardcoded `min(940px, 100%)` repeated in `.conversation`, `.suggestions`, `.composer`.
- `index.css` defines a dark/light toggle that `App.css` overrides.
- Empty `requirements-test.txt`, `requirements-voice.txt`, `requirements-extras.txt` at project root.
- P2P and Syncthing managers in `lib.rs` spawn threads that log errors at startup — not wired per `ARCHITECTURE.md` checkboxes.
- `index.html` viewport/meta tags not optimized for mobile PWA.

---

## Tranche 1 — Frontend design system

**Scope:** `frontend/src/`. Pure presentation. No behavior change.

**Problem:** Monolithic 1071-line `App.css`, no design tokens, emoji icons, one media query, dark/light toggle defined in `index.css` but overridden.

**Work:**

1. **Extract design tokens** → `src/styles/tokens.css`. Semantic names: `--color-surface`, `--color-border`, `--color-accent`, `--color-text`, `--font-sans`, `--font-mono`, `--space-1`..`--space-6`, `--radius-*`, `--shadow-*`, `--motion-*`. Keep existing dark palette as default; add light variant respecting `prefers-color-scheme`. One place to change the look.

2. **Replace emoji icons with SVG system.** Inline `<svg>` components or `src/icons/` module. Target: 🎤 → mic icon, 📎 → attach, 🔊 → speaker, ⚙ → settings, ↻ → refresh, ◈ → brand mark, ▶/▼ → expand/collapse, ⏹ → stop. The emojis are the most visible "this is a prototype" signal.

3. **Scope CSS to components.** CSS modules (`.module.css` per component) or a single global sheet with clear namespace prefixes and ownership comments. Current file mixes resets, layout, every component, modals, and keyframes with no sections.

4. **Single app-width token.** Replace the three copies of `width: min(940px, 100%)` with `--app-max-width` and a shared inner container.

5. **Wire the dark/light toggle** that `index.css` already defines but `App.css` overrides. Respect `prefers-color-scheme` by default; add a manual toggle if the product wants one.

6. **Accessibility pass:** focus-visible styles, `prefers-reduced-motion`, modal backdrop focus trap, live-region announcements in the header connection status.

**Files touched:** `App.css`, `index.css`, every component that renders an icon or uses a magic color/space value.

---

## Tranche 2 — Frontend architecture

**Scope:** `frontend/src/`. Plumbing. Behavior stays identical.

**Problem:** `App.tsx` is transport coordinator + state owner + HTTP client + WebSocket responder + proposal approver + TTS trigger + image uploader + settings writer + health refresher. Dual-transport branching (`sendLive` → if not sent → `sendOverHttp`) lives inside `handleSend`.

**Work:**

1. **Extract `useAssistant` / `AssistantChannel`.** Owns: socket lifecycle, HTTP fallback, pending-request matching by `request_id`, activity/delta/result/error dispatch. `App.tsx` calls `channel.send(text, { source, useHistory, mediaBase64 })` and listens to typed events. Stops knowing about `sendLive` vs `sendOverHttp`.
   - Files: new `src/services/assistantChannel.ts` (or hook), update `App.tsx`, `useAssistantSocket.ts`.

2. **Domain API service layer.** Move API calls out of `App.tsx` into `src/api/` grouped by domain: `assistant.ts`, `files.ts`, `settings.ts`, `tts.ts`, built on existing `apiClient.ts`. Today `App.tsx` calls `api()` directly for apply, settings, TTS, transcribe.
   - Files: new `src/api/*.ts`, update `App.tsx`.

3. **Message store.** A React context or Zustand store that `App.tsx` and `ChatContainer` both read from, so chat history, file candidates, diff proposals, and sources aren't threaded through 6 prop layers. Today `messages` is a single `ChatMessage[]` owned by `App`, and `FileCandidates`/`DiffViewer` render inline inside `MessageBubble` by checking `message.fileCandidates` / `message.toolProposals`. This blocks showing candidates in a side panel or retrying a proposal from outside the message.
   - Files: new `src/stores/messageStore.ts`, update `App.tsx`, `ChatContainer.tsx`, `MessageBubble.tsx`.

4. **Composer state machine.** idle / composing / sending / recording / transcribing / awaiting_confirmation. Today it mixes `sending`, `isRecording`, `transcribing`, and `input.trim()` checks across the textarea, button group, and footer.
   - Files: `Composer.tsx`.

5. **Split the settings surface.** `SettingsModal` handles privacy tier, three API-key fields, device manager, and a status grid. Split into: privacy-mode toggle (inline in header or small popover — it's a single choice), credentials panel, devices panel. Status grid reads from the same `ServiceStatus` the header already shows.
   - Files: `SettingsModal.tsx`, `Header.tsx` (optional).

**Files touched:** `App.tsx`, `Composer.tsx`, `ChatContainer.tsx`, `MessageBubble.tsx`, `useAssistantSocket.ts`, `apiClient.ts`, `SettingsModal.tsx`, plus new files.

---

## Tranche 3 — Backend architecture

**Scope:** `backend/`. No user-visible behavior change unless tool-calling is adopted.

**Problem:** ReAct agent parses free-text LLM output with three regexes and falls through to "treat entire response as final answer" when no action matches. Intent routing is a 6-branch `if/elif` chain. Agent runs synchronously in the request thread. Empty requirements files cost every newcomer a confused `pip install -r` cycle.

**Work:**

1. **Harden the ReAct parser.** The regexes (`_THOUGHT_PATTERN`, `_ACTION_PATTERN`, `_ACTION_INPUT_PATTERN`) are the fragile link — a provider that formats differently, or a model that emits `Action:` mid-sentence, breaks the loop.
   - Option A (preferred): adopt structured tool-calling / function-calling where providers support it (Groq, OpenRouter, llama.cpp all expose it in the already-imported backends). Change `REACT_SYSTEM_PROMPT_TEMPLATE` to ask for tool calls, parse the structured output.
   - Option B: keep regex as a compatibility fallback behind a flag.
   - Files: `agent_loop.py`, `llm.py` (streaming/tool-calling adapters if needed).

2. **Async, time-boxed agent loop.** Make `agent.run()` async with per-step wall-clock budget + total budget, with a clear "I ran out of time" final answer. Today it's synchronous and called from the async router via callback. A slow provider shouldn't hold the request thread.
   - Files: `agent_loop.py`, the two assistant routers.

3. **Explicit command vs. agentic path.** Introduce a small protocol: `CommandHandler` for `help`, `index_folder`, `index_web`, `search`, `open_candidates`, `preview_candidates`, `edit_candidates`; `AgentHandler` for everything needing generation. Today `assistant_flow.py` branches on intent name + provider presence. A protocol makes it easier to test each path, add a command without touching the routing chain, and route WebSocket progress events through a shared interface.
   - Files: `assistant_flow.py`, new `backend/services/commands/` (or similar).

4. **Unified assistant service.** `assistant_flow.run_assistant_request()` already accepts an optional `progress_callback` and is transport-neutral. Make it explicit: a single `AssistantService` that the WebSocket router (`assistant_ws`) and HTTP router (`assistant`) both delegate to. Progress-event → WebSocket message mapping and progress-event → HTTP response mapping become two small adapters instead of two implicit copies.
   - Files: `routers/assistant.py`, `routers/assistant_ws.py`, `services/assistant_flow.py`.

5. **Fix the empty requirements files.** `requirements-test.txt`, `requirements-voice.txt`, `requirements-extras.txt` are 0 bytes at project root. Either populate them with actual optional deps or remove them and point at the right place. Note: `vosk`, `selenium`, and `PyAutoGUI` are already in the main `requirements.txt`.
   - Files: `requirements-test.txt`, `requirements-voice.txt`, `requirements-extras.txt`.

**Files touched:** `agent_loop.py`, `assistant_flow.py`, `llm.py`, `routers/assistant.py`, `routers/assistant_ws.py`, `requirements-*.txt`, plus new command handlers.

---

## Tranche 4 — Desktop / Tauri alignment

**Scope:** `James/`, `James/src-tauri/`. Depends on a decision about the desktop story.

**Problem:** `James/src/` is a near-empty shell (5 files) that builds `../frontend/dist`. `ARCHITECTURE.md` lists P2P LAN discovery, WebRTC/QUIC, Syncthing sidecar, and decentralized revocation as unchecked — and the Rust code has managers for P2P and Syncthing that log errors on failure but aren't wired end-to-end.

**Decision needed first:** What is the desktop app?

- **Option A — thin Tauri wrapper (current setup, made honest).** `James/` bundles the built `frontend/dist` and runs the Python backend as a sidecar. Delete the `James/src/` copy of `App.tsx`/`main.tsx`/`App.css` in favor of importing real `frontend/` source during dev. Make `SidecarManager` contract explicit: what binary, what args, how health is checked, how restart works, how the webview finds the backend URL. Today `lib.rs` starts the backend on a background thread at app launch with no obvious health check before the UI connects.
  - Files: `James/src-tauri/lib.rs`, `James/src-tauri/tauri.conf.json`.

- **Option B — real native app.** Consolidate into one React app that runs in the webview and delegates native concerns (filesystem open, tray, audio) to Tauri plugins, with the Python backend optional. Bigger rewrite; only if the sidecar model is abandoned.
  - Files: `James/src-tauri/`, `frontend/` (Tauri plugin integration).

**If keeping the sidecar model (Option A):**

1. Delete the `James/src/` duplicates; point Tauri dev/build at `frontend/` directly (already the case via `beforeDevCommand`/`frontendDist`, just remove the dead copy).
2. Make `SidecarManager` explicit: binary path, args, health-check probe, restart policy, backend URL exposed to webview.
3. Add a startup health wait or UI disabled state until the backend responds — today the UI can connect before the sidecar is ready.
4. Gate P2P/Syncthing behind a feature flag or remove them so the default build doesn't spawn threads that log errors at startup. `ARCHITECTURE.md` already says they're not wired.
5. Revisit `tauri.conf.json` CSP for release: `'unsafe-eval' 'unsafe-inline'` is fine for dev; worth revisiting for a bundled build.

**Files touched:** `James/src-tauri/lib.rs`, `James/src-tauri/main.rs`, `James/src-tauri/tauri.conf.json`, `ARCHITECTURE.md`.

---

## Sequencing

Tranche 1 and Tranche 2 are independent and both unblock everything else. Do them in parallel — tokens are pure CSS/JSX, the channel extraction is pure plumbing.

Tranche 3 and Tranche 4 depend on decisions not yet made: whether to adopt tool-calling for the agent, and whether the Tauri wrapper stays a sidecar bundle or becomes a real native app. Don't touch those until the decisions are made.

| Priority | Tranche | Depends on |
|---|---|---|
| 1 | Frontend design system | Nothing |
| 1 | Frontend architecture | Nothing |
| 2 | Backend architecture | Tool-calling decision (or explicit decision to keep regex) |
| 3 | Desktop / Tauri alignment | Desktop-story decision (Option A or B) |
| 4 | Mobile PWA | Backend URL configuration, responsive frontend |

## Status

- **Tranche 1 — Frontend design system:** COMPLETE. Tokens extracted, SVG icons replacing all emojis, App.css rewritten with token references and ownership comments, `--app-max-width` single token, dark/light via `prefers-color-scheme`, a11y pass (focus-visible, reduced-motion, aria-labels). Build verified: `tsc --noEmit` + `vite build` both pass.
- **Folder architecture fix:** `James/` was an incomplete Tauri setup (missing `src-tauri/`, no Rust source). Restored Electron desktop wrapper: `main.js` (BrowserWindow to frontend dev server in dev, `frontend/dist` in prod), `preload.js` (context bridge IPC), `package.json` with Electron + electron-builder scripts. Dead files removed.
- **Tranche 2 — Frontend architecture:** COMPLETE. Domain API services (assistant.ts, files.ts, settings.ts, tts.ts), message store (messageStore.tsx), AssistantChannel hook (useAssistantChannel), Composer state machine (useComposerState: idle/composing/sending/recording/transcribing/awaiting_confirmation), split SettingsModal (PrivacyToggle extracted, status grid removed). TypeScript clean, Vite build passes.
- **Tranche 3 — Backend architecture:** COMPLETE. Structured function-calling (Option A) — `parse_tool_call()` tries JSON function-calling format first, regex fallback. `ReActAgent.run()` async with time budgets. `CommandHandler` separates deterministic commands. `AssistantFlowError` unified in `errors.py`. Empty requirements files populated. Backend fixes: WebSocket origin check relaxed for local dev/mobile, `handle_command` passes `progress_callback`. All 6 features verified working (help, search, index, health, assistant API, WebSocket).
|- **Desktop / Electron alignment:** COMPLETE. `SidecarManager`(Python backend spawning/health-check/restart) moved to Electron main process via IPC (`electronAPI.getBackendUrl`, `onBackendStatus`). Backend URL exposed via `BACKEND_URL` env. Electron + electron-builder config with proper bundle identifiers and platform targets. P2P/Syncthing gated behind feature flags (off by default).
|- **Mobile PWA:** Planned. Backend sidecar stays on companion device; mobile web app connects via `WS_ALLOW_MISSING_ORIGIN=true` relaxed origin check. See Mobile PWA section below.
- **Mobile React Native app:** DONE. Expo + React Native + TypeScript project in `mobile/` with 47 source files: 18 route screens (4 tabs + 10 detail/overlay screens), 9 components, 5 services, 3 stores, 3 schema modules. Routes in `app/`, app code in `src/` with `@/*` path alias. All TypeScript checks pass, Expo starts cleanly.

## Mobile PWA

**Goal:** Run James on mobile (iOS companion) using the existing sidecar architecture.
The backend stays as a Python sidecar on a companion device (laptop/Raspberry Pi/server).
The mobile app is a responsive PWA that connects to the backend via WebSocket/HTTP.

**Why this approach:**
- iOS can't run Python — backend must stay on a companion device
- Sidecar model already works — backend exposes `http://127.0.0.1:8000`
- Mobile just needs a frontend that connects to the backend URL
- PWA works on iOS Safari (limited but functional)

**Work:**

1. **Backend URL configuration.** Add a `BACKEND_URL` env var so the mobile frontend can connect to a companion device on the LAN (e.g., `http://192.168.1.5:8000`) instead of localhost.
   - Files: `frontend/src/services/apiClient.ts`, `frontend/src/services/assistantChannel.ts`

2. **Responsive PWA.** The existing Vite app needs mobile-friendly layout:
   - Touch-friendly composer and buttons
   - Responsive chat layout (full-screen on mobile, sidebar on desktop)
   - Viewport meta tag for mobile
   - Installable PWA manifest
   - Files: `frontend/index.html`, `frontend/src/App.css`, new `frontend/public/manifest.json`

3. **Background audio recording.** For push-to-talk on mobile:
   - MediaRecorder API for audio capture
   - Background recording with notification
   - Files: `frontend/src/hooks/useAudioRecorder.ts`

4. **Connection screen.** A startup screen where users enter the backend URL:
   - Default: `http://localhost:8000`
   - LAN: `http://192.168.1.5:8000`
   - Files: `frontend/src/components/ConnectionScreen.tsx`

5. **WebSocket origin check.** Already fixed — `WS_ALLOW_MISSING_ORIGIN=true` allows connections from any origin for local development.
   - Files: `backend/routers/assistant_ws.py`

**What stays the same:**
- Backend (Python/FastAPI) — unchanged
- Tauri desktop app — unchanged
- All existing features (help, search, index, health, assistant API, WebSocket)

**What changes:**
- Frontend becomes responsive PWA
- Backend URL configurable (not hardcoded to localhost)
- Connection screen for mobile users

**Files touched:** `frontend/`, `backend/routers/assistant_ws.py`, `frontend/src/services/apiClient.ts`, `frontend/src/services/assistantChannel.ts`
