/**
 * Indexing screen — shows progress when a folder is being indexed.
 * Per react-native-ui-ux-plan.md §4E.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, borderRadius, shadow } from '@/theme/tokens';
import { FolderUp, X } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFileAudit } from '@/features/files/fileService';

export default function IndexingScreen() {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { data, isLoading } = useFileAudit();

  const [progress, setProgress] = useState({
    phase: 'started',
    message: 'Started scanning the approved folder.',
    folder: '',
    filesSeen: 0,
    filesIndexed: 0,
    filesDiscoverable: 0,
    skippedFiles: 0,
    chunksAdded: 0,
  });

  // Simulate progress for demo
  useEffect(() => {
    const phases = ['started', 'scanning', 'extracting', 'complete'];
    let phaseIndex = 0;
    const interval = setInterval(() => {
      if (phaseIndex < phases.length - 1) {
        phaseIndex += 1;
        const phase = phases[phaseIndex];
        const messages: Record<string, string> = {
          started: 'Started scanning the approved folder.',
          scanning: 'Scanning local files…',
          extracting: 'Extracting readable text from documents.',
          complete: 'Folder scan complete.',
        };
        setProgress((p) => ({
          ...p,
          phase,
          message: messages[phase] || '',
          filesSeen: phaseIndex * 15,
          filesIndexed: phaseIndex * 12,
          filesDiscoverable: phaseIndex * 2,
          chunksAdded: phaseIndex * 40,
        }));
      } else {
        clearInterval(interval);
      }
    }, 800);
    return () => clearInterval(interval);
  }, []);

  const progressPercent = progress.phase === 'complete' ? 100 : Math.min(95, progress.filesSeen * 2);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Indexing</Text>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.back()}
          accessible
          accessibilityLabel="Close"
          accessibilityRole="button"
        >
          <X color={colors.textMuted} size={20} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.folderRow}>
          <FolderUp color={colors.accent} size={20} strokeWidth={1.5} />
          <Text style={styles.folderPath}>
            {progress.folder || '/home/user/documents'}
          </Text>
        </View>

        <Text style={styles.phaseText}>{progress.message}</Text>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>

        <View style={styles.stats}>
          <Stat label="Files scanned" value={progress.filesSeen} />
          <Stat label="Indexed" value={progress.filesIndexed} color={colors.local} />
          <Stat label="Discoverable" value={progress.filesDiscoverable} color={colors.accent} />
          <Stat label="Skipped" value={progress.skippedFiles} color={colors.danger} />
          <Stat label="Chunks added" value={progress.chunksAdded} />
        </View>

        {progress.phase === 'complete' && (
          <TouchableOpacity
            style={styles.viewBtn}
            onPress={() => router.push('/(tabs)/library')}
          >
            <Text style={styles.viewBtnText}>View library</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color && { color }]}>{value}</Text>
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
  title: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  closeBtn: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
  },
  content: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadow.sm,
  },
  folderPath: {
    fontSize: fontSize.base,
    color: colors.text,
    fontFamily: 'monospace',
  },
  phaseText: {
    fontSize: fontSize.base,
    color: colors.text,
    lineHeight: 22,
  },
  progressBar: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    height: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.local,
    borderRadius: borderRadius.full,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  stat: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    minWidth: 80,
    alignItems: 'center',
    ...shadow.sm,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  viewBtn: {
    backgroundColor: colors.local,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    ...shadow.sm,
  },
  viewBtnText: {
    color: colors.background,
    fontSize: fontSize.base,
    fontWeight: '600',
  },
});
