/**
 * Activity screen — grouped history of commands, indexing, file actions,
 * and device events. Privacy-safe: content-free audit records.
 * Per react-native-ui-ux-plan.md §4F.
 */
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, borderRadius, shadow } from '@/theme/tokens';
import { EmptyState } from '@/components/EmptyState';
import { useFileAudit } from '@/features/files/fileService';
import { formatDateRelative } from '@/utils/formatters';
import { Search, Filter, FileText, Edit3, Undo2, FolderUp, Eye } from 'lucide-react-native';

const ACTIVITY_FILTERS = ['All', 'Commands', 'Indexing', 'File actions', 'Devices', 'Errors'] as const;

const EVENT_ICON: Record<string, React.ComponentType<any>> = {
  preview: Eye,
  open: FileText,
  edit_proposed: Edit3,
  edit_applied: Edit3,
  edit_undone: Undo2,
  index_folder: FolderUp,
};

function getEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    preview: 'Previewed file',
    open: 'Opened file',
    edit_proposed: 'Proposed edit',
    edit_applied: 'Applied edit',
    edit_undone: 'Undid edit',
    index_folder: 'Indexed folder',
    index_web: 'Indexed web page',
  };
  return labels[eventType] || eventType.replace(/_/g, ' ');
}

function getEventColor(outcome: string): string {
  if (outcome === 'success') return colors.local;
  if (outcome === 'blocked' || outcome === 'conflict') return colors.danger;
  return colors.online;
}

export default function ActivityScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  const { data, isLoading, isError } = useFileAudit();
  const events = data?.results || [];

  const filtered = useMemo(() => {
    let result = events;
    if (searchQuery) {
      result = result.filter((e) =>
        e.event_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.file_name?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }
    if (activeFilter !== 'All') {
      const filterLower = activeFilter.toLowerCase();
      result = result.filter((e) => e.event_type?.toLowerCase().includes(filterLower.replace(' ', '_')));
    }
    return result;
  }, [events, searchQuery, activeFilter]);

  const renderItem = ({ item }: { item: typeof events[0] }) => {
    const Icon = EVENT_ICON[item.event_type || ''] || FileText;
    const color = getEventColor(item.outcome || 'success');
    const label = getEventLabel(item.event_type || '');
    return (
      <View style={styles.eventCard}>
        <View style={[styles.eventIcon, { backgroundColor: `${color}20` }]}>
          <Icon color={color} size={16} strokeWidth={1.5} />
        </View>
        <View style={styles.eventContent}>
          <Text style={styles.eventLabel}>{label}</Text>
          {item.file_name && <Text style={styles.eventFile}>{item.file_name}</Text>}
          <Text style={styles.eventTime}>{formatDateRelative(item.created_at || '')}</Text>
        </View>
        <View style={[styles.outcomeBadge, { backgroundColor: `${color}20` }]}>
          <Text style={[styles.outcomeText, { color }]}>{item.outcome}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.searchWrapper}>
          <Search color={colors.textMuted} size={16} strokeWidth={1.5} style={styles.searchIcon} />
          <View style={[styles.searchInput, { height: 40 }]}>
            <Text style={styles.searchPlaceholder}>Search activity…</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => {}}
          accessible
          accessibilityLabel="Filter activity"
        >
          <Filter color={colors.textMuted} size={18} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.event_id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !isLoading && !isError ? (
            <EmptyState
              icon="history"
              title="No activity yet"
              description="Completed commands, indexing, and file actions will appear here."
            />
          ) : null
        }
      />
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
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.sm,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    justifyContent: 'center',
  },
  searchPlaceholder: {
    fontSize: fontSize.base,
    color: colors.textMuted,
  },
  filterBtn: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
  },
  list: {
    paddingHorizontal: spacing.md,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.xs,
    ...shadow.sm,
  },
  eventIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventContent: {
    flex: 1,
  },
  eventLabel: {
    fontSize: fontSize.base,
    fontWeight: '500',
    color: colors.text,
  },
  eventFile: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  eventTime: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  outcomeBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  outcomeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
