import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { periodKey } from "../lib/forecast";
import { cn } from "./ui/utils";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

interface MonthPickerProps {
  id?: string;
  year: number;
  month: number;
  savedPeriods: ReadonlySet<string>;
  onChange: (year: number, month: number) => void;
}

export function MonthPicker({
  id,
  year,
  month,
  savedPeriods,
  onChange,
}: MonthPickerProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(year);

  const selectedLabel = new Date(year, month - 1, 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  useEffect(() => {
    if (open) setViewYear(year);
  }, [open, year]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleSelect = (nextMonth: number) => {
    onChange(viewYear, nextMonth);
    setOpen(false);
  };

  const hasSavedMonthsInView = MONTH_LABELS.some((_, index) =>
    savedPeriods.has(periodKey(viewYear, index + 1)),
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-base font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-shadow"
      >
        <CalendarDays className="size-4 text-muted-foreground shrink-0" aria-hidden />
        <span>{selectedLabel}</span>
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Choose month"
          className="absolute left-0 top-full z-50 mt-2 w-[min(100vw-2rem,18rem)] rounded-xl border border-border bg-popover p-3 shadow-lg"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setViewYear((prev) => prev - 1)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
              aria-label="Previous year"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <p className="text-sm font-medium text-foreground tabular-nums">{viewYear}</p>
            <button
              type="button"
              onClick={() => setViewYear((prev) => prev + 1)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
              aria-label="Next year"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {MONTH_LABELS.map((label, index) => {
              const monthNumber = index + 1;
              const isSelected = viewYear === year && monthNumber === month;
              const isSaved = savedPeriods.has(periodKey(viewYear, monthNumber));
              const monthName = MONTH_NAMES[index];

              return (
                <button
                  key={label}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  aria-label={
                    isSaved
                      ? `${monthName} ${viewYear}, buckets saved`
                      : `${monthName} ${viewYear}`
                  }
                  onClick={() => handleSelect(monthNumber)}
                  className={cn(
                    "relative rounded-lg px-2 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring/50",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : isSaved
                        ? "bg-secondary text-secondary-foreground ring-1 ring-inset ring-primary/40"
                        : "text-foreground hover:bg-muted",
                  )}
                >
                  {label}
                  {isSaved && !isSelected && (
                    <span
                      className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary"
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
          </div>

          {hasSavedMonthsInView && (
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className="inline-flex size-3 shrink-0 items-center justify-center rounded-sm bg-secondary ring-1 ring-inset ring-primary/40"
                aria-hidden
              >
                <span className="size-1 rounded-full bg-primary" />
              </span>
              Buckets saved
            </p>
          )}
        </div>
      )}
    </div>
  );
}
