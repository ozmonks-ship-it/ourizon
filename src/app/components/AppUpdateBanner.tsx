import { RefreshCw, X } from "lucide-react";
import { useAppUpdate } from "../hooks/useAppUpdate";

export function AppUpdateBanner({ aboveNav = false }: { aboveNav?: boolean }) {
  const { needRefresh, refresh, dismiss } = useAppUpdate();

  if (!needRefresh) return null;

  return (
    <div
      role="alert"
      className={`fixed left-0 right-0 z-[70] px-4 pointer-events-none ${
        aboveNav ? "bottom-[4.75rem]" : "bottom-4"
      }`}
    >
      <div className="max-w-3xl mx-auto pointer-events-auto rounded-2xl border border-border bg-card shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-xl bg-primary/15 p-2 text-primary">
            <RefreshCw className="size-5" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Update available</p>
            <p className="text-xs text-muted-foreground mt-1">
              A new version of Ourizon is ready. Refresh to get the latest changes.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={refresh}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium px-3 py-2 hover:opacity-90 active:scale-[0.98] transition-all"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Refresh now
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-xl text-xs font-medium px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Later
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss update notice"
            className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
