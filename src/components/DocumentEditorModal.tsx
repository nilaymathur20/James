import React, { useState, useEffect } from 'react';
import {
  X,
  FileCode,
  Play,
  Save,
  Download,
  Plus,
  Trash2,
  Copy,
  Check,
  Send,
  Eye,
  Terminal,
  Folder as FolderIcon,
  RotateCcw,
} from 'lucide-react';
import { EditorDocument, Folder } from '../types/chat';

interface DocumentEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendToChat: (prompt: string) => void;
  folders: Folder[];
  initialDoc?: { title: string; content: string } | null;
}

const STORAGE_KEY_DOCS = 'james_editor_documents_v1';

const DEFAULT_DOCUMENTS: EditorDocument[] = [
  {
    id: 'doc-welcome',
    title: 'getting-started.md',
    content: `# Welcome to JAMES Document & Code Workspace

This environment lets you draft documents, write scripts, and preview interactive artifacts.

### Key Capabilities:
- **Interactive Sandbox**: Click "Run & Preview" to execute HTML/CSS/JS in an isolated iframe.
- **Markdown & JSON Rendering**: Instant formatted view for documentation and data schemas.
- **Direct Assistant Loop**: Click "Send to JAMES" to request code review, refactoring, or test generation.
- **Project Organization**: Organize files by folder/project.

\`\`\`typescript
export function calculateBudget(promptTokens: number, maxCap: number): number {
  return Math.min(maxCap, promptTokens * 1.5);
}
\`\`\`
`,
    language: 'markdown',
    updatedAt: Date.now(),
  },
  {
    id: 'doc-interactive-demo',
    title: 'interactive-widget.html',
    content: `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: system-ui, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .card {
      background: #1e293b;
      padding: 24px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.1);
      max-width: 380px;
      width: 100%;
      text-align: center;
    }
    button {
      background: #2563eb;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      margin-top: 16px;
    }
    button:hover { background: #1d4ed8; }
    .count { font-size: 32px; font-weight: bold; color: #60a5fa; margin: 12px 0; }
  </style>
</head>
<body>
  <div class="card">
    <h2>JAMES Sandbox Demo</h2>
    <p style="color:#94a3b8; font-size:14px;">Live preview running in an isolated sandboxed iframe.</p>
    <div id="counter" class="count">0</div>
    <button onclick="increment()">Click to Counter</button>
  </div>
  <script>
    let n = 0;
    function increment() {
      n++;
      document.getElementById('counter').innerText = n;
      console.log('Counter updated to ' + n);
    }
  </script>
</body>
</html>`,
    language: 'html',
    updatedAt: Date.now(),
  },
];

export const DocumentEditorModal: React.FC<DocumentEditorModalProps> = ({
  isOpen,
  onClose,
  onSendToChat,
  folders,
  initialDoc,
}) => {
  const [documents, setDocuments] = useState<EditorDocument[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_DOCS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_DOCUMENTS;
  });

  const [activeDocId, setActiveDocId] = useState<string>(DEFAULT_DOCUMENTS[0].id);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  // If initialDoc passed in, load or create it
  useEffect(() => {
    if (initialDoc && initialDoc.title) {
      const existing = documents.find((d) => d.title === initialDoc.title);
      if (existing) {
        setActiveDocId(existing.id);
      } else {
        const newDoc: EditorDocument = {
          id: `doc-${Date.now()}`,
          title: initialDoc.title,
          content: initialDoc.content,
          language: initialDoc.title.endsWith('.html') ? 'html' : 'markdown',
          updatedAt: Date.now(),
        };
        setDocuments((prev) => [newDoc, ...prev]);
        setActiveDocId(newDoc.id);
      }
    }
  }, [initialDoc]);

  // Save to storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(documents));
    } catch {}
  }, [documents]);

  if (!isOpen) return null;

  const activeDoc = documents.find((d) => d.id === activeDocId) || documents[0];

  const updateCurrentDoc = (updates: Partial<EditorDocument>) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === activeDoc.id
          ? { ...doc, ...updates, updatedAt: Date.now() }
          : doc
      )
    );
  };

  const handleCreateDocument = () => {
    const newDoc: EditorDocument = {
      id: `doc-${Date.now()}`,
      title: `document-${documents.length + 1}.md`,
      content: '# New Document\n\nWrite your content here...\n',
      language: 'markdown',
      updatedAt: Date.now(),
    };
    setDocuments((prev) => [newDoc, ...prev]);
    setActiveDocId(newDoc.id);
    setActiveTab('editor');
  };

  const handleDeleteDocument = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (documents.length <= 1) return;
    const remaining = documents.filter((d) => d.id !== id);
    setDocuments(remaining);
    if (activeDocId === id) {
      setActiveDocId(remaining[0].id);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(activeDoc.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([activeDoc.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeDoc.title;
    a.click;
    URL.revokeObjectURL(url);
  };

  const handleSendToAssistant = (instruction: string) => {
    const prompt = `${instruction}:\n\nFile: \`${activeDoc.title}\` (${activeDoc.language})\n\`\`\`${activeDoc.language}\n${activeDoc.content}\n\`\`\``;
    onSendToChat(prompt);
    onClose();
  };

  const lines = activeDoc.content.split('\n');
  const wordCount = activeDoc.content.trim() ? activeDoc.content.trim().split(/\s+/).length : 0;
  const charCount = activeDoc.content.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 select-none">
      <div
        className="w-full max-w-6xl h-[92vh] bg-[#11141c] border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#141822] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-[#1a202c] border border-white/5 text-blue-400">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Workspace Document & Code Editor
              </h2>
              <span className="text-xs text-neutral-400">
                Draft, edit, and preview files with live sandboxed execution.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#171b26] p-0.5 rounded-lg border border-white/5 text-xs">
              <button
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                  activeTab === 'editor'
                    ? 'bg-blue-600 text-white font-medium shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Editor</span>
              </button>

              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                  activeTab === 'preview'
                    ? 'bg-blue-600 text-white font-medium shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Play className="w-3.5 h-3.5" />
                <span>Run & Preview</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* File Tabs Strip */}
        <div className="px-4 py-2 border-b border-white/10 bg-[#0e1017] flex items-center justify-between shrink-0 overflow-x-auto gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => setActiveDocId(doc.id)}
                className={`flex items-center gap-2 px-3 py-1 rounded-md cursor-pointer text-xs font-mono transition-colors shrink-0 ${
                  doc.id === activeDoc.id
                    ? 'bg-[#1b2232] text-white border border-blue-500/40'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <span>{doc.title}</span>
                {documents.length > 1 && (
                  <button
                    onClick={(e) => handleDeleteDocument(doc.id, e)}
                    className="text-neutral-500 hover:text-rose-400 p-0.5"
                    title="Close document"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={handleCreateDocument}
              className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 text-xs flex items-center gap-1"
              title="New file"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Actions for Current Document */}
          <div className="flex items-center gap-2 shrink-0 text-xs">
            {/* Folder selection */}
            {folders.length > 0 && (
              <select
                value={activeDoc.folderId || ''}
                onChange={(e) => updateCurrentDoc({ folderId: e.target.value || null })}
                className="bg-[#171b26] border border-white/10 text-neutral-300 rounded px-2 py-1 text-[11px] focus:outline-none"
              >
                <option value="">No Project</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={handleCopy}
              className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-white/5"
              title="Copy content"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleDownload}
              className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-white/5"
              title="Download file"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* Assistant prompt actions */}
            <div className="flex items-center gap-1 pl-2 border-l border-white/10">
              <button
                onClick={() => handleSendToAssistant('Please review this code for bugs, performance and readability')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#171b26] hover:bg-[#1f2533] border border-white/10 text-neutral-300 hover:text-white text-xs transition-colors"
                title="Send to assistant for code review"
              >
                <Send className="w-3 h-3 text-blue-400" />
                <span>Ask Review</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Editor / Sandbox Area */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden bg-[#0a0d14]">
          {activeTab === 'editor' ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Document Title & Language Settings */}
              <div className="px-4 py-2 border-b border-white/5 bg-[#0f121a] flex items-center justify-between text-xs">
                <input
                  type="text"
                  value={activeDoc.title}
                  onChange={(e) => updateCurrentDoc({ title: e.target.value })}
                  className="bg-transparent text-white font-mono font-medium text-xs focus:outline-none w-64"
                  placeholder="filename.ext"
                />

                <div className="flex items-center gap-3 text-neutral-400 font-mono text-[11px] tabular-nums">
                  <span>{lines.length} lines</span>
                  <span>·</span>
                  <span>{wordCount} words</span>
                  <span>·</span>
                  <span>{charCount} chars</span>
                </div>
              </div>

              {/* Textarea Code Editor */}
              <div className="flex-1 flex overflow-hidden">
                {/* Line numbers gutter */}
                <div className="w-12 bg-[#090b10] border-r border-white/5 py-3 select-none text-right pr-2.5 font-mono text-xs text-neutral-600 overflow-hidden">
                  {lines.map((_, i) => (
                    <div key={i} className="leading-6">
                      {i + 1}
                    </div>
                  ))}
                </div>

                <textarea
                  value={activeDoc.content}
                  onChange={(e) => updateCurrentDoc({ content: e.target.value })}
                  className="flex-1 bg-transparent p-3 text-neutral-200 font-mono text-xs focus:outline-none resize-none leading-6 overflow-y-auto selection:bg-blue-600/30 selection:text-blue-200"
                  spellCheck={false}
                />
              </div>
            </div>
          ) : (
            /* Live Sandbox / Preview Pane */
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0b0e14]">
              <div className="px-4 py-2 border-b border-white/10 bg-[#141822] flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center gap-2">
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  Live Preview: {activeDoc.title}
                </span>

                <span className="text-[11px] text-neutral-400 font-mono">
                  Sandboxed Environment (iframe isolated)
                </span>
              </div>

              {/* Sandbox Renderer */}
              <div className="flex-1 bg-white overflow-hidden relative">
                {activeDoc.language === 'html' || activeDoc.title.endsWith('.html') ? (
                  <iframe
                    title="Live Preview"
                    sandbox="allow-scripts"
                    srcDoc={activeDoc.content}
                    className="w-full h-full border-none"
                  />
                ) : activeDoc.language === 'markdown' || activeDoc.title.endsWith('.md') ? (
                  <div className="w-full h-full bg-[#0e1118] text-neutral-100 p-6 overflow-y-auto font-sans leading-relaxed text-sm">
                    <pre className="whitespace-pre-wrap font-sans">
                      {activeDoc.content}
                    </pre>
                  </div>
                ) : (
                  <div className="w-full h-full bg-[#0a0d14] text-neutral-200 p-6 overflow-y-auto font-mono text-xs">
                    <div className="p-3 bg-[#11141c] rounded border border-white/10 text-emerald-400 mb-4">
                      Execution output simulation for {activeDoc.title}:
                    </div>
                    <pre className="text-neutral-300">{activeDoc.content}</pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
