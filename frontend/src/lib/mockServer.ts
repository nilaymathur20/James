// ---------------------------------------------------------------------------
import type { LiveChannelState } from "@/types/system";
// Dev-only mock server — simulates james.assistant.v1 WebSocket events
// so the UI can be demoed without the backend running.
// ---------------------------------------------------------------------------

import type { WsInbound } from "@/types/ws";

type EventHandler = (msg: WsInbound) => void;

class MockServer {
  private handlers: Set<EventHandler> = new Set();
  private state: LiveChannelState = "disconnected";
  private intervalRefs: ReturnType<typeof setInterval>[] = [];
  private timeoutRefs: ReturnType<typeof setTimeout>[] = [];

  connect() {
    this.state = "connected";
    this.emit({ type: "ready", protocol: "james.assistant.v1", message: "Live assistant channel connected (mock)." });

    // Simulate an assistant request after 1.5s
    const t1 = setTimeout(() => {
      this.emit({ type: "assistant_status", request_id: "mock-1", phase: "accepted", message: "Request accepted." });
      this.emit({ type: "assistant_status", request_id: "mock-1", phase: "thinking", message: "Thinking…", budget_remaining_ms: 118_000, step: 1, max_steps: 8 });

      const t2 = setTimeout(() => {
        this.emit({ type: "agent_thought", request_id: "mock-1", thought: "The user asked for a summary. I should search the RAG index first." });
        this.emit({ type: "tool_call", request_id: "mock-1", tool: "search_rag", args: { query: "privacy policy summary", top_k: "5" } });

        const t3 = setTimeout(() => {
          this.emit({ type: "tool_result", request_id: "mock-1", tool: "search_rag", result: "Found 3 relevant chunks about local-first architecture and privacy safeguards.", duration_ms: 142 });
          this.emit({ type: "agent_thought", request_id: "mock-1", thought: "Good — synthesizing the answer now." });
          this.emit({ type: "assistant_status", request_id: "mock-1", phase: "streaming", message: "Streaming response…", budget_remaining_ms: 110_000 });

          // Stream tokens
          const words = "Privacy-first local AI assistant. Your data stays on-device unless you explicitly choose cloud. All file operations go through the guarded proposal flow with backup and undo.";
          let i = 0;
          const t4 = setInterval(() => {
            if (i >= words.length) {
              clearInterval(t4);
              this.emit({ type: "assistant_status", request_id: "mock-1", phase: "complete", message: "Done." });
              this.emit({ type: "assistant_result", request_id: "mock-1", result: { response: words } });
              return;
            }
            const chunk = words.slice(i, i + 3);
            this.emit({ type: "token_delta", request_id: "mock-1", delta: chunk });
            i += 3;
          }, 30);
          this.timeoutRefs.push(t4);
        }, 600);
        this.timeoutRefs.push(t3);
      }, 500);
      this.timeoutRefs.push(t2);
    }, 1500);
    this.timeoutRefs.push(t1);
  }

  disconnect() {
    this.state = "disconnected";
    this.intervalRefs.forEach(clearInterval);
    this.timeoutRefs.forEach(clearTimeout);
    this.intervalRefs = [];
    this.timeoutRefs = [];
  }

  onMessage(fn: EventHandler) {
    this.handlers.add(fn);
    return () => this.handlers.delete(fn);
  }

  private emit(msg: WsInbound) {
    this.handlers.forEach((h) => h(msg));
  }

  getState(): LiveChannelState {
    return this.state;
  }
}

// Singleton for dev
let instance: MockServer | null = null;
export function getMockServer(): MockServer {
  if (!instance) instance = new MockServer();
  return instance;
}