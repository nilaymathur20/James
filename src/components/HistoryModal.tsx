import React, { useState } from 'react';
import {
  X,
  History,
  Search,
  MessageSquare,
  Trash2,
  Download,
  Calendar,
  Gauge,
  ArrowRight,
  Pin,
  Folder as FolderIcon,
} from 'lucide-react';
import { Conversation, Folder } from '../types/chat';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeId: string;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onClearAll: () => void;
  folders: Folder[];
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  conversations,
  activeId,
  onSelectConversation,
  onDeleteConversation,
  onClearAll,
  folders,
}) => {
  const [search, setSearch] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [confirmClear, setConfirmClear] = useState(false);

  if (!isOpen) return null;

  const filteredConversations = conversations.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.messages.some((m) => m.content.toLowerCase().includes(search.toLowerCase()));

    const matchesFolder =
      selectedFolderId === 'all'
        ? true
        : selectedFolderId === 'none'
        ? !c.folderId
        : c.folderId === selectedFolderId;

    return matchesSearch && matchesFolder;
  });

  const totalMessages = conversations.reduce((acc, c) => acc + c.messages.length, 0);

  const handleExportAll = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(conversations, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `james-chat-history-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 select-none">
      <div
        className="w-full max-w-4xl bg-[#11141c] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#141822]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-[#1a202c] border border-white/5 text-blue-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Conversation History & Timeline
              </h2>
              <p className="text-xs text-neutral-400">
                Browse, search, export, or manage all previous chat sessions across folders.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1a202c] hover:bg-[#232b3b] border border-white/10 text-neutral-300 hover:text-white text-xs transition-colors"
              title="Export all chat history as JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export History</span>
            </button>

            <button
              onClick={onClose}
              className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 border-b border-white/5 bg-[#0e1017] flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search conversation history..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-md bg-[#141822] border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500 placeholder:text-neutral-500 font-sans"
            />
          </div>

          {/* Folder Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setSelectedFolderId('all')}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                selectedFolderId === 'all'
                  ? 'bg-blue-600 text-white font-medium'
                  : 'bg-[#141822] text-neutral-400 hover:text-white'
              }`}
            >
              All ({conversations.length})
            </button>
            <button
              onClick={() => setSelectedFolderId('none')}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                selectedFolderId === 'none'
                  ? 'bg-blue-600 text-white font-medium'
                  : 'bg-[#141822] text-neutral-400 hover:text-white'
              }`}
            >
              No Folder
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFolderId(f.id)}
                className={`px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
                  selectedFolderId === f.id
                    ? 'bg-blue-600 text-white font-medium'
                    : 'bg-[#141822] text-neutral-400 hover:text-white'
                }`}
              >
                <span>📁 {f.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Body: Timeline List */}
        <div className="p-6 overflow-y-auto space-y-2.5 flex-1 text-xs">
          {filteredConversations.length > 0 ? (
            filteredConversations.map((c) => {
              const isActive = c.id === activeId;
              const folder = folders.find((f) => f.id === c.folderId);

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    onSelectConversation(c.id);
                    onClose();
                  }}
                  className={`p-4 rounded-xl border transition-colors cursor-pointer flex items-center justify-between group ${
                    isActive
                      ? 'bg-[#1b2232] border-blue-500'
                      : 'bg-[#141822] border-white/5 hover:border-white/10 hover:bg-[#171c26]'
                  }`}
                >
                  <div className="space-y-1.5 min-w-0 flex-1 pr-4">
                    <div className="flex items-center gap-2">
                      {c.pinned && <Pin className="w-3 h-3 text-blue-400 shrink-0" />}
                      <span className="font-semibold text-white text-sm truncate">
                        {c.title}
                      </span>
                      {folder && (
                        <span className="px-2 py-0.5 rounded bg-blue-950/60 border border-blue-500/20 text-blue-300 text-[10px]">
                          {folder.name}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-400 font-mono">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                      <span>·</span>
                      <span>{c.messages.length} messages</span>
                      <span>·</span>
                      <span className="text-neutral-300">{c.model}</span>
                    </div>

                    {c.messages.length > 0 && (
                      <p className="text-xs text-neutral-400 line-clamp-1 italic font-sans">
                        "{c.messages[c.messages.length - 1].content.slice(0, 100)}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(c.id);
                      }}
                      className="p-1.5 rounded text-neutral-500 hover:text-rose-400 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete this conversation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-white/5 group-hover:bg-blue-600 text-neutral-300 group-hover:text-white transition-colors text-xs font-medium">
                      <span>Open</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-16 text-center text-xs text-neutral-500 bg-[#141822]/40 rounded-xl border border-white/5">
              No conversations found matching your search.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-[#141822] flex items-center justify-between text-xs">
          <div>
            {confirmClear ? (
              <div className="flex items-center gap-2">
                <span className="text-rose-400">Are you sure? This cannot be undone.</span>
                <button
                  onClick={() => {
                    onClearAll();
                    setConfirmClear(false);
                    onClose();
                  }}
                  className="px-2.5 py-1 rounded bg-rose-600 text-white font-medium hover:bg-rose-500"
                >
                  Yes, Clear All
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="px-2 py-1 rounded bg-white/5 text-neutral-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="text-neutral-500 hover:text-rose-400 transition-colors"
              >
                Clear all conversation history
              </button>
            )}
          </div>

          <div className="text-neutral-400 font-mono text-[11px] tabular-nums">
            Total conversations: {conversations.length} · Total turns: {totalMessages}
          </div>
        </div>
      </div>
    </div>
  );
};
