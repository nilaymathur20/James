import React, { useRef, useState, useCallback } from "react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useComposerState, placeholderText, isSendDisabled, isInputDisabled } from "@/hooks/useComposerState";
import { AttachIcon, MicIcon, StopIcon } from "@/icons";
import { api } from "@/services/apiClient";

interface BlobPresenceProps {
  state: "idle" | "listening" | "thinking" | "speaking" | "error";
}

function BlobPresence({ state }: BlobPresenceProps) {
  return (
    <span className="blob-indicator" aria-label={`Status: ${state}`} title={state}>
      <span className={`blob-dot blob-dot--${state}`} />
      <span className={`blob-morph blob-morph--${state}`} />
    </span>
  );
}

// Spam protection: minimum interval between sends (ms)
const MIN_SEND_INTERVAL = 1000;
// Max input length to prevent abuse
const MAX_INPUT_LENGTH = 20000;

interface ComposerProps {
  input: string;
  onChangeInput: (value: string) => void;
  onSend: (text: string, source?: "typed" | "voice") => void;
  onCancel?: () => void;
  sending: boolean;
  useHistory: boolean;
  onChangeUseHistory: (value: boolean) => void;
  historyAvailable: boolean;
  onClearScreen: () => void;
  onImageAttached?: (file: File) => void;
  blobState?: "idle" | "listening" | "thinking" | "speaking" | "error";
}

export const Composer: React.FC<ComposerProps> = ({
  input,
  onChangeInput,
  onSend,
  onCancel,
  sending,
  useHistory,
  onChangeUseHistory,
  historyAvailable,
  onClearScreen,
  onImageAttached,
  blobState = "idle",
}) => {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastSendRef = useRef<number>(0);
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const [transcribing, setTranscribing] = useState(false);
  const [composerState, composerActions] = useComposerState();

  const handleSubmit = useCallback((event?: React.FormEvent) => {
    event?.preventDefault();
    const text = input.trim();
    if (!text || sending || isSendDisabled(composerState)) return;

    // Spam protection: enforce minimum interval between sends
    const now = Date.now();
    if (now - lastSendRef.current < MIN_SEND_INTERVAL) return;
    lastSendRef.current = now;

    // Spam protection: enforce max input length
    if (text.length > MAX_INPUT_LENGTH) return;

    onSend(text, "typed");
  }, [input, sending, composerState, onSend]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleVoiceToggle = async () => {
    // Use backend whisper.cpp transcription
    if (isRecording) {
      const audioBlob = await stopRecording();
      if (audioBlob) {
        composerActions.startTranscribing();
        setTranscribing(true);
        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, "recording.webm");
          const res = await api<{ text: string }>("/transcribe", {
            method: "POST",
            body: formData,
          });
          if (res.text) {
            onSend(res.text, "voice");
          }
        } catch (err) {
          console.error("Transcription failed:", err);
          alert(`Voice transcription failed: ${err instanceof Error ? err.message : "Unknown error"}`);
        } finally {
          setTranscribing(false);
          composerActions.endTranscribing();
        }
      }
      composerActions.endRecording();
    } else {
      composerActions.startRecording();
      const started = await startRecording();
      if (!started) {
        composerActions.endRecording();
        alert("Could not start recording. Please allow microphone access.");
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onImageAttached) {
      onImageAttached(file);
    }
  };

  const disabled = isInputDisabled(composerState) || sending;

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="assistant-input">
        Ask James
      </label>
      <div className="composer-input-row">
        <BlobPresence state={blobState} />
        <textarea
          ref={inputRef}
          id="assistant-input"
          rows={1}
          value={input}
          onChange={(e) => onChangeInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholderText(composerState)}
          disabled={disabled}
        />

        <div className="composer-button-group">
          {sending && onCancel ? (
            <button
              type="button"
              className="composer-action-btn stop-btn"
              onClick={onCancel}
              title="Stop generation"
              aria-label="Stop generation"
            >
              <StopIcon size={16} />
            </button>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="composer-action-btn attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach image for vision query"
            disabled={isSendDisabled(composerState)}
            aria-label="Attach image"
          >
            <AttachIcon size={18} />
          </button>

          <button
            type="button"
            className={`composer-action-btn voice-btn ${isRecording ? "recording" : ""}`}
            onClick={handleVoiceToggle}
            title={isRecording ? "Stop recording" : "Record voice (Whisper)"}
            disabled={isSendDisabled(composerState)}
            aria-label={isRecording ? "Stop recording" : "Start recording"}
          >
            {isRecording ? <StopIcon size={16} /> : <MicIcon size={16} />}
          </button>

          <button
            className="send"
            type="submit"
            disabled={sending || isSendDisabled(composerState) || !input.trim() || isRecording || transcribing}
            aria-label="Send message"
          >
            {sending ? (
              <span className="spinner" aria-label="Sending" />
            ) : (
              <>
                <span>Send</span>
                <b aria-hidden="true">↑</b>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="composer-footer">
        <span>
          Click <MicIcon size={10} /> to speak (Whisper)
        </span>
        <label
          className="history-toggle"
          title="When enabled, this request may read and save local chat history."
        >
          <input
            type="checkbox"
            checked={useHistory}
            onChange={(event) => onChangeUseHistory(event.target.checked)}
            disabled={!historyAvailable}
          />
          Save/use local history
        </label>
        <span>Enter to send · Shift + Enter for newline</span>
        <button type="button" className="clear" onClick={onClearScreen}>
          Clear screen
        </button>
      </div>
    </form>
  );
};