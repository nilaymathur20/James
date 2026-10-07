import React from 'react';
import { Gauge, ArrowRight } from 'lucide-react';
import { Persona } from '../types/chat';
import { PROMPT_STARTERS } from '../data/prompts';

interface ChatEmptyStateProps {
  persona: Persona;
  onOpenPersonaSelector: () => void;
  onOpenTokenInspector: () => void;
  onSelectPrompt: (prompt: string) => void;
  maxOutputTokens: number;
}

export const ChatEmptyState: React.FC<ChatEmptyStateProps> = ({
  persona,
  onOpenPersonaSelector,
  onOpenTokenInspector,
  onSelectPrompt,
  maxOutputTokens,
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-3xl mx-auto select-none space-y-6">
      {/* Product Model & Context (Clean unboxed typography) */}
      <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
        <span className="text-neutral-200 font-sans font-medium">Gemini 3.8 Flash</span>
        <span aria-hidden="true" className="text-neutral-600">·</span>
        <span className="tabular-nums">1,048,576 token context</span>
      </div>

      {/* Main Title & Clear Description in Plain English */}
      <div className="space-y-2 max-w-lg">
        <h2 className="text-2xl font-bold text-white tracking-tight [text-wrap:balance]">
          Start a conversation
        </h2>
        <p className="text-sm text-neutral-400 leading-relaxed">
          Type your question below, attach files, or select one of the prompt starters below.
        </p>
      </div>

      {/* Active Persona & Token Limit Controls */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
        <button
          onClick={onOpenPersonaSelector}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141822] hover:bg-[#1a202c] border border-white/10 text-neutral-200 transition-colors"
          title="Change prompt directive"
        >
          <span className="text-neutral-400 font-medium">Directive:</span>
          <span className="font-semibold text-white">{persona.name}</span>
        </button>

        <button
          onClick={onOpenTokenInspector}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141822] hover:bg-[#1a202c] border border-white/10 text-neutral-200 font-mono transition-colors"
          title="Adjust token limit"
        >
          <Gauge className="w-3.5 h-3.5 text-blue-400" />
          <span className="tabular-nums">{maxOutputTokens} token limit</span>
        </button>
      </div>

      {/* Example Prompt Starters Grid */}
      <div className="w-full pt-4 space-y-3">
        <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
          <span className="font-medium text-neutral-300">Prompt starters</span>
          <span className="text-[11px] text-neutral-500">Click any card to load</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-left">
          {PROMPT_STARTERS.map((starter) => (
            <button
              key={starter.id}
              onClick={() => onSelectPrompt(starter.prompt)}
              className="p-3 rounded-lg bg-[#141822] hover:bg-[#1a202c] border border-white/10 hover:border-blue-500/50 transition-colors text-xs flex flex-col justify-between group"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white group-hover:text-blue-300 transition-colors truncate">
                    {starter.title}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-[11.5px] text-neutral-400 line-clamp-2 leading-relaxed">
                  {starter.description}
                </p>
              </div>

              <div className="pt-2 text-[10px] font-mono text-neutral-500">
                {starter.category}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
