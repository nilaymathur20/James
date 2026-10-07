import React, { useState } from 'react';
import {
  Plus,
  MessageSquare,
  Search,
  Pin,
  Trash2,
  Edit2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Home,
  Folder as FolderIcon,
  FolderPlus,
  Video,
  FileCode,
  History,
  BookOpen,
  Share2,
  HardDrive,
  MoreVertical,
} from 'lucide-react';
import { Conversation, Persona, Folder } from '../types/chat';

interface ChatSidebarProps {
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onTogglePin: (id: string) => void;
  onRenameChat: (id: string, newTitle: string) => void;
  activePersona: Persona;
  onOpenPersonaSelector: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  onBackToLanding?: () => void;
  folders: Folder[];
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveChatToFolder: (chatId: string, folderId: string | null) => void;
  onOpenTranscribe: () => void;
  onOpenDocumentEditor: () => void;
  onOpenHistory: () => void;
  onOpenLibrary: () => void;
  onOpenP2P: () => void;
  onOpenAutoIndex: () => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDeleteChat,
  onTogglePin,
  onRenameChat,
  activePersona,
  onOpenPersonaSelector,
  isCollapsed,
  onToggleCollapse,
  selectedModel,
  onSelectModel,
  onBackToLanding,
  folders,
  onCreateFolder,
  onDeleteFolder,
  onMoveChatToFolder,
  onOpenTranscribe,
  onOpenDocumentEditor,
  onOpenHistory,
  onOpenLibrary,
  onOpenP2P,
  onOpenAutoIndex,
}) => {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  const filteredConversations = conversations.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.messages.some((m) => m.content.toLowerCase().includes(search.toLowerCase()))
  );

  const pinnedConversations = filteredConversations.filter((c) => c.pinned);

  const handleStartRename = (c: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(c.id);
    setEditTitle(c.title);
  };

  const handleSaveRename = (id: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRenameChat(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };

  const toggleFolderCollapse = (id: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (isCollapsed) {
    return (
      <div className="h-full w-14 bg-[#0e1118] border-r border-white/10 flex flex-col items-center py-3 select-none justify-between z-20">
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {onBackToLanding && (
            <button
              onClick={onBackToLanding}
              className="p-2 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Product overview page"
            >
              <Home className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onNewChat}
            className="w-8 h-8 rounded-md bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center font-bold transition-colors"
            title="New conversation"
          >
            <Plus className="w-4 h-4" />
          </button>

          <div className="w-6 h-[1px] bg-white/10 my-1" />

          {/* Quick tool icons */}
          <button
            onClick={onOpenDocumentEditor}
            className="p-2 rounded-md text-neutral-400 hover:text-white hover:bg-white/5"
            title="Document & Code Editor"
          >
            <FileCode className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenTranscribe}
            className="p-2 rounded-md text-neutral-400 hover:text-white hover:bg-white/5"
            title="Video Transcription"
          >
            <Video className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenHistory}
            className="p-2 rounded-md text-neutral-400 hover:text-white hover:bg-white/5"
            title="Chat History"
          >
            <History className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenLibrary}
            className="p-2 rounded-md text-neutral-400 hover:text-white hover:bg-white/5"
            title="Prompt Library"
          >
            <BookOpen className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={onOpenPersonaSelector}
          className="w-8 h-8 rounded-md bg-[#171b26] border border-white/10 flex items-center justify-center text-xs font-mono font-bold text-blue-400"
          title={`Active Directive: ${activePersona.name}`}
        >
          {activePersona.avatar}
        </button>
      </div>
    );
  }

  return (
    <div className="h-full w-72 bg-[#0e1118] border-r border-white/10 flex flex-col select-none z-20 transition-all">
      {/* Brand Header */}
      <div className="p-3.5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold text-xs select-none">
            J
          </span>
          <h1 className="text-sm font-semibold text-white tracking-tight">
            JAMES
          </h1>
        </div>

        <div className="flex items-center gap-1">
          {onBackToLanding && (
            <button
              onClick={onBackToLanding}
              className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors text-[11px] flex items-center gap-1"
              title="Back to landing page"
            >
              <Home className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Action buttons: New Chat + Search */}
      <div className="p-3 space-y-2 border-b border-white/10">
        <button
          onClick={onNewChat}
          className="w-full py-2 px-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New conversation</span>
        </button>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-md bg-[#141822] border border-white/10 text-xs text-neutral-200 focus:outline-none focus:border-blue-500 placeholder:text-neutral-500 font-sans"
          />
        </div>
      </div>

      {/* Workspace Feature Bar (Transcribe, Editor, Library, History, P2P, Index) */}
      <div className="px-3 py-2 border-b border-white/10 bg-[#0b0d13] grid grid-cols-3 gap-1 text-[11px]">
        <button
          onClick={onOpenDocumentEditor}
          className="flex items-center gap-1 p-1 rounded hover:bg-white/5 text-neutral-300 hover:text-white transition-colors"
          title="Document & Code Editor"
        >
          <FileCode className="w-3 h-3 text-blue-400 shrink-0" />
          <span className="truncate">Editor</span>
        </button>

        <button
          onClick={onOpenTranscribe}
          className="flex items-center gap-1 p-1 rounded hover:bg-white/5 text-neutral-300 hover:text-white transition-colors"
          title="Video & Audio Transcription"
        >
          <Video className="w-3 h-3 text-blue-400 shrink-0" />
          <span className="truncate">Transcribe</span>
        </button>

        <button
          onClick={onOpenHistory}
          className="flex items-center gap-1 p-1 rounded hover:bg-white/5 text-neutral-300 hover:text-white transition-colors"
          title="Full Conversation History"
        >
          <History className="w-3 h-3 text-blue-400 shrink-0" />
          <span className="truncate">History</span>
        </button>

        <button
          onClick={onOpenLibrary}
          className="flex items-center gap-1 p-1 rounded hover:bg-white/5 text-neutral-300 hover:text-white transition-colors"
          title="Prompt & Template Library"
        >
          <BookOpen className="w-3 h-3 text-blue-400 shrink-0" />
          <span className="truncate">Library</span>
        </button>

        <button
          onClick={onOpenP2P}
          className="flex items-center gap-1 p-1 rounded hover:bg-white/5 text-neutral-300 hover:text-white transition-colors"
          title="Peer-to-Peer Direct Connection"
        >
          <Share2 className="w-3 h-3 text-blue-400 shrink-0" />
          <span className="truncate">P2P Sync</span>
        </button>

        <button
          onClick={onOpenAutoIndex}
          className="flex items-center gap-1 p-1 rounded hover:bg-white/5 text-neutral-300 hover:text-white transition-colors"
          title="Computer Auto-Index"
        >
          <HardDrive className="w-3 h-3 text-blue-400 shrink-0" />
          <span className="truncate">Auto-Index</span>
        </button>
      </div>

      {/* Model Selector Bar */}
      <div className="px-3 py-1.5 border-b border-white/10 flex items-center justify-between text-[11px] bg-[#11141c]">
        <span className="text-neutral-400">Model:</span>
        <div className="flex items-center gap-1 bg-[#171b26] p-0.5 rounded border border-white/5">
          <button
            onClick={() => onSelectModel('gemini-3.8-flash')}
            className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
              selectedModel === 'gemini-3.8-flash'
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            3.8 Flash
          </button>
          <button
            onClick={() => onSelectModel('gemini-3.1-flash-lite')}
            className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
              selectedModel === 'gemini-3.1-flash-lite'
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            3.1 Lite
          </button>
        </div>
      </div>

      {/* Project Folders Header & Creator */}
      <div className="px-3 pt-2.5 pb-1 flex items-center justify-between text-xs border-b border-white/5">
        <span className="text-[10px] font-mono uppercase text-neutral-500 font-semibold tracking-wider flex items-center gap-1">
          <FolderIcon className="w-3 h-3 text-blue-400" /> Projects / Folders
        </span>
        <button
          onClick={() => setIsCreatingFolder(!isCreatingFolder)}
          className="text-neutral-400 hover:text-white p-0.5 rounded"
          title="Create new project folder"
        >
          <FolderPlus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Folder Creation Input */}
      {isCreatingFolder && (
        <form onSubmit={handleCreateFolderSubmit} className="p-2 bg-[#141822] border-b border-white/10 flex items-center gap-1">
          <input
            autoFocus
            type="text"
            placeholder="Folder name..."
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            className="flex-1 px-2 py-1 bg-neutral-900 border border-blue-500 rounded text-xs text-white focus:outline-none"
          />
          <button type="submit" className="p-1 rounded bg-blue-600 text-white text-xs">
            <Check className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => setIsCreatingFolder(false)}
            className="p-1 text-neutral-400 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        </form>
      )}

      {/* Conversation List Organized by Folders */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* Pinned section */}
        {pinnedConversations.length > 0 && (
          <div className="space-y-1">
            <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
              <Pin className="w-3 h-3 text-blue-400" /> Pinned
            </span>
            {pinnedConversations.map((c) => (
              <ConversationItem
                key={c.id}
                conversation={c}
                isActive={c.id === activeId}
                isEditing={editingId === c.id}
                editTitle={editTitle}
                setEditTitle={setEditTitle}
                onSelect={() => onSelect(c.id)}
                onDelete={(e) => {
                  e.stopPropagation();
                  onDeleteChat(c.id);
                }}
                onTogglePin={(e) => {
                  e.stopPropagation();
                  onTogglePin(c.id);
                }}
                onStartRename={(e) => handleStartRename(c, e)}
                onSaveRename={(e) => handleSaveRename(c.id, e)}
                onCancelRename={(e) => {
                  e.stopPropagation();
                  setEditingId(null);
                }}
                folders={folders}
                onMoveToFolder={(folderId) => onMoveChatToFolder(c.id, folderId)}
              />
            ))}
          </div>
        )}

        {/* Folders List with conversations nested */}
        {folders.map((folder) => {
          const folderChats = filteredConversations.filter((c) => c.folderId === folder.id && !c.pinned);
          const isCollapsed = collapsedFolders[folder.id];

          return (
            <div key={folder.id} className="space-y-1">
              <div
                onClick={() => toggleFolderCollapse(folder.id)}
                className="flex items-center justify-between px-2 py-1 text-xs text-neutral-400 hover:text-white cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 font-medium">
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                  />
                  <span>📁 {folder.name}</span>
                  <span className="text-[10px] font-mono text-neutral-600">
                    ({folderChats.length})
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFolder(folder.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-rose-400 p-0.5"
                  title="Delete folder"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {!isCollapsed && (
                <div className="pl-2 space-y-1">
                  {folderChats.map((c) => (
                    <ConversationItem
                      key={c.id}
                      conversation={c}
                      isActive={c.id === activeId}
                      isEditing={editingId === c.id}
                      editTitle={editTitle}
                      setEditTitle={setEditTitle}
                      onSelect={() => onSelect(c.id)}
                      onDelete={(e) => {
                        e.stopPropagation();
                        onDeleteChat(c.id);
                      }}
                      onTogglePin={(e) => {
                        e.stopPropagation();
                        onTogglePin(c.id);
                      }}
                      onStartRename={(e) => handleStartRename(c, e)}
                      onSaveRename={(e) => handleSaveRename(c.id, e)}
                      onCancelRename={(e) => {
                        e.stopPropagation();
                        setEditingId(null);
                      }}
                      folders={folders}
                      onMoveToFolder={(folderId) => onMoveChatToFolder(c.id, folderId)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Uncategorized conversations */}
        <div className="space-y-1">
          {folders.length > 0 && (
            <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block">
              General
            </span>
          )}

          {filteredConversations
            .filter((c) => !c.pinned && (!c.folderId || !folders.some((f) => f.id === c.folderId)))
            .map((c) => (
              <ConversationItem
                key={c.id}
                conversation={c}
                isActive={c.id === activeId}
                isEditing={editingId === c.id}
                editTitle={editTitle}
                setEditTitle={setEditTitle}
                onSelect={() => onSelect(c.id)}
                onDelete={(e) => {
                  e.stopPropagation();
                  onDeleteChat(c.id);
                }}
                onTogglePin={(e) => {
                  e.stopPropagation();
                  onTogglePin(c.id);
                }}
                onStartRename={(e) => handleStartRename(c, e)}
                onSaveRename={(e) => handleSaveRename(c.id, e)}
                onCancelRename={(e) => {
                  e.stopPropagation();
                  setEditingId(null);
                }}
                folders={folders}
                onMoveToFolder={(folderId) => onMoveChatToFolder(c.id, folderId)}
              />
            ))}
        </div>
      </div>

      {/* Active Persona footer */}
      <div className="p-3 border-t border-white/10 bg-[#11141c] flex items-center justify-between">
        <button
          onClick={onOpenPersonaSelector}
          className="flex items-center gap-2 p-1.5 rounded-md hover:bg-white/5 transition-colors text-left flex-1 min-w-0"
          title="Change active prompt directive"
        >
          <span className="px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-400 font-mono text-[10px] font-bold">
            {activePersona.avatar}
          </span>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-medium text-white block truncate">
              {activePersona.name}
            </span>
            <span className="text-[10px] text-neutral-400 block truncate">
              {activePersona.role}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
};

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  isEditing: boolean;
  editTitle: string;
  setEditTitle: (val: string) => void;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onTogglePin: (e: React.MouseEvent) => void;
  onStartRename: (e: React.MouseEvent) => void;
  onSaveRename: (e: React.MouseEvent) => void;
  onCancelRename: (e: React.MouseEvent) => void;
  folders: Folder[];
  onMoveToFolder: (folderId: string | null) => void;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  isEditing,
  editTitle,
  setEditTitle,
  onSelect,
  onDelete,
  onTogglePin,
  onStartRename,
  onSaveRename,
  onCancelRename,
  folders,
  onMoveToFolder,
}) => {
  const [showFolderMenu, setShowFolderMenu] = useState(false);

  return (
    <div
      onClick={onSelect}
      className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer text-xs transition-colors ${
        isActive
          ? 'bg-[#1b2130] text-white font-medium border border-blue-500/30'
          : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03] border border-transparent'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <MessageSquare
          className={`w-3.5 h-3.5 shrink-0 ${
            isActive ? 'text-blue-400' : 'text-neutral-500'
          }`}
        />

        {isEditing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSaveRename(e as any);
            }}
            className="flex items-center gap-1 w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-1.5 py-0.5 rounded bg-neutral-900 border border-blue-500 text-white text-xs focus:outline-none"
            />
            <button type="submit" className="text-emerald-400 hover:text-emerald-300 p-0.5">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={onCancelRename} className="text-neutral-400 hover:text-white p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <span className="truncate text-xs">{conversation.title}</span>
        )}
      </div>

      {/* Hover actions */}
      {!isEditing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0">
          {/* Folder assign button */}
          {folders.length > 0 && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFolderMenu(!showFolderMenu);
                }}
                className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/10"
                title="Move to project folder"
              >
                <FolderIcon className="w-3 h-3" />
              </button>

              {showFolderMenu && (
                <div
                  className="absolute right-0 mt-1 w-36 bg-[#141822] border border-white/10 rounded-md shadow-xl py-1 z-30 text-[11px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      onMoveToFolder(null);
                      setShowFolderMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1 text-neutral-300 hover:bg-white/10"
                  >
                    No Folder
                  </button>
                  {folders.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        onMoveToFolder(f.id);
                        setShowFolderMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-1 text-neutral-300 hover:bg-white/10"
                    >
                      📁 {f.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={onTogglePin}
            className={`p-1 rounded hover:bg-white/10 ${
              conversation.pinned ? 'text-blue-400' : 'text-neutral-400 hover:text-white'
            }`}
            title={conversation.pinned ? 'Unpin' : 'Pin'}
          >
            <Pin className="w-3 h-3" />
          </button>
          <button
            onClick={onStartRename}
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/10"
            title="Rename"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded text-neutral-400 hover:text-rose-400 hover:bg-white/10"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
