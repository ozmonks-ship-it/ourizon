import { AnimatedLogo } from "./AnimatedLogo";
import { LOADING_ANIMATION_STYLES } from "./loadingAnimationStyles";

type PageLoaderProps = {
  /** Full-viewport overlay (e.g. auth/bootstrap). Default is in-page layout. */
  overlay?: boolean;
};

export function PageLoader({ overlay = false }: PageLoaderProps) {
  return (
    <>
      <style>{LOADING_ANIMATION_STYLES}</style>
      <div
        className={
          overlay
            ? "fixed inset-0 z-[150] bg-background flex flex-col items-center justify-center"
            : "relative flex min-h-[50vh] flex-col items-center justify-center py-16"
        }
        role="status"
        aria-label="Loading"
      >
        <div className="flex flex-col items-center gap-5">
          <AnimatedLogo size={56} />
          <p
            className="wordmark-animate text-lg font-medium text-foreground tracking-[0.04em]"
            style={{ fontFamily: "'Fredoka', sans-serif" }}
          >
            Ourizon
          </p>
        </div>
        <div
          className={
            overlay
              ? "absolute bottom-12 left-1/2 -translate-x-1/2 w-24 h-px bg-border overflow-hidden rounded-full"
              : "mt-8 w-24 h-px bg-border overflow-hidden rounded-full"
          }
        >
          <div className="bar-animate h-full bg-foreground/40 rounded-full" />
        </div>
      </div>
    </>
  );
}
