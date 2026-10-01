import React from "react";
import type { PrivacyMode } from "@/types";
import { LockIcon, HomeIcon, CloudIcon } from "@/icons";

interface PrivacyToggleProps {
  currentMode: PrivacyMode;
  onChangeMode: (mode: PrivacyMode) => void;
}

const modes: { value: PrivacyMode; icon: React.ReactNode; label: string; desc: string }[] = [
  {
    value: "offline",
    icon: <LockIcon size={14} />,
    label: "Offline Mode",
    desc: "Zero internet egress. Local Vosk STT, FTS5 RAG & local models only.",
  },
  {
    value: "local",
    icon: <HomeIcon size={14} />,
    label: "Local / LAN Mode",
    desc: "Allows local network P2P mesh discovery and LAN LLM servers.",
  },
  {
    value: "cloud",
    icon: <CloudIcon size={14} />,
    label: "Cloud / Hybrid Mode",
    desc: "Permits configured cloud API providers (Groq, Gemini, OpenRouter).",
  },
];

export const PrivacyToggle: React.FC<PrivacyToggleProps> = ({
  currentMode,
  onChangeMode,
}) => {
  return (
    <div className="privacy-mode-selector">
      {modes.map(({ value, icon, label, desc }) => (
        <label
          key={value}
          className={`mode-option ${currentMode === value ? "active" : ""}`}
        >
          <input
            type="radio"
            name="privacy_mode"
            value={value}
            checked={currentMode === value}
            onChange={() => onChangeMode(value)}
          />
          <div>
            <strong>
              {icon} {label}
            </strong>
            <small>{desc}</small>
          </div>
        </label>
      ))}
    </div>
  );
};