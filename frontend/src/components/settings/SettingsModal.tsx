import { useState } from "react";
import type { PrivacyMode, ServiceStatus } from "@/types";
import { DeviceManager } from "./DeviceManager";
import { PrivacyToggle } from "./PrivacyToggle";
import { ProviderSetup } from "./ProviderSetup";
import { CloseIcon } from "@/icons";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: PrivacyMode;
  onChangeMode: (mode: PrivacyMode) => void;
  onSaveKeys: (keys: Record<string, string>) => Promise<void>;
  service: ServiceStatus;
  onModeSwitch?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentMode,
  onChangeMode,
  onSaveKeys,
  service,
  onModeSwitch,
}) => {
  const [activeTab, setActiveTab] = useState<"general" | "devices">("general");
  const [groqKey, setGroqKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const keys: Record<string, string> = {};
      if (groqKey.trim()) keys.GROQ_API_KEY = groqKey.trim();
      if (geminiKey.trim()) keys.GEMINI_API_KEY = geminiKey.trim();
      if (openRouterKey.trim()) keys.OPENROUTER_API_KEY = openRouterKey.trim();
      await onSaveKeys(keys);
      setSaveMessage("Settings saved successfully.");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch {
      setSaveMessage("Error saving settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings & Privacy</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close settings">
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="tabs" role="tablist">
          <button
            className={activeTab === "general" ? "active" : ""}
            onClick={() => setActiveTab("general")}
            role="tab"
            aria-selected={activeTab === "general"}
          >
            General
          </button>
          <button
            className={activeTab === "devices" ? "active" : ""}
            onClick={() => setActiveTab("devices")}
            role="tab"
            aria-selected={activeTab === "devices"}
          >
            Devices
          </button>
        </div>

        <div className="modal-body">
          {activeTab === "general" ? (
            <>
              <PrivacyToggle
                currentMode={currentMode}
                onChangeMode={onChangeMode}
              />

              <ProviderSetup service={service} onModeSwitch={onModeSwitch} />

              <form onSubmit={handleSave} className="setting-section">
                <h3>Bring Your Own Key (BYOK)</h3>
                <p className="setting-desc">
                  Stored securely in OS Keychain / local credential store.
                </p>

                <div className="form-group">
                  <label htmlFor="groq-key">Groq API Key (Fast Inference & Whisper):</label>
                  <input
                    id="groq-key"
                    type="password"
                    placeholder="gsk_..."
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="gemini-key">Google Gemini API Key (Vision & Reasoning):</label>
                  <input
                    id="gemini-key"
                    type="password"
                    placeholder="AIzaSy..."
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="openrouter-key">OpenRouter API Key (Multi-Model):</label>
                  <input
                    id="openrouter-key"
                    type="password"
                    placeholder="sk-or-v1-..."
                    value={openRouterKey}
                    onChange={(e) => setOpenRouterKey(e.target.value)}
                  />
                </div>

                {saveMessage && <div className="save-message">{saveMessage}</div>}

                <div className="modal-actions">
                  <button type="submit" className="save-btn" disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Credentials"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <DeviceManager />
          )}
        </div>
      </div>
    </div>
  );
};