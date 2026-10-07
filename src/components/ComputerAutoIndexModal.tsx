import React, { useState, useRef } from 'react';
import {
  X,
  HardDrive,
  Upload,
  Search,
  FileText,
  FileCode,
  Trash2,
  Check,
  Zap,
  Layers,
  ArrowRight,
  Database,
} from 'lucide-react';
import { AutoIndexedFile } from '../types/chat';

interface ComputerAutoIndexModalProps {
  isOpen: boolean;
  onClose: () => void;
  indexedFiles: AutoIndexedFile[];
  onAddFiles: (files: AutoIndexedFile[]) => void;
  onRemoveFile: (id: string) => void;
  onClearIndex: () => void;
  onInjectToChat: (fileSnippet: string) => void;
}

export const ComputerAutoIndexModal: React.FC<ComputerAutoIndexModalProps> = ({
  isOpen,
  onClose,
  indexedFiles,
  onAddFiles,
  onRemoveFile,
  onClearIndex,
  onInjectToChat,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<AutoIndexedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newIndexed: AutoIndexedFile[] = [];

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const tokenEstimate = Math.max(1, Math.ceil(text.length / 4));
        newIndexed.push({
          id: `idx-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: file.name,
          content: text,
          size: file.size,
          tokenCount: tokenEstimate,
          indexedAt: Date.now(),
        });

        if (newIndexed.length === files.length) {
          onAddFiles(newIndexed);
        }
      };
      reader.readAsText(file);
    });

    e.target.value = '';
  };

  const filteredFiles = indexedFiles.filter(
    (f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalTokens = indexedFiles.reduce((acc, f) => acc + f.tokenCount, 0);
  const totalSize = indexedFiles.reduce((acc, f) => acc + f.size, 0);

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
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Computer File & Codebase Auto-Index
              </h2>
              <p className="text-xs text-neutral-400">
                Index local project files and documents for instant semantic retrieval in conversations.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          {/* Index Stats Strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg bg-[#141822] border border-white/5 space-y-1">
              <span className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-blue-400" />
                Indexed Files
              </span>
              <span className="text-xl font-bold font-mono text-white tabular-nums">
                {indexedFiles.length}
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-[#141822] border border-white/5 space-y-1">
              <span className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                Total Tokens
              </span>
              <span className="text-xl font-bold font-mono text-white tabular-nums">
                {totalTokens.toLocaleString()}
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-[#141822] border border-white/5 space-y-1">
              <span className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                Raw Data Size
              </span>
              <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                {(totalSize / 1024).toFixed(1)} KB
              </span>
            </div>
          </div>

          {/* Upload Drop Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border border-dashed border-white/20 hover:border-blue-500 rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-[#141822]/60 hover:bg-[#141822]"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".ts,.tsx,.js,.jsx,.py,.json,.md,.txt,.html,.css,.sql,.env,.yaml,.yml"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Upload className="w-6 h-6 text-blue-400 mb-2" />
            <span className="font-semibold text-white text-xs sm:text-sm">
              Upload files or codebase snippets to auto-index
            </span>
            <p className="text-[11px] text-neutral-400 mt-1">
              Select multiple TypeScript, Python, Markdown, JSON, HTML or config files.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search through all indexed codebase files and text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#141822] border border-white/10 text-xs text-neutral-200 focus:outline-none focus:border-blue-500 placeholder:text-neutral-500 font-sans"
            />
          </div>

          {/* Files List & Preview Split */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* List */}
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {filteredFiles.length > 0 ? (
                filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => setSelectedFile(file)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-center justify-between text-xs ${
                      selectedFile?.id === file.id
                        ? 'bg-[#1b2232] border-blue-500'
                        : 'bg-[#141822] border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <span className="font-semibold text-white truncate block font-mono">
                        {file.name}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        ~{file.tokenCount.toLocaleString()} tokens · {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveFile(file.id);
                        }}
                        className="p-1 rounded text-neutral-500 hover:text-rose-400 hover:bg-white/5"
                        title="Remove from index"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-xs text-neutral-500 bg-[#141822]/40 rounded-lg border border-white/5">
                  {indexedFiles.length === 0
                    ? 'No files indexed yet. Upload files above to index your codebase.'
                    : 'No matching files found.'}
                </div>
              )}
            </div>

            {/* Preview Box */}
            <div className="rounded-xl border border-white/10 bg-[#090b10] p-4 flex flex-col h-72">
              <div className="flex items-center justify-between pb-2 border-b border-white/5 text-xs">
                <span className="font-mono text-neutral-300 font-semibold truncate">
                  {selectedFile ? selectedFile.name : 'Select a file to preview'}
                </span>

                {selectedFile && (
                  <button
                    onClick={() => {
                      onInjectToChat(
                        `[Context from Indexed File: ${selectedFile.name}]\n\`\`\`\n${selectedFile.content.slice(0, 3000)}\n\`\`\``
                      );
                      onClose();
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium"
                  >
                    <span>Insert into chat</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto pt-2 font-mono text-[11.5px] text-neutral-300 whitespace-pre-wrap leading-relaxed">
                {selectedFile ? (
                  selectedFile.content
                ) : (
                  <span className="text-neutral-500 italic">
                    Click any indexed file on the left to inspect content and inject directly into prompts.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        {indexedFiles.length > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-[#141822]">
            <button
              onClick={onClearIndex}
              className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
            >
              Clear entire index
            </button>

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
