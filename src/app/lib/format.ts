const LOCALE = "en-AU";

/** Money for reading: whole dollars when there are no cents, e.g. "$715,517" or "$4,654.20". */
export const fmt = (n: number) => {
  const hasCents = Math.round(Math.abs(n) * 100) % 100 !== 0;
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(n);
};

/** Short money for chart axes only, e.g. "$750k" or "$1.2M". */
export const fmtK = (n: number) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1000)}k`;
  return `${sign}$${Math.round(abs)}`;
};

/** Rounds to the nearest thousand for estimates, e.g. "$879,000". */
export const fmtEstimate = (n: number) => fmt(Math.round(n / 1000) * 1000);

export const fmtDate = (iso: string | Date) =>
  new Date(iso).toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export const fmtMonth = (year: number, month: number) =>
  new Date(year, month - 1, 1).toLocaleDateString(LOCALE, { month: "long", year: "numeric" });

export const fmtMonthName = (year: number, month: number) =>
  new Date(year, month - 1, 1).toLocaleDateString(LOCALE, { month: "long" });

/** Value for an editable money field: plain digits, no grouping, cents only when present. */
export const toInputValue = (n: number | null | undefined) =>
  n === null || n === undefined ? "" : String(Math.round(n * 100) / 100);
