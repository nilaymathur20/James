export type PrivacyMode = "offline" | "local" | "cloud";
export type ServiceState = "checking" | "online" | "offline";
export type LiveChannelState = "connecting" | "connected" | "disconnected" | "unavailable";

export interface HealthResponse {
  status?: string;
  indexed_chunks?: number;
  chat_provider?: string | null;
  history?: {
    feature_enabled?: boolean;
  };
  ai_mode?: PrivacyMode;
  device_id?: string;
  vosk?: {
    provider?: string;
    package_installed?: boolean;
    model_configured?: boolean;
    model_loaded?: boolean;
  };
}

export interface ServiceStatus {
  state: ServiceState;
  chunks: number;
  provider: string | null;
  historyAvailable: boolean;
  aiMode?: PrivacyMode;
  privacyMode?: PrivacyMode;
  deviceId?: string;
}

export interface PairedDevice {
  id: string;
  name: string;
  address: string;
  port: number;
  trust_level: "trusted" | "pending" | "revoked";
  paired_at: string;
  is_online?: boolean;
}
