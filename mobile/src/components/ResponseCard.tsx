/**
 * ResponseCard — compact assistant response card.
 * Shows a short answer, source chips, and a local/online label.
 * Per react-native-ui-ux-plan.md §4A: concise and expandable.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, fontSize, borderRadius, shadow } from '@/theme/tokens';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react-native';
import { formatNumber } from '@/utils/formatters';

export interface SourceChip {
  source: string;
  snippet?: string;
  score?: number;
}

export interface ResponseCardProps {
  content: string;
  role: 'user' | 'assistant';
  isLocal?: boolean;
  mode?: string;
  sources?: SourceChip[];
  onSourcePress?: (source: string) => void;
}

export function ResponseCard({
  content,
  role,
  isLocal = true,
  mode,
  sources = [],
  onSourcePress,
}: ResponseCardProps) {
  const isAssistant = role === 'assistant';
  const [expanded, setExpanded] = useState(false);
  const maxPreview = 300;
  const isLong = content.length > maxPreview;
  const displayText = isAssistant && !expanded && isLong ? content.slice(0, maxPreview) + '…' : content;

  const toggleExpand = useCallback(() => setExpanded((e) => !e), []);

  const badgeText = isLocal ? 'Local' : 'Online';
  const badgeColor = isLocal ? colors.local : colors.online;

  return (
    <View
      style={[
        styles.card,
        isAssistant ? styles.assistantCard : styles.userCard,
        { backgroundColor: isAssistant ? colors.surface : colors.accent },
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.badge, { backgroundColor: `${badgeColor}20` }]}>
          <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeText}</Text>
        </View>
        {mode && <Text style={styles.modeText}>{mode}</Text>}
      </View>

      <Text style={[styles.content, isAssistant ? styles.assistantText : styles.userText]}>
        {displayText}
      </Text>

      {isAssistant && isLong && (
        <TouchableOpacity onPress={toggleExpand} style={styles.expandBtn} hitSlop={8}>
          <Text style={styles.expandText}>{expanded ? 'Show less' : 'Show more'}</Text>
          {expanded ? (
            <ChevronUp color={colors.textMuted} size={14} strokeWidth={2} />
          ) : (
            <ChevronDown color={colors.textMuted} size={14} strokeWidth={2} />
          )}
        </TouchableOpacity>
      )}

      {isAssistant && sources.length > 0 && (
        <View style={styles.sourcesContainer}>
          {sources.slice(0, expanded ? sources.length : 3).map((source, i) => (
            <TouchableOpacity
              key={source.source + i}
              style={styles.sourceChip}
              onPress={() => onSourcePress?.(source.source)}
            >
              <Text style={styles.sourceLabel} numberOfLines={1}>
                {source.source.split('/').pop() || source.source}
              </Text>
              {source.score != null && (
                <Text style={styles.sourceScore}>{formatNumber(source.score * 100)}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginVertical: spacing.xs,
    ...shadow.sm,
  },
  assistantCard: {
    alignSelf: 'stretch',
    marginLeft: 4,
  },
  userCard: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
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
  modeText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'lowercase',
  },
  content: {
    fontSize: fontSize.base,
    lineHeight: 20,
  },
  assistantText: {
    color: colors.text,
  },
  userText: {
    color: colors.text,
    fontWeight: '500',
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  expandText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  sourcesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  sourceChip: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sourceLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    maxWidth: 120,
  },
  sourceScore: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    opacity: 0.6,
    marginLeft: 4,
  },
});
