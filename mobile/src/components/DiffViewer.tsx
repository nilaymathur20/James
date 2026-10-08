/**
 * DiffViewer — renders a unified diff (additions/deletions) for the
 * edit proposal review flow. Per react-native-ui-ux-plan.md §4D.
 * Uses simple text styling instead of react-native-render-html to keep
 * dependencies minimal; sanitization happens server-side.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { colors, spacing, fontSize, borderRadius, shadow } from '@/theme/tokens';
import { Check, X, FileText } from 'lucide-react-native';

interface DiffViewerProps {
  /** Raw unified diff string (from the backend diff field). */
  diff: string;
  fileName?: string;
  maxHeight?: number;
  showHeader?: boolean;
}

interface DiffLine {
  type: 'add' | 'del' | 'context' | 'hunk' | 'meta';
  content: string;
  lineNumber: number;
}

export function DiffViewer({ diff, fileName, maxHeight = 300, showHeader = true }: DiffViewerProps) {
  const lines = useMemo(() => parseDiff(diff), [diff]);

  const addedLines = lines.filter((l) => l.type === 'add').length;
  const removedLines = lines.filter((l) => l.type === 'del').length;

  return (
    <View style={[styles.container, { maxHeight: maxHeight + (showHeader ? 60 : 0) }]}>
      {showHeader && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <FileText color={colors.textMuted} size={16} strokeWidth={1.5} />
            <Text style={styles.fileName}>{fileName || 'Untitled'}</Text>
          </View>
          <View style={styles.stats}>
            <StatBadge label="+" value={addedLines} color={colors.local} />
            <StatBadge label="−" value={removedLines} color={colors.danger} />
          </View>
        </View>
      )}

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator>
        {lines.map((line, i) => (
          <DiffLineView key={i} line={line} />
        ))}
      </ScrollView>
    </View>
  );
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statBadge, { backgroundColor: `${color}20` }]}>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

function backgroundColorFor(type: DiffLine['type']): string {
  switch (type) {
    case 'add': return `${colors.local}0A`;
    case 'del': return `${colors.danger}0A`;
    case 'hunk': return `${colors.surfaceRaised}40`;
    default: return 'transparent';
  }
}

function DiffLineView({ line }: { line: DiffLine }) {
  let style = styles.contextLine;
  let dotColor: string = colors.border;

  switch (line.type) {
    case 'add':
      style = styles.addLine;
      dotColor = colors.local;
      break;
    case 'del':
      style = styles.delLine;
      dotColor = colors.danger;
      break;
    case 'hunk':
      style = styles.hunkLine;
      dotColor = colors.textMuted;
      break;
  }

  return (
    <View style={style}>
      <View style={[styles.lineNumberCol, { backgroundColor: backgroundColorFor(line.type) }]}>
        {line.lineNumber > 0 && <Text style={styles.lineNumber}>{line.lineNumber}</Text>}
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
      </View>
      <Text style={[styles.lineText, line.type === 'add' && styles.addText, line.type === 'del' && styles.delText]}>
        {line.content}
      </Text>
    </View>
  );
}

function parseDiff(diff: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let leftNum = 0;
  let rightNum = 0;
  let hasStarted = false;

  for (const raw of diff.split('\n')) {
    if (raw.startsWith('diff ') || raw.startsWith('index ')) {
      lines.push({ type: 'meta', content: raw, lineNumber: 0 });
      hasStarted = false;
      leftNum = 0;
      rightNum = 0;
      continue;
    }
    if (raw.startsWith('--- ')) {
      lines.push({ type: 'meta', content: raw, lineNumber: 0 });
      continue;
    }
    if (raw.startsWith('+++ ')) {
      lines.push({ type: 'meta', content: raw, lineNumber: 0 });
      continue;
    }
    if (raw.startsWith('@@')) {
      const match = raw.match(/@@ -?(\d+),?(\d*) \+?(\d+),?(\d*)/);
      if (match) {
        leftNum = parseInt(match[1], 10);
        rightNum = parseInt(match[3], 10);
        hasStarted = true;
      }
      lines.push({ type: 'hunk', content: raw, lineNumber: 0 });
      continue;
    }
    if (!hasStarted) {
      if (raw.startsWith(' ')) {
        lines.push({ type: 'context', content: raw.slice(1), lineNumber: 0 });
      }
      continue;
    }
    if (raw.startsWith('+')) {
      lines.push({ type: 'add', content: raw.slice(1), lineNumber: rightNum });
      rightNum += 1;
    } else if (raw.startsWith('-')) {
      lines.push({ type: 'del', content: raw.slice(1), lineNumber: leftNum });
      leftNum += 1;
    } else if (raw.startsWith(' ')) {
      lines.push({ type: 'context', content: raw.slice(1), lineNumber: rightNum });
      leftNum += 1;
      rightNum += 1;
    } else if (raw === '\\ No newline at end of file') {
      lines.push({ type: 'meta', content: raw, lineNumber: 0 });
    } else {
      lines.push({ type: 'context', content: raw, lineNumber: 0 });
    }
  }

  return lines;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadow.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fileName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  statValue: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  scroll: {
    maxHeight: 280,
  },
  lineNumberCol: {
    width: 44,
    alignItems: 'flex-end',
    paddingRight: spacing.xs,
    paddingTop: 2,
  },
  lineNumber: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
  lineText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flexShrink: 1,
    lineHeight: 18,
  },
  addText: {
    color: colors.local,
  },
  delText: {
    color: colors.danger,
  },
  contextLine: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
  },
  addLine: {
    flexDirection: 'row',
    backgroundColor: `${colors.local}0A`,
  },
  delLine: {
    flexDirection: 'row',
    backgroundColor: `${colors.danger}0A`,
  },
  hunkLine: {
    flexDirection: 'row',
    backgroundColor: `${colors.surfaceRaised}40`,
  },
});
