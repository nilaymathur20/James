/**
 * Session store — connection state, backend URL, identity.
 * Per react-native-ui-ux-plan.md §4: store only non-sensitive endpoint /
 * pairing metadata in SecureStore (never secrets).
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { secureStorage } from '@/utils/storage';
import { setApiBaseUrl, getApiBaseUrl } from '@/services/apiClient';
import { setTransportBaseUrl } from '@/services/assistantSocket';

const KEY_BACKEND_URL = 'james_backend_url';
const KEY_DEVICE_ID = 'james_device_id';
const KEY_PAIR_TOKEN = 'james_pair_token';

export type ConnectionStatus = 'unknown' | 'checking' | 'online' | 'offline';
export type PrivacyMode = 'offline' | 'local' | 'cloud';

interface SessionState {
  backendUrl: string | null;
  wsUrl: string | null;
  status: ConnectionStatus;
  error: string | null;
  lastChecked: number | null;
  deviceId: string | null;
  pairToken: string | null;

  // actions
  setBackendUrl: (url: string) => void;
  setStatus: (status: ConnectionStatus) => void;
  setError: (error: string | null) => void;
  setLastChecked: (ts: number) => void;
  clearError: () => void;

  // persistence
  load: () => Promise<void>;
  saveBackendUrl: (url: string) => Promise<void>;
}

export const useSessionStore = create<SessionState>()(
  devtools(
    (set, get) => ({
      backendUrl: null,
      wsUrl: null,
      status: 'unknown',
      error: null,
      lastChecked: null,
      deviceId: null,
      pairToken: null,

      setBackendUrl: (url: string) => {
        const trimmed = url.replace(/\/+$/, '');
        const wsUrl = trimmed.replace(/^https?:\/\//, (m) => (m === 'https://' ? 'wss://' : 'ws://'));
        setApiBaseUrl(trimmed);
        setTransportBaseUrl(wsUrl, trimmed);
        set({ backendUrl: trimmed, wsUrl });
      },

      setStatus: (status: ConnectionStatus) => set({ status }),
      setError: (error: string | null) => set({ error }),
      setLastChecked: (ts: number) => set({ lastChecked: ts }),
      clearError: () => set({ error: null }),

      load: async () => {
        const [backendUrl, deviceId, pairToken] = await Promise.all([
          secureStorage.getItem(KEY_BACKEND_URL),
          secureStorage.getItem(KEY_DEVICE_ID),
          secureStorage.getItem(KEY_PAIR_TOKEN),
        ]);
        if (backendUrl) {
          const trimmed = backendUrl.replace(/\/+$/, '');
          const wsUrl = trimmed.replace(/^https?:\/\//, (m) => (m === 'https://' ? 'wss://' : 'ws://'));
          setApiBaseUrl(trimmed);
          setTransportBaseUrl(wsUrl, trimmed);
          set({ backendUrl: trimmed, wsUrl });
        }
        set({ deviceId, pairToken });
      },

      saveBackendUrl: async (url: string) => {
        const trimmed = url.replace(/\/+$/, '');
        await secureStorage.setItem(KEY_BACKEND_URL, trimmed);
        get().setBackendUrl(trimmed);
      },
    }),
    { name: 'james-session' },
  ),
);

// Initialize from stored state on first import
export function hydrateSession(): void {
  const store = useSessionStore.getState();
  store.load().then(() => {
    // In web/Electron (same-origin dev server), default to the local backend
    // so the desktop app works without manual connection setup.
    if (!store.backendUrl && typeof window !== 'undefined') {
      store.setBackendUrl('http://127.0.0.1:8000');
    }
  });
}

export function getBackendUrl(): string {
  return getApiBaseUrl();
}
