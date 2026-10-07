import { api } from "@/services/apiClient";

export async function applyProposal(proposalId: string): Promise<{ success: boolean; message?: string }> {
  return api<{ success: boolean; message?: string }>("/files/apply", {
    method: "POST",
    body: { proposal_id: proposalId },
  });
}