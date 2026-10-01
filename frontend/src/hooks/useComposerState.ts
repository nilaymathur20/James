import { useCallback, useState } from "react";

export type ComposerState =
  | "idle"
  | "composing"
  | "sending"
  | "recording"
  | "transcribing"
  | "awaiting_confirmation";

interface ComposerActions {
  startSending: () => void;
  endSending: () => void;
  startRecording: () => void;
  endRecording: () => void;
  startTranscribing: () => void;
  endTranscribing: () => void;
  startAwaitingConfirmation: () => void;
  endAwaitingConfirmation: () => void;
  setComposing: (value: boolean) => void;
  reset: () => void;
}

export function useComposerState(): [ComposerState, ComposerActions] {
  const [state, setState] = useState<ComposerState>("idle");

  const startSending = useCallback(() => setState("sending"), []);
  const endSending = useCallback(() => setState((s) => (s === "sending" ? "idle" : s)), []);
  const startRecording = useCallback(() => setState("recording"), []);
  const endRecording = useCallback(() => setState((s) => (s === "recording" ? "idle" : s)), []);
  const startTranscribing = useCallback(() => setState("transcribing"), []);
  const endTranscribing = useCallback(
    () => setState((s) => (s === "transcribing" ? "idle" : s)),
    []
  );
  const startAwaitingConfirmation = useCallback(() => setState("awaiting_confirmation"), []);
  const endAwaitingConfirmation = useCallback(
    () => setState((s) => (s === "awaiting_confirmation" ? "idle" : s)),
    []
  );
  const setComposing = useCallback(
    (value: boolean) => {
      setState((s) => {
        if (value && s === "idle") return "composing";
        if (!value && s === "composing") return "idle";
        return s;
      });
    },
    []
  );
  const reset = useCallback(() => setState("idle"), []);

  return [
    state,
    {
      startSending,
      endSending,
      startRecording,
      endRecording,
      startTranscribing,
      endTranscribing,
      startAwaitingConfirmation,
      endAwaitingConfirmation,
      setComposing,
      reset,
    },
  ];
}

// Derived state helpers
export function isSendDisabled(state: ComposerState): boolean {
  return state === "sending" || state === "recording" || state === "transcribing";
}

export function isInputDisabled(state: ComposerState): boolean {
  return state === "sending" || state === "recording" || state === "transcribing";
}

export function isVoiceActive(state: ComposerState): boolean {
  return state === "recording" || state === "transcribing";
}

export function placeholderText(state: ComposerState): string {
  switch (state) {
    case "recording":
      return "Listening... Speak your command...";
    case "transcribing":
      return "Transcribing voice with local Vosk...";
    default:
      return "Ask, search, index, or command…";
  }
}