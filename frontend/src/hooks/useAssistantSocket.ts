import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistantResultPayload, LiveChannelState, WebSocketInboundMessage, WebSocketOutboundMessage } from "@/types";

const { VITE_WS_PATH = "/ws/assistant" } = import.meta.env;
const SOCKET_PATH = VITE_WS_PATH.startsWith("/") ? VITE_WS_PATH : "/ws/assistant";

function liveSocketUrl(): string {
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}://${window.location.host}${SOCKET_PATH}`;
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
  const reconnectAttemptRef = useRef(0);
  const pingIntervalRef = useRef<number | null>(null);
  const pendingRequestRef = useRef<string | null>(null);

  const clearPing = useCallback(() => {
    if (pingIntervalRef.current !== null) {
      window.clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const startPing = useCallback((socket: WebSocket) => {
    clearPing();
    pingIntervalRef.current = window.setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({ type: "ping" }));
        } catch {
          /* ignore */
        }
      }
    }, 20000);
  }, [clearPing]);

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
        reconnectAttemptRef.current = 0;
        startPing(socket);
      }
    };

    socket.onmessage = (event: MessageEvent) => {
      let payload: WebSocketInboundMessage;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      if (payload.type === "pong") {
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
      clearPing();
      setLiveState("unavailable");
      if (pendingRequestRef.current) {
        pendingRequestRef.current = null;
        if (onActivity) onActivity("");
        onError("The live connection closed before the result arrived. Safe local operations were not duplicated.");
      }
      if (!reconnectTimerRef.current) {
        reconnectAttemptRef.current += 1;
        const delay = Math.min(3000 * Math.pow(1.5, reconnectAttemptRef.current - 1), 30000);
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectTimerRef.current = null;
          connect();
        }, delay);
      }
    };
  }, [onActivity, onDelta, onError, onResult, clearPing, startPing]);

  useEffect(() => {
    connect();
    return () => {
      clearPing();
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [connect, clearPing]);

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

  const cancelLive = useCallback((): boolean => {
    const socket = socketRef.current;
    if (typeof WebSocket !== "undefined" && socket?.readyState === WebSocket.OPEN && liveState === "connected") {
      try {
        socket.send(JSON.stringify({ type: "cancel", request_id: pendingRequestRef.current }));
        return true;
      } catch {
        pendingRequestRef.current = null;
      }
    }
    return false;
  }, [liveState]);

  return {
    liveState,
    sendLive,
    cancelLive,
    reconnect: connect,
  };
}
