import { ShellProvider } from "@/store/shellStore";
import { AppShell } from "@/components/layout/AppShell";

function ChatStream() {
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-[var(--color-text)] mb-2">James</h2>
          <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
            Privacy-first local AI assistant. Your data stays on-device. Type a message or use Cmd+K to start.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {["What can you do?", "Search my files", "Index a folder", "Generate an image"].map((q) => (
              <button key={q} className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-card)] text-xs text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-text)] transition-colors">
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ShellProvider>
      <AppShell>
        <ChatStream />
      </AppShell>
    </ShellProvider>
  );
}

export default App;
