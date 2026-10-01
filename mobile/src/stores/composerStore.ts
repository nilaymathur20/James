/**
 * Composer store — ephemeral state for the Ask composer.
 * Preserves drafts across navigation and interruptions.
 * Per react-native-ui-ux-plan.md §4: Zustand for composer draft,
 * active request, socket state, and theme.
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { AssistantEvent } from '@/schemas/assistant';

export type ComposerStatus = 'idle' | 'sending' | 'connected' | 'disconnected';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  status?: 'sending' | 'partial' | 'complete' | 'error';
  mode?: string;
  isLocal?: boolean;
  sources?: Array<{ source: string; snippet?: string; score?: number }>;
}

interface ComposerState {
  // Draft (persisted to survive back-navigation)
  draft: string;
  setDraft: (text: string) => void;
  clearDraft: () => void;

  // Messages / conversation
  messages: Message[];
  addMessage: (msg: Omit<Message, 'id' | 'timestamp'>) => void;
  updateLastMessage: (updates: Partial<Message> | ((prev: Message) => Partial<Message>)) => void;
  clearMessages: () => void;

  // Active request
  activeRequestId: string | null;
  status: ComposerStatus;
  setStatus: (status: ComposerStatus) => void;
  setActiveRequestId: (id: string | null) => void;

  // Live events
  lastEvent: AssistantEvent | null;
  setLastEvent: (event: AssistantEvent | null) => void;

  // Error
  error: string | null;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Mode / privacy
  useHistory: boolean;
  setUseHistory: (val: boolean) => void;
}

export const useComposerStore = create<ComposerState>()(
  devtools(
    (set) => ({
      draft: '',
      messages: [],
      activeRequestId: null,
      status: 'idle',
      lastEvent: null,
      error: null,
      useHistory: false,

      setDraft: (text: string) => set({ draft: text }),
      clearDraft: () => set({ draft: '' }),

      addMessage: (msg) =>
        set((state) => ({
          messages: [
            ...state.messages,
            {
              ...msg,
              id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              timestamp: Date.now(),
            },
          ],
        })),
      updateLastMessage: (updates: Partial<Message> | ((prev: Message) => Partial<Message>)) =>
        set((state) => {
          if (!state.messages.length) return state;
          const last = state.messages[state.messages.length - 1];
          const next = typeof updates === 'function' ? updates(last) : updates;
          return {
            messages: [...state.messages.slice(0, -1), { ...last, ...next }],
          };
        }),
      clearMessages: () => set({ messages: [] }),

      setActiveRequestId: (id) => set({ activeRequestId: id }),
      setStatus: (status) => set({ status }),

      setLastEvent: (event) => set({ lastEvent: event }),

      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      setUseHistory: (val) => set({ useHistory: val }),
    }),
    { name: 'james-composer' },
  ),
);
