import React from 'react';
import {
  X,
  Gauge,
  Sliders,
  Cpu,
  Layers,
  Info,
  Zap,
} from 'lucide-react';
import { TokenMetrics, Conversation } from '../types/chat';

interface TokenInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  metrics: TokenMetrics;
  activeConversation: Conversation;
  onUpdateConversation: (updates: Partial<Conversation>) => void;
}

export const TokenInspectorModal: React.FC<TokenInspectorModalProps> = ({
  isOpen,
  onClose,
  metrics,
  activeConversation,
  onUpdateConversation,
}) => {
  if (!isOpen) return null;

  const { totalSessionTokens, maxContextWindow, tokensPerSecond } = metrics;
  const contextPercentage = ((totalSessionTokens / maxContextWindow) * 100).toFixed(4);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div
        className="w-full max-w-2xl bg-[#11141c] border border-white/10 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#141822]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-[#1a202c] border border-white/5 text-blue-400">
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Token & Context Inspector
              </h2>
              <p className="text-xs text-neutral-400">
                Inspect active prompt and completion tokens, set response limits, and adjust context retention.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto text-xs sm:text-sm">
          {/* Main Stat Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg bg-[#141822] border border-white/5 flex flex-col space-y-1">
              <span className="text-[11px] font-medium text-neutral-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-blue-400" /> Active session
              </span>
              <span className="text-xl font-bold font-mono text-white tabular-nums">
                {totalSessionTokens.toLocaleString()}
              </span>
              <span className="text-[10px] text-neutral-500">Total tokens used</span>
            </div>

            <div className="p-3.5 rounded-lg bg-[#141822] border border-white/5 flex flex-col space-y-1">
              <span className="text-[11px] font-medium text-neutral-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" /> Context memory
              </span>
              <span className="text-xl font-bold font-mono text-white tabular-nums">
                {contextPercentage}%
              </span>
              <span className="text-[10px] text-neutral-500">of 1,048,576 limit</span>
            </div>

            <div className="p-3.5 rounded-lg bg-[#141822] border border-white/5 flex flex-col space-y-1">
              <span className="text-[11px] font-medium text-neutral-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-400" /> Response speed
              </span>
              <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                {tokensPerSecond || '50+'}
              </span>
              <span className="text-[10px] text-neutral-500">Tokens / second</span>
            </div>
          </div>

          {/* Context Window Capacity Bar */}
          <div className="p-4 rounded-lg bg-[#141822] border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-neutral-300">
                Context window usage
              </span>
              <span className="font-mono text-neutral-400 tabular-nums">
                {totalSessionTokens.toLocaleString()} / 1,048,576 tokens
              </span>
            </div>

            <div className="w-full h-2.5 bg-neutral-900 rounded-full overflow-hidden p-0.5 border border-white/5">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300 min-w-[4px]"
                style={{ width: `${Math.max(1, Math.min(100, Number(contextPercentage) * 10))}%` }}
              />
            </div>

            <p className="text-[11px] text-neutral-400 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              Gemini 3.8 Flash supports up to 1,048,576 tokens in memory (~750,000 words).
            </p>
          </div>

          {/* Token Limit Controls */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              Response parameters
            </h3>

            {/* Max Output Tokens Slider */}
            <div className="p-4 rounded-lg bg-[#141822] border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-white block">
                    Maximum output tokens per response
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    Limits model response length so answers do not exceed what you need.
                  </span>
                </div>
                <span className="font-mono text-xs font-bold text-blue-400 bg-blue-950/60 px-2.5 py-0.5 rounded border border-blue-500/20">
                  {activeConversation.maxOutputTokens} tokens
                </span>
              </div>

              <input
                type="range"
                min="256"
                max="8192"
                step="256"
                value={activeConversation.maxOutputTokens}
                onChange={(e) => {
                  onUpdateConversation({ maxOutputTokens: Number(e.target.value) });
                }}
                className="w-full accent-blue-600 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
              />

              {/* Presets */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] text-neutral-500">Presets:</span>
                {[
                  { label: '512 (Brief)', val: 512 },
                  { label: '1024 (Standard)', val: 1024 },
                  { label: '4096 (Detailed)', val: 4096 },
                  { label: '8192 (Max)', val: 8192 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    onClick={() => {
                      onUpdateConversation({ maxOutputTokens: preset.val });
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      activeConversation.maxOutputTokens === preset.val
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'bg-[#1a202c] text-neutral-400 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Temperature Slider */}
            <div className="p-4 rounded-lg bg-[#141822] border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-white block">
                    Temperature (Creativity vs Determinism)
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    Lower (0.2) = consistent and focused; higher (0.8) = creative and varied.
                  </span>
                </div>
                <span className="font-mono text-xs font-bold text-neutral-200 bg-[#1a202c] px-2.5 py-0.5 rounded border border-white/10">
                  {activeConversation.temperature.toFixed(2)}
                </span>
              </div>

              <input
                type="range"
                min="0.0"
                max="1.5"
                step="0.05"
                value={activeConversation.temperature}
                onChange={(e) => {
                  onUpdateConversation({ temperature: Number(e.target.value) });
                }}
                className="w-full accent-blue-600 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
              />
            </div>

            {/* Context Window Strategy */}
            <div className="p-4 rounded-lg bg-[#141822] border border-white/5 space-y-2.5">
              <div>
                <span className="text-xs font-medium text-white block">
                  Context retention strategy
                </span>
                <span className="text-[11px] text-neutral-400">
                  Controls how many previous conversation turns are sent with each prompt.
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  {
                    id: 'all',
                    title: 'Full conversation',
                    desc: 'Sends all turns up to 1M tokens',
                  },
                  {
                    id: 'last10',
                    title: 'Last 10 turns',
                    desc: 'Rolling window for faster queries',
                  },
                  {
                    id: 'last20',
                    title: 'Last 20 turns',
                    desc: 'Balanced context length',
                  },
                ].map((strat) => (
                  <button
                    key={strat.id}
                    onClick={() => {
                      onUpdateConversation({
                        contextWindowStrategy: strat.id as any,
                      });
                    }}
                    className={`p-2.5 text-left rounded-md border transition-colors ${
                      activeConversation.contextWindowStrategy === strat.id
                        ? 'bg-blue-950/60 border-blue-500 text-blue-200'
                        : 'bg-[#1a202c] border-white/5 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <span className="block text-xs font-semibold text-white">
                      {strat.title}
                    </span>
                    <span className="block text-[10px] text-neutral-400 mt-0.5">
                      {strat.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-white/10 bg-[#141822]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
