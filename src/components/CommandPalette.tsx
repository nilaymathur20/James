import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Download,
  Gauge,
  Bot,
  Command,
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onClearChat: () => void;
  onOpenTokenInspector: () => void;
  onOpenPersonaSelector: () => void;
  onExportChat: (format: 'markdown' | 'json' | 'txt') => void;
  isSoundEnabled?: boolean;
  onToggleSound?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNewChat,
  onClearChat,
  onOpenTokenInspector,
  onOpenPersonaSelector,
  onExportChat,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const actions = [
    {
      id: 'new-chat',
      title: 'New conversation',
      shortcut: '⌘N',
      icon: Plus,
      category: 'Chat',
      action: () => {
        onNewChat();
        onClose();
      },
    },
    {
      id: 'token-inspector',
      title: 'Open token & context inspector',
      shortcut: '⌘T',
      icon: Gauge,
      category: 'Settings',
      action: () => {
        onOpenTokenInspector();
        onClose();
      },
    },
    {
      id: 'persona-selector',
      title: 'Switch prompt directive',
      shortcut: '⌘P',
      icon: Bot,
      category: 'Settings',
      action: () => {
        onOpenPersonaSelector();
        onClose();
      },
    },
    {
      id: 'export-md',
      title: 'Export conversation as Markdown (.md)',
      shortcut: '⌘E',
      icon: Download,
      category: 'Export',
      action: () => {
        onExportChat('markdown');
        onClose();
      },
    },
    {
      id: 'export-json',
      title: 'Export conversation as JSON',
      shortcut: '⌥J',
      icon: Download,
      category: 'Export',
      action: () => {
        onExportChat('json');
        onClose();
      },
    },
    {
      id: 'clear-chat',
      title: 'Clear messages in this conversation',
      shortcut: '⇧⌘C',
      icon: Trash2,
      category: 'Chat',
      action: () => {
        onClearChat();
        onClose();
      },
    },
  ];

  const filtered = actions.filter((act) =>
    act.title.toLowerCase().includes(query.toLowerCase()) ||
    act.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/80"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#11141c] border border-white/10 rounded-xl shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Input */}
        <div className="flex items-center px-4 py-3 border-b border-white/10 bg-[#141822]">
          <Search className="w-4 h-4 text-neutral-400 mr-3" />
          <input
            autoFocus
            type="text"
            placeholder="Type a command or search action..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-white focus:outline-none placeholder:text-neutral-500 font-sans"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-neutral-400 font-mono text-[10px] select-none">
            ESC
          </kbd>
        </div>

        {/* List */}
        <div className="p-2 max-h-72 overflow-y-auto space-y-1">
          {filtered.length > 0 ? (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-xs transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'text-neutral-300 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.title}</span>
                  </div>

                  <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${isSelected ? 'bg-blue-700 text-white' : 'bg-white/5 text-neutral-400'}`}>
                    {item.shortcut}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs text-neutral-500">
              No matching commands.
            </div>
          )}
        </div>

        {/* Footer tip */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#141822] border-t border-white/5 text-[11px] text-neutral-400">
          <span className="flex items-center gap-1.5">
            <Command className="w-3 h-3" /> Navigate with ↑ ↓ Enter
          </span>
          <span>JAMES Commands</span>
        </div>
      </div>
    </div>
  );
};
