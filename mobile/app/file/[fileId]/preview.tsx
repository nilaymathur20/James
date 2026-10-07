/**
 * File preview screen — read-only content viewer with safe actions.
 * Per react-native-ui-ux-plan.md §4C.
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, borderRadius, shadow } from '@/theme/tokens';
import { PrivacyBadge } from '@/components/PrivacyBadge';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFilePreview } from '@/features/files/fileService';
import { Eye, Edit3, ExternalLink, Copy } from 'lucide-react-native';

export default function FilePreviewScreen() {
  const router = useRouter();
  const { fileId } = useLocalSearchParams<{ fileId: string }>();
  const { data, isLoading, isError, error } = useFilePreview(fileId, true);

  const handleEdit = useCallback(() => {
    if (data?.file) {
      router.push(`/file/${data.file.file_id}/edit`);
    }
  }, [data, router]);

  const handleOpen = useCallback(() => {
    // Would call open_file with confirmed flow
  }, [data]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.content}><Text style={styles.loading}>Loading preview…</Text></View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.content}>
          <Text style={styles.error}>
            {error instanceof Error ? error.message : 'File not found or unavailable.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const file = data.file;
  const isIndexed = file.category === 'indexed';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.fileName}>{file.name}</Text>
          <Text style={styles.filePath}>{file.path}</Text>
        </View>
        <PrivacyBadge variant={isIndexed ? 'local' : 'default'} explicit={true} />
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {file.can_preview && <ActionButton icon={Eye} label="Preview" onPress={() => {}} color={colors.accent} />}
        {file.can_edit && <ActionButton icon={Edit3} label="Edit" onPress={handleEdit} color={colors.local} />}
        {file.can_open && <ActionButton icon={ExternalLink} label="Open" onPress={handleOpen} color={colors.online} />}
        <ActionButton icon={Copy} label="Share" onPress={() => {}} color={colors.textMuted} />
      </View>

      {/* Content viewer */}
      {!isIndexed ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            This file is discoverable but its content is not indexed. Preview and edit require an indexed file.
          </Text>
        </View>
      ) : data.truncated ? (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator>
          <Text style={styles.content}>{data.content}</Text>
          <Text style={styles.truncatedNote}>
            Content truncated. Open the file to read the full text.
          </Text>
        </ScrollView>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator>
          <Text style={styles.content}>{data.content}</Text>
        </ScrollView>
      )}
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
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} accessible={true} accessibilityRole="button" accessibilityLabel={label}>
      <Icon color={color} size={18} strokeWidth={1.5} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
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
    fontSize: fontSize.base,
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
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
  content: {
    padding: spacing.md,
    fontSize: fontSize.sm,
    color: colors.text,
    fontFamily: 'monospace',
    lineHeight: 22,
  },
  scroll: {
    flex: 1,
  },
  loading: {
    color: colors.textMuted,
    fontSize: fontSize.base,
    padding: spacing.md,
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.base,
    padding: spacing.md,
  },
  noticeBox: {
    backgroundColor: `${colors.online}10`,
    borderLeftWidth: 3,
    borderLeftColor: colors.online,
    padding: spacing.md,
    margin: spacing.md,
    borderRadius: borderRadius.md,
  },
  noticeText: {
    color: colors.text,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  truncatedNote: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontStyle: 'italic',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
