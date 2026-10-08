/**
 * Mock transport — emits simulated WebSocket events so the UI can be
 * developed and tested without a running backend.
 * Per react-native-ui-ux-plan.md §12 Phase 0: mocked transport so UI work
 * can proceed without a live backend.
 */
import type { AssistantEvent, AssistantResultPayload } from '@/schemas/assistant';

export interface MockConfig {
  /** Simulated network latency between events (ms). */
  latency?: number;
  /** Whether to simulate a connection failure. */
  fail?: boolean;
}

export class MockTransport {
  private listeners: Set<(event: AssistantEvent) => void> = new Set();
  private config: MockConfig;
  private running = false;

  constructor(config: MockConfig = {}) {
    this.config = { latency: 300, ...config };
  }

  subscribe(listener: (event: AssistantEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get state(): 'connected' | 'disconnected' {
    return this.config.fail ? 'disconnected' : 'connected';
  }

  send(input: { text: string }, onEvent: (event: AssistantEvent) => void): Promise<string> {
    const requestId = `mock_${Date.now()}`;

    // Emit ready event
    this.emit(onEvent, { type: 'ready', protocol: 'james.assistant.v1', message: 'Mock channel connected.' });

    if (this.config.fail) {
      this.emit(onEvent, {
        type: 'error',
        code: 'connection_failed',
        message: 'Mock connection failure: backend is unreachable.',
        status_code: 502,
      });
      return Promise.resolve(requestId);
    }

    this.emit(onEvent, {
      type: 'assistant_status',
      phase: 'routing',
      message: 'Understanding your request.',
      request_id: requestId,
    });

    setTimeout(() => {
      this.emit(onEvent, {
        type: 'assistant_status',
        phase: 'retrieving',
        message: 'Searching local index.',
        request_id: requestId,
      });

      setTimeout(() => {
        this.emit(onEvent, {
          type: 'assistant_status',
          phase: 'answering',
          message: 'Preparing a response.',
          request_id: requestId,
          data: { mode: 'retrieval' },
        });

        setTimeout(() => {
          const result: AssistantResultPayload = {
            kind: 'chat',
            response: `This is a mock response to: "${input.text}". In a real session, James would search your local index and respond with grounded results.`,
            mode: 'retrieval',
            provider: null,
            results: [
              {
                source: '/home/user/documents/README.md',
                source_type: 'file',
                score: 0.95,
                snippet: 'James is a privacy-first local AI assistant with a FastAPI backend...',
              },
            ],
            file_candidates: [
              {
                path: '/home/user/documents/README.md',
                name: 'README.md',
                size: 1247,
              },
            ],
            provider_error: null,
          };

          this.emit(onEvent, { type: 'assistant_result', request_id: requestId, result });
        }, this.config.latency);
      }, this.config.latency);
    }, this.config.latency);

    return Promise.resolve(requestId);
  }

  close(): void {
    this.listeners.clear();
    this.running = false;
  }

  reconnect(): void {}

  private emit(onEvent: (event: AssistantEvent) => void, event: AssistantEvent): void {
    onEvent(event);
  }
}

export const mockTransport = new MockTransport();
