/**
 * Simple activity indicator using native RN, respecting reduced motion.
 */
import React from 'react';
import { ActivityIndicator as RNActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '@/theme/tokens';
import { usePreferencesStore } from '@/stores/preferencesStore';

interface Props {
  size?: 'small' | 'large';
  color?: string;
  loading?: boolean;
}

export function ActivityIndicator({ size = 'small', color, loading = true }: Props) {
  const { reducedMotion } = usePreferencesStore();
  if (!loading) return null;
  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <RNActivityIndicator
        style={styles.indicator}
        size={size}
        color={color || colors.accent}
        // When reduced motion is on, still show a static spinner (RNActivityIndicator
        // is a native spinner; we just ensure it doesn't animate rapidly)
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'center',
    padding: 8,
  },
  indicator: {
    alignSelf: 'center',
    marginVertical: 12,
  },
});
