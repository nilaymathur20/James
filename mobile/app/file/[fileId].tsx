/**
 * File detail root — entry point for the file/[fileId] route.
 * Displays file identity header with quick action buttons.
 * Per react-native-ui-ux-plan.md §4C (File preview screen) and §4D (Edit flow).
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, borderRadius, shadow } from '@/theme/tokens';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFilePreview } from '@/features/files/fileService';
import { PrivacyBadge } from '@/components/PrivacyBadge';
import { ActivityIndicator } from '@/components/ActivityIndicator';
import { Eye, Edit3, ExternalLink, Share2 } from 'lucide-react-native';
import type { FileMetadata } from '@/schemas/files';

export default function FileDetailScreen() {
  const router = useRouter();
  const { fileId } = useLocalSearchParams<{ fileId: string }>();
  const { data, isLoading, isError } = useFilePreview(fileId, true);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}><ActivityIndicator /></SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.error}>File not found or unavailable.</Text>
      </SafeAreaView>
    );
  }

  const file: FileMetadata = data.file;
  const isIndexed = file.category === 'indexed';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.fileName}>{file.name}</Text>
          <Text style={styles.filePath}>{file.path}</Text>
        </View>
        <PrivacyBadge variant={isIndexed ? 'local' : 'default'} explicit={true} />
      </View>

      <View style={styles.actions}>
        {file.can_preview && (
          <ActionButton
            icon={Eye}
            label="Preview"
            color={colors.accent}
            onPress={() => router.push(`/file/${fileId}/preview`)}
          />
        )}
        {file.can_edit && (
          <ActionButton
            icon={Edit3}
            label="Edit"
            color={colors.local}
            onPress={() => router.push(`/file/${fileId}/edit`)}
          />
        )}
        {file.can_open && (
          <ActionButton icon={ExternalLink} label="Open" color={colors.online} onPress={() => {}} />
        )}
        <ActionButton icon={Share2} label="Share" color={colors.textMuted} onPress={() => {}} />
      </View>

      <View style={styles.infoSection}>
        <InfoRow label="Category" value={file.category} />
        <InfoRow label="Extension" value={file.extension} />
        <InfoRow label="Size" value={file.size_bytes ? `${file.size_bytes} bytes` : '—'} />
        {file.reason && <InfoRow label="Note" value={file.reason} />}
      </View>
    </SafeAreaView>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onPress,
  color,
}: {
  icon: React.ComponentType<any>;
  label: string;
  onPress: () => void;
  color: string;
}) {
  return (
    <TouchableOpacity
      style={styles.actionBtn}
      onPress={onPress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon color={color} size={20} strokeWidth={1.5} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fileName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  filePath: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    ...shadow.sm,
  },
  actionLabel: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  infoSection: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  infoValue: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: '500',
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.base,
    padding: spacing.md,
  },
});
