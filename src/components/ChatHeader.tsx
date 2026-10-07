import React, { useState } from 'react';
import {
  Menu,
  Search,
  Bookmark,
  Download,
  Trash2,
  Command,
  ArrowLeft,
} from 'lucide-react';
import { Conversation, Persona, TokenMetrics } from '../types/chat';
import { TokenGauge } from './TokenGauge';

interface ChatHeaderProps {
  activeConversation: Conversation;
  activePersona: Persona;
  tokenMetrics: TokenMetrics;
  onOpenSidebar: () => void;
  onOpenTokenInspector: () => void;
  onOpenPersonaSelector: () => void;
  onOpenSearchMessages: () => void;
  onOpenSavedInsights: () => void;
  onOpenCommandPalette: () => void;
  onClearChat: () => void;
  onExportChat: (format: 'markdown' | 'json' | 'txt') => void;
  isSoundEnabled?: boolean;
  onToggleSound?: () => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  onBackToLanding?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  activeConversation,
  activePersona,
  tokenMetrics,
  onOpenSidebar,
  onOpenTokenInspector,
  onOpenPersonaSelector,
  onOpenSearchMessages,
  onOpenSavedInsights,
  onOpenCommandPalette,
  onClearChat,
  onExportChat,
  onBackToLanding,
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);

  const pinnedCount = activeConversation.messages.filter((m) => m.pinned).length;

  return (
    <header className="h-14 border-b border-white/10 bg-[#11141c] px-4 flex items-center justify-between select-none z-10 shrink-0">
      {/* Left: Sidebar toggle + Back to Overview + Active Chat Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          onClick={onOpenSidebar}
          className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors md:hidden"
          title="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {onBackToLanding && (
          <button
            onClick={onBackToLanding}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-colors shrink-0"
            title="Return to product overview page"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Overview</span>
          </button>
        )}

        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onOpenPersonaSelector}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#141822] hover:bg-[#1a202c] border border-white/10 transition-colors text-left shrink-0"
            title="Switch prompt directive"
          >
            <span className="text-xs font-mono font-bold text-blue-400">{activePersona.avatar}</span>
            <span className="text-xs font-medium text-white hidden sm:inline truncate max-w-[120px]">
              {activePersona.name}
            </span>
          </button>

          <span className="text-neutral-700 hidden sm:inline">/</span>

          <h1 className="text-xs font-medium text-neutral-300 truncate max-w-[150px] sm:max-w-[220px]">
            {activeConversation.title}
          </h1>
        </div>
      </div>

      {/* Center: Token Gauge & Context Engine */}
      <div className="hidden lg:flex items-center">
        <TokenGauge
          metrics={tokenMetrics}
          maxOutputLimit={activeConversation.maxOutputTokens}
          onClick={onOpenTokenInspector}
        />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {/* Compact Token Gauge on mobile/tablet */}
        <div className="lg:hidden">
          <TokenGauge
            compact
            metrics={tokenMetrics}
            maxOutputLimit={activeConversation.maxOutputTokens}
            onClick={onOpenTokenInspector}
          />
        </div>

        {/* Search messages */}
        <button
          onClick={onOpenSearchMessages}
          className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
          title="Search messages in this thread"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Bookmarked insights drawer */}
        <button
          onClick={onOpenSavedInsights}
          className={`p-1.5 rounded-md transition-colors relative ${
            pinnedCount > 0
              ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20'
              : 'text-neutral-400 hover:text-white hover:bg-white/5'
          }`}
          title="View saved messages"
        >
          <Bookmark className="w-4 h-4" />
          {pinnedCount > 0 && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-400" />
          )}
        </button>

        {/* Command palette button */}
        <button
          onClick={onOpenCommandPalette}
          className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors hidden sm:flex items-center gap-1 text-xs"
          title="Open keyboard commands (Cmd+K)"
        >
          <Command className="w-4 h-4" />
          <span className="text-[10px] text-neutral-500 font-mono hidden md:inline">⌘K</span>
        </button>

        {/* Export dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Export conversation"
          >
            <Download className="w-4 h-4" />
          </button>

          {showExportMenu && (
            <div
              className="absolute right-0 mt-2 w-48 bg-[#141822] border border-white/10 rounded-lg shadow-xl p-1 z-30 text-xs"
              onClick={() => setShowExportMenu(false)}
            >
              <button
                onClick={() => onExportChat('markdown')}
                className="w-full text-left px-3 py-1.5 rounded text-neutral-200 hover:bg-white/5 hover:text-white transition-colors"
              >
                Export Markdown (.md)
              </button>
              <button
                onClick={() => onExportChat('json')}
                className="w-full text-left px-3 py-1.5 rounded text-neutral-200 hover:bg-white/5 hover:text-white transition-colors"
              >
                Export JSON (.json)
              </button>
              <button
                onClick={() => onExportChat('txt')}
                className="w-full text-left px-3 py-1.5 rounded text-neutral-200 hover:bg-white/5 hover:text-white transition-colors"
              >
                Export Plain Text (.txt)
              </button>
            </div>
          )}
        </div>

        {/* Clear chat */}
        <button
          onClick={onClearChat}
          className="p-1.5 rounded-md text-neutral-400 hover:text-rose-400 hover:bg-white/5 transition-colors"
          title="Clear messages in this conversation"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
