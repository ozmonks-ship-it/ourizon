import { useEffect, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import { Home, PieChart, Target, Wallet, type LucideIcon } from "lucide-react";
import { OurizonLogo } from "./OurizonLogo";
import { CollaboratorsMenu } from "./CollaboratorsMenu";
import { useBusy } from "../lib/dataCache";

export type NavScreen = "dashboard" | "assets" | "monthly" | "budgets";

export const NAV: { id: NavScreen; label: string; Icon: LucideIcon }[] = [
  { id: "dashboard", label: "Home", Icon: Home },
  { id: "assets", label: "Assets", Icon: Wallet },
  { id: "monthly", label: "Monthly plan", Icon: PieChart },
  { id: "budgets", label: "Budgets", Icon: Target },
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
  const mainRef = useRef<HTMLElement>(null);
  const busy = useBusy();
  const firstRender = useRef(true);

  // Name the page and move focus to its heading on navigation, so screen-reader
  // users hear where they are (WCAG 2.4.2, 2.4.3).
  useEffect(() => {
    const label = NAV.find((item) => item.id === screen)?.label ?? "Home";
    document.title = `${label} · Ourizon`;

    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const main = mainRef.current;
    if (!main) return;
    main.scrollTo({ top: 0 });
    main.focus({ preventScroll: true });

    // Screens show a loader first; focus the heading once it renders.
    const focusHeading = () => {
      const heading = main.querySelector<HTMLElement>("h1");
      if (!heading) return false;
      heading.focus({ preventScroll: true });
      return true;
    };
    if (focusHeading()) return;
    const observer = new MutationObserver(() => {
      if (focusHeading()) observer.disconnect();
    });
    observer.observe(main, { childList: true, subtree: true });
    const timeout = window.setTimeout(() => observer.disconnect(), 5000);
    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
    };
  }, [screen]);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <header className="relative shrink-0 border-b border-border bg-card/50 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <OurizonLogo size={30} />
            <span className="text-lg font-semibold text-foreground" style={{ fontFamily: "'Fredoka', sans-serif" }}>
              Ourizon
            </span>
          </div>
          <CollaboratorsMenu session={session} />
        </div>
        <div className="load-bar" data-on={busy} aria-hidden="true" />
      </header>

      <main ref={mainRef} tabIndex={-1} aria-busy={busy} className="relative flex-1 overflow-y-auto overscroll-contain scroll-smooth focus:outline-none">
        <div className="mx-auto max-w-3xl px-4 pt-6 pb-8">{children}</div>
      </main>

      <nav aria-label="Main" className="shrink-0 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-3xl grid-cols-4">
          {NAV.map(({ id, label, Icon }) => {
            const active = id === screen;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-sm font-bold transition-colors ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <span className="absolute inset-x-1/4 top-0 h-[3px] rounded-b-full bg-primary" aria-hidden="true" />
                )}
                <Icon className="size-6" aria-hidden="true" strokeWidth={active ? 2.4 : 2} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
