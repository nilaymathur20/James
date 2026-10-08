/**
 * StatusTimeline — shows the live WebSocket status phases.
 * Per react-native-ui-ux-plan.md §4A: human-readable phases like
 * "Routing → Searching local index → Preparing result".
 */
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '@/theme/tokens';

export interface StatusStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'complete' | 'error';
}

interface StatusTimelineProps {
  steps: StatusStep[];
  currentStep?: string;
  onReduceMotion?: boolean;
}

export function StatusTimeline({ steps, currentStep, onReduceMotion = false }: StatusTimelineProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <View style={styles.container} pointerEvents="none">
      {steps.map((step, index) => {
        const isComplete = step.status === 'complete';
        const isActive = step.status === 'active' || (index === currentIndex && step.status === 'pending');
        const isPending = step.status === 'pending' && index > currentIndex;
        const showDot = isComplete || isActive;

        return (
          <View key={step.id} style={styles.stepRow}>
            {/* Line + dot column */}
            <View style={styles.lineColumn}>
              {index > 0 && <View style={[styles.line, !isComplete && styles.lineDashed]} />}
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: isComplete
                      ? colors.local
                      : isActive
                        ? colors.accent
                        : colors.border,
                    opacity: isPending ? 0.4 : 1,
                  },
                ]}
              />
              {index < steps.length - 1 && (
                <View style={[styles.line, !isComplete && styles.lineDashed, { top: 16 }]} />
              )}
            </View>

            {/* Label */}
            <View style={styles.labelColumn}>
              <Text
                style={[
                  styles.stepLabel,
                  {
                    color: isComplete ? colors.text : isActive ? colors.accent : colors.textMuted,
                    fontWeight: isActive ? '600' : '400',
                  },
                ]}
              >
                {step.label}
              </Text>
              {isPending && <Text style={styles.pendingHint}>Waiting…</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  lineColumn: {
    width: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  line: {
    position: 'absolute',
    left: 7,
    width: 2,
    height: 40,
    backgroundColor: colors.local,
    zIndex: 0,
  },
  lineDashed: {
    backgroundColor: colors.border,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    zIndex: 1,
  },
  labelColumn: {
    flex: 1,
    paddingBottom: spacing.sm,
  },
  stepLabel: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  pendingHint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
});
