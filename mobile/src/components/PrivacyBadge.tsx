/**
 * Privacy badge — shows "Local by default" / "Local" / "Online" at a glance.
 * Per react-native-ui-ux-plan.md §5: green/blue for local, amber for online.
 * Icon + text, never color alone.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize } from '@/theme/tokens';
import { Check, Wifi, Cloud } from 'lucide-react-native';

export type PrivacyBadgeVariant = 'local' | 'online' | 'default';

interface PrivacyBadgeProps {
  variant?: PrivacyBadgeVariant;
  explicit?: boolean;
}

export function PrivacyBadge({ variant = 'local', explicit = false }: PrivacyBadgeProps) {
  const config = {
    local: {
      label: explicit ? 'Local' : 'Local by default',
      color: colors.local,
      Icon: Check,
    },
    online: {
      label: 'Online',
      color: colors.online,
      Icon: Cloud,
    },
    default: {
      label: 'Local',
      color: colors.accent,
      Icon: Check,
    },
  }[variant];

  return (
    <View style={[styles.container, { backgroundColor: `${config.color}20` }]}>
      <config.Icon color={config.color} size={14} strokeWidth={2} />
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    lineHeight: 16,
  },
});
