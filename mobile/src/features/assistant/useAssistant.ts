/**
 * useAssistant — orchestration hook for the Ask screen.
 * Ties together the transport layer (WebSocket + HTTP fallback), the
 * composer store, and live event dispatch.
 * Per react-native-ui-ux-plan.md §4A and §7.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssistantEvent, AssistantResultPayload } from '@/schemas/assistant';
import type { TransportState } from '@/services/assistantSocket';
import { WebSocketAssistantTransport, HttpFallbackTransport, DualTransport } from '@/services/assistantSocket';
import { useComposerStore, type Message } from '@/stores/composerStore';
import { useSessionStore } from '@/stores/sessionStore';

export interface UseAssistantOptions {
  useMock?: boolean;
  mockTransport?: { send: (input: any, cb: (e: AssistantEvent) => void) => Promise<string>; close: () => void; reconnect: () => void; state: string };
}

export function useAssistant(options?: UseAssistantOptions) {
  const { addMessage, setStatus, updateLastMessage, setActiveRequestId, setLastEvent, setError } =
    useComposerStore();
  const { backendUrl, status: connectionStatus } = useSessionStore();
  const [transportState, setTransportState] = useState<TransportState>('disconnected');
  const [liveStatus, setLiveStatus] = useState<string | null>(null);

  const transportRef = useRef<DualTransport | WebSocketAssistantTransport | HttpFallbackTransport | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Initialize transport
    if (options?.useMock && options?.mockTransport) {
      transportRef.current = {
        send: options.mockTransport.send.bind(options.mockTransport),
        close: options.mockTransport.close.bind(options.mockTransport),
        reconnect: options.mockTransport.reconnect.bind(options.mockTransport),
        get state() {
          return options.mockTransport!.state as TransportState;
        },
      } as any;
    } else if (backendUrl) {
      transportRef.current = new DualTransport();
      (transportRef.current as DualTransport).connect();
    } else {
      transportRef.current = new HttpFallbackTransport();
    }

    return () => {
      transportRef.current?.close();
      transportRef.current = null;
    };
  }, [backendUrl, options]);

  const send = useCallback(
    async (text: string, opts?: { source?: 'typed' | 'voice'; useHistory?: boolean }) => {
      const transport = transportRef.current;
      if (!transport) {
        setError('No transport configured. Check your connection settings.');
        return;
      }

      const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      activeRequestIdRef.current = requestId;
      setActiveRequestId(requestId);
      setStatus('sending');

      // Add user message
      addMessage({
        role: 'user',
        content: text,
        status: 'complete',
      });

      // Add assistant placeholder
      addMessage({
        role: 'assistant',
        status: 'partial',
        content: '',
      });

      const handleEvent = (event: AssistantEvent) => {
        setLastEvent(event);

        switch (event.type) {
          case 'assistant_status':
            setLiveStatus(event.message || event.phase || null);
            setStatus(event.phase === 'complete' ? 'connected' : 'sending');
            if (event.phase === 'complete') {
              updateLastMessage({ status: 'complete' });
            }
            break;

          case 'token_delta':
            updateLastMessage((prev) => ({
              content: (prev.content || '') + (event.delta || ''),
              status: 'partial',
            }));
            setLiveStatus(null);
            break;

          case 'index_progress':
            setLiveStatus(event.message || 'Indexing…');
            break;

          case 'agent_thought':
          case 'tool_call':
          case 'tool_result':
            // Could be rendered as intermediate steps
            setLiveStatus(event.type);
            break;

          case 'confirmation_required':
            setStatus('disconnected');
            setLiveStatus(null);
            // This would open a confirmation sheet
            // For now, record it
            updateLastMessage({ status: 'complete' });
            break;

          case 'assistant_result':
            handleResult(event.result, requestId);
            break;

          case 'error':
            setError(event.message);
            setStatus('disconnected');
            updateLastMessage({ status: 'error', content: event.message });
            break;

          case 'ready':
            setTransportState('connected');
            break;
        }
      };

      try {
        const wsTransport = transport as WebSocketAssistantTransport;
        if (wsTransport.state === 'connected') {
          setTransportState('connected');
        }
        await transport.send(
          { text, source: opts?.source || 'typed', useHistory: opts?.useHistory || false },
          handleEvent,
        );
      } catch (err: unknown) {
        // Fallback to HTTP
        const http = new HttpFallbackTransport();
        try {
          await http.send({ text, source: opts?.source || 'typed' }, handleEvent);
        } catch {
          setError('Unable to reach the local backend. Start FastAPI and try again.');
          updateLastMessage({ status: 'error', content: 'Unable to reach the local backend.' });
        }
      }
    },
    [addMessage, setActiveRequestId, setStatus, updateLastMessage, setLastEvent, setError],
  );

  const handleResult = (result: AssistantResultPayload, requestId: string) => {
    if (activeRequestIdRef.current !== requestId) return;
    activeRequestIdRef.current = null;
    setActiveRequestId(null);
    setStatus('connected');
    setLiveStatus(null);

    const content = result.response || '';
    const sources = (result.results || []).map((r) => ({
      source: r.source,
      snippet: r.snippet,
      score: r.score,
    }));

    updateLastMessage({
      content,
      status: 'complete',
      mode: result.mode,
      isLocal: result.mode === 'retrieval' || result.mode === 'retrieval_fallback',
      sources,
    });
  };

  const reconnect = useCallback(() => {
    if (transportRef.current && 'reconnect' in transportRef.current) {
      transportRef.current.reconnect();
    }
  }, []);

  const close = useCallback(() => {
    transportRef.current?.close();
    transportRef.current = null;
    setTransportState('disconnected');
  }, []);

  return {
    send,
    reconnect,
    close,
    transportState,
    liveStatus,
    activeRequestId: activeRequestIdRef.current,
    connectionStatus,
    backendUrl,
  };
}
