/**
 * FileCard — compact result card for file discovery results.
 * Shows filename, safe status badge, path, and contextual actions.
 * Per react-native-ui-ux-plan.md §4B.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { colors, spacing, fontSize, borderRadius, shadow } from '@/theme/tokens';
import { FileText, Folder, ExternalLink, Edit3, Eye } from 'lucide-react-native';
import type { FileMetadata } from '@/schemas/files';

interface FileCardProps {
  file: FileMetadata;
  onPress?: () => void;
  onPreview?: () => void;
  onEdit?: () => void;
  onOpen?: () => void;
}

const CATEGORY_ICON: Record<string, React.ComponentType<any>> = {
  indexed: FileText,
  discoverable: Folder,
};

const CATEGORY_LABEL: Record<string, string> = {
  indexed: 'Indexed',
  discoverable: 'Discoverable',
  protected: 'Protected',
  ignored: 'Ignored',
};

const CATEGORY_COLOR: Record<string, string> = {
  indexed: colors.local,
  discoverable: colors.accent,
  protected: colors.danger,
  ignored: colors.textMuted,
};

export function FileCard({ file, onPress, onPreview, onEdit, onOpen }: FileCardProps) {
  const Icon = CATEGORY_ICON[file.category] || FileText;
  const label = CATEGORY_LABEL[file.category] || file.category;
  const badgeColor = CATEGORY_COLOR[file.category] || colors.textMuted;
  const isIndexed = file.category === 'indexed';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`${file.name}, ${label} content`}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Icon color={badgeColor} size={18} strokeWidth={1.5} style={styles.icon} />
          <Text style={styles.fileName} numberOfLines={1}>
            {file.name}
          </Text>
        </View>

        <View style={[styles.badge, { backgroundColor: `${badgeColor}20` }]}>
          <Text style={[styles.badgeText, { color: badgeColor }]}>{label}</Text>
        </View>
      </View>

      <Text style={styles.path} numberOfLines={1}>
        {file.path}
      </Text>

      {!isIndexed && (
        <View style={styles.warningRow}>
          <FileText color={colors.textMuted} size={12} strokeWidth={1.5} />
          <Text style={styles.warningText}>
            {file.reason || 'Content is not indexed; metadata only.'}
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        {file.can_preview && (
          <ActionButton icon={Eye} label="Preview" onPress={onPreview} color={colors.accent} />
        )}
        {file.can_open && (
          <ActionButton icon={ExternalLink} label="Open" onPress={onOpen} color={colors.online} />
        )}
        {file.can_edit && (
          <ActionButton icon={Edit3} label="Edit" onPress={onEdit} color={colors.local} />
        )}
      </View>
    </TouchableOpacity>
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
  onPress?: () => void;
  color: string;
}) {
  if (!onPress) return null;
  return (
    <TouchableOpacity
      style={styles.actionBtn}
      onPress={onPress}
      hitSlop={8}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon color={color} size={14} strokeWidth={2} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.xs,
    ...shadow.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  icon: {
    width: 20,
    alignItems: 'center',
  },
  fileName: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  path: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  warningText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: `${colors.background}80`,
  },
  actionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
});
