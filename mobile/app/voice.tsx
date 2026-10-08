/**
 * Voice screen — push-to-talk voice input with recording state.
 * Per react-native-ui-ux-plan.md §9.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, borderRadius, shadow } from '@/theme/tokens';
import { Mic, MicOff, Send, Trash2 } from 'lucide-react-native';
import { formatDuration } from '@/utils/formatters';
import { useComposerStore, type Message } from '@/stores/composerStore';

export default function VoiceScreen() {
  const { addMessage } = useComposerStore();
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  const startRecording = useCallback(() => {
    setIsRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);
    // Simulate recording for demo — in production, call expo-av
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setIsRecording(false);
    // Simulate transcription — in production, upload to /api/transcribe
    setTranscript('This is a simulated voice transcript from the recording.');
  }, []);

  const handleSendTranscript = useCallback(() => {
    if (!transcript.trim()) return;
    addMessage({
      role: 'user',
      content: transcript,
      status: 'complete',
    });
    setTranscript('');
    // The Ask screen would pick this up — for now just navigate back
  }, [transcript, addMessage]);

  const handlePressIn = () => {
    startRecording();
  };

  const handlePressOut = () => {
    stopRecording();
  };

  const handleCancel = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setIsRecording(false);
    setElapsed(0);
    Alert.alert('Cancelled', 'Recording cancelled.');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Text style={styles.title}>Push to Talk</Text>
      <Text style={styles.instructions}>
        Press and hold the microphone. Release to transcribe.
      </Text>

      {/* Mic button */}
      <View style={styles.micContainer}>
        <TouchableOpacity
          style={[
            styles.micButton,
            isRecording && styles.micButtonRecording,
            !isRecording && shadow.sm,
          ]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          delayPressIn={0}
          delayPressOut={100}
        >
          {isRecording ? (
            <Mic color={colors.danger} size={48} strokeWidth={1.5} />
          ) : (
            <Mic color={colors.textMuted} size={48} strokeWidth={1.5} />
          )}
          {isRecording && <View style={styles.recordingDot} />}
        </TouchableOpacity>

        <Text style={styles.duration}>{formatDuration(elapsed)}</Text>
      </View>

      {/* Transcript preview */}
      {transcript ? (
        <View style={styles.transcriptBox}>
          <Text style={styles.transcript}>{transcript}</Text>
          <View style={styles.transcriptActions}>
            <TouchableOpacity style={styles.transcriptBtn} onPress={handleCancel}>
              <Trash2 color={colors.textMuted} size={18} strokeWidth={1.5} />
              <Text style={styles.transcriptBtnText}>Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.transcriptBtn, styles.transcriptBtnPrimary]} onPress={handleSendTranscript}>
              <Send color={colors.background} size={18} strokeWidth={1.5} />
              <Text style={styles.transcriptBtnTextPrimary}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={styles.noTranscript}>Release the microphone to see the transcript.</Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    padding: spacing.md,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  instructions: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  micContainer: {
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.xl,
  },
  micButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...shadow.lg,
  },
  micButtonRecording: {
    backgroundColor: `${colors.danger}10`,
    borderColor: colors.danger,
    borderWidth: 2,
  },
  recordingDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.danger,
  },
  duration: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.text,
    fontFamily: 'monospace',
  },
  transcriptBox: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    width: '100%',
    ...shadow.sm,
  },
  transcript: {
    fontSize: fontSize.base,
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  transcriptActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  transcriptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
  transcriptBtnPrimary: {
    backgroundColor: colors.local,
  },
  transcriptBtnText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  transcriptBtnTextPrimary: {
    fontSize: fontSize.sm,
    color: colors.background,
    fontWeight: '600',
  },
  noTranscript: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
