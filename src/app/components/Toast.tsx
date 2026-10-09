import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";

const ToastContext = createContext<(message: string) => void>(() => {});
const AnnounceContext = createContext<(message: string) => void>(() => {});

/** Tell screen-reader users about a change without showing anything on screen. */
export function useAnnounce() {
  return useContext(AnnounceContext);
}

/** Show a short confirmation that is also announced to screen readers (WCAG 4.1.3). */
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [spoken, setSpoken] = useState("");
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((next: string) => {
    window.clearTimeout(timer.current);
    // Clear first so the same message is announced again.
    setMessage(null);
    window.setTimeout(() => setMessage(next), 30);
    timer.current = window.setTimeout(() => setMessage(null), 6000);
  }, []);

  const announce = useCallback((next: string) => {
    setSpoken("");
    window.setTimeout(() => setSpoken(next), 30);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      <AnnounceContext.Provider value={announce}>{children}</AnnounceContext.Provider>
      <p className="sr-only" role="status" aria-live="polite">
        {spoken}
      </p>
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex justify-center px-4"
      >
        {message && (
          <p className="pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl bg-foreground px-4 py-3 font-semibold text-background shadow-lg">
            <Check className="size-5 shrink-0" aria-hidden="true" />
            {message}
          </p>
        )}
      </div>
    </ToastContext.Provider>
  );
}
