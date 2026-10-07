import { create } from "zustand";

export interface BudgetState {
  totalMs: number;
  perStepMs: number;
  maxSteps: number;
  remainingMs: number;
  currentStep: number;
  active: boolean;
}

export interface TraceEvent {
  id: string;
  type: "thought" | "tool_call" | "tool_result" | "status" | "error";
  label: string;
  detail: string;
  timestamp: number;
  durationMs?: number;
  raw?: Record<string, unknown>;
  status?: "pending" | "running" | "done" | "error";
}

interface TraceState {
  events: TraceEvent[];
  budget: BudgetState;
  isStreaming: boolean;
  addEvent: (event: Omit<TraceEvent, "id" | "timestamp">) => void;
  updateEvent: (id: string, updates: Partial<TraceEvent>) => void;
  setBudget: (budget: Partial<BudgetState>) => void;
  setStreaming: (v: boolean) => void;
  clearTrace: () => void;
}

export const useTraceStore = create<TraceState>((set) => ({
  events: [],
  budget: {
    totalMs: 120_000,
    perStepMs: 30_000,
    maxSteps: 8,
    remainingMs: 120_000,
    currentStep: 0,
    active: false,
  },
  isStreaming: false,
  addEvent: (entry) =>
    set((state) => ({
      events: [...state.events, { ...entry, id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, timestamp: Date.now() }],
    })),
  updateEvent: (id, updates) =>
    set((state) => ({
      events: state.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })),
  setBudget: (budget: Partial<BudgetState>) => set((state) => ({ budget: { ...state.budget, ...budget } })),
  setStreaming: (v) => set({ isStreaming: v }),
  clearTrace: () => set({ events: [], budget: { totalMs: 120_000, perStepMs: 30_000, maxSteps: 8, remainingMs: 120_000, currentStep: 0, active: false } }),
}));
