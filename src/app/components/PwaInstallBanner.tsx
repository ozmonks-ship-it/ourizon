import { Download, Share, X } from "lucide-react";
import { OurizonLogo } from "./OurizonLogo";
import { usePwaInstall } from "../hooks/usePwaInstall";

export function PwaInstallBanner({ aboveNav = false }: { aboveNav?: boolean }) {
  const { visible, mode, dismiss, install, canInstall } = usePwaInstall();

  if (!visible || !mode) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="pwa-install-title"
      className={`fixed left-0 right-0 z-[60] px-4 pointer-events-none ${
        aboveNav ? "bottom-[4.75rem]" : "bottom-4"
      }`}
    >
      <div className="max-w-3xl mx-auto pointer-events-auto rounded-2xl border border-border bg-card shadow-lg p-4">
        <div className="flex items-start gap-3">
          <OurizonLogo size={40} />
          <div className="flex-1 min-w-0">
            <p id="pwa-install-title" className="text-sm font-semibold text-foreground">
              Install Ourizon
            </p>
            {mode === "chrome" ? (
              <p className="text-xs text-muted-foreground mt-1">
                Add Ourizon to your home screen for quick access, just like a native app.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Tap <Share className="inline size-3.5 align-text-bottom mx-0.5" aria-hidden="true" />
                Share, then choose <span className="font-medium text-foreground">Add to Home Screen</span>.
              </p>
            )}
            <div className="flex items-center gap-2 mt-3">
              {canInstall && (
                <button
                  type="button"
                  onClick={() => void install()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium px-3 py-2 hover:opacity-90 active:scale-[0.98] transition-all"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  Install app
                </button>
              )}
              <button
                type="button"
                onClick={dismiss}
                className="rounded-xl text-xs font-medium px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install prompt"
            className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
