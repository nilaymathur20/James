/**
 * Voice feature — recording + transcription hook.
 * Per react-native-ui-ux-plan.md §9 (Voice UX) and §6 (features/voice).
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useComposerStore } from '@/stores/composerStore';

export type VoiceState = 'idle' | 'requesting_permission' | 'recording' | 'transcribing' | 'ready' | 'error';

export interface VoiceHookResult {
  state: VoiceState;
  elapsed: number;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  cancel: () => void;
  transcript: string;
  error: string | null;
}

export function useVoice(): VoiceHookResult {
  const [state, setState] = useState<VoiceState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { addMessage } = useComposerStore();

  const transcribeMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const resp = await fetch(`${process.env.JAMES_API_URL || '/api'}/transcribe`, {
        method: 'POST',
        body: formData,
      });
      if (!resp.ok) throw new Error('Transcription failed');
      return resp.json();
    },
    onMutate: () => {
      setState('transcribing');
      setError(null);
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Transcription failed');
      setState('error');
    },
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const start = useCallback(async () => {
    setState('requesting_permission');
    setError(null);
    setTranscript('');

    try {
      // In production: call expo-av to start recording
      // For now, simulate
      setState('recording');
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((s) => s + 1);
      }, 1000);
    } catch (err: unknown) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Could not start recording.');
    }
  }, []);

  const stop = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setState('ready');

    try {
      // Simulate transcription
      const mockTranscript = 'This is a simulated voice transcript.';
      setTranscript(mockTranscript);
      setState('idle');
    } catch (err: unknown) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Transcription failed.');
    }
  }, []);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setState('idle');
    setElapsed(0);
    setTranscript('');
  }, []);

  return { state, elapsed, start, stop, cancel, transcript, error };
}
