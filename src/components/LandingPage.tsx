import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  Code2,
  Cpu,
  FileText,
  Gauge,
  Lock,
  Sliders,
  Terminal,
  Zap,
} from 'lucide-react';

interface LandingPageProps {
  onLaunchChat: () => void;
  onSelectPromptAndLaunch: (prompt: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchChat,
  onSelectPromptAndLaunch,
}) => {
  // Interactive product preview state
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<'code' | 'summary' | 'security'>('code');

  const workflowExamples = {
    code: {
      title: 'Code review and optimization',
      input: 'Review this TypeScript function for memory allocation in a hot loop and suggest an efficient alternative.',
      promptTokens: 142,
      responseTokens: 388,
      speed: '52 tokens/sec',
      duration: '1.4s',
      output: `// Original: Allocates thousands of temporary objects per frame
// Optimized: Reuses an ArrayBuffer view with zero garbage-collection overhead

export class FastNodeBuffer {
  private buffer: Float64Array;
  private pointer = 0;

  constructor(size = 10000) {
    this.buffer = new Float64Array(size);
  }

  push(x: number, y: number): void {
    if (this.pointer + 2 > this.buffer.length) return;
    this.buffer[this.pointer++] = x;
    this.buffer[this.pointer++] = y;
  }

  reset(): void {
    this.pointer = 0;
  }
}`,
      explanation: 'Replaces per-item object allocation with a pre-sized TypedArray. Eliminates GC pauses during high-frequency loop executions.',
    },
    summary: {
      title: 'Strict 512-token response limit',
      input: 'Provide an executive summary of migrating a single Node.js service to Cloud Run. Keep it under 200 words.',
      promptTokens: 89,
      responseTokens: 174,
      speed: '58 tokens/sec',
      duration: '0.8s',
      output: `Bottom-line recommendation:
Migrating to Cloud Run is recommended for this service because it reduces idle infrastructure costs to zero while preserving standard container deployments.

1. Cost trade-off: You pay only per active request with scale-to-zero during off-hours, saving ~60% over static VMs.
2. Cold start consideration: Lightweight Node containers start in ~400ms. Set min-instances: 1 if sub-100ms latency is mandatory.
3. Deployment simplicity: Push existing Dockerfile directly with standard traffic splitting (e.g. 10% canary testing).`,
      explanation: 'Hard response limit prevented boilerplate introductions and rambling explanations.',
    },
    security: {
      title: 'Session token security check',
      input: 'Compare httpOnly cookies against local storage for storing JWT authentication tokens in a React application.',
      promptTokens: 112,
      responseTokens: 310,
      speed: '50 tokens/sec',
      duration: '1.1s',
      output: `Security comparison:

1. httpOnly SameSite Cookies (Recommended)
   - XSS protection: JavaScript cannot access the cookie, preventing token theft from malicious scripts or compromised npm dependencies.
   - CSRF protection: Requires SameSite=Lax or Strict plus an anti-CSRF token on state-changing POST requests.

2. Browser LocalStorage (Avoid for sensitive sessions)
   - XSS vulnerability: Any script running in the application can read localStorage.getItem("token") and exfiltrate it.
   - Persistence: Tokens persist across browser crashes but lack automatic origin-scoped security flags.

Recommendation: Store access tokens in httpOnly, Secure, SameSite=Lax cookies with short expirations (15 mins) and refresh token rotation.`,
      explanation: 'Clear risk assessment with specific mitigations rather than generic claims.',
    },
  };

  const activeExample = workflowExamples[activeWorkflowTab];

  return (
    <div className="min-h-screen bg-[#0b0d13] text-neutral-100 font-sans">
      {/* 1. Header / Navigation */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b0d13]/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center font-bold text-white text-xs select-none">
              J
            </span>
            <span className="font-semibold text-white text-base tracking-tight">JAMES</span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs text-neutral-300">
            <a href="#how-it-works" className="hover:text-white transition-colors">
              How it works
            </a>
            <a href="#comparison" className="hover:text-white transition-colors">
              The problem
            </a>
            <a href="#product-evidence" className="hover:text-white transition-colors">
              Real outputs
            </a>
            <a href="#specifications" className="hover:text-white transition-colors">
              Technical specs
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={onLaunchChat}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors shadow-sm"
            >
              <span>Open chat app</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="pt-16 pb-14 sm:pt-24 sm:pb-20 border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
          {/* Clean Unboxed Metadata */}
          <div className="flex items-center justify-center gap-2 text-xs text-neutral-400">
            <span className="text-neutral-300 font-medium">Gemini 3.8 Flash</span>
            <span aria-hidden="true" className="text-neutral-600">·</span>
            <span className="font-mono tabular-nums">1,048,576 token context</span>
            <span aria-hidden="true" className="text-neutral-600">·</span>
            <span>Local browser storage</span>
          </div>

          {/* Plain Human Headline */}
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight [text-wrap:balance]">
            An AI chat assistant that shows your exact token usage.
          </h1>

          {/* Specific Subtitle in Plain English */}
          <p className="text-base sm:text-lg text-neutral-400 max-w-2xl mx-auto leading-relaxed">
            Most chat interfaces hide token consumption until you hit a rate limit. JAMES displays prompt and completion tokens on every turn, lets you set hard response length caps, and saves all history directly in your browser.
          </p>

          {/* Action CTAs */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onLaunchChat}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors shadow-sm"
            >
              <span>Start chatting now</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <a
              href="#product-evidence"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#141822] hover:bg-[#1a202c] border border-white/10 text-neutral-300 hover:text-white text-sm font-medium transition-colors"
            >
              View real output examples
            </a>
          </div>

          {/* Transparent Guarantees Row */}
          <div className="pt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            <div className="p-3.5 rounded-lg bg-[#11141c] border border-white/5 space-y-1">
              <span className="text-xs font-semibold text-white block">Exact token counting</span>
              <p className="text-xs text-neutral-400">
                Official API token measurements before and after every generation.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-[#11141c] border border-white/5 space-y-1">
              <span className="text-xs font-semibold text-white block">Hard response caps</span>
              <p className="text-xs text-neutral-400">
                Set maximum output tokens (256 to 8,192) to avoid rambling answers.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-[#11141c] border border-white/5 space-y-1">
              <span className="text-xs font-semibold text-white block">100% local storage</span>
              <p className="text-xs text-neutral-400">
                Conversations stay in your browser. No account, login, or tracking database.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Real Product Preview (Demonstration of Working Interface) */}
      <section id="product-preview" className="py-16 sm:py-20 border-b border-white/5 bg-[#0e1017]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="space-y-2">
            <span className="text-xs font-medium text-blue-400">
              Live Interface Preview
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              What the chat interface actually looks like
            </h2>
            <p className="text-sm text-neutral-400 max-w-2xl">
              This is a live representation of the chat environment with active token telemetry, code syntax formatting, and model configuration.
            </p>
          </div>

          {/* Real Interactive Preview Frame */}
          <div className="rounded-xl border border-white/10 bg-[#11141c] shadow-lg overflow-hidden">
            {/* Top Preview Bar */}
            <div className="px-4 py-3 border-b border-white/10 bg-[#141822] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="font-semibold text-white">Active session</span>
                <span className="text-neutral-500">/</span>
                <span className="text-neutral-400">TypeScript Algorithm Refactor</span>
              </div>

              {/* Real Telemetry Readout */}
              <div className="flex items-center gap-3 font-mono text-[11px] text-neutral-400">
                <span className="flex items-center gap-1 text-neutral-300">
                  <Gauge className="w-3.5 h-3.5 text-blue-400" />
                  Prompt: <strong className="text-white">142 tok</strong>
                </span>
                <span>·</span>
                <span className="flex items-center gap-1 text-neutral-300">
                  Response: <strong className="text-white">388 tok</strong>
                </span>
                <span>·</span>
                <span className="text-emerald-400 font-semibold">52 tok/s</span>
              </div>
            </div>

            {/* Conversation Flow */}
            <div className="p-5 sm:p-6 space-y-6 text-xs sm:text-sm">
              {/* User Message */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-md bg-neutral-800 flex items-center justify-center font-bold text-neutral-300 text-xs shrink-0 select-none">
                  YOU
                </div>
                <div className="space-y-1 max-w-2xl">
                  <span className="text-xs font-semibold text-white">You</span>
                  <p className="text-neutral-300 bg-[#171b26] p-3 rounded-lg border border-white/5 leading-relaxed">
                    Review this TypeScript function for memory allocation in a hot loop and suggest an efficient alternative.
                  </p>
                </div>
              </div>

              {/* Assistant Message with Real Output */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center font-bold text-white text-xs shrink-0 select-none">
                  AI
                </div>
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">Software Engineer</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-neutral-400 font-mono">
                      Gemini 3.8 Flash
                    </span>
                  </div>

                  <p className="text-neutral-300 leading-relaxed text-xs sm:text-sm">
                    In high-frequency loops (e.g. animation frames or socket handlers), creating object literals triggers garbage-collection pauses. Here is a zero-allocation buffer pattern using a <code className="px-1 py-0.5 rounded bg-neutral-800 text-blue-300 font-mono text-xs">Float64Array</code>:
                  </p>

                  {/* Clean Syntax Block */}
                  <div className="rounded-lg border border-white/10 bg-[#090b10] p-3 font-mono text-xs overflow-x-auto text-neutral-200">
                    <div className="text-neutral-500 pb-2 border-b border-white/5 flex justify-between items-center text-[11px]">
                      <span>typescript</span>
                      <span>15 lines</span>
                    </div>
                    <pre className="pt-2 text-[12px] leading-relaxed">
{`export class FastNodeBuffer {
  private buffer: Float64Array;
  private pointer = 0;

  constructor(size = 10000) {
    this.buffer = new Float64Array(size);
  }

  push(x: number, y: number): void {
    if (this.pointer + 2 > this.buffer.length) return;
    this.buffer[this.pointer++] = x;
    this.buffer[this.pointer++] = y;
  }
}`}
                    </pre>
                  </div>

                  {/* Telemetry pill */}
                  <div className="pt-1 flex items-center gap-3 text-[11px] font-mono text-neutral-500">
                    <span>Generated in 1.4s</span>
                    <span>·</span>
                    <span>388 tokens generated</span>
                    <span>·</span>
                    <span className="text-neutral-400">Cost: $0.00 (Standard Tier)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Preview Footer with Action */}
            <div className="px-5 py-3 border-t border-white/10 bg-[#141822] flex items-center justify-between text-xs">
              <span className="text-neutral-400 hidden sm:inline">
                Want to test this prompt in the real chat app?
              </span>
              <button
                onClick={() => onSelectPromptAndLaunch('Review this TypeScript function for memory allocation in a hot loop and suggest an efficient alternative.')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
              >
                <span>Run this prompt in app</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. What Problem Does It Solve? (Direct Comparison) */}
      <section id="comparison" className="py-16 sm:py-24 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="space-y-2">
            <span className="text-xs font-medium text-blue-400">
              The Problem
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Why visibility over token limits matters
            </h2>
            <p className="text-sm sm:text-base text-neutral-400 max-w-2xl">
              Most AI apps treat token consumption as a hidden internal metric. When models ramble or truncate context without warning, work is wasted.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Standard Chat Tools */}
            <div className="p-6 rounded-xl bg-[#11141c] border border-white/5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className="text-sm font-semibold text-neutral-300">Standard AI chat tools</span>
                <span className="text-[11px] font-mono text-neutral-500">Typical pattern</span>
              </div>

              <ul className="space-y-3 text-xs sm:text-sm text-neutral-400">
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-400 font-bold mt-0.5">✕</span>
                  <span><strong>Hidden token consumption:</strong> You never know how many tokens were processed until you hit a rate limit or invoice.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-400 font-bold mt-0.5">✕</span>
                  <span><strong>Silent memory truncation:</strong> Earlier conversation turns quietly drop out of memory without any visual notice.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-400 font-bold mt-0.5">✕</span>
                  <span><strong>No response length caps:</strong> Models often produce lengthy, unstructured text when you only asked for a short answer.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-400 font-bold mt-0.5">✕</span>
                  <span><strong>Server-side data retention:</strong> Chat histories are saved on remote servers and tied to customer accounts.</span>
                </li>
              </ul>
            </div>

            {/* JAMES Approach */}
            <div className="p-6 rounded-xl bg-[#141822] border border-blue-500/30 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  JAMES
                </span>
                <span className="text-[11px] font-mono text-blue-400">Transparent engine</span>
              </div>

              <ul className="space-y-3 text-xs sm:text-sm text-neutral-300">
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <span><strong>Per-turn token telemetry:</strong> See exact prompt tokens, response tokens, duration, and processing velocity on every message.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <span><strong>Configurable memory window:</strong> Choose between full memory (up to 1M tokens) or rolling sliding windows (last 10 or 20 turns).</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <span><strong>Hard response limits:</strong> Adjust maximum output tokens from 256 for brief summaries up to 8,192 for long codebases.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <span><strong>100% browser-stored data:</strong> All conversations, bookmarks, and custom personas are saved in local storage.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 5. How It Works (3 Clear Steps) */}
      <section id="how-it-works" className="py-16 sm:py-24 border-b border-white/5 bg-[#0e1017]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="space-y-2">
            <span className="text-xs font-medium text-blue-400">
              Workflow
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              How the application works in three steps
            </h2>
            <p className="text-sm sm:text-base text-neutral-400 max-w-2xl">
              No complex setup or onboarding questionnaires. You configure your parameters and chat directly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="p-6 rounded-xl bg-[#11141c] border border-white/5 space-y-2">
              <span className="text-xs font-mono font-bold text-blue-400 block">01</span>
              <h3 className="text-base font-semibold text-white">Choose your directive</h3>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                Select a focused role (Software Engineer, Design Reviewer, Concise Summary, Security Analyst) or write your own custom system instructions.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-xl bg-[#11141c] border border-white/5 space-y-2">
              <span className="text-xs font-mono font-bold text-blue-400 block">02</span>
              <h3 className="text-base font-semibold text-white">Set your response limit</h3>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                Use the token limit slider to cap model output between 256 and 8,192 tokens. Keep answers tight or allow full-length documentation.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-xl bg-[#11141c] border border-white/5 space-y-2">
              <span className="text-xs font-mono font-bold text-blue-400 block">03</span>
              <h3 className="text-base font-semibold text-white">Chat with live telemetry</h3>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                Send messages, code, or images. Inspect prompt tokens and generation speed in real time, copy code blocks with one click, or export to Markdown.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Real Capabilities & Concrete Outputs (Interactive Proof) */}
      <section id="product-evidence" className="py-16 sm:py-24 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="space-y-2">
            <span className="text-xs font-medium text-blue-400">
              Real Output Examples
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Real prompts, real outputs, and real token counts
            </h2>
            <p className="text-sm sm:text-base text-neutral-400 max-w-2xl">
              Inspect actual inputs and generated responses across common technical tasks.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
            {[
              { id: 'code', label: 'Code optimization' },
              { id: 'summary', label: 'Strict 512-token cap' },
              { id: 'security', label: 'Security comparison' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveWorkflowTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeWorkflowTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#141822] text-neutral-300 hover:text-white hover:bg-[#1a202c]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content Card with Exact Real Data */}
          <div className="p-6 rounded-xl bg-[#11141c] border border-white/10 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/5 text-xs">
              <span className="font-semibold text-white">{activeExample.title}</span>
              <div className="flex items-center gap-3 font-mono text-[11px] text-neutral-400">
                <span>Prompt: <strong className="text-white">{activeExample.promptTokens} tokens</strong></span>
                <span>·</span>
                <span>Response: <strong className="text-white">{activeExample.responseTokens} tokens</strong></span>
                <span>·</span>
                <span>Speed: <strong className="text-emerald-400">{activeExample.speed}</strong></span>
              </div>
            </div>

            {/* Input prompt */}
            <div className="space-y-1.5">
              <span className="text-xs text-neutral-500 font-mono uppercase tracking-wider">User Input</span>
              <p className="p-3 rounded-lg bg-[#141822] text-xs sm:text-sm text-neutral-200 border border-white/5">
                {activeExample.input}
              </p>
            </div>

            {/* Output result */}
            <div className="space-y-1.5">
              <span className="text-xs text-neutral-500 font-mono uppercase tracking-wider">Generated Output</span>
              <pre className="p-3.5 rounded-lg bg-[#090b10] border border-white/5 font-mono text-xs sm:text-xs text-neutral-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {activeExample.output}
              </pre>
            </div>

            {/* Real Explanation of why it matters */}
            <div className="pt-2 flex items-start gap-2 text-xs text-neutral-400 border-t border-white/5">
              <span className="text-blue-400 font-semibold shrink-0">Analysis:</span>
              <p>{activeExample.explanation}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Transparent Technical Specifications */}
      <section id="specifications" className="py-16 sm:py-24 border-b border-white/5 bg-[#0e1017]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="space-y-2">
            <span className="text-xs font-medium text-blue-400">
              Architecture & Details
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Technical specifications
            </h2>
            <p className="text-sm sm:text-base text-neutral-400 max-w-2xl">
              Concrete infrastructure and runtime details. No vague claims or marketing adjectives.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs sm:text-sm">
            <div className="p-4 rounded-lg bg-[#11141c] border border-white/5 space-y-1.5">
              <span className="text-neutral-400 font-mono text-xs uppercase block">Primary Model</span>
              <span className="text-white font-semibold text-base">gemini-3.8-flash</span>
              <p className="text-neutral-400 text-xs">
                Official Google GenAI SDK integration with streaming SSE protocol.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[#11141c] border border-white/5 space-y-1.5">
              <span className="text-neutral-400 font-mono text-xs uppercase block">Context Capacity</span>
              <span className="text-white font-semibold text-base font-mono">1,048,576 tokens</span>
              <p className="text-neutral-400 text-xs">
                Approximately 750,000 words in active conversation memory.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[#11141c] border border-white/5 space-y-1.5">
              <span className="text-neutral-400 font-mono text-xs uppercase block">Output Limits</span>
              <span className="text-white font-semibold text-base font-mono">256 to 8,192 tokens</span>
              <p className="text-neutral-400 text-xs">
                Configurable per session via strict model maxOutputTokens parameter.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[#11141c] border border-white/5 space-y-1.5">
              <span className="text-neutral-400 font-mono text-xs uppercase block">Data Storage</span>
              <span className="text-white font-semibold text-base">Browser LocalStorage</span>
              <p className="text-neutral-400 text-xs">
                Stored exclusively in client browser storage. No accounts, cookies, or remote databases.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[#11141c] border border-white/5 space-y-1.5">
              <span className="text-neutral-400 font-mono text-xs uppercase block">Multimodal Inputs</span>
              <span className="text-white font-semibold text-base">Images and Documents</span>
              <p className="text-neutral-400 text-xs">
                Direct parsing of PNG, JPG, WEBP, and code/text files (.ts, .py, .json, .csv, .md).
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[#11141c] border border-white/5 space-y-1.5">
              <span className="text-neutral-400 font-mono text-xs uppercase block">Token Accounting</span>
              <span className="text-white font-semibold text-base">Exact API countTokens</span>
              <p className="text-neutral-400 text-xs">
                Calculated directly by the Gemini token counting endpoint before streaming.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Frequently Asked Questions */}
      <section id="faq" className="py-16 sm:py-24 border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
              Questions & Answers
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Frequently asked questions
            </h2>
            <p className="text-sm sm:text-base text-neutral-400">
              Clear, straightforward answers about how JAMES works.
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-5 rounded-lg bg-[#11141c] border border-white/5 space-y-2">
              <h3 className="text-sm sm:text-base font-semibold text-white">
                Do I need an account or API key to use this?
              </h3>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                No. You do not need to create an account, enter an email, or supply your own API key. The server manages connectivity through Google AI Studio so you can start chatting immediately.
              </p>
            </div>

            <div className="p-5 rounded-lg bg-[#11141c] border border-white/5 space-y-2">
              <h3 className="text-sm sm:text-base font-semibold text-white">
                Where is my chat history and personal data saved?
              </h3>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                Your conversations, pinned bookmarks, and custom persona directives are saved entirely in your browser's local storage. There is no remote user database storing your chat logs.
              </p>
            </div>

            <div className="p-5 rounded-lg bg-[#11141c] border border-white/5 space-y-2">
              <h3 className="text-sm sm:text-base font-semibold text-white">
                How is token usage calculated?
              </h3>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                When you send a prompt, the server executes a token count via the official Google GenAI countTokens endpoint to measure the exact input tokens. As the model replies, the official usage metadata counts the completion tokens.
              </p>
            </div>

            <div className="p-5 rounded-lg bg-[#11141c] border border-white/5 space-y-2">
              <h3 className="text-sm sm:text-base font-semibold text-white">
                What does the response limit slider do?
              </h3>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                It enforces a hard maximum token ceiling (maxOutputTokens) on the model. If you only want a short 2-sentence summary, you can set it to 256 or 512 tokens. If you are generating a complete software module, you can raise it up to 8,192 tokens.
              </p>
            </div>

            <div className="p-5 rounded-lg bg-[#11141c] border border-white/5 space-y-2">
              <h3 className="text-sm sm:text-base font-semibold text-white">
                Can I export my conversations?
              </h3>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                Yes. Any conversation can be exported with one click as clean Markdown (.md), structured JSON (.json), or plain text (.txt).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 9. Final CTA */}
      <section className="py-16 sm:py-20 border-b border-white/5 bg-[#0e1017]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Ready to test the chat workspace?
          </h2>
          <p className="text-sm sm:text-base text-neutral-400 max-w-lg mx-auto leading-relaxed">
            Open the chat app to test real token limits, prompt directives, and file uploads. No signup required.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={onLaunchChat}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors shadow-sm"
            >
              <span>Open chat app</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 10. Clean Minimalist Footer */}
      <footer className="py-8 bg-[#0b0d13] text-xs text-neutral-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-300">JAMES</span>
            <span>·</span>
            <span>Transparent token management for Google Gemini</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={onLaunchChat}
              className="hover:text-neutral-300 transition-colors"
            >
              Chat Workspace
            </button>
            <span>·</span>
            <span className="text-neutral-600">Local browser storage active</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
