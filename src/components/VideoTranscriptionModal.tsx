import React, { useState, useRef } from 'react';
import {
  X,
  Video,
  Mic,
  Upload,
  Copy,
  Check,
  Download,
  FileText,
  Clock,
  Sparkles,
  Play,
  RotateCcw,
  MessageSquare,
} from 'lucide-react';
import { TranscriptionRecord } from '../types/chat';

interface VideoTranscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertToChat: (text: string) => void;
  onOpenInEditor?: (title: string, content: string) => void;
}

const STORAGE_KEY_TRANSCRIPTS = 'james_transcripts_v1';

export const VideoTranscriptionModal: React.FC<VideoTranscriptionModalProps> = ({
  isOpen,
  onClose,
  onInsertToChat,
  onOpenInEditor,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number>(0);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const [history, setHistory] = useState<TranscriptionRecord[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_TRANSCRIPTS);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<any>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > 80 * 1024 * 1024) {
      setError('File size exceeds 80MB. Please select a shorter video or audio clip.');
      return;
    }

    setFile(selected);
    setError(null);

    const reader = new FileReader();
    reader.onload = () => {
      setFileBase64(reader.result as string);
    };
    reader.readAsDataURL(selected);
  };

  const startMediaRecording = async (type: 'video' | 'audio') => {
    try {
      const constraints =
        type === 'video'
          ? { video: true, audio: true }
          : { audio: true, video: false };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const chunks: BlobPart[] = [];
      const mimeType = type === 'video' ? 'video/webm' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const recordedFile = new File([blob], `recorded-${type}-${Date.now()}.webm`, {
          type: mimeType,
        });
        setFile(recordedFile);

        const reader = new FileReader();
        reader.onload = () => {
          setFileBase64(reader.result as string);
        };
        reader.readAsDataURL(blob);

        stream.getTracks().forEach((track) => track.stop());
        clearInterval(timerRef.current);
        setIsRecording(false);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setError('Could not access microphone/camera. Please grant browser permissions.');
    }
  };

  const stopMediaRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const runTranscription = async () => {
    if (!fileBase64 || !file) return;

    setIsProcessing(true);
    setError(null);
    setCurrentTranscript('');

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: fileBase64,
          mimeType: file.type || 'video/mp4',
          filename: file.name,
          customPrompt: customPrompt.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Transcription failed');
      }

      setCurrentTranscript(data.transcript);
      setDurationMs(data.durationMs || 0);

      const newRecord: TranscriptionRecord = {
        id: `trans-${Date.now()}`,
        filename: file.name,
        mimeType: file.type,
        transcript: data.transcript,
        durationMs: data.durationMs || 0,
        createdAt: Date.now(),
      };

      const updated = [newRecord, ...history.slice(0, 19)];
      setHistory(updated);
      localStorage.setItem(STORAGE_KEY_TRANSCRIPTS, JSON.stringify(updated));
    } catch (err: any) {
      setError(err.message || 'Failed to process media transcription.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentTranscript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([currentTranscript], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${file?.name || 'media'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 select-none">
      <div
        className="w-full max-w-4xl bg-[#11141c] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#141822]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-[#1a202c] border border-white/5 text-blue-400">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Video & Audio Transcription
              </h2>
              <p className="text-xs text-neutral-400">
                Transcribe recordings with timestamped subtitles, speaker tags, and summaries using Gemini 3.8 Flash.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          {/* Upload & Source Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* File Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="md:col-span-2 border border-dashed border-white/20 hover:border-blue-500 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-[#141822]/60 hover:bg-[#141822]"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,audio/mp3,audio/wav,audio/m4a,audio/webm,audio/ogg"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="w-8 h-8 text-blue-400 mb-2" />
              <span className="font-semibold text-white text-sm">
                {file ? file.name : 'Choose a video or audio file'}
              </span>
              <p className="text-xs text-neutral-400 mt-1">
                MP4, WebM, MOV, MP3, WAV, M4A up to 80MB
              </p>
              {file && (
                <div className="mt-3 flex items-center gap-2 text-[11px] font-mono text-neutral-300 bg-white/5 px-3 py-1 rounded">
                  <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                  <span>·</span>
                  <span>{file.type || 'media'}</span>
                </div>
              )}
            </div>

            {/* Quick Live Recording */}
            <div className="border border-white/10 rounded-xl p-4 bg-[#141822] flex flex-col justify-between space-y-3">
              <div>
                <span className="text-xs font-semibold text-white block">
                  Live Recording
                </span>
                <p className="text-xs text-neutral-400 mt-1">
                  Record directly from microphone or camera to transcribe.
                </p>
              </div>

              {isRecording ? (
                <div className="space-y-3 text-center">
                  <div className="flex items-center justify-center gap-2 text-rose-400 font-mono text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                    <span>Recording: {recordingSeconds}s</span>
                  </div>
                  <button
                    onClick={stopMediaRecording}
                    className="w-full py-2 px-3 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition-colors"
                  >
                    Stop and Load Recording
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => startMediaRecording('audio')}
                    className="w-full py-2 px-3 rounded-md bg-[#1a202c] hover:bg-[#222a3a] border border-white/5 text-neutral-200 text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <Mic className="w-3.5 h-3.5 text-blue-400" />
                    <span>Record Audio</span>
                  </button>
                  <button
                    onClick={() => startMediaRecording('video')}
                    className="w-full py-2 px-3 rounded-md bg-[#1a202c] hover:bg-[#222a3a] border border-white/5 text-neutral-200 text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <Video className="w-3.5 h-3.5 text-blue-400" />
                    <span>Record Video</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Optional Prompt Refinement */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-neutral-300">
              Optional transcription instructions
            </span>
            <input
              type="text"
              placeholder="e.g. Focus on technical terms, translate into English, or identify speakers by name..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#141822] border border-white/10 text-xs text-neutral-200 focus:outline-none focus:border-blue-500 placeholder:text-neutral-500 font-sans"
            />
          </div>

          {/* Action Trigger */}
          <div className="flex items-center justify-between">
            {error && <span className="text-xs text-rose-400">{error}</span>}
            <div className="ml-auto">
              <button
                onClick={runTranscription}
                disabled={!fileBase64 || isProcessing}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:pointer-events-none text-white font-medium text-xs transition-colors"
              >
                {isProcessing ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>Transcribing with Gemini 3.8 Flash...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Transcript</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Output Transcript Area */}
          {currentTranscript && (
            <div className="rounded-xl border border-white/10 bg-[#0e1118] overflow-hidden space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10 text-xs">
                <div className="flex items-center gap-2 text-neutral-400 font-mono text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>Processed in {(durationMs / 1000).toFixed(1)}s</span>
                  <span>·</span>
                  <span>{file?.name}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#171b26] border border-white/10 text-neutral-300 hover:text-white text-xs transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>

                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#171b26] border border-white/10 text-neutral-300 hover:text-white text-xs transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export (.md)</span>
                  </button>

                  {onOpenInEditor && (
                    <button
                      onClick={() => onOpenInEditor(`Transcript - ${file?.name || 'Media'}`, currentTranscript)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#171b26] border border-white/10 text-blue-400 hover:text-blue-300 text-xs transition-colors"
                    >
                      <FileText className="w-3 h-3" />
                      <span>Edit in Document Editor</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      onInsertToChat(`Here is the transcript for "${file?.name || 'media file'}":\n\n${currentTranscript}`);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>Insert to Chat</span>
                  </button>
                </div>
              </div>

              <pre className="font-mono text-xs text-neutral-200 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto p-2 bg-[#090b10] rounded border border-white/5">
                {currentTranscript}
              </pre>
            </div>
          )}

          {/* History of Past Transcripts */}
          {history.length > 0 && !currentTranscript && (
            <div className="space-y-2 pt-2 border-t border-white/5">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
                Recent Transcripts
              </span>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {history.map((record) => (
                  <div
                    key={record.id}
                    className="p-3 rounded-lg bg-[#141822] border border-white/5 flex items-center justify-between text-xs hover:border-white/20 transition-colors"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <span className="font-semibold text-white block truncate">
                        {record.filename}
                      </span>
                      <span className="text-[10px] text-neutral-500 font-mono">
                        {new Date(record.createdAt).toLocaleDateString()} · {(record.durationMs / 1000).toFixed(1)}s
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setCurrentTranscript(record.transcript)}
                        className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-neutral-300 text-xs"
                      >
                        View
                      </button>
                      <button
                        onClick={() => {
                          onInsertToChat(record.transcript);
                          onClose();
                        }}
                        className="px-2.5 py-1 rounded bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 text-xs"
                      >
                        Insert
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
