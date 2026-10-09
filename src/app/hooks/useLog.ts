import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { AllocationMode, Bucket, BucketKind } from "@/lib/supabase/database.types";
import { calculateAllocationSummary, type BucketAllocationInput } from "../lib/bucketAllocation";
import {
  buildDraftFromServer,
  clearDraftSnapshot,
  loadDraftSnapshot,
  mergeDraftWithBuckets,
  restoreDraftSnapshot,
  saveDraftSnapshot,
} from "../lib/logDraftStorage";
import { periodKey } from "../lib/forecast";
import {
  createBucket,
  deleteBucket,
  deleteMonthlyLog,
  fetchBuckets,
  fetchMonthlyLog,
  fetchMonthlyLogs,
  resolveBudgetOwnerId,
  saveMonthlyLog,
  seedDefaultBuckets,
  updateBucket,
} from "../lib/logApi";

export function currentPeriod(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function periodToMonthInput(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthInputToPeriod(value: string): { year: number; month: number } {
  const [year, month] = value.split("-").map(Number);
  return { year, month };
}

function parseDraftValue(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === "") return 0;
  const value = parseFloat(trimmed);
  return Number.isNaN(value) || value < 0 ? 0 : value;
}

/**
 * Values carried over from the most recent saved month before the selected one.
 * They pre-fill an unsaved month as real, editable values so you can fine-tune
 * from where you left off rather than starting from scratch.
 */
interface CarryForwardSnapshot {
  values: Record<string, string>;
  netIncome: string;
  year: number;
  month: number;
}

function findPreviousSavedPeriod(
  periods: { year: number; month: number }[],
  year: number,
  month: number,
): { year: number; month: number } | null {
  const target = year * 12 + (month - 1);
  let best: { year: number; month: number } | null = null;
  let bestIndex = -1;
  for (const period of periods) {
    const index = period.year * 12 + (period.month - 1);
    if (index < target && index > bestIndex) {
      bestIndex = index;
      best = { year: period.year, month: period.month };
    }
  }
  return best;
}

/** Draft for an unsaved month, pre-filled from the carried-over month. */
function draftFromCarryForward(
  bucketRows: Bucket[],
  carried: CarryForwardSnapshot,
): { draftValues: Record<string, string>; netIncomeDraft: string } {
  const draftValues: Record<string, string> = {};
  for (const bucket of bucketRows) {
    draftValues[bucket.id] = carried.values[bucket.id] ?? "";
  }
  return { draftValues, netIncomeDraft: carried.netIncome };
}

async function buildCarryForward(
  budgetOwnerId: string,
  savedPeriods: { year: number; month: number }[],
  year: number,
  month: number,
): Promise<CarryForwardSnapshot | null> {
  const previous = findPreviousSavedPeriod(savedPeriods, year, month);
  if (!previous) return null;

  const previousLog = await fetchMonthlyLog(budgetOwnerId, previous.year, previous.month);
  if (!previousLog) return null;

  const values: Record<string, string> = {};
  for (const entry of previousLog.monthly_log_entries ?? []) {
    values[entry.bucket_id] = entry.input_value === 0 ? "" : String(entry.input_value);
  }

  return {
    values,
    netIncome: previousLog.net_income === 0 ? "" : String(previousLog.net_income),
    year: previous.year,
    month: previous.month,
  };
}

interface UseLogResult {
  loading: boolean;
  saving: boolean;
  savingBucket: boolean;
  savingLog: boolean;
  error: string | null;
  buckets: Bucket[];
  incomeBuckets: Bucket[];
  expenseBuckets: Bucket[];
  subBucketsByParent: Map<string, Bucket[]>;
  monthLabel: string;
  year: number;
  month: number;
  draftValues: Record<string, string>;
  netIncomeDraft: string;
  /** The saved month an unsaved month was pre-filled from, if any. */
  carriedFrom: { year: number; month: number } | null;
  hasIncomeBuckets: boolean;
  summary: ReturnType<typeof calculateAllocationSummary>;
  saved: boolean;
  savedPeriods: ReadonlySet<string>;
  isCurrentPeriodSaved: boolean;
  setDraftValue: (bucketId: string, value: string) => void;
  setNetIncomeDraft: (value: string) => void;
  addBucket: (input: {
    name: string;
    kind: BucketKind;
    allocationMode: AllocationMode;
    defaultValue: number;
    parentBucketId?: string | null;
  }) => Promise<void>;
  editBucket: (
    bucketId: string,
    input: {
      name?: string;
      allocationMode?: AllocationMode;
      defaultValue?: number;
    },
  ) => Promise<void>;
  removeBucket: (bucketId: string) => Promise<void>;
  removeMonthlyLog: () => Promise<void>;
  saveBuckets: () => Promise<void>;
  setSelectedPeriod: (year: number, month: number) => void;
  refresh: () => Promise<void>;
}

export function useLog(session: Session | null): UseLogResult {
  const [selectedPeriod, setSelectedPeriodState] = useState(currentPeriod);
  const { year, month } = selectedPeriod;
  const monthLabel = new Date(year, month - 1, 1).toLocaleString("en-AU", {
    month: "long",
    year: "numeric",
  });

  const [loading, setLoading] = useState(true);
  const [savingBucket, setSavingBucket] = useState(false);
  const [savingLog, setSavingLog] = useState(false);
  const saving = savingBucket || savingLog;
  const [error, setError] = useState<string | null>(null);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [netIncomeDraft, setNetIncomeDraft] = useState("");
  const [carryForward, setCarryForward] = useState<CarryForwardSnapshot | null>(null);
  const [saved, setSaved] = useState(false);
  const [savedPeriods, setSavedPeriods] = useState<ReadonlySet<string>>(new Set());
  const [budgetOwnerId, setBudgetOwnerId] = useState<string | null>(null);

  const incomeBuckets = useMemo(
    () => buckets.filter((b) => b.kind === "income"),
    [buckets],
  );
  const expenseBuckets = useMemo(
    () => buckets.filter((b) => b.kind === "expense" && !b.parent_bucket_id),
    [buckets],
  );
  const subBucketsByParent = useMemo(() => {
    const map = new Map<string, Bucket[]>();
    for (const bucket of buckets) {
      if (bucket.kind !== "expense" || !bucket.parent_bucket_id) continue;
      const siblings = map.get(bucket.parent_bucket_id) ?? [];
      siblings.push(bucket);
      map.set(bucket.parent_bucket_id, siblings);
    }
    for (const siblings of map.values()) {
      siblings.sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
  }, [buckets]);
  const hasIncomeBuckets = incomeBuckets.length > 0;
  const isCurrentPeriodSaved = savedPeriods.has(periodKey(year, month));
  const userId = session?.user.id;

  const applyDraftSnapshot = useCallback(
    (snapshot: { draftValues: Record<string, string>; netIncomeDraft: string }) => {
      setDraftValues(snapshot.draftValues);
      setNetIncomeDraft(snapshot.netIncomeDraft);
    },
    [],
  );

  const refresh = useCallback(
    async (options?: { preserveDrafts?: boolean }) => {
      if (!userId) {
        setBuckets([]);
        setDraftValues({});
        setNetIncomeDraft("");
        setCarryForward(null);
        setBudgetOwnerId(null);
        setSavedPeriods(new Set());
        setLoading(false);
        return;
      }

      if (!options?.preserveDrafts) {
        setLoading(true);
      }
      setError(null);

      try {
        const ownerId = await resolveBudgetOwnerId(userId);
        setBudgetOwnerId(ownerId);

        const monthlyLogs = await fetchMonthlyLogs(ownerId);
        setSavedPeriods(
          new Set(monthlyLogs.map((log) => periodKey(log.year, log.month))),
        );

        let bucketRows = await fetchBuckets(ownerId);
        if (bucketRows.length === 0) {
          await seedDefaultBuckets();
          bucketRows = await fetchBuckets(ownerId);
        }

        setBuckets(bucketRows);

        if (options?.preserveDrafts) {
          const log = await fetchMonthlyLog(ownerId, year, month);
          const entryMap = new Map(
            (log?.monthly_log_entries ?? []).map((e) => [e.bucket_id, e]),
          );
          setDraftValues((prev) => mergeDraftWithBuckets(prev, bucketRows, entryMap));
          return;
        }

        const log = await fetchMonthlyLog(ownerId, year, month);
        const entryMap = new Map(
          (log?.monthly_log_entries ?? []).map((e) => [e.bucket_id, e]),
        );

        // For an unsaved month, pre-fill the previous saved month's values so the
        // user can fine-tune instead of starting from scratch.
        const carried = log ? null : await buildCarryForward(ownerId, monthlyLogs, year, month);
        setCarryForward(carried);

        const baseSnapshot = log
          ? buildDraftFromServer(bucketRows, log.net_income ?? 0, entryMap)
          : carried
            ? draftFromCarryForward(bucketRows, carried)
            : buildDraftFromServer(bucketRows, 0, entryMap);
        const stored = loadDraftSnapshot(userId, year, month);
        const restored = stored ? restoreDraftSnapshot(baseSnapshot, stored, bucketRows) : baseSnapshot;
        if (stored && carried) {
          // Older drafts left fields blank to mean "use last month's value".
          for (const bucket of bucketRows) {
            if ((restored.draftValues[bucket.id] ?? "").trim() === "") {
              restored.draftValues[bucket.id] = carried.values[bucket.id] ?? "";
            }
          }
          if (restored.netIncomeDraft.trim() === "") restored.netIncomeDraft = carried.netIncome;
        }
        applyDraftSnapshot(restored);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load log");
      } finally {
        if (!options?.preserveDrafts) {
          setLoading(false);
        }
      }
    },
    [userId, year, month, applyDraftSnapshot],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId || loading) return;
    saveDraftSnapshot(userId, year, month, { draftValues, netIncomeDraft });
  }, [userId, year, month, draftValues, netIncomeDraft, loading]);

  const allocationInputs = useMemo((): {
    income: BucketAllocationInput[];
    expense: BucketAllocationInput[];
    fallbackNetIncome: number;
  } => {
    const income = incomeBuckets.map((b) => ({
      id: b.id,
      kind: b.kind,
      allocationMode: b.allocation_mode,
      value: parseDraftValue(draftValues[b.id] ?? ""),
    }));

    const expense = buckets
      .filter((b) => b.kind === "expense")
      .map((b) => ({
        id: b.id,
        kind: b.kind,
        allocationMode: b.allocation_mode,
        value: parseDraftValue(draftValues[b.id] ?? ""),
        parentBucketId: b.parent_bucket_id,
      }));

    return {
      income,
      expense,
      fallbackNetIncome: parseDraftValue(netIncomeDraft),
    };
  }, [incomeBuckets, buckets, draftValues, netIncomeDraft]);

  const summary = useMemo(
    () =>
      calculateAllocationSummary(
        allocationInputs.income,
        allocationInputs.expense,
        allocationInputs.fallbackNetIncome,
      ),
    [allocationInputs],
  );

  const setDraftValue = useCallback((bucketId: string, value: string) => {
    setDraftValues((prev) => ({ ...prev, [bucketId]: value }));
    setSaved(false);
  }, []);

  const handleSetNetIncomeDraft = useCallback((value: string) => {
    setNetIncomeDraft(value);
    setSaved(false);
  }, []);

  const addBucket = useCallback(
    async (input: {
      name: string;
      kind: BucketKind;
      allocationMode: AllocationMode;
      defaultValue: number;
      parentBucketId?: string | null;
    }) => {
      if (!budgetOwnerId) return;

      setSavingBucket(true);
      setError(null);

      try {
        const siblingBuckets = input.parentBucketId
          ? buckets.filter((b) => b.parent_bucket_id === input.parentBucketId)
          : buckets.filter((b) => !b.parent_bucket_id);
        const sortOrder =
          siblingBuckets.length > 0
            ? Math.max(...siblingBuckets.map((b) => b.sort_order)) + 1
            : buckets.length > 0
              ? Math.max(...buckets.map((b) => b.sort_order)) + 1
              : 1;
        const created = await createBucket(budgetOwnerId, {
          name: input.name,
          kind: input.kind,
          allocationMode: input.parentBucketId ? "amount" : input.allocationMode,
          defaultValue: input.defaultValue,
          sortOrder,
          parentBucketId: input.parentBucketId,
        });
        setBuckets((prev) =>
          [...prev, created].sort((a, b) => a.sort_order - b.sort_order),
        );
        setDraftValues((prev) => ({
          ...prev,
          [created.id]: created.default_value === 0 ? "" : String(created.default_value),
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add bucket");
        throw err;
      } finally {
        setSavingBucket(false);
      }
    },
    [budgetOwnerId, buckets],
  );

  const editBucket = useCallback(
    async (
      bucketId: string,
      input: {
        name?: string;
        allocationMode?: AllocationMode;
        defaultValue?: number;
      },
    ) => {
      setSavingBucket(true);
      setError(null);

      try {
        await updateBucket(bucketId, {
          name: input.name,
          allocationMode: input.allocationMode,
          defaultValue: input.defaultValue,
        });
        setBuckets((prev) =>
          prev.map((bucket) => {
            if (bucket.id !== bucketId) return bucket;
            return {
              ...bucket,
              ...(input.name !== undefined ? { name: input.name.trim() } : {}),
              ...(input.allocationMode !== undefined
                ? { allocation_mode: input.allocationMode }
                : {}),
              ...(input.defaultValue !== undefined ? { default_value: input.defaultValue } : {}),
            };
          }),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update bucket");
        throw err;
      } finally {
        setSavingBucket(false);
      }
    },
    [],
  );

  const removeBucket = useCallback(async (bucketId: string) => {
    setSavingBucket(true);
    setError(null);

    try {
      await deleteBucket(bucketId);
      const childIds = new Set(
        buckets.filter((bucket) => bucket.parent_bucket_id === bucketId).map((bucket) => bucket.id),
      );
      const removedIds = new Set([bucketId, ...childIds]);
      setBuckets((prev) => prev.filter((bucket) => !removedIds.has(bucket.id)));
      setDraftValues((prev) => {
        const next = { ...prev };
        for (const id of removedIds) {
          delete next[id];
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete bucket");
      throw err;
    } finally {
      setSavingBucket(false);
    }
  }, [buckets]);

  const setSelectedPeriod = useCallback((nextYear: number, nextMonth: number) => {
    // Selecting the month that's already active is a no-op. Skipping avoids
    // flipping `loading` on without a matching refresh (the refresh effect keys
    // off year/month, so it wouldn't re-run to turn loading back off).
    if (selectedPeriod.year === nextYear && selectedPeriod.month === nextMonth) {
      return;
    }
    setLoading(true);
    setSelectedPeriodState({ year: nextYear, month: nextMonth });
    setSaved(false);
  }, [selectedPeriod]);

  const removeMonthlyLog = useCallback(async () => {
    if (!budgetOwnerId) return;

    setSavingLog(true);
    setError(null);

    try {
      await deleteMonthlyLog(budgetOwnerId, year, month);
      if (userId) {
        clearDraftSnapshot(userId, year, month);
      }

      const remainingLogs = await fetchMonthlyLogs(budgetOwnerId);
      setSavedPeriods(new Set(remainingLogs.map((log) => periodKey(log.year, log.month))));

      const carried = await buildCarryForward(budgetOwnerId, remainingLogs, year, month);
      setCarryForward(carried);
      applyDraftSnapshot(
        carried ? draftFromCarryForward(buckets, carried) : buildDraftFromServer(buckets, 0, new Map()),
      );
      setSaved(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete log");
      throw err;
    } finally {
      setSavingLog(false);
    }
  }, [budgetOwnerId, year, month, userId, buckets, applyDraftSnapshot]);

  const saveBuckets = useCallback(async () => {
    setSavingLog(true);
    setError(null);

    try {
      const entries = buckets.map((bucket) => {
        const inputValue = parseDraftValue(draftValues[bucket.id] ?? "");
        const resolved = summary.byBucketId.get(bucket.id)?.resolvedAmount ?? inputValue;
        return {
          bucket_id: bucket.id,
          input_value: inputValue,
          resolved_amount: resolved,
        };
      });

      await saveMonthlyLog(year, month, summary.totalIncome, summary.saving, entries);
      if (userId) {
        clearDraftSnapshot(userId, year, month);
      }
      setSavedPeriods((prev) => new Set([...prev, periodKey(year, month)]));

      // The pre-filled values are now this month's saved values.
      setCarryForward(null);

      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save log");
      throw err;
    } finally {
      setSavingLog(false);
    }
  }, [buckets, draftValues, summary, year, month, userId]);

  return {
    loading,
    saving,
    savingBucket,
    savingLog,
    error,
    buckets,
    incomeBuckets,
    expenseBuckets,
    subBucketsByParent,
    monthLabel,
    year,
    month,
    draftValues,
    netIncomeDraft,
    carriedFrom: carryForward ? { year: carryForward.year, month: carryForward.month } : null,
    hasIncomeBuckets,
    summary,
    saved,
    savedPeriods,
    isCurrentPeriodSaved,
    setDraftValue,
    setNetIncomeDraft: handleSetNetIncomeDraft,
    addBucket,
    editBucket,
    removeBucket,
    removeMonthlyLog,
    saveBuckets,
    setSelectedPeriod,
    refresh,
  };
}
