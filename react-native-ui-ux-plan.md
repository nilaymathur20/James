# James Local Assistant — React Native Frontend Plan

## Product constraint: native mobile application

This plan treats James as a **native iOS and Android application**, not a website wrapped in a mobile layout. The primary experience should use mobile navigation, touch gestures, safe areas, OS permissions, app lifecycle handling, native audio capture, and device networking. React Native Web is not a target for the first release and should not drive component or layout decisions.

The backend remains local-first, but a phone cannot assume that `127.0.0.1` refers to the user's computer. The mobile app therefore needs an explicit connection and pairing experience for reaching the local FastAPI service over a trusted network or through a deliberate device-pairing flow.

## 1. Product direction

Build a calm, trustworthy mobile companion for the James local assistant. The UI should make three things obvious at all times:

1. **What James is doing** — searching, indexing, generating, transcribing, or waiting.
2. **What data is staying local** — local retrieval and guarded file actions should be visually distinct from online provider requests.
3. **What requires user approval** — opening files, applying edits, undoing edits, pairing devices, and other consequential actions must use explicit review and confirmation screens.

The experience should feel like a focused command center rather than a generic chat app: one primary composer, clear activity state, compact result cards, and deliberate confirmation flows.

## 2. Recommended technical foundation

### App shell

- **Expo + React Native + TypeScript** for rapid cross-platform delivery.
- **Expo Router** for file-based navigation and deep-linkable screens.
- Use native iOS/Android primitives and platform conventions; do not design around browser breakpoints, hover states, URLs, or desktop-style sidebars.
- Use `SafeAreaView`, keyboard-aware layouts, bottom sheets, native back behavior, and platform-specific permission prompts from the start.
- **TanStack Query** for HTTP request state, caching, retries, invalidation, and optimistic UI where safe.
- A small dedicated **WebSocket service** for `/ws/assistant`; do not put socket lifecycle logic directly in screens.

### Suggested package set

```bash
npx expo install expo-router expo-secure-store expo-file-system expo-document-picker expo-av expo-haptics expo-linking react-native-safe-area-context react-native-screens react-native-gesture-handler react-native-reanimated react-native-svg
npm install @tanstack/react-query zustand zod axios @shopify/flash-list
npm install @gorhom/bottom-sheet react-native-mmkv
npm install lottie-react-native moti
npm install lucide-react-native
npm install react-native-render-html react-native-markdown-display
npm install diff
```

Optional packages, only when the related feature is needed:

```bash
npm install expo-sharing expo-device expo-notifications
npm install react-native-keychain
npm install @shopify/react-native-skia
```

### Library guidance

- Use **React Native Reanimated + Moti** for subtle state transitions and progress motion. Use **Anime.js only if a specific complex timeline is needed**; it is not necessary for the core app and may duplicate Reanimated's role.
- Use **FlashList** for large search-result and audit lists.
- Use **Bottom Sheet** for mobile preview, result detail, and confirmation surfaces.
- Use **Zod** to validate every API and WebSocket payload at the boundary.
- Use **Lucide** for consistent outline icons rather than mixing icon packs.
- Use **Lottie** sparingly for empty/loading illustrations; prefer lightweight Reanimated animations for routine states.
- Use **Skia** only for a richer visualizer, waveform, or indexing animation. Do not introduce it for ordinary cards and controls.

## 3. Information architecture

### Primary navigation

Use a native four-tab bottom navigator on phones, with a tablet layout introduced later only if needed:

1. **Ask** — primary composer, live response, suggestions, and recent commands.
2. **Library** — indexed roots, files, search, previews, and edit history.
3. **Activity** — indexing jobs, command history, audit records, and online/local activity.
4. **Settings** — connection health, providers, voice, devices, privacy, and appearance.

Keep the composer accessible from every tab through a compact floating action or persistent mini-composer.

Use native stack transitions for detail screens. Support the Android system back button and iOS swipe-back gesture. Do not depend on browser history or URL-based navigation for core flows.

### Route map

```text
/(tabs)
  /ask
  /library
  /activity
  /settings

/command/[requestId]
/file/[fileId]
/file/[fileId]/preview
/file/[fileId]/edit
/file/[fileId]/edit-review
/indexing/[jobId]
/voice
/devices
/privacy
/connection
```

## 4. Core screen plans

### A. Ask screen

**Purpose:** Make the one-box command flow the center of the product.

Layout:

- Header with James status: `Ready`, `Working`, `Offline`, or `Needs attention`.
- Small privacy badge: `Local by default`.
- Conversation/activity stream with compact assistant response cards.
- Composer docked near the bottom with:
  - multiline text input;
  - microphone push-to-talk button;
  - send button;
  - attachment/document button only when supported;
  - command suggestions shown above the keyboard.
- Suggested chips:
  - `Search my files`
  - `Index a folder`
  - `Preview a file`
  - `Review recent activity`

UX improvements:

- Show a human-readable status timeline while the WebSocket is active: `Routing → Searching local index → Preparing result`.
- Display a local/online label on each response, not just globally.
- Keep assistant responses concise and expandable.
- Preserve drafts when navigating away.
- Provide a retry action on socket failure and automatically fall back to `POST /api/assistant`.
- Never imply that a candidate file has been opened or edited before the guarded route succeeds.

### B. Search and Library screen

**Purpose:** Make indexed knowledge understandable and controllable.

Sections:

- Search bar with filters: `All`, `Indexed content`, `Discoverable metadata`, `Recent`.
- Approved roots card showing folder name, item count, last refresh, and status.
- Search results as file cards containing:
  - filename and type icon;
  - safe status badge;
  - path shown in a secondary style;
  - matching excerpt only for indexed content;
  - actions: `Preview`, `Open`, `Edit` where permitted.
- Empty state explaining how to index a folder.

UX improvements:

- Distinguish `indexed` from `discoverable` with both icon and text; do not rely only on color.
- Use skeleton rows while searching.
- Keep search results stable while new results arrive.
- Use FlashList for large result sets.
- Add a filter sheet instead of crowding the search bar.

### C. File preview screen

**Purpose:** Let users inspect content before taking action.

Components:

- File identity header: name, type, root, indexed timestamp.
- Read-only content viewer with line wrapping and monospace mode for code.
- Search within preview.
- `Propose edit`, `Open`, and `Close` actions, conditioned by policy.
- Clear note for discoverable-only files: metadata is available, content is not.

For Markdown or HTML-like content, render safely and sanitize output. For source files, use a plain text or syntax-highlighted viewer without executing content.

### D. Edit proposal and review flow

Use a three-step, explicit flow:

1. **Create proposal** — user enters or confirms the requested change.
2. **Review diff** — show additions/deletions, file identity, expiry countdown, and external-change warning state.
3. **Confirm apply** — explain that the operation writes to disk and creates a backup; require a deliberate confirmation action.

After success:

- Show backup identifier and `Undo` action.
- Make undo available from the activity item.
- If the file changed externally, show a blocking conflict state and do not overwrite.

Use a bottom sheet for short confirmation and a full-screen review for long diffs.

### E. Indexing screen

**Purpose:** Make background work legible without overwhelming the user.

Show:

- Current root or URL.
- Progress state from WebSocket `index_progress`.
- Files scanned, supported text chunks, skipped/protected items, and errors.
- Animated but restrained progress indicator.
- `Run in background` or `Close` if the operation can safely continue.
- A final summary with `View library` action.

Do not show raw internal logs by default. Offer an expandable diagnostics section.

### F. Activity screen

Group events by day and type:

- Commands and responses.
- Indexing runs.
- Preview/open actions.
- Edit proposals, applies, and undos.
- Online provider requests.
- Device events.

The audit endpoint is content-free, so present it as a privacy-safe activity history. Add filters and a search field.

### G. Settings and connection screens

Sections:

- **Connection:** API health, WebSocket state, backend URL/profile, reconnect.
- **Privacy:** local vs online explanation, approved roots, clear local draft/cache controls.
- **Providers:** provider availability without exposing secrets; explain that keys remain backend-side.
- **Voice:** Vosk availability, model status, push-to-talk preference.
- **Devices:** paired devices, heartbeat, revoke action.
- **Appearance:** theme, reduced motion, compact density.
- **About:** protocol version and app diagnostics export.

Device revocation and changing connection targets should use explicit confirmation because they alter access or connectivity.

## 5. Visual design system

### Design principles

- **Quiet confidence:** dark graphite or warm neutral background, high-contrast text, restrained accent color.
- **Local-first clarity:** green/blue accent for local work, amber for online work, red only for blocked or failed actions.
- **Progressive disclosure:** show the next useful action first; put diagnostics and raw metadata behind expansion.
- **Touch-first:** minimum 44–48 dp touch targets and generous spacing around destructive actions.

### Tokens

```ts
export const colors = {
  background: '#0F1115',
  surface: '#171A21',
  surfaceRaised: '#202631',
  text: '#F4F7FB',
  textMuted: '#9AA5B5',
  accent: '#7C9CFF',
  local: '#5FD1A7',
  online: '#F3B562',
  danger: '#F27D86',
  border: '#2B3340',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};
```

Use `StyleSheet.create` or a typed styling system. Avoid scattering literal colors and spacing across screens.

### Motion

- Composer send: short scale/fade transition.
- WebSocket status: animated dot or progress line, never a distracting spinner on every card.
- Indexing: smooth progress interpolation, not frame-by-frame jumps.
- Bottom sheets: Reanimated spring.
- Respect `reduceMotion` and provide a settings override.

## 6. Frontend architecture

```text
src/
  app/                         # Expo Router routes
  components/
    Composer/
    StatusTimeline/
    FileCard/
    DiffViewer/
    PrivacyBadge/
    EmptyState/
  features/
    assistant/
    files/
    indexing/
    activity/
    devices/
    voice/
  services/
    apiClient.ts
    assistantSocket.ts
    audioService.ts
    fileService.ts
  stores/
    sessionStore.ts
    composerStore.ts
    preferencesStore.ts
  schemas/
    assistant.ts
    files.ts
    indexing.ts
  theme/
    tokens.ts
    navigationTheme.ts
  utils/
    errors.ts
    formatters.ts
```

### State ownership

- **TanStack Query:** server state, cache, request lifecycle, invalidation.
- **Zustand:** ephemeral app state such as composer draft, active request, socket state, theme, and user preferences.
- **Screen-local state:** modal visibility and short-lived form state.
- Do not duplicate the same file or index status in multiple independent stores.

### Transport abstraction

Create a single assistant client with two implementations behind one interface:

```ts
export type AssistantEvent =
  | { type: 'ready'; protocol: string }
  | { type: 'assistant_status'; status: string; message?: string }
  | { type: 'index_progress'; scanned: number; indexed: number; skipped: number }
  | { type: 'assistant_result'; result: AssistantResult }
  | { type: 'error'; message: string };

export interface AssistantTransport {
  send(input: AssistantInput, onEvent: (event: AssistantEvent) => void): Promise<void>;
  close(): void;
}
```

The React Native WebSocket client should use a configurable `ws://` or `wss://` base URL. Never hard-code `127.0.0.1` for a physical device; use an environment-specific backend URL or pairing flow.

### Mobile connection model

Provide a first-run connection screen with three explicit options:

1. **Local computer on the same Wi-Fi** — enter or scan a trusted backend address and verify `/api/health`.
2. **Paired device** — use the backend's pairing endpoints and show the paired device name and heartbeat state.
3. **Demo/offline mode** — use mocked data for exploring the interface without a live backend.

For development, allow a configurable LAN host rather than assuming localhost. Explain that the backend should remain bound to a trusted interface and should not be exposed to the public internet. Store only the selected endpoint and non-secret pairing metadata in SecureStore/Keychain. Show connection loss as a recoverable mobile state, not as a blank screen.

### App lifecycle and mobile runtime

- Pause or close the WebSocket when the app enters the background; reconnect on foreground with backoff.
- Preserve the composer draft and the last known request state across interruptions, navigation, and OS memory pressure.
- Do not claim that a long-running indexing operation continues after the app is suspended unless the backend exposes a durable job/status model.
- Use native permission prompts only when a feature is activated: microphone for Vosk transcription, notifications if notifications are added, and local network access where required by the platform.
- Keep all destructive or file-writing confirmations in foreground UI; never trigger them from a background notification.
- Support dark mode, light mode, reduced motion, font scaling, safe areas, keyboard avoidance, and screen-reader navigation.

## 7. Backend integration map

| Backend capability | Mobile UI | Transport |
|---|---|---|
| `/ws/assistant` | Ask screen status timeline | WebSocket |
| `/api/assistant` | Fallback command submission | HTTP |
| `/api/search` | Library search | HTTP |
| `/api/index-folder` | Index root flow | HTTP |
| `/api/index-status` | Library/connection status | HTTP |
| `/api/files/preview` | Preview screen | HTTP |
| `/api/files/open` | Open confirmation flow | HTTP |
| `/api/files/propose-edit` | Edit proposal | HTTP |
| `/api/files/apply-edit` | Diff confirmation | HTTP |
| `/api/files/undo-edit` | Undo action | HTTP |
| `/api/files/audit` | Activity screen | HTTP |
| `/api/transcribe` | Push-to-talk voice flow | Multipart HTTP |
| `/api/transcribe/status` | Voice settings | HTTP |
| `/api/tts/*` | Optional read-aloud feature | HTTP |
| `/api/media/*` | Optional media tools | HTTP |
| `/api/devices`, `/api/pair`, `/api/revoke/*` | Device management | HTTP |
| `/api/health` | Connection diagnostics | HTTP |

Every response should be validated with Zod. Map backend errors to user-facing categories: `offline`, `permission blocked`, `confirmation required`, `file changed`, `expired proposal`, `provider unavailable`, and `unknown error`.

## 8. Critical safety UX rules

1. Never expose arbitrary path input for file actions. The UI must send server-generated `file_id`, `proposal_id`, or `backup_id` only.
2. Use a full review surface before `apply-edit` and `undo-edit`.
3. Label online operations before they begin, especially web search, cloud chat, media generation, and TTS.
4. Avoid showing sensitive file contents in notifications, analytics, crash logs, or deep-link URLs.
5. Do not store provider keys in the mobile app.
6. Store only non-sensitive session/device metadata in SecureStore or Keychain.
7. For offline failure, preserve the user's draft and explain whether retry is safe.
8. Do not assume a WebSocket `assistant_result` means a file action was completed; guarded HTTP actions remain separate.
9. Add a persistent `Local`/`Online` indicator to result cards and settings.
10. Support a reduced-motion mode and accessible labels for every icon-only control.

## 9. Voice UX

Flow:

1. User presses and holds the microphone.
2. Show recording state, elapsed time, cancel gesture, and input-level animation.
3. Release to upload a short recording to `/api/transcribe`.
4. Show transcript as editable draft text.
5. User confirms by pressing Send; transcription must not automatically execute a command.
6. If Vosk is unavailable, explain that voice is not configured and keep typed input available.

Use `expo-av` for recording and `expo-haptics` for start/stop feedback. Request microphone permission only when the user first activates voice.

## 10. Accessibility and internationalization

- Support Dynamic Type and avoid fixed-height text containers.
- Ensure 4.5:1 contrast for normal text.
- Add accessibility labels, hints, and roles to all controls.
- Announce important state changes through accessibility live regions where supported.
- Never communicate safety state by color alone.
- Prepare strings through an i18n layer from the first screen, even if only English ships initially.
- Test VoiceOver and TalkBack on Ask, preview, diff review, and confirmation flows.

## 11. Performance strategy

- Use FlashList for results and activity history.
- Debounce search input and cancel stale requests.
- Keep WebSocket event handling outside render loops.
- Memoize result cards and status rows.
- Avoid rendering large file previews all at once; paginate or virtualize long content.
- Compress or avoid uploading audio longer than the configured short push-to-talk limit.
- Use Reanimated worklets for UI motion rather than JS-thread animation.
- Add performance markers around search, preview, and long diff rendering.

## 12. Delivery phases

### Phase 0 — UX foundation

- Confirm mobile deployment target: Expo Go, development build, or bare React Native.
- Establish navigation, theme tokens, accessibility defaults, and environment configuration.
- Define Zod schemas from the backend response shapes.
- Build a mocked transport so UI work can proceed without a running backend.

**Exit criteria:** navigation works on iOS/Android, theme is consistent, mock Ask flow renders all status states.

### Phase 1 — Ask and connection

- Implement Ask screen and composer.
- Add WebSocket transport with reconnect and HTTP fallback.
- Add status timeline, local/online badges, errors, retries, and draft persistence.
- Add `/api/health` connection card.

**Exit criteria:** typed command flows show ready/status/progress/result/error states and recover from socket failure.

### Phase 2 — Library and preview

- Add search, filters, root status, file cards, and preview.
- Implement indexed versus discoverable presentation.
- Add FlashList, loading skeletons, empty states, and safe action affordances.

**Exit criteria:** users can search, distinguish content availability, preview indexed files, and understand blocked actions.

### Phase 3 — Edit review and activity

- Implement proposal form, diff viewer, apply confirmation, backup result, undo, and conflict states.
- Add audit/activity timeline with filters.
- Add expiry and external-change messaging.

**Exit criteria:** no write or undo action is possible without explicit review and confirmation.

### Phase 4 — Voice, devices, and polish

- Add push-to-talk transcription with editable transcript.
- Add paired device management and revoke confirmation.
- Add notification/deep-link handling only after privacy review.
- Add reduced motion, accessibility QA, haptics, and refined empty/error states.

**Exit criteria:** voice never auto-submits, device states are clear, and critical flows pass accessibility checks.

## 13. Testing plan

### Unit tests

- API and WebSocket schema validation.
- Transport fallback behavior.
- Error mapping.
- Permission/confirmation state machines.
- Diff rendering data transformation.
- Draft persistence and clearing.

### Integration tests

- Ask: WebSocket ready → progress → result.
- WebSocket disconnect → HTTP fallback.
- Search → preview → proposal → diff review → apply.
- External file change → blocked apply.
- Voice recording → transcript draft → manual send.
- Device pairing → list → revoke.

### End-to-end tests

Use Detox or Maestro for the highest-risk flows:

- First launch and backend unavailable.
- Local search and preview.
- Apply edit confirmation.
- Undo confirmation.
- Accessibility labels on the Ask and review screens.

## 14. Definition of a successful UI/UX improvement

The redesign is successful when a first-time user can:

1. Understand within five seconds that James is local-first.
2. Submit a command and understand its live progress.
3. Find a file without seeing confusing raw paths or unsupported actions.
4. Preview a file before opening or editing it.
5. Understand exactly what will change before approving an edit.
6. Tell whether a request is local, online, blocked, or complete.
7. Recover from offline, expired-proposal, and external-change errors without losing work.
8. Complete the core flows with TalkBack or VoiceOver.

## 15. Recommended first implementation slice

Start with a vertical slice rather than building every tab at once:

1. Expo Router shell and design tokens.
2. Ask screen with mocked WebSocket events.
3. Real WebSocket connection and HTTP fallback.
4. One search result card and preview screen.
5. One edit proposal → diff review → confirmation flow.
6. Activity event for the completed operation.

This slice validates the product's central promise—**a clear, local-first assistant that never hides consequential file actions**—before investing in voice, media, device pairing, or elaborate animations.
