import { api } from "@/services/apiClient";
import type { AssistantResultPayload } from "@/types";

export async function sendAssistantRequest(payload: {
  text: string;
  source?: "typed" | "voice";
  use_history?: boolean;
  media_base64?: string;
}): Promise<AssistantResultPayload> {
  return api<AssistantResultPayload>("/assistant", {
    method: "POST",
    body: payload,
  });
}