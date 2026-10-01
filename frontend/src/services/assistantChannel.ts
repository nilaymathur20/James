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

  // Keep callbacks fresh without reconnecting
  useEffect(() => {
    resultCallbackRef.current = onResult;
    errorCallbackRef.current = onError;
    activityCallbackRef.current = onActivity;
    deltaCallbackRef.current = onDelta;
  }, [onResult, onError, onActivity, onDelta]);

  const { liveState: socketLiveState, sendLive, reconnect } = useAssistantSocket({
    onResult: (result) => resultCallbackRef.current(result),
    onError: (error) => errorCallbackRef.current(error),
    onActivity: (activity) => activityCallbackRef.current?.(activity),
    onDelta: (delta) => deltaCallbackRef.current?.(delta),
  });

  // Sync liveState
  useEffect(() => {
    setLiveState(socketLiveState);
  }, [socketLiveState]);

  const send = useCallback(
    async (
      text: string,
      options?: { source?: "typed" | "voice"; useHistory?: boolean; mediaBase64?: string }
    ) => {
      const requestId =
        globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

      pendingRequestRef.current = requestId;

      const sent = sendLive({
        type: "assistant_message",
        request_id: requestId,
        text,
        source: options?.source || "typed",
        use_history: options?.useHistory || false,
      });

      if (!sent) {
        activityCallbackRef.current?.("Live channel unavailable; using local HTTP fallback.");
        try {
          const result = await sendAssistantRequest({
            text,
            source: options?.source || "typed",
            use_history: options?.useHistory,
            media_base64: options?.mediaBase64,
          });
          resultCallbackRef.current(result);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Request failed";
          errorCallbackRef.current(`I could not complete that request.\n\nError: ${message}`);
        } finally {
          activityCallbackRef.current?.("");
          pendingRequestRef.current = null;
        }
      }
    },
    [sendLive]
  );

  return { liveState, send, reconnect };
}