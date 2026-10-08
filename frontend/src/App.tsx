import React, { useCallback, useEffect, useRef, useState } from "react";
import type { PrivacyMode, ServiceStatus } from "@/types";
import { Header } from "@/components/layout/Header";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { Suggestions } from "@/components/composer/Suggestions";
import { Composer } from "@/components/composer/Composer";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { CookieConsent } from "@/components/CookieConsent";
import { MessageStoreProvider, useMessageStore } from "@/stores/messageStore";
import { useAssistantChannel } from "@/services/assistantChannel";
import { applyProposal } from "@/api/files";
import { saveKeys } from "@/api/settings";
import { synthesizeSpeech } from "@/api/tts";
import { fetchHealth } from "@/services/healthService";
import { ImageGeneratorModal } from "@/components/media/ImageGeneratorModal";
import { MediaLibraryModal } from "@/components/media/MediaLibraryModal";
import { generateImage, generateAudio, generateVideo } from "@/api/media";
import "./App.css";

const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const timeNow = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function makeMessage(
  role: "user" | "assistant",
  content: string,
  extra: Partial<import("@/types").ChatMessage> = {}
): import("@/types").ChatMessage {
  return { id: id(), role, content, time: timeNow(), ...extra };
}

type ThemeMode = "aurora" | "midnight" | "amoled" | "auto";

/* Left rail: chats, folders, devices */
function LeftRail({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { state: msgState } = useMessageStore();
  return (
    <aside
      className={`rail ${collapsed ? "rail--collapsed" : ""}`}
      role="complementary"
      aria-label="Sidebar"
    >
      <button className="rail__toggle" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
        {collapsed ? "▸" : "▾"}
      </button>
      {!collapsed && (
        <div className="rail__content">
          <section className="rail__section">
            <h3 className="rail__heading">Chats</h3>
            <p className="rail__empty">No conversations yet</p>
          </section>
          <section className="rail__section">
            <h3 className="rail__heading">Folders</h3>
            <p className="rail__empty">No folders indexed</p>
          </section>
          <section className="rail__section">
            <h3 className="rail__heading">Devices</h3>
            <p className="rail__empty">No paired devices</p>
          </section>
          <div className="rail__msg-count">
            {msgState.messages.length} messages
          </div>
        </div>
      )}
    </aside>
  );
}

/* Right activity drawer: live trace, previews, diffs, audit */
function ActivityDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state: msgState } = useMessageStore();
  return (
    <aside className={`drawer ${open ? "drawer--open" : ""}`} role="complementary" aria-label="Activity">
      <div className="drawer__header">
        <h2 className="drawer__title">Activity</h2>
        <button className="drawer__close" onClick={onClose} aria-label="Close activity drawer">✕</button>
      </div>
      <div className="drawer__body">
        <section className="drawer__section">
          <h3 className="drawer__heading">Live Trace</h3>
          <p className="rail__empty">No active trace</p>
        </section>
        <section className="drawer__section">
          <h3 className="drawer__heading">Previews</h3>
          <p className="rail__empty">No previews</p>
        </section>
        <section className="drawer__section">
          <h3 className="drawer__heading">Audit</h3>
          <p className="rail__empty">No audit entries</p>
        </section>
        <section className="drawer__section">
          <h3 className="drawer__heading">Messages</h3>
          <p className="rail__empty">{msgState.messages.length} messages</p>
        </section>
      </div>
    </aside>
  );
}

/* Blob presence indicator: idle / listening / thinking / speaking / error */
function BlobPresence({ state }: { state: "idle" | "listening" | "thinking" | "speaking" | "error" }) {
  return (
    <span className="blob-indicator" aria-label={`Status: ${state}`} title={state}>
      <span className={`blob-dot blob-dot--${state}`} />
      <span className={`blob-morph blob-morph--${state}`} />
    </span>
  );
}

/* Theme switcher */
function ThemeSwitcher({ current, onChange }: { current: ThemeMode; onChange: (t: ThemeMode) => void }) {
  const options: { value: ThemeMode; label: string }[] = [
    { value: "aurora", label: "Aurora" },
    { value: "midnight", label: "Midnight" },
    { value: "amoled", label: "AMOLED" },
    { value: "auto", label: "Auto" },
  ];
  return (
    <div className="theme-switcher" role="radiogroup" aria-label="Theme">
      {options.map((o) => (
        <button
          key={o.value}
          className={`theme-btn ${current === o.value ? "theme-btn--active" : ""}`}
          onClick={() => onChange(o.value)}
          role="radio"
          aria-checked={current === o.value}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Inner component that uses the message store and channel
const AppInner: React.FC = () => {
  const { state: messageState, dispatch: messageDispatch } = useMessageStore();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [useHistory, setUseHistory] = useState(false);
  const [activity, setActivity] = useState("");
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>("offline");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImageGenOpen, setIsImageGenOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("auto");
  const [blobState, setBlobState] = useState<"idle" | "listening" | "thinking" | "speaking" | "error">("idle");
  const healthChecked = useRef(false);

  // Theme application
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "auto") {
      root.removeAttribute("data-theme");
      root.classList.remove("theme-aurora", "theme-midnight", "theme-amoled");
    } else {
      root.setAttribute("data-theme", theme === "midnight" ? "midnight" : theme === "amoled" ? "amoled" : "aurora");
    }
  }, [theme]);

  // Map channel state → blob presence
  useEffect(() => {
    if (sending) setBlobState("thinking");
    else if (activity) setBlobState("thinking");
    else setBlobState("idle");
  }, [sending, activity]);

  // Health check — runs once on mount, retries until online
  useEffect(() => {
    if (healthChecked.current) return;
    healthChecked.current = true;

    let disposed = false;
    let retryTimer: number | null = null;

    const checkHealth = async () => {
      const result = await fetchHealth();
      if (disposed) return;

      if (result.online) {
        setPrivacyMode(result.mode);
        setService({
          state: "online",
          chunks: result.chunks,
          provider: result.provider,
          historyAvailable: result.historyAvailable,
          privacyMode: result.mode,
          deviceId: result.deviceId,
        });
        if (!result.historyAvailable) setUseHistory(false);
      } else {
        setService((current) => ({ ...current, state: "offline", historyAvailable: false }));
        setUseHistory(false);
        retryTimer = window.setTimeout(checkHealth, 3000);
      }
    };

    void checkHealth();
    return () => {
      disposed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, []);

  const handleResult = useCallback(
    (result: import("@/types").AssistantResultPayload) => {
      messageDispatch({
        type: "ADD_MESSAGE",
        payload: makeMessage("assistant", result.response || "The assistant returned no text.", {
          kind: result.kind,
          mode: result.mode,
          sources: result.results || [],
          fileCandidates: result.file_candidates || [],
          providerError: result.provider_error || null,
          thought: result.thought,
          steps: result.steps,
          toolProposals: result.tool_proposals,
          mediaUrl: result.media_url,
          mediaType: result.media_type,
          data: { images: result.images || [] },
        }),
      });
      setActivity("");
      setSending(false);
      setBlobState("idle");
    },
    [messageDispatch]
  );

  const handleError = useCallback(
    (errorMessage: string) => {
      setActivity("");
      setSending(false);
      setBlobState("error");
      messageDispatch({
        type: "ADD_MESSAGE",
        payload: makeMessage("assistant", `I could not complete that request.\n\nError: ${errorMessage}`),
      });
    },
    [messageDispatch]
  );

  const handleActivity = useCallback((statusMessage: string) => {
    setActivity(statusMessage);
  }, []);

  const channel = useAssistantChannel({
    onResult: handleResult,
    onError: handleError,
    onActivity: handleActivity,
  });

  const handleSend = useCallback(
    async (text: string, source: "typed" | "voice" = "typed") => {
      if (!text.trim() || sending) return;
      const trimmed = text.trim();

      // Image generation
      if (trimmed.toLowerCase().startsWith("image ") || trimmed.toLowerCase().startsWith("/image ")) {
        const prefix = trimmed.toLowerCase().startsWith("/image ") ? "/image " : "image ";
        const prompt = trimmed.slice(prefix.length).trim();
        if (!prompt) {
          messageDispatch({ type: "ADD_MESSAGE", payload: makeMessage("user", text) });
          messageDispatch({ type: "ADD_MESSAGE", payload: makeMessage("assistant", "Please provide a prompt for image generation.") });
          return;
        }
        messageDispatch({ type: "ADD_MESSAGE", payload: makeMessage("user", text) });
        setInput("");
        setSending(true);
        setActivity("Generating image…");
        try {
          const result = await generateImage({ prompt });
          if (result.success && result.filename) {
            messageDispatch({ type: "ADD_MESSAGE", payload: makeMessage("assistant", `Image generated: ${result.filename}`, { mediaUrl: `/api/media/library/image/${result.filename}`, mediaType: "image" }) });
          } else {
            messageDispatch({ type: "ADD_MESSAGE", payload: makeMessage("assistant", `Failed to generate image: ${result.error || "Unknown error"}`) });
          }
        } catch (err) {
          messageDispatch({ type: "ADD_MESSAGE", payload: makeMessage("assistant", `Error: ${err instanceof Error ? err.message : "Failed to generate image"}`) });
        }
        setActivity("");
        setSending(false);
        return;
      }

      // Audio generation
      if (trimmed.toLowerCase().startsWith("audio ") || trimmed.toLowerCase().startsWith("/audio ")) {
        const prefix = trimmed.toLowerCase().startsWith("/audio ") ? "/audio " : "audio ";
        const prompt = trimmed.slice(prefix.length).trim();
        if (!prompt) {
          messageDispatch({ type: "ADD_MESSAGE", payload: makeMessage("user", text) });
          messageDispatch({ type: "ADD_MESSAGE", payload: makeMessage("assistant", "Please provide a prompt for audio generation.") });
          return;
        }
        messageDispatch({ type: "ADD_MESSAGE", payload: makeMessage("user", text) });
        setInput("");
        setSending(true);
        setActivity("Generating audio…");
        try {
          const result = await generateAudio({ prompt });
          if (result.success && result.filename) {
            messageDispatch({ type: "ADD_MESSAGE", payload: makeMessage("assistant", `Audio generated: ${result.filename}`, { mediaUrl: `/api/media/library/audio/${result.filename}`, mediaType: "audio" }) });
          } else {
            messageDispatch({ type: "ADD_MESSAGE", payload: makeMessage("assistant", `Failed to generate audio: ${result.error || "Unknown error"}`) });
          }
        } catch (err) {
          messageDispatch({ type: "ADD_MESSAGE", payload: makeMessage("assistant", `Error: ${err instanceof Error ? err.message : "Failed to generate audio"}`) });
        }
        setActivity("");
        setSending(false);
        return;
      }

      // Video generation
      if (trimmed.toLowerCase().startsWith("video ") || trimmed.toLowerCase().startsWith("/video ")) {
        const prefix = trimmed.toLowerCase().startsWith("/video ") ? "/video " : "video ";
        const prompt = trimmed.slice(prefix.length).trim();
        if (!prompt) {
          messageDispatch({ type: "ADD_MESSAGE", payload: makeMessage("user", text) });
          messageDispatch({ type: "ADD_MESSAGE", payload: makeMessage("assistant", "Please provide a prompt for video generation.") });
          return;
        }
        messageDispatch({ type: "ADD_MESSAGE", payload: makeMessage("user", text) });
        setInput("");
        setSending(true);
        setActivity("Generating video… (this may take 15-45 seconds)");
        try {
          const result = await generateVideo({ prompt });
          if (result.success && result.filename) {
            messageDispatch({ type: "ADD_MESSAGE", payload: makeMessage("assistant", `Video generated: ${result.filename}\n\nYou can also view it in the Media Library.`, { mediaUrl: `/api/media/library/video/${result.filename}`, mediaType: "video" }) });
          } else {
            messageDispatch({ type: "ADD_MESSAGE", payload: makeMessage("assistant", `Failed to generate video: ${result.error || "Unknown error"}`) });
          }
        } catch (err) {
          messageDispatch({ type: "ADD_MESSAGE", payload: makeMessage("assistant", `Error: ${err instanceof Error ? err.message : "Failed to generate video"}`) });
        }
        setActivity("");
        setSending(false);
        return;
      }

      // Default: send to assistant channel
      messageDispatch({ type: "ADD_MESSAGE", payload: makeMessage("user", text) });
      setInput("");
      setSending(true);
      setBlobState("thinking");
      setActivity("Processing request locally…");

      await channel.send(text, { source, useHistory });
    },
    [sending, useHistory, messageDispatch, channel]
  );

  const handleImageAttached = useCallback(
    async (file: File) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        const prompt = input.trim() || "Analyze this image and describe what you see.";
        messageDispatch({ type: "ADD_MESSAGE", payload: makeMessage("user", prompt, { mediaUrl: base64Data, mediaType: "image" }) });
        setInput("");
        setSending(true);
        setBlobState("thinking");
        setActivity("Analyzing image with vision model…");
        await channel.send(prompt, { source: "typed", mediaBase64: base64Data });
      };
      reader.readAsDataURL(file);
    },
    [channel, input, messageDispatch]
  );

  const handleApproveProposal = useCallback(
    async (proposalId: string) => {
      try {
        const res = await applyProposal(proposalId);
        messageDispatch({ type: "ADD_MESSAGE", payload: makeMessage("assistant", res.message || "Changes applied successfully. Backup created.") });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error applying changes";
        messageDispatch({ type: "ADD_MESSAGE", payload: makeMessage("assistant", `Failed to apply change: ${msg}`) });
      }
    },
    [messageDispatch]
  );

  const handleRejectProposal = useCallback(
    (proposalId: string) => {
      messageDispatch({ type: "ADD_MESSAGE", payload: makeMessage("assistant", `Proposal ${proposalId} was rejected by user.`) });
    },
    [messageDispatch]
  );

  const handleSpeakText = useCallback(async (text: string) => {
    const blob = await synthesizeSpeech(text);
    if (blob) {
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      void audio.play();
    }
  }, []);

  const handleSaveKeys = useCallback(async (keys: Record<string, string>) => {
    await saveKeys(keys);
  }, []);

  const handleChangePrivacyMode = useCallback(
    async (mode: PrivacyMode) => {
      setPrivacyMode(mode);
      try {
        const result = await fetchHealth();
        if (result.online) {
          setPrivacyMode(result.mode);
          setService((current) => ({ ...current, privacyMode: result.mode }));
        }
      } catch {
        setPrivacyMode((prev) => prev);
      }
    },
    []
  );

  const handleCancel = useCallback(() => {
    channel.cancel();
    setSending(false);
    setActivity("");
    setBlobState("idle");
  }, [channel]);

  const handleClearScreen = useCallback(() => {
    messageDispatch({
      type: "SET_MESSAGES",
      payload: [
        makeMessage(
          "assistant",
          useHistory
            ? "Screen cleared. Local chat history remains enabled."
            : "Screen cleared. Local chat history is off for new requests."
        ),
      ],
    });
  }, [useHistory, messageDispatch]);

  // Seed initial message once
  const initialSeededRef = useRef(false);
  useEffect(() => {
    if (initialSeededRef.current || messageState.messages.length > 0) return;
    initialSeededRef.current = true;
    messageDispatch({
      type: "ADD_MESSAGE",
      payload: makeMessage(
        "assistant",
        'I am ready. Ask a question, search your indexed files, or type a command such as "index ~/Documents".\n\ntry: "search API configuration" or "help" to see all commands.'
      ),
    });
  }, [messageDispatch, messageState.messages.length]);

  const [service, setService] = useState<ServiceStatus>({
    state: "checking",
    chunks: 0,
    provider: null,
    historyAvailable: false,
    privacyMode: "offline",
    deviceId: "local",
  });

  return (
    <main className="app-shell">
      {/* Top bar */}
      <Header
        service={service}
        liveState={channel.liveState}
        onRefreshHealth={async () => {
          const result = await fetchHealth();
          if (result.online) {
            setPrivacyMode(result.mode);
            setService({
              state: "online",
              chunks: result.chunks,
              provider: result.provider,
              historyAvailable: result.historyAvailable,
              privacyMode: result.mode,
              deviceId: result.deviceId,
            });
            if (!result.historyAvailable) setUseHistory(false);
          } else {
            setService((current) => ({ ...current, state: "offline", historyAvailable: false }));
            setUseHistory(false);
          }
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenImageGen={() => setIsImageGenOpen(true)}
        onOpenLibrary={() => setIsLibraryOpen(true)}
      />

      <div className="app-layout">
        {/* Left rail */}
        <LeftRail collapsed={railCollapsed} onToggle={() => setRailCollapsed((c) => !c)} />

        {/* Center: conversation + composer */}
        <div className="app-main">
          <ChatContainer
            messages={messageState.messages}
            sending={sending}
            activity={activity}
            onApproveProposal={handleApproveProposal}
            onRejectProposal={handleRejectProposal}
            onSpeakText={handleSpeakText}
          />

          <Suggestions onSelect={(command) => setInput(command)} />

          {/* Floating composer with blob presence */}
          <div className="composer-float">
            <BlobPresence state={blobState} />
            <Composer
              input={input}
              onChangeInput={setInput}
              onSend={handleSend}
              onCancel={handleCancel}
              sending={sending}
              useHistory={useHistory}
              onChangeUseHistory={setUseHistory}
              historyAvailable={service.historyAvailable}
              onClearScreen={handleClearScreen}
              onImageAttached={handleImageAttached}
              blobState={blobState}
            />
          </div>
        </div>

        {/* Right activity drawer */}
        <ActivityDrawer open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      </div>

      {/* Theme switcher (floating, bottom-left) */}
      <div className="theme-switcher-float">
        <ThemeSwitcher current={theme} onChange={setTheme} />
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentMode={privacyMode}
        onChangeMode={handleChangePrivacyMode}
        onSaveKeys={handleSaveKeys}
        service={service}
        onModeSwitch={() => {
          setPrivacyMode("cloud" as PrivacyMode);
        }}
      />

      <ImageGeneratorModal isOpen={isImageGenOpen} onClose={() => setIsImageGenOpen(false)} />
      <MediaLibraryModal isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} />

      <CookieConsent />
    </main>
  );
};

// Wrap with MessageStoreProvider
export const App: React.FC = () => (
  <MessageStoreProvider>
    <AppInner />
  </MessageStoreProvider>
);

export default App;