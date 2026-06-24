import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  buildSavingsForecast,
  DEFAULT_FORECAST_YEARS,
  periodKey,
  type BucketSnapshot,
  type ForecastPoint,
} from "../lib/forecast";
import { fetchMonthlyLogs, resolveBudgetOwnerId } from "../lib/logApi";
import { useAssets } from "./useAssets";
import { currentPeriod, useLog } from "./useLog";

interface UseForecastResult {
  loading: boolean;
  hasSnapshots: boolean;
  forecastData: ForecastPoint[];
  forecastYears: number;
}

export function useForecast(session: Session | null): UseForecastResult {
  const {
    loading: assetsLoading,
    totalNetWorth,
    hasSnapshots,
    netWorthHistory,
  } = useAssets(session);
  const { loading: logLoading, summary } = useLog(session);
  const [logsLoading, setLogsLoading] = useState(true);
  const [savingsByPeriod, setSavingsByPeriod] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!session?.user.id) {
      setSavingsByPeriod(new Map());
      setLogsLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setLogsLoading(true);
      try {
        const ownerId = await resolveBudgetOwnerId(session.user.id);
        const logs = await fetchMonthlyLogs(ownerId);
        if (cancelled) return;

        const next = new Map<string, number>();
        for (const log of logs) {
          next.set(periodKey(log.year, log.month), Number(log.saving_amount));
        }
        setSavingsByPeriod(next);
      } catch {
        if (!cancelled) setSavingsByPeriod(new Map());
      } finally {
        if (!cancelled) setLogsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  const { year: startYear, month: startMonth } = currentPeriod();

  const bucketSnapshots = useMemo((): BucketSnapshot[] => {
    return Array.from(savingsByPeriod.entries())
      .map(([key, saving]) => {
        const [year, month] = key.split("-").map(Number);
        return { year, month, saving };
      })
      .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
  }, [savingsByPeriod]);

  const forecastData = useMemo(() => {
    if (!hasSnapshots) return [];

    const balanceSnapshots = netWorthHistory.map((point) => ({
      recordedAt: point.recordedAt,
      totalWorth: point.value,
    }));

    return buildSavingsForecast({
      netWorthToday: totalNetWorth,
      startYear,
      startMonth,
      forecastYears: DEFAULT_FORECAST_YEARS,
      balanceSnapshots,
      bucketSnapshots,
      fallbackSaving: summary.saving,
    });
  }, [
    hasSnapshots,
    netWorthHistory,
    totalNetWorth,
    startYear,
    startMonth,
    bucketSnapshots,
    summary.saving,
  ]);

  return {
    loading: assetsLoading || logLoading || logsLoading,
    hasSnapshots,
    forecastData,
    forecastYears: DEFAULT_FORECAST_YEARS,
  };
}
