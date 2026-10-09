import { cn } from "./utils";

const base =
  "inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl font-semibold text-base transition-[opacity,background-color,color] disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 [&_svg]:size-5 [&_svg]:shrink-0";

export const btnPrimary = cn(base, "bg-primary text-primary-foreground hover:opacity-90");
export const btnOutline = cn(base, "border-2 border-field-border bg-transparent text-foreground hover:bg-muted");
export const btnSecondary = cn(base, "bg-muted text-foreground hover:bg-secondary");
export const btnDanger = cn(base, "bg-destructive text-background hover:opacity-90");
export const btnLink =
  "inline-flex items-center min-h-11 px-1 font-semibold text-primary underline underline-offset-4 hover:opacity-90";
/** 44 × 44px icon-only button. Always pass an aria-label. */
export const iconBtn =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-5";
