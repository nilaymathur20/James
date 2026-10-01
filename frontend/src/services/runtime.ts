export function isElectronEnvironment(): boolean {
  return typeof window !== "undefined" && Boolean((window as unknown as { electronAPI?: unknown }).electronAPI);
}

export function isPWA(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function getRuntimePlatform(): "electron" | "pwa" | "browser" {
  if (isElectronEnvironment()) return "electron";
  if (isPWA()) return "pwa";
  return "browser";
}