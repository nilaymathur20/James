import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Plus,
  Copy,
  Check,
  Send,
  FileCode,
  Sparkles,
  Terminal,
  Shield,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { LibraryTemplate } from '../types/chat';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (prompt: string) => void;
  onOpenInEditor?: (title: string, content: string) => void;
}

const DEFAULT_TEMPLATES: LibraryTemplate[] = [
  {
    id: 'tpl-1',
    title: 'Code Refactoring & Hot Loop Optimization',
    category: 'coding',
    description: 'Refactor hot-loop algorithms to avoid memory allocation and garbage collection churn.',
    prompt: `Review the following code for memory allocation hotspots, unnecessary garbage collection churn, and algorithmic complexity:

[Insert Code Here]

Provide:
1. Identified bottlenecks and asymptotic complexity (Big-O).
2. Optimized, type-safe implementation using zero-allocation or typed buffers where appropriate.
3. Benchmark or performance trade-off explanation.`,
  },
  {
    id: 'tpl-2',
    title: 'Comprehensive Unit & Edge Case Test Suite',
    category: 'coding',
    description: 'Generate high-coverage unit tests with boundary checks, mock dependencies, and error branches.',
    prompt: `Generate a production-ready, type-safe unit test suite using TypeScript and Vitest/Jest for the following component/function:

[Insert Code Here]

Cover:
- Happy path execution
- Boundary conditions (empty input, null, overflow)
- Error handling & exception assertions
- Mocking external side effects`,
  },
  {
    id: 'tpl-3',
    title: 'Security Vulnerability & Threat Modeling Review',
    category: 'analysis',
    description: 'Audit architecture or code against OWASP Top 10, injection risks, and auth flaws.',
    prompt: `Perform a comprehensive security audit on this implementation against OWASP guidelines:

[Insert Architecture or Code Here]

Analyze:
1. Authentication & Authorization bypass risks (IDOR, privilege escalation).
2. Input sanitization, injection vectors (SQL, XSS, SSRF).
3. Secret management and data exposure risks.
4. Concrete remediation code with explanation.`,
  },
  {
    id: 'tpl-4',
    title: 'System Architecture RFC & Trade-Off Matrix',
    category: 'workflow',
    description: 'Draft a technical design doc comparing architecture alternatives with concrete pros/cons.',
    prompt: `Draft a Request for Comments (RFC) engineering document for:

[Insert System Goal Here]

Structure:
- Problem Statement & Constraints
- Proposed Architecture & Data Flow
- Alternative Approaches Considered
- Trade-off Matrix (Latency, Cost, Operational Complexity)
- Invariants & Rollout Plan`,
  },
  {
    id: 'tpl-5',
    title: 'Executive Meeting Transcript Summarizer',
    category: 'workflow',
    description: 'Extract concise executive takeaways, decision logs, and owners from raw meeting transcripts.',
    prompt: `Summarize the following meeting or conversation transcript:

[Insert Transcript Here]

Output:
1. Executive Summary (3-4 sentences max)
2. Decisions Agreed Upon
3. Action Items with Assigned Owners and Deadlines
4. Open Unresolved Questions`,
  },
];

const STORAGE_KEY_CUSTOM_TEMPLATES = 'james_custom_templates_v1';

export const LibraryModal: React.FC<LibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectPrompt,
  onOpenInEditor,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'coding' | 'analysis' | 'workflow' | 'system'>('coding');
  const [newDesc, setNewDesc] = useState('');
  const [newPrompt, setNewPrompt] = useState('');

  const [customTemplates, setCustomTemplates] = useState<LibraryTemplate[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CUSTOM_TEMPLATES);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  if (!isOpen) return null;

  const allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];

  const filtered = allTemplates.filter(
    (t) => activeCategory === 'all' || t.category === activeCategory
  );

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newPrompt.trim()) return;

    const created: LibraryTemplate = {
      id: `custom-tpl-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      description: newDesc.trim() || 'Custom prompt template',
      prompt: newPrompt.trim(),
    };

    const updated = [created, ...customTemplates];
    setCustomTemplates(updated);
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_TEMPLATES, JSON.stringify(updated));
    } catch {}

    setNewTitle('');
    setNewDesc('');
    setNewPrompt('');
    setIsCreating(false);
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
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Prompt & Template Library
              </h2>
              <p className="text-xs text-neutral-400">
                Curated technical blueprints, reasoning prompts, and saved workflows.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isCreating ? 'View Library' : 'Create Template'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {isCreating ? (
            /* Custom Template Creator Form */
            <form onSubmit={handleSaveCustom} className="space-y-4 max-w-2xl mx-auto">
              <span className="text-sm font-semibold text-white block">
                Create New Template
              </span>

              <div className="space-y-1">
                <label className="text-neutral-400">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Database Migration Verification Script"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#141822] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500 font-sans"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-neutral-400">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-[#141822] border border-white/10 text-white text-xs focus:outline-none"
                  >
                    <option value="coding">Coding & Systems</option>
                    <option value="analysis">Security & Analysis</option>
                    <option value="workflow">Workflow & Summaries</option>
                    <option value="system">System Directives</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-neutral-400">Brief Description</label>
                  <input
                    type="text"
                    placeholder="Short description of purpose"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#141822] border border-white/10 text-white text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400">Prompt Content</label>
                <textarea
                  rows={6}
                  placeholder="Write the full reusable prompt directive here..."
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  className="w-full p-3 rounded-lg bg-[#141822] border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded-md bg-white/5 hover:bg-white/10 text-neutral-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-sm"
                >
                  Save to Library
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Category Pills */}
              <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                {[
                  { id: 'all', label: 'All Templates' },
                  { id: 'coding', label: 'Coding & Architecture' },
                  { id: 'analysis', label: 'Security & Analysis' },
                  { id: 'workflow', label: 'Workflow & Summaries' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                      activeCategory === cat.id
                        ? 'bg-blue-600 text-white font-medium'
                        : 'bg-[#141822] text-neutral-400 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Template Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="p-4 rounded-xl bg-[#141822] border border-white/5 hover:border-white/10 transition-colors flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-white text-sm">
                          {tpl.title}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/5 text-neutral-400 shrink-0">
                          {tpl.category}
                        </span>
                      </div>
                      <p className="text-neutral-400 text-xs leading-relaxed">
                        {tpl.description}
                      </p>
                    </div>

                    <div className="p-2.5 rounded bg-[#090b10] border border-white/5 font-mono text-[11px] text-neutral-400 line-clamp-3">
                      {tpl.prompt}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopy(tpl.id, tpl.prompt)}
                          className="inline-flex items-center gap-1 text-neutral-400 hover:text-white"
                          title="Copy prompt"
                        >
                          {copiedId === tpl.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === tpl.id ? 'Copied' : 'Copy'}</span>
                        </button>

                        {onOpenInEditor && (
                          <button
                            onClick={() => {
                              onOpenInEditor(tpl.title, tpl.prompt);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1 text-neutral-400 hover:text-blue-300"
                            title="Edit in Document Editor"
                          >
                            <FileCode className="w-3.5 h-3.5" />
                            <span>Editor</span>
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          onSelectPrompt(tpl.prompt);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                      >
                        <span>Use Prompt</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
