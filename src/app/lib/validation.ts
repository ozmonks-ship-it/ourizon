export type ParsedAmount = { ok: true; value: number } | { ok: false; empty: boolean };

/** Accepts "1200", "1,200.50" or "$1200". Rejects negatives, letters and more than 2 decimals. */
export function parseAmount(raw: string): ParsedAmount {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (cleaned === "") return { ok: false, empty: true };
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return { ok: false, empty: false };
  return { ok: true, value: parseFloat(cleaned) };
}

/** Returns an error message for a money or percentage field, or null when it's valid. */
export function amountError(
  raw: string,
  options: { required?: boolean; allowZero?: boolean; max?: number; percent?: boolean } = {},
): string | null {
  const { required = true, allowZero = true, max, percent = false } = options;
  const parsed = parseAmount(raw);
  if (!parsed.ok) {
    if (parsed.empty) {
      return required ? (percent ? "Enter a percentage, like 10." : "Enter an amount, like 1200 or 1200.50.") : null;
    }
    return percent ? "Use numbers only, like 10 or 12.5." : "Use numbers only, like 1200 or 1200.50.";
  }
  if (!allowZero && parsed.value === 0) return "Enter an amount more than $0.";
  if (max !== undefined && parsed.value > max) {
    return percent ? `A share of income can't be more than ${max}%.` : `Enter an amount up to ${max}.`;
  }
  return null;
}

/** Parses a field that has already passed amountError. Empty means 0. */
export function amountValue(raw: string): number {
  const parsed = parseAmount(raw);
  return parsed.ok ? parsed.value : 0;
}

export function nameError(raw: string, what: string): string | null {
  return raw.trim() ? null : `Enter a name for this ${what}.`;
}

export function emailError(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Enter an email address.";
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ? null : "Enter a full email address, like sam@example.com.";
}
