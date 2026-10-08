import { create } from "zustand";

interface Toast {
  id: string;
  message: string;
  action?: string;
  onAction?: () => void;
  duration?: number;
  expiresAt: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id" | "expiresAt">) => string;
  removeToast: (id: string) => void;
  dismissExpired: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: ({ message, action, onAction, duration = 5000 }) => {
    const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const expiresAt = Date.now() + duration;
    set((state) => ({ toasts: [...state.toasts, { id, message, action, onAction, duration, expiresAt }] }));
    return id;
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  dismissExpired: () => {
    const now = Date.now();
    set((state) => ({ toasts: state.toasts.filter((t) => t.expiresAt > now) }));
  },
}));
