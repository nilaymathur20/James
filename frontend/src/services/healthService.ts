import { api } from "@/services/apiClient";
import type { PrivacyMode } from "@/types";

export interface HealthResult {
  online: boolean;
  historyAvailable: boolean;
  mode: PrivacyMode;
  chunks: number;
  provider: string | null;
  deviceId: string;
}

export async function fetchHealth(): Promise<HealthResult> {
  try {
    const health = await api<{
      indexed_chunks?: number;
      chat_provider?: string;
      history?: { feature_enabled?: boolean };
      device_id?: string;
      privacy_mode?: PrivacyMode;
    }>("/health");

    return {
      online: true,
      historyAvailable: Boolean(health.history?.feature_enabled),
      mode: health.privacy_mode || "offline",
      chunks: Number(health.indexed_chunks || 0),
      provider: health.chat_provider || null,
      deviceId: health.device_id || "local",
    };
  } catch {
    return {
      online: false,
      historyAvailable: false,
      mode: "offline",
      chunks: 0,
      provider: null,
      deviceId: "local",
    };
  }
}