import React, { useState } from 'react';
import {
  Copy,
  Check,
  RotateCcw,
  Bookmark,
  Edit3,
  Gauge,
  Zap,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Share2,
  FileText,
  Brain,
} from 'lucide-react';
import { Message, Persona } from '../types/chat';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatMessageItemProps {
  message: Message;
  persona: Persona;
  isStreaming?: boolean;
  onRegenerate?: () => void;
  onEdit?: (newContent: string) => void;
  onTogglePin?: () => void;
  onVariantChange?: (newIndex: number) => void;
  onShare?: (text: string) => void;
  onOpenInEditor?: (title: string, content: string) => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  persona,
  isStreaming = false,
  onRegenerate,
  onEdit,
  onTogglePin,
  onVariantChange,
  onShare,
  onOpenInEditor,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);

  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editContent.trim() && onEdit) {
      onEdit(editContent.trim());
      setIsEditing(false);
    }
  };

  const handleShareClick = () => {
    if (onShare) {
      onShare(message.content);
    } else {
      navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const variants = message.variants || [message.content];
  const currentVariantIndex = message.variantIndex || 0;
  const hasMultipleVariants = variants.length > 1;

  return (
    <div
      className={`group relative flex flex-col py-3.5 px-4 md:px-6 transition-colors ${
        isUser ? 'bg-transparent' : 'bg-[#11141c] border-y border-white/5'
      }`}
    >
      <div className="max-w-4xl mx-auto w-full flex items-start gap-3.5">
        {/* Avatar */}
        <div className="shrink-0 select-none pt-0.5">
          {isUser ? (
            <div className="w-7 h-7 rounded-md bg-neutral-800 border border-white/5 flex items-center justify-center font-bold text-neutral-300 text-xs">
              U
            </div>
          ) : (
            <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
              J
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Header row: Name, Model, Timestamp */}
          <div className="flex items-center gap-2 select-none text-xs">
            <span className="font-semibold text-white">
              {isUser ? 'You' : persona.name}
            </span>

            {!isUser && (
              <span className="text-[11px] text-neutral-500 font-mono">
                Gemini 3.8 Flash
              </span>
            )}

            <span className="text-neutral-600">·</span>

            <span className="text-[11px] text-neutral-500 font-mono tabular-nums">
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          {/* Attachments preview */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 py-1">
              {message.attachments.map((att) => {
                const isImg = att.mimeType.startsWith('image/');
                const isVid = att.mimeType.startsWith('video/');
                const isAud = att.mimeType.startsWith('audio/');

                return (
                  <div
                    key={att.id}
                    className="p-1.5 rounded-md bg-[#141822] border border-white/10 max-w-[240px]"
                  >
                    {isImg ? (
                      <img
                        src={att.data}
                        alt={att.name}
                        className="max-h-36 rounded object-cover"
                      />
                    ) : isVid ? (
                      <div className="p-2 space-y-1">
                        <video src={att.data} controls className="max-h-36 rounded w-full" />
                        <span className="text-[10px] font-mono text-neutral-400 block truncate">
                          🎬 {att.name}
                        </span>
                      </div>
                    ) : isAud ? (
                      <div className="p-2 space-y-1">
                        <audio src={att.data} controls className="w-full" />
                        <span className="text-[10px] font-mono text-neutral-400 block truncate">
                          🎵 {att.name}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] font-mono text-neutral-300 truncate px-1">
                        📄 {att.name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Reasoning / Thinking Indication Block */}
          {!isUser && message.thought && (
            <div className="mb-2 rounded-lg border border-white/10 bg-[#0d1017] overflow-hidden text-xs">
              <button
                onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                className="w-full px-3 py-2 bg-[#141822] flex items-center justify-between text-neutral-300 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Brain className="w-3.5 h-3.5 text-blue-400" />
                  <span className="font-semibold text-[11px]">Thinking Process</span>
                  <span className="text-[10px] text-neutral-500 font-mono">
                    (~{Math.ceil(message.thought.length / 4)} tokens)
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    isThinkingExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {isThinkingExpanded && (
                <div className="p-3 text-neutral-300 font-mono text-[11px] whitespace-pre-wrap leading-relaxed border-t border-white/5 bg-[#090b10] max-h-60 overflow-y-auto">
                  {message.thought}
                </div>
              )}
            </div>
          )}

          {/* Message Content or Inline Edit */}
          {isEditing ? (
            <form onSubmit={handleSaveEdit} className="space-y-2 pt-1">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={3}
                className="w-full p-2.5 rounded-md bg-[#141822] border border-blue-500 text-neutral-100 text-sm focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="px-3 py-1 text-xs rounded-md bg-blue-600 text-white font-medium hover:bg-blue-500"
                >
                  Save and resubmit
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1 text-xs rounded-md text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : message.isError ? (
            <div className="p-3.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-rose-200">Notice</p>
                <p>{message.content}</p>
                {onRegenerate && (
                  <button
                    onClick={onRegenerate}
                    className="mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-medium transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" /> Retry generation
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="relative">
              <MarkdownRenderer content={message.content} />
              {isStreaming && (
                <span className="inline-block w-2 h-3.5 bg-blue-500 animate-pulse ml-1 align-middle" />
              )}
            </div>
          )}

          {/* Message Stats & Token Telemetry */}
          {!isUser && message.stats && (
            <div className="flex flex-wrap items-center gap-3 pt-2 text-[10px] text-neutral-500 font-mono select-none border-t border-white/5">
              <span className="flex items-center gap-1 text-neutral-400">
                <Gauge className="w-3 h-3 text-blue-400" />
                Prompt: <span className="text-neutral-200 tabular-nums">{message.stats.promptTokens}</span> tok
              </span>
              <span className="text-neutral-700">·</span>
              <span className="flex items-center gap-1 text-neutral-400">
                Completion: <span className="text-neutral-200 tabular-nums">{message.stats.candidatesTokens}</span> tok
              </span>
              <span className="text-neutral-700">·</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <Zap className="w-3 h-3" />
                <span className="tabular-nums">{message.stats.tokensPerSecond || '50'}</span> tok/s
              </span>
              <span className="text-neutral-700">·</span>
              <span className="flex items-center gap-1 text-neutral-400">
                <Clock className="w-3 h-3" />
                <span className="tabular-nums">{(message.stats.durationMs / 1000).toFixed(2)}s</span>
              </span>
            </div>
          )}

          {/* Clean Message Actions Bar (Copy / Share / Retry / Edit / Pin) */}
          {!isEditing && (
            <div className="flex items-center justify-between pt-1 opacity-70 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-1">
                {/* Copy */}
                <button
                  onClick={handleCopy}
                  className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                  title="Copy message"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Share */}
                <button
                  onClick={handleShareClick}
                  className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                  title="Share snippet"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>

                {/* Open in editor */}
                {!isUser && onOpenInEditor && (
                  <button
                    onClick={() =>
                      onOpenInEditor(
                        `Response-${new Date(message.timestamp).toLocaleTimeString()}`,
                        message.content
                      )
                    }
                    className="p-1 rounded-md text-neutral-400 hover:text-blue-300 hover:bg-white/5 transition-colors"
                    title="Open in Document Editor"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Edit (for user) */}
                {isUser && onEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                    title="Edit message"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Regenerate / Retry (for assistant) */}
                {!isUser && onRegenerate && (
                  <button
                    onClick={onRegenerate}
                    className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                    title="Retry / Regenerate response"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Bookmark / Pin */}
                {onTogglePin && (
                  <button
                    onClick={onTogglePin}
                    className={`p-1 rounded-md transition-colors ${
                      message.pinned
                        ? 'text-blue-400 hover:text-blue-300'
                        : 'text-neutral-400 hover:text-white hover:bg-white/5'
                    }`}
                    title={message.pinned ? 'Unpin message' : 'Save message'}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Variant Switcher */}
              {!isUser && hasMultipleVariants && onVariantChange && (
                <div className="flex items-center gap-1 text-[11px] text-neutral-400 font-mono bg-white/5 px-2 py-0.5 rounded">
                  <button
                    disabled={currentVariantIndex === 0}
                    onClick={() => onVariantChange(currentVariantIndex - 1)}
                    className="disabled:opacity-30 hover:text-white"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  <span className="tabular-nums">
                    {currentVariantIndex + 1} / {variants.length}
                  </span>
                  <button
                    disabled={currentVariantIndex === variants.length - 1}
                    onClick={() => onVariantChange(currentVariantIndex + 1)}
                    className="disabled:opacity-30 hover:text-white"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
