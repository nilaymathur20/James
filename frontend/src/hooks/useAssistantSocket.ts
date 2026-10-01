import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistantResultPayload, LiveChannelState, WebSocketInboundMessage, WebSocketOutboundMessage } from "@/types";

const configuredSocketPath = import.meta.env.VITE_WS_PATH || "/ws/assistant";
const SOCKET_PATH = configuredSocketPath.startsWith("/") ? configuredSocketPath : "/ws/assistant";

function liveSocketUrl(): string {
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const backendTarget = import.meta.env.VITE_BACKEND_TARGET || "http://127.0.0.1:8000";
  // Same backend target as the Vite /api and /ws HTTP proxy — VITE_BACKEND_TARGET.
  const backendOrigin = backendTarget.replace(/^https?:\/\//, "");
  return `${wsProtocol}//${backendOrigin}${SOCKET_PATH}`;
}

export interface UseAssistantSocketOptions {
  onResult: (result: AssistantResultPayload) => void;
  onError: (error: string) => void;
  onActivity?: (activity: string) => void;
  onDelta?: (delta: string) => void;
}

export function useAssistantSocket({
  onResult,
  onError,
  onActivity,
  onDelta,
}: UseAssistantSocketOptions) {
  const [liveState, setLiveState] = useState<LiveChannelState>("connecting");
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pendingRequestRef = useRef<string | null>(null);

  const connect = useCallback(() => {
    if (typeof WebSocket === "undefined") {
      setLiveState("unavailable");
      return;
    }

    let socket: WebSocket;
    try {
      socket = new WebSocket(liveSocketUrl());
    } catch {
      setLiveState("unavailable");
      return;
    }

    socketRef.current = socket;
    setLiveState("connecting");

    socket.onopen = () => {
      if (socketRef.current === socket) {
        setLiveState("connected");
      }
    };

    socket.onmessage = (event: MessageEvent) => {
      let payload: WebSocketInboundMessage;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      if (payload.type === "ready") {
        setLiveState("connected");
        return;
      }

      const isPending = payload.request_id && payload.request_id === pendingRequestRef.current;

      if (payload.type === "assistant_status" || payload.type === "index_progress") {
        if (isPending && onActivity) {
          onActivity(payload.message || "Working locally…");
        }
        return;
      }

      if (payload.type === "token_delta" && isPending && onDelta && payload.delta) {
        onDelta(payload.delta);
        return;
      }

      if (payload.type === "assistant_result" && isPending) {
        pendingRequestRef.current = null;
        if (onActivity) onActivity("");
        onResult(payload.result || {});
        return;
      }

      if (payload.type === "error" && (!payload.request_id || isPending)) {
        pendingRequestRef.current = null;
        if (onActivity) onActivity("");
        onError(payload.message || "The live channel returned an error.");
      }
    };

    socket.onerror = () => {
      setLiveState("unavailable");
    };

    socket.onclose = () => {
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
      setLiveState("unavailable");
      if (pendingRequestRef.current) {
        pendingRequestRef.current = null;
        if (onActivity) onActivity("");
        onError("The live connection closed before the result arrived. Safe local operations were not duplicated.");
      }
      if (!reconnectTimerRef.current) {
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectTimerRef.current = null;
          connect();
        }, 3000);
      }
    };
  }, [onActivity, onDelta, onError, onResult]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [connect]);

  const sendLive = useCallback(
    (message: WebSocketOutboundMessage): boolean => {
      const socket = socketRef.current;
      if (typeof WebSocket !== "undefined" && socket?.readyState === WebSocket.OPEN && liveState === "connected") {
        pendingRequestRef.current = message.request_id;
        try {
          socket.send(JSON.stringify(message));
          return true;
        } catch {
          pendingRequestRef.current = null;
        }
      }
      return false;
    },
    [liveState]
  );

  return {
    liveState,
    sendLive,
    reconnect: connect,
  };
}
