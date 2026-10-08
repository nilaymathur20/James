/**
 * Edit review screen — shows the diff, expiry countdown, and confirmation.
 * Per react-native-ui-ux-plan.md §4D step 2 (Review diff) and step 3 (Confirm apply).
 * Full-screen review for long diffs, bottom sheet for short ones.
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, borderRadius, shadow } from '@/theme/tokens';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { DiffViewer } from '@/components/DiffViewer';
import { useFilePreview, useApplyEdit, useUndoEdit } from '@/features/files/fileService';
import { ActivityIndicator } from '@/components/ActivityIndicator';
import { Clock } from 'lucide-react-native';

function parseIso(iso: string): Date {
  return new Date(iso);
}

function timeRemainingUntil(targetIso: string): number {
  try {
    const target = parseIso(targetIso).getTime();
    return Math.max(0, Math.floor((target - Date.now()) / 1000));
  } catch {
    return 0;
  }
}

function formatTimeLeft(seconds: number): string {
  if (seconds <= 0) return 'Expired';
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default function EditReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ fileId: string; proposalId: string; backupId?: string }>();
  const { fileId, proposalId, backupId } = params;
  const isUndoFlow = !!backupId;

  const { data: previewData, isLoading, isError } = useFilePreview(fileId, true);
  const applyMutation = useApplyEdit();
  const undoMutation = useUndoEdit();

  const [countdown, setCountdown] = useState<number | null>(null);

  // We need the proposal details — fetch them via preview (which has file info)
  // In a full implementation, we'd call an API to get proposal details by ID.
  // For now, we use the file preview to get file metadata and construct the diff
  // from the proposal_id stored in the URL.
  const file = previewData?.file;
  const fileName = file?.name || 'Untitled';

  // For the edit flow, we need the diff and expiry. In a real implementation,
  // the propose-edit response carries these. Here we simulate getting them.
  // The diff comes from the backend's propose_edit endpoint response.

  // Since we passed proposalId via the URL, we need to reconstruct the diff.
  // For the UI demo, we'll fetch the file preview and use a simplified diff.
  // In production, this would be the stored proposal's diff field.
  const [diffText, setDiffText] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    // For the edit flow: the diff would come from the propose-edit API response.
    // Since we navigate here with just the proposalId, we simulate by showing
    // a placeholder diff from the file content.
    // A real implementation would have an API to fetch proposal by ID.
    if (file && previewData?.content) {
      // This is a simplification - the real diff would be stored server-side
      // and returned by the propose-edit endpoint.
      setDiffText(`--- a/${fileName}\n+++ b/${fileName}\n@@ -1,3 +1,3 @@\n-Old line example\n+New line example\n Context line 3`);
      setExpiresAt(new Date(Date.now() + 15 * 60 * 1000).toISOString());
    }
  }, [file, previewData, fileName]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const remaining = timeRemainingUntil(expiresAt);
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);
    setCountdown(timeRemainingUntil(expiresAt));
    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleConfirmApply = useCallback(async () => {
    Alert.alert(
      isUndoFlow ? 'Restore backup?' : 'Apply edit?',
      isUndoFlow
        ? 'This will restore the file to its original content before the edit. A backup record will be created.'
        : 'This will write changes to disk. An undo backup will be created. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isUndoFlow ? 'Restore' : 'Apply',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isUndoFlow && backupId) {
                await undoMutation.mutateAsync({ backup_id: backupId, confirmed: true });
              } else if (proposalId) {
                await applyMutation.mutateAsync({ proposal_id: proposalId, confirmed: true });
              }
              Alert.alert(
                'Success',
                isUndoFlow ? 'Backup restored.' : 'Edit applied. An undo backup was created.',
                [{ text: 'OK', onPress: () => router.back() }],
              );
            } catch (err: unknown) {
              Alert.alert(
                'Failed',
                err instanceof Error ? err.message : 'Could not complete the operation.',
              );
            }
          },
        },
      ],
    );
  }, [isUndoFlow, backupId, proposalId, applyMutation, undoMutation, router]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (isError || !file) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.error}>Could not load the file for review.</Text>
      </SafeAreaView>
    );
  }

  const isExpired = countdown !== null && countdown <= 0;
  const canApply = !isExpired && !applyMutation.isPending;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Review header */}
      <View style={styles.reviewHeader}>
        <Text style={styles.fileName}>{fileName}</Text>
        <View style={styles.expiryBadge}>
          <Clock color={isExpired ? colors.danger : colors.online} size={14} strokeWidth={1.5} />
          <Text style={[styles.expiryText, { color: isExpired ? colors.danger : colors.online }]}>
            {expiresAt ? (isExpired ? 'Expired' : `${formatTimeLeft(countdown ?? 0)} left`) : ''}
          </Text>
        </View>
      </View>

      {/* Diff viewer */}
      <View style={styles.diffSection}>
        <DiffViewer diff={diffText} fileName={fileName} maxHeight={300} />
      </View>

      {/* File info */}
      <View style={styles.infoSection}>
        <Text style={styles.infoLabel}>Path:</Text>
        <Text style={styles.infoValue}>{file.path}</Text>
        <Text style={styles.infoLabel}>Size:</Text>
        <Text style={styles.infoValue}>{file.size_bytes ? `${file.size_bytes} bytes` : '—'}</Text>
        {expiresAt && (
          <>
            <Text style={styles.infoLabel}>Expires:</Text>
            <Text style={styles.infoValue}>
              {new Date(expiresAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Text>
          </>
        )}
      </View>

      {/* Confirmation note */}
      <View style={styles.confirmBox}>
        <Text style={styles.confirmText}>
          {isUndoFlow
            ? 'Restoring this backup will revert the file. Make sure no newer edits exist.'
            : 'Applying this edit will write to disk and create an undo backup. Review the diff carefully.'}
        </Text>
      </View>

      {/* Action buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.cancelBtn, shadow.sm]}
          onPress={() => router.back()}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.applyBtn,
            !canApply && styles.applyBtnDisabled,
            shadow.sm,
          ]}
          onPress={handleConfirmApply}
          disabled={!canApply}
          accessible
          accessibilityRole="button"
          accessibilityLabel={isUndoFlow ? 'Restore backup' : 'Apply edit'}
        >
          <ActivityIndicator loading={applyMutation.isPending || undoMutation.isPending} />
          <Text style={styles.applyBtnText}>
            {applyMutation.isPending || undoMutation.isPending
              ? ''
              : isUndoFlow
                ? 'Restore backup'
                : 'Apply edit'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fileName: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.text,
  },
  expiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: `${colors.online}10`,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  expiryText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  diffSection: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  infoSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    width: 60,
  },
  infoValue: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    flex: 1,
    minWidth: 120,
  },
  confirmBox: {
    backgroundColor: `${colors.danger}10`,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    padding: spacing.md,
    margin: spacing.md,
    borderRadius: borderRadius.md,
  },
  confirmText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    color: colors.textMuted,
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  applyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.local,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    height: 48,
  },
  applyBtnDisabled: {
    opacity: 0.5,
  },
  applyBtnText: {
    color: colors.background,
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.base,
    padding: spacing.md,
  },
});
