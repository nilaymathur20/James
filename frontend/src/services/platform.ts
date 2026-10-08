export interface PlatformCapabilities {
  platform: "electron" | "pwa" | "web";
  isDesktop: boolean;
  isPWA: boolean;
  hasNativeFileSystem: boolean;
  hasDirectPortRouting: boolean;
}

export function isElectron(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean((window as unknown as { electronAPI?: unknown }).electronAPI)
  );
}

export function isPWA(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as { standalone?: boolean }).standalone)
  );
}

export function getPlatformCapabilities(): PlatformCapabilities {
  const desktop = isElectron();
  const pwa = !desktop && isPWA();
  return {
    platform: desktop ? "electron" : pwa ? "pwa" : "web",
    isDesktop: desktop,
    isPWA: pwa,
    hasNativeFileSystem: desktop,
    hasDirectPortRouting: desktop,
  };
}

export async function getDesktopBackendInfo(): Promise<{
  port: number;
  base_url: string;
  is_running: boolean;
  pid?: number;
} | null> {
  if (!isElectron()) return null;
  try {
    const api = (window as unknown as { electronAPI?: { getBackendInfo: () => Promise<{ port: number; base_url: string; is_running: boolean; pid?: number } | null> } }).electronAPI;
    if (api?.getBackendInfo) {
      return await api.getBackendInfo();
    }
    return null;
  } catch {
    return null;
  }
}