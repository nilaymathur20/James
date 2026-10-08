import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTraceStore } from "@/store/traceStore";

const toolIcons: Record<string, string> = {
  search_rag: "🔍",
  discover_files: "📁",
  preview_file: "👁️",
  propose_file_edit: "✏️",
  calculate: "🧮",
  index_directory: "📊",
  get_system_status: "💻",
  generate_image: "🎨",
  browse_web: "🌐",
  web_search: "🔎",
  analyze_image: "🖼️",
};

export const TraceTimeline: React.FC = () => {
  const { events, budget, isStreaming } = useTraceStore();

  return (
    <div className="flex flex-col gap-3 p-4 overflow-auto max-h-full">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-hint)]">ReAct Trace</span>
        {budget.active && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-[var(--color-text-dim)]">
              Step {budget.currentStep}/{budget.maxSteps} · {Math.round(budget.remainingMs / 1000)}s left
            </span>
            <div className="w-24 h-2 rounded-full bg-[var(--color-surface-elevated)] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#557ee2] to-[#7158c9] rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, 100 - (budget.remainingMs / (budget.totalMs / 100)))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {events.map((event) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className={`rounded-xl border p-3 text-sm ${
              event.type === "error"
                ? "border-red-500/30 bg-red-500/5"
                : event.type === "tool_call"
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-[var(--color-border)] bg-[var(--color-surface-card)]"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span>{toolIcons[event.label.replace("Tool: ", "").replace("Result: ", "")] || "⚡"}</span>
              <span className="font-mono text-xs font-bold text-[var(--color-text)]">{event.label}</span>
              {event.durationMs && <span className="text-[10px] font-mono text-[var(--color-text-dim)]">{event.durationMs}ms</span>}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] font-mono">{event.detail}</p>
          </motion.div>
        ))}
      </AnimatePresence>

      {isStreaming && (
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-dim)] font-mono">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Streaming…
        </div>
      )}
    </div>
  );
};
