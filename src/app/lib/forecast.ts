export const DEFAULT_FORECAST_YEARS = 5;

export interface BalanceSnapshot {
  recordedAt: string;
  totalWorth: number;
}

export interface BucketSnapshot {
  year: number;
  month: number;
  saving: number;
}

export interface ForecastPoint {
  year: string;
  projected: number;
  actual: number;
}

export function periodKey(year: number, month: number): string {
  return `${year}-${month}`;
}

export function periodFromIso(iso: string): { year: number; month: number } {
  const date = new Date(iso);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function balanceSnapshotInMonth(
  snapshots: BalanceSnapshot[],
  year: number,
  month: number,
): BalanceSnapshot | undefined {
  const matches = snapshots.filter((snapshot) => {
    const period = periodFromIso(snapshot.recordedAt);
    return period.year === year && period.month === month;
  });

  if (matches.length === 0) return undefined;
  return matches[matches.length - 1];
}

/**
 * Returns the saving amount from the most recent bucket snapshot on or before
 * the given month. Walks back in time when the current month has no saved log.
 */
export function savingForMonth(
  bucketSnapshots: BucketSnapshot[],
  year: number,
  month: number,
  fallbackSaving: number,
): number {
  let saving = fallbackSaving;

  for (const snapshot of bucketSnapshots) {
    if (snapshot.year < year || (snapshot.year === year && snapshot.month <= month)) {
      saving = snapshot.saving;
    } else {
      break;
    }
  }

  return saving;
}

function advanceMonth(
  projected: number,
  actual: number,
  balanceSnapshots: BalanceSnapshot[],
  bucketSnapshots: BucketSnapshot[],
  year: number,
  month: number,
  fallbackSaving: number,
): { projected: number; actual: number } {
  const activeSaving = savingForMonth(bucketSnapshots, year, month, fallbackSaving);
  const nextProjected = projected + activeSaving;

  const balanceSnapshot = balanceSnapshotInMonth(balanceSnapshots, year, month);
  if (balanceSnapshot) {
    return {
      projected: nextProjected,
      actual: balanceSnapshot.totalWorth,
    };
  }

  return {
    projected: nextProjected,
    actual: actual + activeSaving,
  };
}

/**
 * Projects net worth forward from the current month using bucket snapshot savings.
 * Each month adds the saving from the most recent saved monthly log on or before
 * that month. When a balance snapshot exists, the adjusted line reflects actual
 * net worth (showing gains/losses vs the savings-only projection).
 */
export function buildSavingsForecast(input: {
  netWorthToday: number;
  startYear: number;
  startMonth: number;
  forecastYears: number;
  balanceSnapshots: BalanceSnapshot[];
  bucketSnapshots: BucketSnapshot[];
  fallbackSaving: number;
}): ForecastPoint[] {
  const {
    netWorthToday,
    startYear,
    startMonth,
    forecastYears,
    balanceSnapshots,
    bucketSnapshots,
    fallbackSaving,
  } = input;

  if (balanceSnapshots.length === 0) return [];

  let projected = netWorthToday;
  let actual = netWorthToday;

  const points: ForecastPoint[] = [
    {
      year: String(startYear),
      projected: Math.round(projected),
      actual: Math.round(actual),
    },
  ];

  const totalMonths = forecastYears * 12;

  for (let monthOffset = 1; monthOffset <= totalMonths; monthOffset++) {
    const { year, month } = addMonths(startYear, startMonth, monthOffset);
    const next = advanceMonth(
      projected,
      actual,
      balanceSnapshots,
      bucketSnapshots,
      year,
      month,
      fallbackSaving,
    );
    projected = next.projected;
    actual = next.actual;

    if (monthOffset % 12 === 0) {
      points.push({
        year: String(year),
        projected: Math.round(projected),
        actual: Math.round(actual),
      });
    }
  }

  return points;
}
