import { create } from "zustand";

export interface PrivacyModeInfo {
  mode: "offline" | "local" | "cloud";
  provider?: string;
  perMessage?: Array<{ msgId: string; mode: string; detail: string }>;
}

interface PrivacyState {
  privacy: PrivacyModeInfo;
  setPrivacy: (p: PrivacyModeInfo) => void;
  showCloudWarning: boolean;
  setShowCloudWarning: (v: boolean) => void;
}

export const usePrivacyStore = create<PrivacyState>((set) => ({
  privacy: { mode: "offline" },
  setPrivacy: (p) => {
    const wasCloud = usePrivacyStore.getState().privacy.mode === "cloud";
    const isCloud = p.mode === "cloud";
    set({ privacy: p, showCloudWarning: isCloud && !wasCloud });
    if (isCloud && !wasCloud) {
      setTimeout(() => set({ showCloudWarning: false }), 6000);
    }
  },
  setShowCloudWarning: (v) => set({ showCloudWarning: v }),
  showCloudWarning: false,
}));
