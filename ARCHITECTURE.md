# James Local AI Assistant - Architectural Specifications

This document outlines the architectural goals and implementation status of the James Local AI Assistant.

## 1. Cross-Platform & Architecture
- [x] **Single Codebase UI**: Built using Vite, React, and TypeScript.
|- [x] **Desktop Packaging**: Electron framework supporting Windows, macOS, and Linux with a native webview surface.
- [x] **Progressive Web App (PWA)**: Pure web version serving the same React frontend with platform-specific feature gating.
- [x] **Centralized Backend/Agent Runtime**: Decoupled backend process handling business logic, the ReAct loop, and tool executions to prevent code duplication across platforms.

## 2. Networking & P2P Connectivity
- [x] **Device Pairing & Trust Store**: SQLite-backed trusted device management with REST endpoints for pair/list/revoke/heartbeat; P2P proxy middleware routes to trusted peers via HTTP.
- [ ] **Zero-Config LAN Discovery**: mDNS and libp2p not yet wired in.
- [ ] **Secure Data Channels**: WebRTC/QUIC not yet implemented.
- [ ] **Fallback Relay Support**: Tailscale/Cloudflare Tunnels not yet implemented.

## 3. Synchronization & State Management
- [ ] **Peer-to-Peer File Sync**: Syncthing integration managed as a Tauri sidecar process for robust, background folder synchronization.
- [x] **Isolated Security Boundaries**: Separation of the core Syncthing folder from critical agent metadata (device lists, revocation logs, and audit trails) to prevent full-agent compromise. (Implemented via strict file policy)

## 4. Security & Device Pairing
- [x] **Multi-Device Pairing**: REST endpoints + SQLite trust store with device tracking, revocation, heartbeat.
- [x] **Cryptographic Trust Store**: SQLite-backed trusted device management tracking public keys, names, pairing timestamps, and revocation flags.
- [ ] **Decentralized Revocation**: Signed revocation messages broadcasted across the P2P mesh for eventually consistent device access dropping.

## 5. Streaming & Communication
- [x] **Live WebSocket Command Streaming**: Real-time streaming of agent thoughts, tool execution steps, and final responses using structured JSON events.
- [ ] **Multi-Device Proxying**: Cross-device command routing encapsulated securely over P2P data channels when agents run on remote nodes.

## 6. Agent Orchestration & ReAct Loop
- [x] **Classic ReAct Architecture**: Multi-step reasoning framework executing Thought $\rightarrow$ Action $\rightarrow$ Observation loops until a final answer is reached.
- [x] **Versioned Tool Registry**: Centralized tool schemas accessible by both local and remote agent instances.
- [x] **Interactive Guardrails**: Interruptible execution loops with human-in-the-loop confirmation gates for destructive operations.

## 7. Retrieval-Augmented Generation (RAG) & Indexing
- [x] **Lexical RAG (SQLite FTS5)**: Full-text search engine indexing document contents and structural file metadata (paths, timestamps, device origins).
- [x] **Incremental Background Indexing**: File system watchers (`notify` / `chokidar`) that compute content hashes, extract safe text chunks, and upsert records into the FTS table on changes.
- [x] **Low-Priority Processing**: Background thread execution to prevent indexing tasks from blocking the main agent loop.

## 8. Guarded File Operations
- [x] **Strict File Sandboxing**: Comprehensive path canonicalization, size limits, and MIME-type checks preventing unauthorized access to system directories.
- [x] **Edit Proposals & Diffs**: Generation of unified diffs or structured changes instead of immediate disk writes, requiring user acceptance.
- [x] **Atomic File Writes**: Safe write patterns utilizing temporary files (`file.tmp`), `fsync`, and atomic renaming.
- [x] **Automated Versioned Backups**: Creation of backup snapshots prior to any write operation, maintaining a short version history stack.
- [x] **Single-Step Undo Stack**: Quick restoration tool that rolls back files using stored snapshots.
- [x] **Content-Free Audit Logging**: Privacy-preserving audit logs storing timestamps, device IDs, action types, and hashes while strictly excluding file content.

## 9. Voice & Multimodal Processing
- [x] **Offline Push-to-Talk STT**: Local speech-to-text transcription powered by bundled Vosk models via the Web Audio API or Tauri audio plugins.
- [x] **Cloud & Local STT Flexibility**: Settings-backed toggles allowing fallback to high-quality cloud models (Whisper/Groq) when needed.
- [x] **Multimodal Vision Support**: Integration with Gemini vision models for direct image understanding, UI screenshots, and visual queries.

## 10. Generative Media & Tools
- [x] **Zero-Auth Image Generation**: Integration with Pollinations.ai for a default free-tier, keyless image creation experience.
- [x] **Free-Tier Cloud TTS**: Natural-sounding speech synthesis via `edge-tts` wrapping Microsoft Edge neural voice endpoints.
- [x] **Agentic Web Browsing**: Headless browser automation via Playwright allowing the agent to navigate, click elements, extract DOM states, and scrape web data safely.
- [x] **High-Speed Text Offloading**: Routing short, latency-sensitive generation tasks to high-speed providers (Groq API) while reserving heavier reasoning for primary models.

## 11. Configuration & Key Management
- [x] **Bring-Your-Own-Key (BYOK)**: Secure credential storage utilizing OS keychains (via Tauri plugins) or encrypted SQLite tables.
- [x] **Flexible Tier Selection**: Choice between app-provided rate-limited free tiers and user-supplied API keys for scaling performance.
