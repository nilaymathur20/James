import React from "react";
import type { LiveChannelState, ServiceStatus } from "@/types";
import { BrandMark, RefreshIcon, SettingsIcon } from "@/icons";

interface HeaderProps {
  service: ServiceStatus;
  liveState: LiveChannelState;
  onRefreshHealth: () => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  service,
  liveState,
  onRefreshHealth,
  onOpenSettings,
}) => {
  const connectionLabel =
    service.state === "offline"
      ? "Backend offline"
      : service.state === "checking"
      ? "Checking local API…"
      : service.provider === "llama.cpp"
      ? "Local model configured"
      : service.provider === "openrouter"
      ? "OpenRouter available"
      : service.provider === "gemini"
      ? "Gemini available"
      : service.provider === "groq"
      ? "Groq ultrafast active"
      : "Offline RAG ready";

  const liveChannelLabel =
    liveState === "connected"
      ? "Live updates connected"
      : liveState === "connecting"
      ? "Connecting live updates…"
      : "HTTP fallback active";

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <BrandMark size={20} />
        </span>
        <div>
          <p>LOCAL-FIRST ASSISTANT</p>
          <h1>James</h1>
        </div>
      </div>

      <div className="topbar-actions">
        <div className={`connection connection--${service.state}`} aria-live="polite">
          <span className="status-dot" aria-hidden="true" />
          <div>
            <strong>{connectionLabel}</strong>
            <small>
              {service.chunks} indexed chunk{service.chunks === 1 ? "" : "s"} · {liveChannelLabel}
            </small>
          </div>
          <button
            type="button"
            className="refresh"
            onClick={onRefreshHealth}
            title="Refresh local API status"
            aria-label="Refresh connection status"
          >
            <RefreshIcon size={16} />
          </button>
        </div>

        {onOpenSettings && (
          <button
            type="button"
            className="settings-button"
            onClick={onOpenSettings}
            title="Configure settings & providers"
            aria-label="Open settings"
          >
            <SettingsIcon size={16} />
          </button>
        )}
      </div>
    </header>
  );
};