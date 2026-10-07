import React from 'react';
import { Gauge } from 'lucide-react';
import { TokenMetrics } from '../types/chat';

interface TokenGaugeProps {
  metrics: TokenMetrics;
  maxOutputLimit: number;
  onClick: () => void;
  compact?: boolean;
}

export const TokenGauge: React.FC<TokenGaugeProps> = ({
  metrics,
  maxOutputLimit,
  onClick,
  compact = false,
}) => {
  const { totalSessionTokens, maxContextWindow } = metrics;
  
  // Percentage of max context window (1M tokens)
  const contextPercent = Math.min(100, (totalSessionTokens / maxContextWindow) * 100);

  // Status color
  const getColor = (pct: number) => {
    if (pct > 80) return { stroke: '#ef4444', text: 'text-red-400' };
    if (pct > 50) return { stroke: '#f59e0b', text: 'text-amber-400' };
    return { stroke: '#3b82f6', text: 'text-blue-400' };
  };

  const statusColor = getColor(contextPercent);

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#141822] hover:bg-[#1a202c] border border-white/10 text-xs transition-colors select-none"
        title="Open token and context inspector"
      >
        <Gauge className="w-3.5 h-3.5 text-blue-400" />
        <span className="font-mono tabular-nums text-neutral-200 font-medium text-[11px]">
          {totalSessionTokens.toLocaleString()}
        </span>
        <span className="text-neutral-500 text-[10px]">tokens</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[#141822] hover:bg-[#1a202c] border border-white/10 transition-colors select-none text-left"
      title="Click to view detailed token inspector"
    >
      <div className="w-7 h-7 rounded-md bg-[#1a202c] border border-white/5 flex items-center justify-center text-blue-400">
        <Gauge className="w-4 h-4" />
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
          <span className="font-medium text-neutral-300">Tokens</span>
          <span>·</span>
          <span className="font-mono text-neutral-400">{maxOutputLimit} cap</span>
        </div>
        <div className="flex items-baseline gap-1 font-mono text-xs">
          <span className="font-semibold text-white tabular-nums">
            {totalSessionTokens.toLocaleString()}
          </span>
          <span className="text-neutral-500 text-[10px]">/ 1M context</span>
        </div>
      </div>
    </button>
  );
};
