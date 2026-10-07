import React from "react";
import { useShell } from "@/store/shellStore";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { state } = useShell();

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", state.theme);
  }, [state.theme]);

  return (
    <div className="app-shell min-h-screen flex flex-col" data-theme={state.theme}>
      <header className="z-10">
        <Header />
      </header>
      <div className="flex flex-1 overflow-hidden relative z-0">
        {state.leftRailOpen && (
          <aside className="z-20" data-layer="rail">
            <LeftRail />
          </aside>
        )}
        <main className="flex-1 flex flex-col overflow-hidden z-10">{children}</main>
        {state.rightDrawerOpen && (
          <aside className="z-20" data-layer="drawer">
            <RightDrawer />
          </aside>
        )}
      </div>
      <footer className="z-10" data-layer="composer">
        <Composer />
      </footer>
    </div>
  );
}

function Header() {
  const { state } = useShell();
  return (
    <header className="topbar flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]/90 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <button className="p-2 rounded-lg hover:bg-[var(--color-surface-elevated)] transition-colors" aria-label="Toggle left rail">
          <MenuIcon />
        </button>
        <span className="font-mono text-sm font-bold tracking-tight text-[var(--color-brand-muted)]">JAMES</span>
        <PrivacyPill />
      </div>
      <div className="flex items-center gap-2">
        <button className="p-2 rounded-lg hover:bg-[var(--color-surface-elevated)] transition-colors" aria-label="Toggle theme" title="Cycle theme">
          <ThemeIcon theme={state.theme} />
        </button>
        <button className="p-2 rounded-lg hover:bg-[var(--color-surface-elevated)] transition-colors" aria-label="Toggle mission control">
          <TerminalIcon />
        </button>
      </div>
    </header>
  );
}

function LeftRail() {
  const { state } = useShell();
  return (
    <aside className="w-64 border-r border-[var(--color-border)] bg-[var(--color-surface-card)]/60 backdrop-blur-sm flex flex-col p-4 gap-4">
      <nav className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-hint)] mb-1">Conversations</span>
        {state.conversations.length === 0 && <span className="text-xs text-[var(--color-text-dim)]">No conversations yet</span>}
        {state.conversations.map((c) => (
          <button key={c.id} className={`text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${state.activeConversation === c.id ? "bg-[var(--color-surface-elevated)] text-[var(--color-text)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}>
            {c.title}
          </button>
        ))}
      </nav>
      <div className="border-t border-[var(--color-border)] pt-3 mt-auto">
        <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-hint)]">Indexed Folders</span>
        <p className="text-xs text-[var(--color-text-dim)] mt-1">None configured</p>
      </div>
    </aside>
  );
}

function RightDrawer() {
  const { state } = useShell();
  return (
    <aside className="w-80 border-l border-[var(--color-border)] bg-[var(--color-surface-card)]/60 backdrop-blur-sm flex flex-col">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--color-border)]">
        {(["trace", "files", "audit"] as const).map((tab) => (
          <button key={tab} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${state.rightDrawerTab === tab ? "bg-[var(--color-surface-elevated)] text-[var(--color-text)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}>
            {tab}
          </button>
        ))}
      </div>
      <div className="flex-1 p-3 overflow-auto">
        {state.rightDrawerTab === "trace" && <p className="text-xs text-[var(--color-text-dim)]">Live agent trace will appear here during a request.</p>}
        {state.rightDrawerTab === "files" && <p className="text-xs text-[var(--color-text-dim)]">File previews and diffs.</p>}
        {state.rightDrawerTab === "audit" && <p className="text-xs text-[var(--color-text-dim)]">Audit log entries.</p>}
      </div>
    </aside>
  );
}

function PrivacyPill() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-emerald-500/30 bg-emerald-500/20 text-emerald-400">
      <span>🔒</span> offline
    </span>
  );
}

function ThemeIcon({ theme }: { theme: string }) {
  if (theme === "dark") return <span className="text-sm">🌙</span>;
  if (theme === "light") return <span className="text-sm">☀️</span>;
  return <span className="text-sm">🖤</span>;
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12h18M3 6h18M3 18h18" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}
