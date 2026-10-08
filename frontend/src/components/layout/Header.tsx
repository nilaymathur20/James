import React from "react";
import type { LiveChannelState, ServiceStatus } from "@/types";
import { BrandMark, RefreshIcon, SettingsIcon, ImageGenIcon, LibraryIcon } from "@/icons";

interface HeaderProps {
  service: ServiceStatus;
  liveState: LiveChannelState;
  onRefreshHealth: () => void;
  onOpenSettings?: () => void;
  onOpenImageGen?: () => void;
  onOpenLibrary?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  service,
  liveState,
  onRefreshHealth,
  onOpenSettings,
  onOpenImageGen,
  onOpenLibrary,
}) => {
  const connectionLabel =
    service.state === "offline"
      ? "Backend offline"
      : service.state === "checking"
      ? "Checking API…"
      : service.provider === "llama.cpp"
      ? "Local Llama.cpp"
      : service.provider === "openrouter"
      ? "OpenRouter AI"
      : service.provider === "gemini"
      ? "Google Gemini AI"
      : service.provider === "groq"
      ? "Groq Ultrafast"
      : "Offline RAG Ready";

  const liveChannelLabel =
    liveState === "connected"
      ? "Live WS"
      : liveState === "connecting"
      ? "Connecting..."
      : "HTTP Mode";

  return (
    <header className="h-16 px-6 bg-slate-900/95 border-b border-slate-800 backdrop-blur-xl flex items-center justify-between sticky top-0 z-50 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0">
          <BrandMark size={22} />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black tracking-widest text-blue-400 uppercase leading-none mb-1">
            LOCAL-FIRST ASSISTANT
          </span>
          <h1 className="text-xl font-bold text-white leading-none tracking-tight">
            James
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Status Chip */}
        <div className="hidden sm:flex items-center gap-2.5 bg-slate-950 border border-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-mono text-slate-300">
          <span className={`w-2.5 h-2.5 rounded-full ${service.state === 'offline' ? 'bg-rose-500' : 'bg-emerald-400 animate-pulse'}`} />
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-slate-100">{connectionLabel}</span>
            <span className="text-[10px] text-slate-400">{service.chunks} chunks · {liveChannelLabel}</span>
          </div>
          <button
            type="button"
            onClick={onRefreshHealth}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            title="Refresh API Status"
          >
            <RefreshIcon size={14} />
          </button>
        </div>

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="px-3.5 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 shadow-sm"
            title="Configure API Keys & Privacy Mode"
          >
            <SettingsIcon size={15} />
            <span>API & Settings</span>
          </button>
        )}

        {onOpenLibrary && (
          <button
            type="button"
            onClick={onOpenLibrary}
            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl transition-all"
            title="View Image Library"
          >
            <LibraryIcon size={16} />
          </button>
        )}

        {onOpenImageGen && (
          <button
            type="button"
            onClick={onOpenImageGen}
            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl transition-all"
            title="Generate Images"
          >
            <ImageGenIcon size={16} />
          </button>
        )}
      </div>
    </header>
  );
};