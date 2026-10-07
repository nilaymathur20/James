import React, { useState, useEffect, useRef } from 'react';
import {
  Conversation,
  Message,
  Persona,
  TokenMetrics,
  Attachment,
  Folder,
  AutoIndexedFile,
} from './types/chat';
import { DEFAULT_PERSONAS } from './data/personas';
import { ChatSidebar } from './components/ChatSidebar';
import { ChatHeader } from './components/ChatHeader';
import { ChatMessageItem } from './components/ChatMessageItem';
import { ChatComposer } from './components/ChatComposer';
import { ChatEmptyState } from './components/ChatEmptyState';
import { TokenInspectorModal } from './components/TokenInspectorModal';
import { PersonaSelector } from './components/PersonaSelector';
import { CommandPalette } from './components/CommandPalette';
import { SavedInsightsDrawer } from './components/SavedInsightsDrawer';
import { SearchMessagesModal } from './components/SearchMessagesModal';
import { LandingPage } from './components/LandingPage';
import { VideoTranscriptionModal } from './components/VideoTranscriptionModal';
import { DocumentEditorModal } from './components/DocumentEditorModal';
import { HistoryModal } from './components/HistoryModal';
import { LibraryModal } from './components/LibraryModal';
import { PeerToPeerModal } from './components/PeerToPeerModal';
import { ComputerAutoIndexModal } from './components/ComputerAutoIndexModal';
import { ArrowDown, CheckCircle2 } from 'lucide-react';

const STORAGE_KEY_CHATS = 'james_conversations_v1';
const STORAGE_KEY_LEGACY_CHATS = 'aether_conversations_v1';
const STORAGE_KEY_CUSTOM_PERSONAS = 'james_custom_personas_v1';
const STORAGE_KEY_ACTIVE_ID = 'james_active_chat_id_v1';
const STORAGE_KEY_FOLDERS = 'james_folders_v1';
const STORAGE_KEY_INDEXED_FILES = 'james_indexed_files_v1';

export default function App() {
  // Navigation view: landing page vs active chat workspace
  const [currentView, setCurrentView] = useState<'landing' | 'chat'>('landing');

  // Custom personas state
  const [customPersonas, setCustomPersonas] = useState<Persona[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CUSTOM_PERSONAS);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const allPersonas = [...DEFAULT_PERSONAS, ...customPersonas];

  // Project Folders State
  const [folders, setFolders] = useState<Folder[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_FOLDERS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      { id: 'f-eng', name: 'Software & Code', createdAt: Date.now() },
      { id: 'f-res', name: 'Research & Notes', createdAt: Date.now() },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(folders));
    } catch {}
  }, [folders]);

  // Computer Auto-Indexed Files State
  const [indexedFiles, setIndexedFiles] = useState<AutoIndexedFile[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_INDEXED_FILES);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_INDEXED_FILES, JSON.stringify(indexedFiles));
    } catch {}
  }, [indexedFiles]);

  // Conversations state (with legacy fallback)
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const stored =
        localStorage.getItem(STORAGE_KEY_CHATS) ||
        localStorage.getItem(STORAGE_KEY_LEGACY_CHATS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}

    const initialChat: Conversation = {
      id: `chat-${Date.now()}`,
      title: 'Welcome to JAMES',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pinned: true,
      messages: [],
      systemInstruction: DEFAULT_PERSONAS[0].systemPrompt,
      model: 'gemini-3.8-flash',
      temperature: DEFAULT_PERSONAS[0].temperature,
      topP: 0.95,
      maxOutputTokens: 4096,
      personaId: DEFAULT_PERSONAS[0].id,
      enableThinking: false,
      thinkingBudget: 2048,
      contextWindowStrategy: 'all',
    };
    return [initialChat];
  });

  // Active chat ID
  const [activeChatId, setActiveChatId] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
      if (stored && conversations.some((c) => c.id === stored)) return stored;
    } catch {}
    return conversations[0]?.id || `chat-${Date.now()}`;
  });

  // Active conversation object
  const activeConversation =
    conversations.find((c) => c.id === activeChatId) || conversations[0];

  // Active persona
  const activePersona =
    allPersonas.find((p) => p.id === activeConversation.personaId) ||
    DEFAULT_PERSONAS[0];

  // Streaming & Generation state
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // UI Modals & Panels state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isTokenInspectorOpen, setIsTokenInspectorOpen] = useState(false);
  const [isPersonaSelectorOpen, setIsPersonaSelectorOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSavedInsightsOpen, setIsSavedInsightsOpen] = useState(false);
  const [isSearchMessagesOpen, setIsSearchMessagesOpen] = useState(false);

  // New Modals: Transcribe, Document Editor, History, Library, P2P, AutoIndex
  const [isTranscribeOpen, setIsTranscribeOpen] = useState(false);
  const [isDocumentEditorOpen, setIsDocumentEditorOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isP2POpen, setIsP2POpen] = useState(false);
  const [isAutoIndexOpen, setIsAutoIndexOpen] = useState(false);
  const [editorInitialDoc, setEditorInitialDoc] = useState<{ title: string; content: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Scroll & view tracking
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Token Metrics
  const [tokenMetrics, setTokenMetrics] = useState<TokenMetrics>({
    totalSessionTokens: 0,
    maxContextWindow: 1048576,
    lastTurnTokens: 0,
    tokensPerSecond: '50.0',
    averageLatencyMs: 1200,
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Sync to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(conversations));
      localStorage.setItem(STORAGE_KEY_ACTIVE_ID, activeChatId);
    } catch (e) {
      console.warn('LocalStorage quota exceeded or unavailable', e);
    }
  }, [conversations, activeChatId]);

  // Recalculate token metrics
  useEffect(() => {
    let totalTokens = 0;
    let lastTurn = 0;

    activeConversation.messages.forEach((msg) => {
      if (msg.stats) {
        totalTokens += msg.stats.totalTokens;
        lastTurn = msg.stats.candidatesTokens;
      } else {
        const est = Math.ceil(msg.content.length / 4);
        totalTokens += est;
        lastTurn = est;
      }
    });

    setTokenMetrics((prev) => ({
      ...prev,
      totalSessionTokens: totalTokens,
      lastTurnTokens: lastTurn,
    }));
  }, [activeConversation]);

  // Scroll to bottom
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (!isStreaming) {
      scrollToBottom('auto');
    }
  }, [activeConversation.id]);

  useEffect(() => {
    if (isStreaming) {
      scrollToBottom('auto');
    }
  }, [activeConversation.messages]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottom(distanceToBottom > 160);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      if (isMeta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (isMeta && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleCreateNewChat();
      } else if (isMeta && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        setIsTokenInspectorOpen((prev) => !prev);
      } else if (isMeta && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsPersonaSelectorOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setIsTokenInspectorOpen(false);
        setIsPersonaSelectorOpen(false);
        setIsTranscribeOpen(false);
        setIsDocumentEditorOpen(false);
        setIsHistoryOpen(false);
        setIsLibraryOpen(false);
        setIsP2POpen(false);
        setIsAutoIndexOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePersona, conversations]);

  // Update active conversation
  const updateActiveConversation = (updates: Partial<Conversation>) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? { ...c, ...updates, updatedAt: Date.now() }
          : c
      )
    );
  };

  // Create new chat
  const handleCreateNewChat = (folderId?: string | null) => {
    const newChat: Conversation = {
      id: `chat-${Date.now()}`,
      title: 'New conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pinned: false,
      messages: [],
      systemInstruction: activePersona.systemPrompt,
      model: activeConversation.model,
      temperature: activePersona.temperature,
      topP: activePersona.topP,
      maxOutputTokens: activePersona.maxTokens,
      personaId: activePersona.id,
      folderId: folderId || activeConversation.folderId || null,
      enableThinking: activeConversation.enableThinking || false,
      thinkingBudget: activeConversation.thinkingBudget || 2048,
      contextWindowStrategy: 'all',
    };

    setConversations((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setIsMobileSidebarOpen(false);
    setCurrentView('chat');
  };

  // Delete chat
  const handleDeleteChat = (id: string) => {
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (filtered.length === 0) {
        const replacement: Conversation = {
          id: `chat-${Date.now()}`,
          title: 'New conversation',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          pinned: false,
          messages: [],
          systemInstruction: DEFAULT_PERSONAS[0].systemPrompt,
          model: 'gemini-3.8-flash',
          temperature: DEFAULT_PERSONAS[0].temperature,
          topP: 0.95,
          maxOutputTokens: 4096,
          personaId: DEFAULT_PERSONAS[0].id,
          contextWindowStrategy: 'all',
        };
        setActiveChatId(replacement.id);
        return [replacement];
      }
      if (activeChatId === id) {
        setActiveChatId(filtered[0].id);
      }
      return filtered;
    });
    showToast('Conversation deleted.');
  };

  // Clear active chat messages
  const handleClearChat = () => {
    updateActiveConversation({ messages: [] });
    showToast('Cleared conversation messages.');
  };

  // Stop generation stream
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  // Toggle Thinking / Reasoning Mode
  const handleToggleThinking = () => {
    const nextVal = !activeConversation.enableThinking;
    updateActiveConversation({ enableThinking: nextVal });
    showToast(nextVal ? 'Reasoning mode enabled' : 'Reasoning mode disabled');
  };

  // Folder Operations
  const handleCreateFolder = (name: string) => {
    const newFolder: Folder = {
      id: `f-${Date.now()}`,
      name,
      createdAt: Date.now(),
    };
    setFolders((prev) => [...prev, newFolder]);
    showToast(`Project folder "${name}" created.`);
  };

  const handleDeleteFolder = (id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setConversations((prev) =>
      prev.map((c) => (c.folderId === id ? { ...c, folderId: null } : c))
    );
    showToast('Folder deleted.');
  };

  const handleMoveChatToFolder = (chatId: string, folderId: string | null) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, folderId } : c))
    );
    const targetFolder = folders.find((f) => f.id === folderId);
    showToast(targetFolder ? `Moved to "${targetFolder.name}"` : 'Removed from folder');
  };

  // Auto Index File Operations
  const handleAddIndexedFiles = (newFiles: AutoIndexedFile[]) => {
    setIndexedFiles((prev) => [...prev, ...newFiles]);
    showToast(`Indexed ${newFiles.length} files successfully.`);
  };

  const handleRemoveIndexedFile = (id: string) => {
    setIndexedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClearIndexedFiles = () => {
    setIndexedFiles([]);
    showToast('Cleared indexed files.');
  };

  // Open Document in Editor
  const handleOpenInEditor = (title: string, content: string) => {
    setEditorInitialDoc({ title, content });
    setIsDocumentEditorOpen(true);
  };

  // Share Snippet / Conversation
  const handleShare = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copied content to clipboard!');
  };

  // Send Message with SSE Streaming & Thinking Support
  const handleSendMessage = async (
    content: string,
    attachments: Attachment[] = []
  ) => {
    if (isStreaming) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    // Auto title for the first turn if default
    let updatedTitle = activeConversation.title;
    if (
      activeConversation.messages.length === 0 ||
      activeConversation.title === 'New conversation' ||
      activeConversation.title === 'Welcome to JAMES' ||
      activeConversation.title === 'Welcome to Aether AI'
    ) {
      updatedTitle = content.slice(0, 32) || 'Conversation';
    }

    const updatedMessages = [...activeConversation.messages, userMessage];

    // Placeholder model message
    const modelMessageId = `msg-${Date.now() + 1}-${Math.random().toString(36).substr(2, 4)}`;
    const initialModelMessage: Message = {
      id: modelMessageId,
      role: 'model',
      content: '',
      thought: '',
      timestamp: Date.now(),
      variants: [''],
      variantIndex: 0,
    };

    updateActiveConversation({
      title: updatedTitle,
      messages: [...updatedMessages, initialModelMessage],
    });

    setIsStreaming(true);

    // Filter context according to strategy
    let contextMessages = updatedMessages;
    if (activeConversation.contextWindowStrategy === 'last10') {
      contextMessages = updatedMessages.slice(-10);
    } else if (activeConversation.contextWindowStrategy === 'last20') {
      contextMessages = updatedMessages.slice(-20);
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: contextMessages,
          model: activeConversation.model,
          systemInstruction: activeConversation.systemInstruction || activePersona.systemPrompt,
          temperature: activeConversation.temperature,
          topP: activeConversation.topP,
          maxOutputTokens: activeConversation.maxOutputTokens,
          enableThinking: activeConversation.enableThinking || false,
          thinkingBudget: activeConversation.thinkingBudget || 2048,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');

      if (!reader) {
        throw new Error('Readable stream not supported');
      }

      let accumulatedContent = '';
      let accumulatedThought = '';
      let streamStats: any = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));

              if (parsed.thoughtText) {
                accumulatedThought += parsed.thoughtText;
                setConversations((prev) =>
                  prev.map((c) => {
                    if (c.id !== activeConversation.id) return c;
                    return {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === modelMessageId
                          ? { ...m, thought: accumulatedThought }
                          : m
                      ),
                    };
                  })
                );
              }

              if (parsed.text) {
                accumulatedContent += parsed.text;
                setConversations((prev) =>
                  prev.map((c) => {
                    if (c.id !== activeConversation.id) return c;
                    return {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === modelMessageId
                          ? {
                              ...m,
                              content: accumulatedContent,
                              thought: accumulatedThought || m.thought,
                              variants: [accumulatedContent],
                            }
                          : m
                      ),
                    };
                  })
                );
              }

              if (parsed.stats) {
                streamStats = parsed.stats;
              }

              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch {
              // Ignore partial JSON lines
            }
          }
        }
      }

      // Finalize message with stats
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeConversation.id) return c;
          return {
            ...c,
            messages: c.messages.map((m) =>
              m.id === modelMessageId
                ? {
                    ...m,
                    content: accumulatedContent,
                    thought: accumulatedThought,
                    variants: [accumulatedContent],
                    stats: streamStats || {
                      durationMs: 1200,
                      promptTokens: Math.ceil(content.length / 4),
                      candidatesTokens: Math.ceil(accumulatedContent.length / 4),
                      totalTokens:
                        Math.ceil(content.length / 4) +
                        Math.ceil(accumulatedContent.length / 4),
                      tokensPerSecond: '52',
                    },
                  }
                : m
            ),
          };
        })
      );
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Cancelled by user
      } else {
        console.error('Generation error:', err);
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== activeConversation.id) return c;
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === modelMessageId
                  ? {
                      ...m,
                      content:
                        err.message ||
                        'Could not connect to the Gemini service. Please check your network and try again.',
                      isError: true,
                    }
                  : m
              ),
            };
          })
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  // Regenerate Response
  const handleRegenerate = async (targetMessageIndex: number) => {
    if (isStreaming) return;

    const userMsg = activeConversation.messages[targetMessageIndex - 1];
    if (!userMsg) return;

    const previousHistory = activeConversation.messages.slice(0, targetMessageIndex);

    updateActiveConversation({ messages: previousHistory });
    handleSendMessage(userMsg.content, userMsg.attachments);
  };

  // Edit user message
  const handleEditUserMessage = (msgId: string, newContent: string) => {
    const idx = activeConversation.messages.findIndex((m) => m.id === msgId);
    if (idx === -1) return;

    const sliced = activeConversation.messages.slice(0, idx);
    const target = activeConversation.messages[idx];

    updateActiveConversation({ messages: sliced });
    handleSendMessage(newContent, target.attachments);
  };

  // Toggle Pin message
  const handleTogglePinMessage = (msgId: string) => {
    updateActiveConversation({
      messages: activeConversation.messages.map((m) =>
        m.id === msgId ? { ...m, pinned: !m.pinned } : m
      ),
    });
    showToast('Updated saved message status.');
  };

  // Export conversation
  const handleExportChat = (format: 'markdown' | 'json' | 'txt') => {
    let content = '';
    let filename = `${activeConversation.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

    if (format === 'json') {
      content = JSON.stringify(activeConversation, null, 2);
      filename += '.json';
    } else if (format === 'markdown') {
      content = `# ${activeConversation.title}\nDirective: ${activePersona.name} | Model: ${activeConversation.model}\n\n`;
      activeConversation.messages.forEach((m) => {
        const role = m.role === 'user' ? '### User' : `### ${activePersona.name}`;
        content += `${role} (${new Date(m.timestamp).toLocaleTimeString()}):\n${m.content}\n\n`;
      });
      filename += '.md';
    } else {
      activeConversation.messages.forEach((m) => {
        const role = m.role === 'user' ? 'USER' : 'JAMES';
        content += `[${new Date(m.timestamp).toLocaleTimeString()}] ${role}:\n${m.content}\n\n`;
      });
      filename += '.txt';
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Exported as ${format.toUpperCase()}`);
  };

  // Import conversation from P2P or history
  const handleImportConversation = (imported: Conversation) => {
    const freshId = `chat-${Date.now()}`;
    const cleanConv: Conversation = {
      ...imported,
      id: freshId,
      title: `${imported.title} (Imported)`,
      updatedAt: Date.now(),
    };
    setConversations((prev) => [cleanConv, ...prev]);
    setActiveChatId(freshId);
    showToast('Imported conversation to your workspace!');
  };

  // Jump to specific message
  const handleJumpToMessage = (_id: string) => {
    setIsSavedInsightsOpen(false);
    setIsSearchMessagesOpen(false);
  };

  if (currentView === 'landing') {
    return (
      <LandingPage
        onLaunchChat={() => setCurrentView('chat')}
        onSelectPromptAndLaunch={(prompt) => {
          handleSendMessage(prompt);
          setCurrentView('chat');
        }}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0b0d13] text-neutral-100 font-sans selection:bg-blue-600/30 selection:text-blue-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#141822] border border-white/10 text-white text-xs shadow-xl animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Sidebar for Desktop */}
      <div className="hidden md:flex h-full shrink-0 z-20">
        <ChatSidebar
          conversations={conversations}
          activeId={activeChatId}
          onSelect={(id) => {
            setActiveChatId(id);
          }}
          onNewChat={handleCreateNewChat}
          onDeleteChat={handleDeleteChat}
          onTogglePin={(id) => {
            setConversations((prev) =>
              prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
            );
          }}
          onRenameChat={(id, title) => {
            setConversations((prev) =>
              prev.map((c) => (c.id === id ? { ...c, title } : c))
            );
          }}
          activePersona={activePersona}
          onOpenPersonaSelector={() => setIsPersonaSelectorOpen(true)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          selectedModel={activeConversation.model}
          onSelectModel={(model) => updateActiveConversation({ model })}
          onBackToLanding={() => setCurrentView('landing')}
          folders={folders}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
          onMoveChatToFolder={handleMoveChatToFolder}
          onOpenTranscribe={() => setIsTranscribeOpen(true)}
          onOpenDocumentEditor={() => setIsDocumentEditorOpen(true)}
          onOpenHistory={() => setIsHistoryOpen(true)}
          onOpenLibrary={() => setIsLibraryOpen(true)}
          onOpenP2P={() => setIsP2POpen(true)}
          onOpenAutoIndex={() => setIsAutoIndexOpen(true)}
        />
      </div>

      {/* Mobile Drawer Sidebar */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 md:hidden flex"
          onClick={() => setIsMobileSidebarOpen(false)}
        >
          <div
            className="w-80 h-full bg-[#0e1118]"
            onClick={(e) => e.stopPropagation()}
          >
            <ChatSidebar
              conversations={conversations}
              activeId={activeChatId}
              onSelect={(id) => {
                setActiveChatId(id);
                setIsMobileSidebarOpen(false);
              }}
              onNewChat={handleCreateNewChat}
              onDeleteChat={handleDeleteChat}
              onTogglePin={(id) => {
                setConversations((prev) =>
                  prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
                );
              }}
              onRenameChat={(id, title) => {
                setConversations((prev) =>
                  prev.map((c) => (c.id === id ? { ...c, title } : c))
                );
              }}
              activePersona={activePersona}
              onOpenPersonaSelector={() => {
                setIsMobileSidebarOpen(false);
                setIsPersonaSelectorOpen(true);
              }}
              isCollapsed={false}
              onToggleCollapse={() => setIsMobileSidebarOpen(false)}
              selectedModel={activeConversation.model}
              onSelectModel={(model) => updateActiveConversation({ model })}
              onBackToLanding={() => setCurrentView('landing')}
              folders={folders}
              onCreateFolder={handleCreateFolder}
              onDeleteFolder={handleDeleteFolder}
              onMoveChatToFolder={handleMoveChatToFolder}
              onOpenTranscribe={() => setIsTranscribeOpen(true)}
              onOpenDocumentEditor={() => setIsDocumentEditorOpen(true)}
              onOpenHistory={() => setIsHistoryOpen(true)}
              onOpenLibrary={() => setIsLibraryOpen(true)}
              onOpenP2P={() => setIsP2POpen(true)}
              onOpenAutoIndex={() => setIsAutoIndexOpen(true)}
            />
          </div>
        </div>
      )}

      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative z-10">
        {/* Header Bar */}
        <ChatHeader
          activeConversation={activeConversation}
          activePersona={activePersona}
          tokenMetrics={tokenMetrics}
          onOpenSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenTokenInspector={() => setIsTokenInspectorOpen(true)}
          onOpenPersonaSelector={() => setIsPersonaSelectorOpen(true)}
          onOpenSearchMessages={() => setIsSearchMessagesOpen(true)}
          onOpenSavedInsights={() => setIsSavedInsightsOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onClearChat={handleClearChat}
          onExportChat={handleExportChat}
          selectedModel={activeConversation.model}
          onSelectModel={(model) => updateActiveConversation({ model })}
          onBackToLanding={() => setCurrentView('landing')}
        />

        {/* Message Stream Area */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col"
        >
          {activeConversation.messages.length === 0 ? (
            <ChatEmptyState
              persona={activePersona}
              onOpenPersonaSelector={() => setIsPersonaSelectorOpen(true)}
              onOpenTokenInspector={() => setIsTokenInspectorOpen(true)}
              onSelectPrompt={(prompt) => handleSendMessage(prompt)}
              maxOutputTokens={activeConversation.maxOutputTokens}
            />
          ) : (
            <div className="py-4 space-y-1">
              {activeConversation.messages.map((msg, index) => (
                <ChatMessageItem
                  key={msg.id}
                  message={msg}
                  persona={activePersona}
                  isStreaming={
                    isStreaming &&
                    index === activeConversation.messages.length - 1 &&
                    msg.role === 'model'
                  }
                  onRegenerate={() => handleRegenerate(index)}
                  onEdit={(newContent) => handleEditUserMessage(msg.id, newContent)}
                  onTogglePin={() => handleTogglePinMessage(msg.id)}
                  onShare={handleShare}
                  onOpenInEditor={handleOpenInEditor}
                />
              ))}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}

          {/* Floating Scroll to Bottom button */}
          {showScrollBottom && (
            <button
              onClick={() => scrollToBottom('smooth')}
              className="fixed bottom-24 right-8 z-30 p-2.5 rounded-full bg-[#171b26] border border-white/10 text-white shadow-xl hover:bg-[#1f2533] transition-colors"
              title="Scroll to bottom"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Input Composer with Speech Dictation & Reasoning Toggle */}
        <ChatComposer
          onSendMessage={handleSendMessage}
          isStreaming={isStreaming}
          onStopGeneration={handleStopGeneration}
          personaId={activePersona.id}
          enableThinking={activeConversation.enableThinking || false}
          onToggleThinking={handleToggleThinking}
        />
      </div>

      {/* Modals & Drawers */}
      <TokenInspectorModal
        isOpen={isTokenInspectorOpen}
        onClose={() => setIsTokenInspectorOpen(false)}
        metrics={tokenMetrics}
        activeConversation={activeConversation}
        onUpdateConversation={updateActiveConversation}
      />

      <PersonaSelector
        isOpen={isPersonaSelectorOpen}
        onClose={() => setIsPersonaSelectorOpen(false)}
        activePersonaId={activePersona.id}
        onSelectPersona={(persona) => {
          updateActiveConversation({
            personaId: persona.id,
            systemInstruction: persona.systemPrompt,
            temperature: persona.temperature,
            maxOutputTokens: persona.maxTokens,
          });
        }}
        customPersonas={customPersonas}
        onSaveCustomPersona={(newPersona) => {
          setCustomPersonas((prev) => {
            const updated = [newPersona, ...prev];
            try {
              localStorage.setItem(STORAGE_KEY_CUSTOM_PERSONAS, JSON.stringify(updated));
            } catch {}
            return updated;
          });
        }}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNewChat={handleCreateNewChat}
        onClearChat={handleClearChat}
        onOpenTokenInspector={() => setIsTokenInspectorOpen(true)}
        onOpenPersonaSelector={() => setIsPersonaSelectorOpen(true)}
        onExportChat={handleExportChat}
      />

      <SavedInsightsDrawer
        isOpen={isSavedInsightsOpen}
        onClose={() => setIsSavedInsightsOpen(false)}
        activeConversation={activeConversation}
        onJumpToMessage={handleJumpToMessage}
        onUnpinMessage={handleTogglePinMessage}
      />

      <SearchMessagesModal
        isOpen={isSearchMessagesOpen}
        onClose={() => setIsSearchMessagesOpen(false)}
        activeConversation={activeConversation}
        onJumpToMessage={handleJumpToMessage}
      />

      {/* Video & Audio Transcription Modal */}
      <VideoTranscriptionModal
        isOpen={isTranscribeOpen}
        onClose={() => setIsTranscribeOpen(false)}
        onInsertToChat={(text) => handleSendMessage(text)}
        onOpenInEditor={handleOpenInEditor}
      />

      {/* Document & Code Editor / Sandbox Runner Modal */}
      <DocumentEditorModal
        isOpen={isDocumentEditorOpen}
        onClose={() => setIsDocumentEditorOpen(false)}
        onSendToChat={(prompt) => handleSendMessage(prompt)}
        folders={folders}
        initialDoc={editorInitialDoc}
      />

      {/* History Manager Modal */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        conversations={conversations}
        activeId={activeChatId}
        onSelectConversation={(id) => setActiveChatId(id)}
        onDeleteConversation={handleDeleteChat}
        onClearAll={() => {
          setConversations([]);
          handleCreateNewChat();
        }}
        folders={folders}
      />

      {/* Prompt & Template Library Modal */}
      <LibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onSelectPrompt={(prompt) => handleSendMessage(prompt)}
        onOpenInEditor={handleOpenInEditor}
      />

      {/* Peer to Peer Connection Modal */}
      <PeerToPeerModal
        isOpen={isP2POpen}
        onClose={() => setIsP2POpen(false)}
        activeConversation={activeConversation}
        onImportConversation={handleImportConversation}
      />

      {/* Computer Auto-Index Modal */}
      <ComputerAutoIndexModal
        isOpen={isAutoIndexOpen}
        onClose={() => setIsAutoIndexOpen(false)}
        indexedFiles={indexedFiles}
        onAddFiles={handleAddIndexedFiles}
        onRemoveFile={handleRemoveIndexedFile}
        onClearIndex={handleClearIndexedFiles}
        onInjectToChat={(snippet) => handleSendMessage(snippet)}
      />
    </div>
  );
}
