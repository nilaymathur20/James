import React, { useCallback, useEffect, useRef, useState } from "react";
import type { PrivacyMode, ServiceStatus } from "@/types";
import { Header } from "@/components/layout/Header";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { Suggestions } from "@/components/composer/Suggestions";
import { Composer } from "@/components/composer/Composer";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { MessageStoreProvider, useMessageStore } from "@/stores/messageStore";
import { useAssistantChannel } from "@/services/assistantChannel";
import { applyProposal } from "@/api/files";
import { saveKeys } from "@/api/settings";
import { synthesizeSpeech } from "@/api/tts";
import { fetchHealth } from "@/services/healthService";
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

// Inner component that uses the message store and channel
const AppInner: React.FC = () => {
  const { state: messageState, dispatch: messageDispatch } = useMessageStore();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [useHistory, setUseHistory] = useState(false);
  const [activity, setActivity] = useState("");
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>("offline");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [service, setService] = useState<ServiceStatus>({
    state: "checking",
    chunks: 0,
    provider: null,
    historyAvailable: false,
    privacyMode: "offline",
    deviceId: "local",
  });
  const healthChecked = useRef(false);

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
        }),
      });
      setActivity("");
      setSending(false);
    },
    [messageDispatch]
  );

  const handleError = useCallback(
    (errorMessage: string) => {
      setActivity("");
      setSending(false);
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

      messageDispatch({ type: "ADD_MESSAGE", payload: makeMessage("user", text) });
      setInput("");
      setSending(true);
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
        messageDispatch({
          type: "ADD_MESSAGE",
          payload: makeMessage("user", prompt, { mediaUrl: base64Data, mediaType: "image" }),
        });
        setInput("");
        setSending(true);
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
        messageDispatch({
          type: "ADD_MESSAGE",
          payload: makeMessage("assistant", res.message || "Changes applied successfully. Backup created."),
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error applying changes";
        messageDispatch({
          type: "ADD_MESSAGE",
          payload: makeMessage("assistant", `Failed to apply change: ${msg}`),
        });
      }
    },
    [messageDispatch]
  );

  const handleRejectProposal = useCallback(
    (proposalId: string) => {
      messageDispatch({
        type: "ADD_MESSAGE",
        payload: makeMessage("assistant", `Proposal ${proposalId} was rejected by user.`),
      });
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
        await setPrivacyMode(mode);
      } finally {
        // Revert on failure
        const result = await fetchHealth();
        if (result.online) {
          setPrivacyMode(result.mode);
          setService((current) => ({ ...current, privacyMode: result.mode }));
        }
      }
    },
    []
  );

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

  // Seed initial message once — ref guard prevents double-dispatch under StrictMode
  const initialSeededRef = useRef(false);
  useEffect(() => {
    if (initialSeededRef.current || messageState.messages.length > 0) return;
    initialSeededRef.current = true;
    messageDispatch({
      type: "ADD_MESSAGE",
      payload: makeMessage(
        "assistant",
        'I am ready. Ask a question, search your indexed files, or type a command such as "index ~/Documents".'
      ),
    });
  }, [messageDispatch, messageState.messages.length]);

  return (
    <main className="app-shell">
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
      />

      <ChatContainer
        messages={messageState.messages}
        sending={sending}
        activity={activity}
        onApproveProposal={handleApproveProposal}
        onRejectProposal={handleRejectProposal}
        onSpeakText={handleSpeakText}
      />

      <Suggestions onSelect={(command) => setInput(command)} />

      <Composer
        input={input}
        onChangeInput={setInput}
        onSend={handleSend}
        sending={sending}
        useHistory={useHistory}
        onChangeUseHistory={setUseHistory}
        historyAvailable={service.historyAvailable}
        onClearScreen={handleClearScreen}
        onImageAttached={handleImageAttached}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentMode={privacyMode}
        onChangeMode={handleChangePrivacyMode}
        onSaveKeys={handleSaveKeys}
      />
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