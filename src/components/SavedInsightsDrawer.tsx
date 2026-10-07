import React from 'react';
import { X, Bookmark, Copy, Trash2, ArrowRight } from 'lucide-react';
import { Conversation } from '../types/chat';

interface SavedInsightsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeConversation: Conversation;
  onJumpToMessage: (id: string) => void;
  onUnpinMessage: (id: string) => void;
}

export const SavedInsightsDrawer: React.FC<SavedInsightsDrawerProps> = ({
  isOpen,
  onClose,
  activeConversation,
  onJumpToMessage,
  onUnpinMessage,
}) => {
  if (!isOpen) return null;

  const pinnedMessages = activeConversation.messages.filter((m) => m.pinned);

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-96 bg-[#11141c] border-l border-white/10 shadow-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#141822]">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-white">
            Saved messages ({pinnedMessages.length})
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {pinnedMessages.length > 0 ? (
          pinnedMessages.map((msg) => (
            <div
              key={msg.id}
              className="p-3.5 rounded-lg bg-[#141822] border border-white/5 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between text-[10px] text-neutral-400">
                <span className="font-semibold text-neutral-300">
                  {msg.role === 'user' ? 'Prompt' : 'Response'}
                </span>
                <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
              </div>

              <div className="line-clamp-4 text-neutral-300">
                {msg.content}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(msg.content);
                  }}
                  className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onUnpinMessage(msg.id);
                    }}
                    className="text-neutral-400 hover:text-rose-400 transition-colors"
                    title="Remove bookmark"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      onJumpToMessage(msg.id);
                      onClose();
                    }}
                    className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors font-medium"
                  >
                    <span>Jump</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 text-center text-xs text-neutral-500">
            No saved messages in this conversation. Click the bookmark icon on any message to save it here.
          </div>
        )}
      </div>
    </div>
  );
};
