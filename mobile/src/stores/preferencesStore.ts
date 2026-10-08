/**
 * Preferences store — theme, reduced motion, density, voice settings.
 * Persisted via zustand/middleware for cross-session retention.
 */
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light' | 'system';
export type Density = 'compact' | 'normal' | 'spacious';

interface PreferencesState {
  theme: Theme;
  reducedMotion: boolean;
  density: Density;
  pushToTalk: 'hold' | 'toggle';
  fontSize: number; // scale factor

  setTheme: (theme: Theme) => void;
  setReducedMotion: (val: boolean) => void;
  setDensity: (density: Density) => void;
  setPushToTalk: (mode: 'hold' | 'toggle') => void;
  setFontSize: (size: number) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  devtools(
    persist(
      (set) => ({
        theme: 'dark',
        reducedMotion: false,
        density: 'normal',
        pushToTalk: 'hold',
        fontSize: 1,

        setTheme: (theme: Theme) => set({ theme }),
        setReducedMotion: (val: boolean) => set({ reducedMotion: val }),
        setDensity: (density: Density) => set({ density }),
        setPushToTalk: (mode: 'hold' | 'toggle') => set({ pushToTalk: mode }),
        setFontSize: (size: number) => set({ fontSize: size }),
      }),
      { name: 'james-preferences' },
    ),
    { name: 'james-preferences' },
  ),
);
