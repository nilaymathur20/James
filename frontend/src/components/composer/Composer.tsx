import React, { useRef, useState } from "react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useComposerState, placeholderText, isSendDisabled, isInputDisabled } from "@/hooks/useComposerState";
import { AttachIcon, MicIcon, StopIcon } from "@/icons";
import { api } from "@/services/apiClient";

interface ComposerProps {
  input: string;
  onChangeInput: (value: string) => void;
  onSend: (text: string, source?: "typed" | "voice") => void;
  sending: boolean;
  useHistory: boolean;
  onChangeUseHistory: (value: boolean) => void;
  historyAvailable: boolean;
  onClearScreen: () => void;
  onImageAttached?: (file: File) => void;
}

export const Composer: React.FC<ComposerProps> = ({
  input,
  onChangeInput,
  onSend,
  sending,
  useHistory,
  onChangeUseHistory,
  historyAvailable,
  onClearScreen,
  onImageAttached,
}) => {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const [transcribing, setTranscribing] = useState(false);
  const [composerState, composerActions] = useComposerState();

  const handleSubmit = (event?: React.FormEvent) => {
    event?.preventDefault();
    const text = input.trim();
    if (!text || isSendDisabled(composerState)) return;
    composerActions.startSending();
    onSend(text, "typed");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleVoiceToggle = async () => {
    if (isRecording) {
      const audioBlob = await stopRecording();
      if (audioBlob) {
        composerActions.startTranscribing();
        setTranscribing(true);
        try {
          const formData = new FormData();
          formData.append("file", audioBlob, "recording.webm");
          const res = await api<{ text: string }>("/transcribe", {
            method: "POST",
            body: formData,
          });
          if (res.text) {
            onSend(res.text, "voice");
          }
        } catch {
          // Keep input intact if transcription fails
        } finally {
          setTranscribing(false);
          composerActions.endTranscribing();
        }
      }
      composerActions.endRecording();
    } else {
      composerActions.startRecording();
      await startRecording();
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
            title={isRecording ? "Stop recording" : "Push-to-talk (Vosk STT)"}
            disabled={isSendDisabled(composerState)}
            aria-label={isRecording ? "Stop recording" : "Start recording"}
          >
            {isRecording ? <StopIcon size={16} /> : <MicIcon size={16} />}
          </button>

          <button
            className="send"
            type="submit"
            disabled={isSendDisabled(composerState) || !input.trim() || isRecording || transcribing}
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
          <kbd>`</kbd> Push-to-talk or click <MicIcon size={10} />
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