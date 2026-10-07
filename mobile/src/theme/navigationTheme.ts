/**
 * Dark navigation theme tokens for Expo Router / React Navigation.
 * Uses project design tokens — self-contained, no extra imports needed.
 */
import { colors } from '@/theme/tokens';

export const darkNavigationTheme = {
  dark: true,
  colors: {
    primary: colors.accent,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.danger,
  },
  fonts: {
    regular: {
      fontFamily: undefined,
      fontWeight: '400' as const,
    },
    medium: {
      fontFamily: undefined,
      fontWeight: '600' as const,
    },
    light: {
      fontFamily: undefined,
      fontWeight: '300' as const,
    },
    bold: {
      fontFamily: undefined,
      fontWeight: '700' as const,
    },
  },
  roundness: 8,
};
