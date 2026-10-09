import { useState, type ReactNode } from "react";
import { AlertTriangle, Check, Info } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog";
import { btnDanger, btnOutline } from "./buttonStyles";
import { cn } from "./utils";

/** ids for a field's hint and error, joined for aria-describedby. */
export function describedBy(id: string, hasHint: boolean, error: string | null | undefined) {
  return [hasHint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}

export function FieldError({ id, error }: { id: string; error: string | null | undefined }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm font-semibold text-destructive">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{error}</span>
    </p>
  );
}

/** Label, optional hint, the control (rendered by the caller) and an inline error. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-base font-semibold text-foreground">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {children}
      <FieldError id={id} error={error} />
    </div>
  );
}

/** Text input for money or percentages: shows a $ or % unit and opens a keypad with a decimal point. */
export function MoneyInput({
  id,
  value,
  onChange,
  unit = "$",
  error,
  describedById,
  compact = false,
  label,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  unit?: "$" | "%";
  error?: string | null;
  describedById?: string;
  compact?: boolean;
  /** Accessible name when there is no visible <label for>. */
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-xl border-2 bg-background px-3 min-h-11 focus-within:border-focus",
        error ? "border-destructive" : "border-field-border",
        compact ? "w-32 shrink-0" : "w-full",
        "focus-within:ring-2 focus-within:ring-focus",
      )}
    >
      {unit === "$" && (
        <span className="font-semibold text-muted-foreground" aria-hidden="true">
          $
        </span>
      )}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedById}
        className={cn(
          "min-w-0 flex-1 bg-transparent py-2 text-base font-semibold text-foreground outline-none focus-visible:outline-none",
          compact && "text-right",
        )}
      />
      {unit === "%" && (
        <span className="font-semibold text-muted-foreground" aria-hidden="true">
          %
        </span>
      )}
    </div>
  );
}

export type ChipTone = "good" | "warn" | "bad" | "neutral";

/** State shown with an icon and words, never colour alone. */
export function StatusChip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  const color = {
    good: "text-success",
    warn: "text-warning",
    bad: "text-destructive",
    neutral: "text-muted-foreground",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border-[1.5px] border-current px-2.5 py-0.5 text-sm font-bold",
        color,
      )}
    >
      {tone === "good" && <Check className="size-3.5" aria-hidden="true" />}
      {(tone === "warn" || tone === "bad") && <AlertTriangle className="size-3.5" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
  role,
}: {
  tone?: "info" | "warn" | "bad";
  title: ReactNode;
  children?: ReactNode;
  role?: "alert" | "status";
}) {
  const styles = {
    info: "border-primary [&>svg]:text-primary",
    warn: "border-warning [&>svg]:text-warning",
    bad: "border-destructive [&>svg]:text-destructive",
  }[tone];
  const Icon = tone === "info" ? Info : AlertTriangle;
  return (
    <div role={role} className={cn("flex items-start gap-3 rounded-2xl border-2 bg-card p-4", styles)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="font-bold text-foreground">{title}</div>
        {children && <div className="text-sm text-muted-foreground">{children}</div>}
      </div>
    </div>
  );
}

/** Asks before a destructive action and says exactly what will be lost. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // The caller's hook surfaces the error; keep the dialog open so they can retry.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button type="button" className={cn(btnOutline, "flex-1")} onClick={() => onOpenChange(false)} disabled={busy}>
            Keep it
          </button>
          <button type="button" className={cn(btnDanger, "flex-1")} onClick={() => void handleConfirm()} disabled={busy}>
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export interface SheetAction {
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  onSelect: () => void;
}

/** "More options" menu for a row. Replaces exposed edit and delete icons. */
export function ActionSheet({
  open,
  onOpenChange,
  title,
  description,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  actions: SheetAction[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">Choose an action</DialogDescription>
          )}
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={cn(action.destructive ? btnDanger : btnOutline, "w-full justify-start")}
              onClick={() => {
                onOpenChange(false);
                // Let this dialog close before the next one opens, so focus lands correctly.
                window.setTimeout(action.onSelect, 0);
              }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
