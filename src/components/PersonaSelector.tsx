import React, { useState } from 'react';
import {
  X,
  Plus,
  Check,
  Bot,
} from 'lucide-react';
import { Persona } from '../types/chat';
import { DEFAULT_PERSONAS } from '../data/personas';

interface PersonaSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  activePersonaId: string;
  onSelectPersona: (persona: Persona) => void;
  customPersonas: Persona[];
  onSaveCustomPersona: (persona: Persona) => void;
}

export const PersonaSelector: React.FC<PersonaSelectorProps> = ({
  isOpen,
  onClose,
  activePersonaId,
  onSelectPersona,
  customPersonas,
  onSaveCustomPersona,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [customAvatar, setCustomAvatar] = useState('CUSTOM');
  const [customDescription, setCustomDescription] = useState('');
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [customTemp, setCustomTemp] = useState(0.5);
  const [customTokens, setCustomTokens] = useState(4096);

  if (!isOpen) return null;

  const allPersonas = [...DEFAULT_PERSONAS, ...customPersonas];

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customSystemPrompt.trim()) return;

    const newPersona: Persona = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      role: customRole.trim() || 'Custom Directive',
      avatar: customAvatar.slice(0, 4).toUpperCase() || 'CUST',
      description: customDescription.trim() || 'Custom system prompt directive',
      systemPrompt: customSystemPrompt.trim(),
      temperature: customTemp,
      topP: 0.95,
      maxTokens: customTokens,
      badge: 'Custom Directive',
      accentColor: '#3b82f6',
    };

    onSaveCustomPersona(newPersona);
    onSelectPersona(newPersona);
    setIsCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div
        className="w-full max-w-2xl bg-[#11141c] border border-white/10 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#141822]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-[#1a202c] border border-white/5 text-blue-400">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Prompt Directives & Roles
              </h2>
              <p className="text-xs text-neutral-400">
                Choose a pre-configured role or create a custom system prompt instruction.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
            }}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {!isCreating ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-semibold tracking-wider text-neutral-400">
                  Select a directive
                </span>
                <button
                  onClick={() => {
                    setIsCreating(true);
                  }}
                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium px-2.5 py-1 rounded-md bg-blue-600/10 border border-blue-500/20 transition-colors hover:bg-blue-600/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create custom directive</span>
                </button>
              </div>

              {/* Grid of Personas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allPersonas.map((persona) => {
                  const isSelected = activePersonaId === persona.id;
                  return (
                    <div
                      key={persona.id}
                      onClick={() => {
                        onSelectPersona(persona);
                        onClose();
                      }}
                      className={`p-4 rounded-lg border text-left cursor-pointer transition-colors relative flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#1a2130] border-blue-500'
                          : 'bg-[#141822] border-white/5 hover:border-white/20 hover:bg-[#171c26]'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2.5">
                            <span className="px-1.5 py-0.5 rounded bg-[#1f2533] text-blue-400 font-mono text-[11px] font-bold border border-white/5">
                              {persona.avatar}
                            </span>
                            <div>
                              <h3 className="text-xs font-semibold text-white">
                                {persona.name}
                              </h3>
                              <span className="text-[11px] text-neutral-400 block">
                                {persona.role}
                              </span>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-white">
                              <Check className="w-3 h-3 stroke-[2.5]" />
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-neutral-300 leading-relaxed line-clamp-2 my-2">
                          {persona.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2.5 border-t border-white/5 text-[10px] text-neutral-400 font-mono">
                        <span className="text-neutral-400">
                          {persona.badge}
                        </span>
                        <span>Temp: {persona.temperature} · {persona.maxTokens} tok</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Custom Persona Form */
            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-semibold uppercase text-blue-400">
                  New Custom Directive
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="font-medium text-neutral-300">Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Code Auditor"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md bg-[#141822] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-neutral-300">Tag (max 4 chars)</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={customAvatar}
                    onChange={(e) => setCustomAvatar(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 text-center font-mono rounded-md bg-[#141822] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500 uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-neutral-300">Subtitle / Role</label>
                <input
                  type="text"
                  placeholder="e.g. Automated Code Reviewer"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md bg-[#141822] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-neutral-300">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Inspects code for potential bugs, style issues, and performance bottlenecks."
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md bg-[#141822] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-neutral-300">
                  System Instruction Prompt
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="You are an expert in... You format responses with... Avoid..."
                  value={customSystemPrompt}
                  onChange={(e) => setCustomSystemPrompt(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-[#141822] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500 leading-relaxed font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="font-medium text-neutral-300 flex justify-between">
                    <span>Temperature</span>
                    <span className="font-mono text-blue-400">{customTemp.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.05"
                    value={customTemp}
                    onChange={(e) => setCustomTemp(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-neutral-300 flex justify-between">
                    <span>Max Output Tokens</span>
                    <span className="font-mono text-blue-400">{customTokens}</span>
                  </label>
                  <input
                    type="range"
                    min="512"
                    max="8192"
                    step="512"
                    value={customTokens}
                    onChange={(e) => setCustomTokens(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors"
                >
                  Save directive
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
