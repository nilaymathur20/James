import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveChannelState } from "@/types/system";
import type { WsInbound } from "@/types/ws";
import { getMockServer } from "@/lib/mockServer";

interface UseAssistantSocketOptions {
  onMessage: (msg: WsInbound) => void;
  onStateChange?: (state: LiveChannelState) => void;
  useMock?: boolean;
}

export function useAssistantSocket({
  onMessage,
  onStateChange,
  useMock = false,
}: UseAssistantSocketOptions) {
  const [liveState, setLiveState] = useState<LiveChannelState>("connecting");
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const onMessageRef = useRef(onMessage);
  const mockServerRef = useRef(getMockServer());

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  // Mock mode
  useEffect(() => {
    if (!useMock) return;
    const mock = mockServerRef.current;
    const unsub = mock.onMessage((msg) => onMessageRef.current(msg));
    mock.connect();
    setLiveState("connected");
    onStateChange?.("connected");
    return () => {
      unsub();
      mock.disconnect();
      setLiveState("disconnected");
      onStateChange?.("disconnected");
    };
  }, [useMock, onStateChange]);

  // Real WebSocket mode
  useEffect(() => {
    if (useMock) return;

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${wsProtocol}//${window.location.host}/ws/assistant`;

    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      setLiveState("unavailable");
      onStateChange?.("unavailable");
      return;
    }

    socketRef.current = socket;
    setLiveState("connecting");
    onStateChange?.("connecting");

    socket.onopen = () => {
      setLiveState("connected");
      onStateChange?.("connected");
    };

    socket.onmessage = (event: MessageEvent) => {
      try {
        const payload: WsInbound = JSON.parse(event.data);
        onMessageRef.current(payload);
      } catch { /* ignore */ }
    };

    socket.onclose = () => {
      setLiveState("disconnected");
      onStateChange?.("disconnected");
      let attempts = 0;
      const tryReconnect = () => {
        if (attempts >= 10) {
          setLiveState("unavailable");
          onStateChange?.("unavailable");
          return;
        }
        attempts += 1;
        const delay = Math.min(2000 * Math.pow(2, attempts), 30000);
        reconnectTimerRef.current = window.setTimeout(() => {
          try {
            const retry = new WebSocket(url);
            retry.onopen = () => {
              socket = retry;
              socketRef.current = retry;
              attempts = 0;
              setLiveState("connected");
              onStateChange?.("connected");
            };
            retry.onmessage = (e: MessageEvent) => {
              try { onMessageRef.current(JSON.parse(e.data)); } catch { /* ignore */ }
            };
            retry.onclose = () => {
              setLiveState("disconnected");
              onStateChange?.("disconnected");
              tryReconnect();
            };
          } catch {
            setLiveState("unavailable");
            onStateChange?.("unavailable");
          }
        }, delay);
      };
      tryReconnect();
    };

    socket.onerror = () => {
      setLiveState("disconnected");
      onStateChange?.("disconnected");
    };

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      socket.close();
    };
  }, [useMock, onStateChange]);

  const send = useCallback((msg: Record<string, unknown>) => {
    if (useMock) return;
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  }, [useMock]);

  return { liveState, send };
}
