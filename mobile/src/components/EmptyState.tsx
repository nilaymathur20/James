/**
 * EmptyState — lightweight illustration + message for empty lists/views.
 * Uses lucide-react-native icons instead of Lottie to keep bundle size down,
 * per react-native-ui-ux-plan.md §5 library guidance.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, shadow } from '@/theme/tokens';
import {
  Search,
  FileText,
  History,
  Activity,
  Settings,
  FolderOpen,
  MessageCircle,
} from 'lucide-react-native';

type IconName = 'search' | 'file' | 'history' | 'activity' | 'settings' | 'folder' | 'message';

const ICON_MAP: Record<IconName, React.ComponentType<any>> = {
  search: Search,
  file: FileText,
  history: History,
  activity: Activity,
  settings: Settings,
  folder: FolderOpen,
  message: MessageCircle,
};

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: React.ReactNode;
}

export function EmptyState({
  icon = 'message',
  title,
  description,
  action,
}: EmptyStateProps) {
  const Icon = ICON_MAP[icon];
  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <Icon color={colors.textMuted} size={48} strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  description: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
});
