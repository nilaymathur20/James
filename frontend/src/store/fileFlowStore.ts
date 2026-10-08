import { create } from "zustand";

interface ProposalState {
  proposals: Array<{
    id: string;
    filePath: string;
    diff: string;
    createdAt: number;
    expiresAt: number;
    status: "pending" | "applied" | "expired" | "rejected";
  }>;
  backups: Array<{
    id: string;
    filePath: string;
    backupPath: string;
    createdAt: number;
  }>;
  auditLog: Array<{
    timestamp: string;
    action: string;
    device: string;
    hash: string;
  }>;
  addProposal: (p: ProposalState["proposals"][0]) => void;
  updateProposal: (id: string, status: ProposalState["proposals"][0]["status"]) => void;
  addBackup: (b: ProposalState["backups"][0]) => void;
  addAuditEntry: (e: ProposalState["auditLog"][0]) => void;
}

export const useFileFlowStore = create<ProposalState>((set) => ({
  proposals: [],
  backups: [],
  auditLog: [],
  addProposal: (p) => set((state) => ({ proposals: [p, ...state.proposals] })),
  updateProposal: (id, status) => set((state) => ({
    proposals: state.proposals.map((p) => (p.id === id ? { ...p, status } : p)),
  })),
  addBackup: (b) => set((state) => ({ backups: [b, ...state.backups] })),
  addAuditEntry: (e) => set((state) => ({ auditLog: [e, ...state.auditLog] })),
}));
