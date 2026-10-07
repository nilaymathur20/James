/**
 * Ask screen — primary one-box command center.
 * Header shows James status + privacy badge.
 * Below: conversation/activity stream with ResponseCards.
 * Bottom: Composer with live status timeline.
 * Per react-native-ui-ux-plan.md §4A.
 */
import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, borderRadius } from '@/theme/tokens';
import { PrivacyBadge } from '@/components/PrivacyBadge';
import { Composer } from '@/components/Composer';
import { ResponseCard } from '@/components/ResponseCard';
import { StatusTimeline } from '@/components/StatusTimeline';
import { useAssistant } from '@/features/assistant/useAssistant';
import { mockTransport } from '@/services/mockTransport';
import { useComposerStore } from '@/stores/composerStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useBackendHealth } from '@/features/assistant/connectionService';

const STATUS_PHASES: Record<string, string> = {
  routing: 'Routing',
  validating_folder: 'Validating folder',
  validating_url: 'Validating URL',
  searching: 'Searching index',
  retrieving: 'Retrieving local context',
  preparing: 'Preparing result',
  answering: 'Preparing response',
  sending: 'Sending request',
  connected: 'Connected',
  complete: 'Complete',
};

export default function AskScreen() {
  const { messages, status, lastEvent, error, activeRequestId, clearError } = useComposerStore();
  const { backendUrl } = useSessionStore();

  const { send, reconnect, transportState, liveStatus } = useAssistant({
    useMock: !backendUrl,
    mockTransport: backendUrl ? undefined : mockTransport,
  });

  // Check backend health
  const health = useBackendHealth(!!backendUrl && backendUrl !== '/api');
  const isOnline = health.isOnline;
  const backendAvailable = isOnline || (backendUrl && !health.isOffline);

  // Build timeline steps from lastEvent
  const timelineSteps = useMemo(() => {
    const steps: { id: string; label: string; status: 'pending' | 'active' | 'complete' }[] = [
      { id: 'routing', label: STATUS_PHASES.routing, status: 'complete' },
      { id: 'retrieving', label: STATUS_PHASES.retrieving, status: 'pending' },
      { id: 'answering', label: STATUS_PHASES.answering, status: 'pending' },
      { id: 'complete', label: STATUS_PHASES.complete, status: 'pending' },
    ];
    if (lastEvent) {
      const phase =
        lastEvent.type === 'assistant_status' ? (lastEvent.phase || 'routing') : lastEvent.type;
      const idx = steps.findIndex((s) => s.id === phase);
      if (idx >= 0) {
        steps[idx].status = 'active';
        for (let i = 0; i < idx; i++) steps[i].status = 'complete';
      }
    }
    return steps;
  }, [lastEvent]);

  const showTimeline = activeRequestId && (status === 'sending' || status === 'connected');
  const JamesStatus = backendAvailable
    ? transportState === 'connected'
      ? 'Ready'
      : 'Working'
    : 'Offline';

  const handleSend = (text: string, opts?: { source?: 'typed' | 'voice' }) => {
    clearError();
    send(text, opts);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerLeft, { gap: spacing.sm }]}>
          <View style={[styles.statusDot, statusDotColor(transportState)]} />
          <View>
            <Text style={styles.title}>James</Text>
            <Text style={styles.subtitle}>{JamesStatus}</Text>
          </View>
        </View>
        <PrivacyBadge variant={isOnline ? 'local' : 'default'} explicit={true} />
      </View>

      {/* Progress indicator when streaming */}
      {transportState === 'connecting' && <LinearProgress />}

      {/* Conversation stream */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ResponseCard
            content={item.content}
            role={item.role}
            isLocal={item.isLocal ?? item.role === 'assistant'}
            mode={item.mode}
            sources={item.sources}
          />
        )}
        contentContainerStyle={styles.conversation}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Ask James about your files, indexing, or voice input.</Text>
          </View>
        }
      />

      {/* Live status timeline */}
      {showTimeline && (
        <View style={styles.timelineContainer}>
          <StatusTimeline steps={timelineSteps} currentStep={lastEvent?.type || 'routing'} />
          {liveStatus && <Text style={styles.liveStatus}>{liveStatus}</Text>}
        </View>
      )}

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={reconnect}>
            <Text style={styles.retryLink}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Composer */}
      <Composer
        onSubmit={handleSend}
        disabled={status === 'sending'}
        maxSuggestions={4}
      />
    </SafeAreaView>
  );
}

// Linear progress bar (replaces react-native-paper dependency)
function LinearProgress() {
  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressTrack}>
        <View style={styles.progressFill} />
      </View>
    </View>
  );
}

function statusDotColor(state: string): object {
  switch (state) {
    case 'connected':
      return { backgroundColor: colors.local };
    case 'connecting':
      return { backgroundColor: colors.accent };
    case 'error':
      return { backgroundColor: colors.danger };
    default:
      return { backgroundColor: colors.textMuted };
  }
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  timelineContainer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
  },
  liveStatus: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: `${colors.danger}10`,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: fontSize.sm,
    flex: 1,
  },
  retryLink: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  progressContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: 0,
  },
  progressTrack: {
    height: 3,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    width: '60%',
    backgroundColor: colors.local,
    borderRadius: borderRadius.full,
  },
  conversation: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
});
