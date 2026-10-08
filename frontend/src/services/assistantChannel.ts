import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistantResultPayload, LiveChannelState } from "@/types";
import { useAssistantSocket } from "@/hooks/useAssistantSocket";
import { sendAssistantRequest } from "@/api/assistant";

interface AssistantChannelOptions {
  onResult: (result: AssistantResultPayload) => void;
  onError: (error: string) => void;
  onActivity?: (activity: string) => void;
  onDelta?: (delta: string) => void;
}

export interface AssistantChannel {
  liveState: LiveChannelState;
  send: (
    text: string,
    options?: { source?: "typed" | "voice"; useHistory?: boolean; mediaBase64?: string }
  ) => Promise<void>;
  cancel: () => boolean;
  reconnect: () => void;
}

export function useAssistantChannel({
  onResult,
  onError,
  onActivity,
  onDelta,
}: AssistantChannelOptions): AssistantChannel {
  const [liveState, setLiveState] = useState<LiveChannelState>("connecting");
  const pendingRequestRef = useRef<string | null>(null);
  const resultCallbackRef = useRef(onResult);
  const errorCallbackRef = useRef(onError);
  const activityCallbackRef = useRef(onActivity);
  const deltaCallbackRef = useRef(onDelta);

  useEffect(() => {
    resultCallbackRef.current = onResult;
    errorCallbackRef.current = onError;
    activityCallbackRef.current = onActivity;
    deltaCallbackRef.current = onDelta;
  }, [onResult, onError, onActivity, onDelta]);

  const { liveState: socketLiveState, send: sendSocket } = useAssistantSocket({
    onMessage: (msg) => {
      if (msg.type === "assistant_result") {
        resultCallbackRef.current(msg.result as AssistantResultPayload);
      }
      if (msg.type === "error") {
        errorCallbackRef.current(msg.message || "Unknown error");
      }
      if (msg.type === "assistant_status" || msg.type === "index_progress") {
        activityCallbackRef.current?.(msg.message || "Working locally…");
      }
      if (msg.type === "token_delta") {
        onDelta?.(msg.delta);
      }
    },
    useMock: false,
  });

  useEffect(() => {
    setLiveState(socketLiveState);
  }, [socketLiveState]);

  const send = useCallback(
    async (
      text: string,
      options?: { source?: "typed" | "voice"; useHistory?: boolean; mediaBase64?: string }
    ) => {
      const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      pendingRequestRef.current = requestId;

      sendSocket({
        type: "assistant_message",
        request_id: requestId,
        text,
        source: options?.source || "typed",
        use_history: options?.useHistory || false,
      });

      // Fallback to HTTP if socket not connected
      try {
        const result = await sendAssistantRequest({
          text,
          source: options?.source || "typed",
          use_history: options?.useHistory,
          media_base64: options?.mediaBase64,
        });
        resultCallbackRef.current(result);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errorCallbackRef.current(`I could not complete that request.\n\nError: ${message}`);
      } finally {
        activityCallbackRef.current?.("");
        pendingRequestRef.current = null;
      }
    },
    [sendSocket]
  );

  const cancel = useCallback((): boolean => {
    pendingRequestRef.current = null;
    return false;
  }, []);

  return { liveState, send, cancel, reconnect: () => {} };
}
