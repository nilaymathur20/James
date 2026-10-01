/**
 * WebSocket transport for the live assistant channel at /ws/assistant.
 *
 * Per react-native-ui-ux-plan.md §4: the WebSocket lifecycle lives in a
 * dedicated service, not scattered in screens. Only one in-flight request
 * per connection is active. The base URL is configurable — never hard-coded
 * to 127.0.0.1 (a physical device won't reach it).
 *
 * Exports a single AssistantTransport interface with two implementations:
 *  - WebSocketAssistantTransport: real live streaming
 *  - HttpFallbackTransport: POST /api/assistant fallback
 */
import { WsInboundMessageSchema } from '@/schemas/assistant';
import type { AssistantEvent, AssistantResultPayload } from '@/schemas/assistant';
import { sendAssistantRequest } from '@/services/apiClient';

// The ws:// or wss:// base URL for the live assistant channel.
// Configured at runtime — never hard-coded to 127.0.0.1.
let wsBaseUrl = '';
let apiBaseUrl = '/api';

export function setTransportBaseUrl(ws: string, api: string): void {
  wsBaseUrl = ws;
  apiBaseUrl = api;
}

export function getWsBaseUrl(): string {
  return wsBaseUrl;
}

/** Convert the WS base URL to the assistant socket URL. */
function buildSocketUrl(): string {
  if (!wsBaseUrl) return '';
  // wsBaseUrl is like "ws://192.168.1.5:8000" or "wss://..."
  return `${wsBaseUrl.replace(/\/+$/, '')}/ws/assistant`;
}

export type TransportState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface AssistantTransport {
  state: TransportState;
  send(input: {
    text: string;
    source?: 'typed' | 'voice' | 'paste';
    useHistory?: boolean;
  }, onEvent: (event: AssistantEvent) => void): Promise<string>;
  close(): void;
}

/**
 * Real WebSocket transport — streams live status, progress, tokens, results.
 * Falls back to HTTP per request if the socket is not available.
 */
export class WebSocketAssistantTransport implements AssistantTransport {
  state: TransportState = 'disconnected';
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRequestId: string | null = null;
  private onEventRef: ((event: AssistantEvent) => void) | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly baseBackoffMs = 1000;

  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) return;

    const url = buildSocketUrl();
    if (!url) {
      this.state = 'error';
      return;
    }

    this.state = 'connecting';
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      this.state = 'connected';
      this.reconnectAttempts = 0;
      // Send a ping to verify connectivity
      this.sendPing();
    };

    this.socket.onmessage = (event: { data: string }) => {
      this.handleMessage(event.data);
    };

    this.socket.onerror = () => {
      this.state = 'error';
    };

    this.socket.onclose = () => {
      this.socket = null;
      if (this.pendingRequestId) {
        this.pendingRequestId = null;
        this.onEventRef?.({
          type: 'error',
          message: 'The live connection closed before the result arrived.',
        });
      }
      this.state = 'disconnected';
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.state = 'error';
      return;
    }
    const delay = this.baseBackoffMs * Math.pow(1.5, this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private sendPing(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'ping' }));
    }
  }

  private handleMessage(rawData: string): void {
    let payload: unknown;
    try {
      payload = JSON.parse(rawData);
    } catch {
      this.onEventRef?.({
        type: 'error',
        message: 'Received malformed JSON from the live assistant channel.',
      });
      return;
    }

    let message: { type: string };
    try {
      message = WsInboundMessageSchema.parse(payload) as { type: string };
    } catch {
      // Unknown message type — emit as a generic status
      if (typeof payload === 'object' && payload !== null && 'type' in payload) {
        message = payload as { type: string };
      } else {
        return;
      }
    }

    this.onEventRef?.(this.messageToEvent(message, payload));
  }

  private messageToEvent(message: { type: string }, payload: unknown): AssistantEvent {
    switch (message.type) {
      case 'ready':
        return {
          type: 'ready',
          protocol: (payload as Record<string, unknown>).protocol as string,
          message: (payload as Record<string, unknown>).message as string | undefined,
        };
      case 'pong':
        return { type: 'assistant_status', phase: 'connected', message: 'Live channel is connected.' };
      case 'assistant_status':
      case 'index_progress':
        return this.buildProgressEvent(message.type, payload);
      case 'agent_thought':
        return {
          type: 'agent_thought',
          thought: (payload as Record<string, unknown>).thought as string | undefined,
          content: (payload as Record<string, unknown>).content as string | undefined,
        };
      case 'tool_call':
        return {
          type: 'tool_call',
          tool_name: ((payload as Record<string, unknown>).tool_name ||
            (payload as Record<string, unknown>).tool) as string | undefined,
          input: (payload as Record<string, unknown>).input as Record<string, unknown> | undefined,
        };
      case 'tool_result':
        return {
          type: 'tool_result',
          tool_name: ((payload as Record<string, unknown>).tool_name ||
            (payload as Record<string, unknown>).tool) as string | undefined,
          result: (payload as Record<string, unknown>).result,
        };
      case 'confirmation_required':
        return {
          type: 'confirmation_required',
          proposal_id: (payload as Record<string, unknown>).proposal_id as string | undefined,
          tool: (payload as Record<string, unknown>).tool as string | undefined,
          params: (payload as Record<string, unknown>).params as Record<string, unknown> | undefined,
        };
      case 'token_delta':
        return {
          type: 'token_delta',
          delta: (payload as Record<string, unknown>).delta as string | undefined,
        };
      case 'assistant_result':
        return {
          type: 'assistant_result',
          result: (payload as Record<string, AssistantResultPayload>).result,
        };
      case 'error':
        return {
          type: 'error',
          code: (payload as Record<string, unknown>).code as string | undefined,
          message: (payload as Record<string, unknown>).message as string,
          status_code: (payload as Record<string, unknown>).status_code as number | undefined,
        };
      default:
        return {
          type: 'assistant_status',
          phase: message.type,
          message: 'Received a live event.',
        };
    }
  }

  private buildProgressEvent(type: 'assistant_status' | 'index_progress', payload: unknown): AssistantEvent {
    const p = payload as Record<string, unknown>;
    if (type === 'index_progress') {
      return {
        type: 'index_progress',
        scanned: p.files_seen as number | undefined,
        indexed: p.files_indexed as number | undefined,
        skipped: p.skipped_files as number | undefined,
        phase: p.phase as string | undefined,
        message: p.message as string | undefined,
      };
    }
    return {
      type: 'assistant_status',
      phase: p.phase as string | undefined,
      message: p.message as string | undefined,
      request_id: p.request_id as string | undefined,
      data: p as Record<string, unknown>,
    };
  }

  async send(
    input: { text: string; source?: 'typed' | 'voice' | 'paste'; useHistory?: boolean },
    onEvent: (event: AssistantEvent) => void,
  ): Promise<string> {
    this.onEventRef = onEvent;

    // If socket isn't ready, try to connect
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.connect();
      // Give the socket a brief window to open
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    if (this.socket?.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not available');
    }

    const requestId = `ws_${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
    this.pendingRequestId = requestId;

    const message = JSON.stringify({
      type: 'assistant_message',
      request_id: requestId,
      text: input.text,
      source: input.source || 'typed',
      use_history: input.useHistory || false,
    });

    this.socket.send(message);
    return requestId;
  }

  reconnect(): void {
    this.close();
    this.reconnectAttempts = 0;
    this.connect();
  }

  close(): void {
    this.pendingRequestId = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // ignore
      }
      this.socket = null;
    }
    this.onEventRef = null;
    this.state = 'disconnected';
  }
}

/**
 * HTTP fallback transport. Used when WebSocket is unavailable.
 * Still validates the HTTP response with Zod.
 */
export class HttpFallbackTransport implements AssistantTransport {
  state: TransportState = 'disconnected';

  async send(
    input: { text: string; source?: 'typed' | 'voice' | 'paste'; useHistory?: boolean },
    onEvent: (event: AssistantEvent) => void,
  ): Promise<string> {
    onEvent({ type: 'assistant_status', phase: 'sending', message: 'Sending request via HTTP…' });

    try {
      const result: AssistantResultPayload = await sendAssistantRequest(
        {
          text: input.text,
          source: input.source || 'typed',
          use_history: input.useHistory || false,
        },
        undefined,
      );
      onEvent({ type: 'assistant_status', phase: 'complete', message: 'Response is ready.' });
      onEvent({ type: 'assistant_result', result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Request failed';
      onEvent({ type: 'error', message });
    }

    return '';
  }

  close(): void {
    // no-op for HTTP
  }
}

/**
 * Smart transport: tries WebSocket, falls back to HTTP.
 */
export class DualTransport implements AssistantTransport {
  private ws: WebSocketAssistantTransport;
  private http: HttpFallbackTransport;
  state: TransportState = 'disconnected';
  private wsAttempted = false;

  constructor() {
    this.ws = new WebSocketAssistantTransport();
    this.http = new HttpFallbackTransport();
  }

  connect(): void {
    this.ws.connect();
    this.wsAttempted = true;
  }

  async send(
    input: { text: string; source?: 'typed' | 'voice' | 'paste'; useHistory?: boolean },
    onEvent: (event: AssistantEvent) => void,
  ): Promise<string> {
    // Try WebSocket first
    if (this.ws.state === 'connected' && this.wsAttempted) {
      try {
        return await this.ws.send(input, onEvent);
      } catch {
        // fall through to HTTP
      }
    }

    // Fallback to HTTP
    this.state = 'disconnected';
    return this.http.send(input, onEvent);
  }

  close(): void {
    this.ws.close();
    this.http.close();
    this.state = 'disconnected';
  }

  reconnect(): void {
    this.ws.reconnect();
  }
}
