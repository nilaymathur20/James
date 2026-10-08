/**
 * Command detail screen — shows a single request's progress and result.
 * Per react-native-ui-ux-plan.md route map: /command/[requestId].
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, borderRadius } from '@/theme/tokens';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

export default function CommandScreen() {
  const router = useRouter();
  const { requestId } = useLocalSearchParams<{ requestId: string }>();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessible
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <ArrowLeft color={colors.text} size={20} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={styles.title}>Command {requestId}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.hint}>
          This screen would show the full request history, tool calls, and
          final result for the given request ID.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    padding: spacing.md,
  },
  hint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 20,
  },
});
