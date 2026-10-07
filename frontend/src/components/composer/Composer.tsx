import React, { useCallback, useRef, useState } from "react";
import { Send, Square, Loader2 } from "lucide-react";
import { useAssistantSocket } from "@/hooks/useAssistantSocket";
import { useTraceStore } from "@/store/traceStore";
import { useToastStore } from "@/store/toastStore";
import type { WsInbound } from "@/types/ws";

interface ComposerProps {
  onSend: (text: string, source?: "typed" | "voice") => void;
}

export const Composer: React.FC<ComposerProps> = ({ onSend }) => {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showMock, setShowMock] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const { addEvent, setBudget, setStreaming, clearTrace } = useTraceStore();
  const { addToast } = useToastStore();

  const handleMessage = useCallback(
    (msg: WsInbound) => {
      switch (msg.type) {
        case "assistant_status": {
          if (msg.phase === "thinking" || msg.phase === "tool_call") {
            addEvent({ type: "status", label: "Processing", detail: msg.message || "", status: "running" });
          }
          if (msg.phase === "streaming") setStreaming(true);
          if (msg.phase === "complete") {
            setStreaming(false);
            addEvent({ type: "status", label: "Complete", detail: "Response delivered.", status: "done" });
            setSending(false);
            addToast({ message: "Response received", duration: 3000 });
          }
          if (msg.budget_remaining_ms !== undefined) {
            setBudget({ remainingMs: msg.budget_remaining_ms as number, currentStep: (msg.step || 0) as number, active: true });
          }
          break;
        }
        case "agent_thought":
          addEvent({ type: "thought", label: "Thought", detail: msg.thought, status: "done" });
          break;
        case "tool_call":
          addEvent({ type: "tool_call", label: `Tool: ${msg.tool}`, detail: JSON.stringify(msg.args), status: "running", raw: { tool: msg.tool, args: msg.args } });
          break;
        case "tool_result":
          setBudget({ remainingMs: Math.max(0, 120000 - ((msg.duration_ms || 0) * 1000)), active: true });
          addEvent({ type: "tool_result", label: `Result: ${msg.tool}`, detail: msg.result.slice(0, 200), status: "done", durationMs: msg.duration_ms });
          break;
        case "error":
          addEvent({ type: "error", label: "Error", detail: msg.message, status: "error" });
          setSending(false);
          addToast({ message: msg.message, duration: 5000 });
          break;
        default:
          break;
      }
    },
    [addEvent, setBudget, setStreaming, addToast]
  );

  const { liveState, send } = useAssistantSocket({
    onMessage: handleMessage,
    useMock: showMock,
  });

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const text = input.trim();
      if (!text || sending) return;
      setSending(true);
      clearTrace();
      addEvent({ type: "status", label: "Request sent", detail: text.slice(0, 100), status: "running" });
      send({ type: "assistant_message", request_id: crypto.randomUUID?.() || `${Date.now()}`, text, source: "typed" });
      onSend(text, "typed");
      setInput("");
    },
    [input, sending, send, onSend, clearTrace, addEvent]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div ref={composerRef} className="border-t border-[var(--color-border)] bg-[var(--color-surface-card)]/80 backdrop-blur-md p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full ${liveState === "connected" ? "bg-emerald-400 animate-pulse" : liveState === "connecting" ? "bg-amber-400 animate-pulse" : "bg-red-400"}`} />
        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-dim)]">{liveState}</span>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <input type="checkbox" checked={showMock} onChange={(e) => setShowMock(e.target.checked)} className="accent-[var(--color-accent)]" /> Mock mode
        </label>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask James anything… (Enter to send, Shift+Enter newline)"
          rows={1}
          className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-text)] placeholder-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30 resize-none min-h-[44px] max-h-32 font-mono"
          disabled={sending}
        />
        <button type="button" onClick={() => { setInput(""); clearTrace(); }} className="p-2 rounded-lg text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-elevated)] transition-colors" title="Clear">
          <Square size={18} />
        </button>
        <button type="submit" disabled={!input.trim() || sending} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#557ee2] to-[#7158c9] text-white text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-40 flex items-center gap-2">
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send
        </button>
      </form>

      <div className="mt-2 flex gap-4 text-[10px] font-mono text-[var(--color-text-dim)]">
        <span>Cmd+K: command palette</span>
        <span>/: commands</span>
        <span>@: file mentions</span>
      </div>
    </div>
  );
};
