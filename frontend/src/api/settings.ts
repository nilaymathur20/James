import { api } from "@/services/apiClient";
import type { PrivacyMode } from "@/types";

export async function saveKeys(keys: Record<string, string>): Promise<void> {
  await api("/settings/keys", { method: "POST", body: { keys } });
}

export async function setPrivacyMode(mode: PrivacyMode): Promise<void> {
  await api("/settings/privacy", { method: "POST", body: { mode } });
}

export async function testProvider(
  provider: string,
  apiKey: string,
  model?: string
): Promise<{
  provider: string;
  ok: boolean;
  error_code: string | null;
  message: string;
  latency_ms: number;
  key_source?: string;
  masked_key?: string;
  retry_after?: number | null;
  switch_command?: string;
}> {
  return api("/providers/test", {
    method: "POST",
    body: { provider, api_key: apiKey, model },
  }) as Promise<{
    provider: string;
    ok: boolean;
    error_code: string | null;
    message: string;
    latency_ms: number;
    key_source?: string;
    masked_key?: string;
    retry_after?: number | null;
    switch_command?: string;
  }>;
}