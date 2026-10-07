import React, { useState, useRef, useEffect } from 'react';
import {
  Paperclip,
  Mic,
  MicOff,
  Square,
  X,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  CornerDownLeft,
  Brain,
} from 'lucide-react';
import { Attachment } from '../types/chat';
import { PROMPT_STARTERS } from '../data/prompts';

interface ChatComposerProps {
  onSendMessage: (content: string, attachments: Attachment[]) => void;
  isStreaming: boolean;
  onStopGeneration: () => void;
  personaId: string;
  enableThinking?: boolean;
  onToggleThinking?: () => void;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  onSendMessage,
  isStreaming,
  onStopGeneration,
  personaId,
  enableThinking = false,
  onToggleThinking,
}) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [micUnsupported, setMicUnsupported] = useState(false);
  const [showStarters, setShowStarters] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(200, textareaRef.current.scrollHeight)}px`;
    }
  }, [input]);

  // Speech-To-Text Dictation setup using browser Web Speech API
  const toggleSpeechRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicUnsupported(true);
      setTimeout(() => setMicUnsupported(false), 3000);
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsRecording(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      const isMedia =
        file.type.startsWith('image/') ||
        file.type.startsWith('video/') ||
        file.type.startsWith('audio/');

      if (isMedia) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }

      reader.onload = () => {
        const result = reader.result as string;
        const newAttachment: Attachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: file.name,
          mimeType: file.type || 'text/plain',
          data: result,
          size: file.size,
        };

        setAttachments((prev) => [...prev, newAttachment]);
      };
    });

    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isStreaming) {
      onStopGeneration();
      return;
    }

    if (!input.trim() && attachments.length === 0) return;

    onSendMessage(input.trim(), attachments);
    setInput('');
    setAttachments([]);
    setShowStarters(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const estimatedInputTokens = Math.max(1, Math.ceil(input.length / 4));

  const relevantStarters = PROMPT_STARTERS.filter((s) => s.personaId === personaId);
  const displayedStarters = relevantStarters.length > 0 ? relevantStarters : PROMPT_STARTERS.slice(0, 3);

  return (
    <div className="max-w-4xl mx-auto w-full px-4 pb-4 select-none">
      {/* Quick Prompt Starters */}
      {showStarters && input.length === 0 && (
        <div className="mb-2.5 overflow-x-auto pb-1 flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 font-medium shrink-0 px-1">
            Starters:
          </span>
          {displayedStarters.map((starter) => (
            <button
              key={starter.id}
              onClick={() => {
                setInput(starter.prompt);
                textareaRef.current?.focus();
              }}
              className="px-2.5 py-1 rounded-md bg-[#141822] hover:bg-[#1a202c] border border-white/10 text-xs text-neutral-300 hover:text-white transition-colors shrink-0 flex items-center gap-1.5"
            >
              <span>{starter.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Composer Box */}
      <div className="relative rounded-xl bg-[#141822] border border-white/10 p-2.5 transition-colors focus-within:border-blue-500">
        {/* Attachment chips */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2 border-b border-white/5 mb-1.5">
            {attachments.map((att) => {
              const isImg = att.mimeType.startsWith('image/');
              const isVid = att.mimeType.startsWith('video/');
              const isAud = att.mimeType.startsWith('audio/');

              return (
                <div
                  key={att.id}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#1a202c] border border-white/10 text-xs text-neutral-200"
                >
                  {isImg ? (
                    <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                  ) : isVid ? (
                    <Video className="w-3.5 h-3.5 text-blue-400" />
                  ) : isAud ? (
                    <Music className="w-3.5 h-3.5 text-blue-400" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-neutral-400" />
                  )}
                  <span className="max-w-[120px] truncate text-[11px] font-mono">{att.name}</span>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="text-neutral-500 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Enter to send, Shift+Enter for newline)"
          rows={1}
          className="w-full bg-transparent px-2 py-1 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none resize-none min-h-[38px] max-h-[200px] font-sans"
        />

        {/* Bottom Toolbar */}
        <div className="flex items-center justify-between pt-1.5 px-1 border-t border-white/5">
          <div className="flex items-center gap-1.5">
            {/* Attachment Button */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              accept="image/*,video/*,audio/*,.txt,.ts,.js,.py,.json,.md,.csv,.html,.css"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Attach images, videos, audio, or documents"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Speech-To-Text / Dictation Button */}
            <button
              onClick={toggleSpeechRecognition}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors text-xs ${
                isRecording
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
              title={isRecording ? 'Listening... click to stop' : 'Voice Dictate'}
            >
              {isRecording ? (
                <>
                  <MicOff className="w-3.5 h-3.5 animate-pulse text-rose-400" />
                  <span className="text-[11px] font-medium hidden sm:inline">Dictating...</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  <span className="text-[11px] hidden sm:inline">Dictate</span>
                </>
              )}
            </button>

            {/* Reasoning / Thinking Mode Toggle */}
            {onToggleThinking && (
              <button
                onClick={onToggleThinking}
                className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors text-xs ${
                  enableThinking
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 font-medium'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
                title={
                  enableThinking
                    ? 'Reasoning mode enabled (deep thinking trace)'
                    : 'Enable reasoning mode'
                }
              >
                <Brain className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[11px] hidden sm:inline">
                  {enableThinking ? 'Thinking On' : 'Reasoning'}
                </span>
              </button>
            )}

            {micUnsupported && (
              <span className="text-[11px] text-amber-400 font-sans ml-1">
                Mic not supported
              </span>
            )}

            {/* Live Input Token Indicator */}
            {input.length > 0 && (
              <span className="text-[10px] text-neutral-500 font-mono ml-2 tabular-nums">
                ~{estimatedInputTokens} input tokens
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-neutral-500 font-mono hidden sm:inline-flex items-center gap-1">
              Press Enter ↵
            </span>

            {/* Submit or Stop Generation Button */}
            {isStreaming ? (
              <button
                onClick={onStopGeneration}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors"
              >
                <Square className="w-3.5 h-3.5 fill-rose-300" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                onClick={() => handleSubmit()}
                disabled={!input.trim() && attachments.length === 0}
                className="px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:pointer-events-none text-white font-medium text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                title="Send message"
              >
                <span>Send</span>
                <CornerDownLeft className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
