import { api } from "@/services/apiClient";
import type { PrivacyMode } from "@/types";

export async function saveKeys(keys: Record<string, string>): Promise<void> {
  await api("/settings/keys", { method: "POST", body: { keys } });
}

export async function setPrivacyMode(mode: PrivacyMode): Promise<void> {
  await api("/settings/privacy", { method: "POST", body: { mode } });
}