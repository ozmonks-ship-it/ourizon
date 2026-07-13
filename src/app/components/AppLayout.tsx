import type { Session } from "@supabase/supabase-js";
import { OurizonLogo } from "./OurizonLogo";
import { CollaboratorsMenu } from "./CollaboratorsMenu";

export type NavScreen = "dashboard" | "assets" | "monthly" | "budgets";

const NAV: { id: NavScreen; label: string; emoji: string; enabled: boolean }[] = [
  { id: "dashboard", label: "Home", emoji: "🏠", enabled: true },
  { id: "assets", label: "Assets", emoji: "💰", enabled: true },
  { id: "monthly", label: "Buckets", emoji: "🪣", enabled: true },
  { id: "budgets", label: "Budgets", emoji: "🎯", enabled: true },
];

export function AppLayout({
  children,
  session,
  screen,
  onNavigate,
}: {
  children: React.ReactNode;
  session: Session;
  screen: NavScreen;
  onNavigate: (id: NavScreen) => void;
}) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <OurizonLogo size={28} />
            <span className="text-lg font-medium text-foreground">Ourizon</span>
          </div>
          <div className="flex items-center gap-2">
            <CollaboratorsMenu session={session} />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20 scroll-smooth">
        <div className="max-w-3xl mx-auto px-4 py-6">{children}</div>
      </main>

      <nav
        aria-label="Main navigation"
        className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border flex z-50"
      >
        {NAV.map(({ id, label, emoji, enabled }) => {
          const active = id === screen;
          return (
            <button
              key={id}
              type="button"
              disabled={!enabled}
              onClick={() => enabled && onNavigate(id)}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-medium transition-all duration-200 ${
                active
                  ? "text-foreground"
                  : enabled
                    ? "text-muted-foreground"
                    : "text-muted-foreground/40 cursor-not-allowed"
              }`}
            >
              <span
                className={`text-xl transition-transform duration-200 ${active ? "scale-110" : ""}`}
                aria-hidden="true"
              >
                {emoji}
              </span>
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
