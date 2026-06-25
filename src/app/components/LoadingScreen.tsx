import { useEffect, useState } from "react";
import { AnimatedLogo } from "./AnimatedLogo";
import { LOADING_ANIMATION_STYLES } from "./loadingAnimationStyles";

export function LoadingScreen({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 1900);
    const doneTimer = setTimeout(onDone, 2500);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <>
      <style>{LOADING_ANIMATION_STYLES}</style>
      <div
        className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center"
        style={{
          opacity: fading ? 0 : 1,
          transition: "opacity 600ms",
          pointerEvents: fading ? "none" : "auto",
        }}
        role="status"
        aria-label="Loading"
      >
        <div className="flex flex-col items-center gap-5">
          <AnimatedLogo size={72} />
          <div className="text-center">
            <p
              className="wordmark-animate text-2xl font-medium text-foreground tracking-[0.04em]"
              style={{ fontFamily: "'Fredoka', sans-serif" }}
            >
              Ourizon
            </p>
            <p className="tagline-animate text-sm text-muted-foreground mt-1">
              Forecast your future, together
            </p>
          </div>
        </div>
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-24 h-px bg-border overflow-hidden rounded-full">
          <div className="bar-animate h-full bg-foreground/40 rounded-full" />
        </div>
      </div>
    </>
  );
}
