import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Conversation } from '../types/chat';

interface SearchMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeConversation: Conversation;
  onJumpToMessage: (id: string) => void;
}

export const SearchMessagesModal: React.FC<SearchMessagesModalProps> = ({
  isOpen,
  onClose,
  activeConversation,
  onJumpToMessage,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const matches = query.trim()
    ? activeConversation.messages.filter((m) =>
        m.content.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/80"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#11141c] border border-white/10 rounded-xl shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-white/10 bg-[#141822]">
          <Search className="w-4 h-4 text-neutral-400 mr-2.5" />
          <input
            autoFocus
            type="text"
            placeholder="Search keywords in current conversation..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-white focus:outline-none placeholder:text-neutral-500 font-sans"
          />
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 max-h-80 overflow-y-auto space-y-2">
          {matches.length > 0 ? (
            matches.map((msg) => (
              <div
                key={msg.id}
                onClick={() => {
                  onJumpToMessage(msg.id);
                  onClose();
                }}
                className="p-3 rounded-lg bg-[#141822] hover:bg-[#1a202c] border border-white/5 cursor-pointer text-xs space-y-1 transition-colors"
              >
                <div className="flex items-center justify-between text-[10px] text-neutral-400">
                  <span className="font-semibold text-blue-400">
                    {msg.role === 'user' ? 'Prompt' : 'Response'}
                  </span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="text-neutral-200 line-clamp-2">{msg.content}</p>
              </div>
            ))
          ) : query.trim() ? (
            <div className="py-6 text-center text-xs text-neutral-500">
              No matching messages found for "{query}".
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-neutral-500">
              Type to search messages in this thread.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
