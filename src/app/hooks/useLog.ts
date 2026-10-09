import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { AllocationMode, Bucket, BucketKind } from "@/lib/supabase/database.types";
import { calculateAllocationSummary, type BucketAllocationInput } from "../lib/bucketAllocation";
import {
  buildDraftFromServer,
  clearDraftSnapshot,
  loadDraftSnapshot,
  restoreDraftSnapshot,
  saveDraftSnapshot,
} from "../lib/logDraftStorage";
import { periodKey } from "../lib/forecast";
import { readCache, trackBusy, writeCache } from "../lib/dataCache";
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

/** What a month's plan looked like when last loaded, so revisits are instant. */
interface LogPeriodCache {
  ownerId: string;
  buckets: Bucket[];
  savedPeriods: string[];
  carryForward: CarryForwardSnapshot | null;
  base: { draftValues: Record<string, string>; netIncomeDraft: string };
}

const logCacheKey = (userId: string, year: number, month: number) => `log:${userId}:${periodKey(year, month)}`;

/** The server values for a month with any unsaved local edits applied on top. */
function draftWithStored(
  userId: string,
  year: number,
  month: number,
  base: { draftValues: Record<string, string>; netIncomeDraft: string },
  bucketRows: Bucket[],
  carried: CarryForwardSnapshot | null,
): { draftValues: Record<string, string>; netIncomeDraft: string } {
  const stored = loadDraftSnapshot(userId, year, month);
  if (!stored) return { draftValues: { ...base.draftValues }, netIncomeDraft: base.netIncomeDraft };
  const restored = restoreDraftSnapshot(base, stored, bucketRows);
  if (carried) {
    // Older drafts left fields blank to mean "use last month's value".
    for (const bucket of bucketRows) {
      if ((restored.draftValues[bucket.id] ?? "").trim() === "") {
        restored.draftValues[bucket.id] = carried.values[bucket.id] ?? "";
      }
    }
    if (restored.netIncomeDraft.trim() === "") restored.netIncomeDraft = carried.netIncome;
  }
  return restored;
}

interface UseLogResult {
  loading: boolean;
  /** True while another month's plan loads; the previous month stays on screen. */
  periodLoading: boolean;
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
  const userId = session?.user.id;
  const [initialPeriod] = useState(currentPeriod);
  const [initial] = useState(() => {
    if (!userId) return null;
    const cached = readCache<LogPeriodCache>(logCacheKey(userId, initialPeriod.year, initialPeriod.month));
    if (!cached) return null;
    return {
      cached,
      draft: draftWithStored(userId, initialPeriod.year, initialPeriod.month, cached.base, cached.buckets, cached.carryForward),
    };
  });
  const [selectedPeriod, setSelectedPeriodState] = useState(initialPeriod);
  const { year, month } = selectedPeriod;
  const monthLabel = new Date(year, month - 1, 1).toLocaleString("en-AU", {
    month: "long",
    year: "numeric",
  });

  const [loading, setLoading] = useState(!initial);
  const [savingBucket, setSavingBucket] = useState(false);
  const [savingLog, setSavingLog] = useState(false);
  const saving = savingBucket || savingLog;
  const [error, setError] = useState<string | null>(null);
  const [buckets, setBuckets] = useState<Bucket[]>(initial?.cached.buckets ?? []);
  const [draftValues, setDraftValues] = useState<Record<string, string>>(initial?.draft.draftValues ?? {});
  const [netIncomeDraft, setNetIncomeDraft] = useState(initial?.draft.netIncomeDraft ?? "");
  const [carryForward, setCarryForward] = useState<CarryForwardSnapshot | null>(initial?.cached.carryForward ?? null);
  const [saved, setSaved] = useState(false);
  const [savedPeriods, setSavedPeriods] = useState<ReadonlySet<string>>(new Set(initial?.cached.savedPeriods ?? []));
  const [budgetOwnerId, setBudgetOwnerId] = useState<string | null>(initial?.cached.ownerId ?? null);
  // The month whose values are on screen. Differs from the selected month while it loads.
  const [loadedPeriod, setLoadedPeriodState] = useState<string | null>(
    initial ? periodKey(initialPeriod.year, initialPeriod.month) : null,
  );
  const loadedPeriodRef = useRef(loadedPeriod);
  const setLoadedPeriod = useCallback((value: string | null) => {
    loadedPeriodRef.current = value;
    setLoadedPeriodState(value);
  }, []);
  // Set when the user changes a value, so a background refresh doesn't overwrite it.
  const editedRef = useRef(false);
  const requestRef = useRef(0);

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
  const periodLoading = !loading && loadedPeriod !== periodKey(year, month);

  const applyDraftSnapshot = useCallback(
    (snapshot: { draftValues: Record<string, string>; netIncomeDraft: string }) => {
      setDraftValues(snapshot.draftValues);
      setNetIncomeDraft(snapshot.netIncomeDraft);
    },
    [],
  );

  /** Show a month's cached plan straight away, if there is one. */
  const applyCached = useCallback(
    (nextYear: number, nextMonth: number): boolean => {
      if (!userId) return false;
      const cached = readCache<LogPeriodCache>(logCacheKey(userId, nextYear, nextMonth));
      if (!cached) return false;
      setBudgetOwnerId(cached.ownerId);
      setBuckets(cached.buckets);
      setSavedPeriods(new Set(cached.savedPeriods));
      setCarryForward(cached.carryForward);
      applyDraftSnapshot(draftWithStored(userId, nextYear, nextMonth, cached.base, cached.buckets, cached.carryForward));
      editedRef.current = false;
      setLoadedPeriod(periodKey(nextYear, nextMonth));
      return true;
    },
    [userId, applyDraftSnapshot, setLoadedPeriod],
  );

  const refresh = useCallback(async () => {
    if (!userId) {
      setBuckets([]);
      setDraftValues({});
      setNetIncomeDraft("");
      setCarryForward(null);
      setBudgetOwnerId(null);
      setSavedPeriods(new Set());
      setLoadedPeriod(null);
      setLoading(false);
      return;
    }

    const request = ++requestRef.current;
    const pk = periodKey(year, month);
    // Only the very first load shows placeholders. After that the previous values
    // stay on screen (dimmed when the month changes) while this one loads.
    if (loadedPeriodRef.current === null) setLoading(true);
    setError(null);

    try {
      const result = await trackBusy(
        (async () => {
          const ownerId = await resolveBudgetOwnerId(userId);
          const monthlyLogs = await fetchMonthlyLogs(ownerId);
          let bucketRows = await fetchBuckets(ownerId);
          if (bucketRows.length === 0) {
            await seedDefaultBuckets();
            bucketRows = await fetchBuckets(ownerId);
          }
          const log = await fetchMonthlyLog(ownerId, year, month);
          // For an unsaved month, pre-fill the previous saved month's values so the
          // user can fine-tune instead of starting from scratch.
          const carried = log ? null : await buildCarryForward(ownerId, monthlyLogs, year, month);
          return { ownerId, monthlyLogs, bucketRows, log, carried };
        })(),
      );
      // A newer month was picked while this one loaded; let that request win.
      if (request !== requestRef.current) return;

      const { ownerId, monthlyLogs, bucketRows, log, carried } = result;
      const entryMap = new Map((log?.monthly_log_entries ?? []).map((e) => [e.bucket_id, e]));
      const base = log
        ? buildDraftFromServer(bucketRows, log.net_income ?? 0, entryMap)
        : carried
          ? draftFromCarryForward(bucketRows, carried)
          : buildDraftFromServer(bucketRows, 0, entryMap);
      const savedList = monthlyLogs.map((entry) => periodKey(entry.year, entry.month));

      setBudgetOwnerId(ownerId);
      setSavedPeriods(new Set(savedList));
      setBuckets(bucketRows);
      setCarryForward(carried);

      if (loadedPeriodRef.current !== pk || !editedRef.current) {
        applyDraftSnapshot(draftWithStored(userId, year, month, base, bucketRows, carried));
        editedRef.current = false;
      } else {
        // Keep what the user is typing; just add any buckets that are new.
        setDraftValues((prev) => {
          const next = { ...prev };
          for (const bucket of bucketRows) {
            if (!(bucket.id in next)) next[bucket.id] = base.draftValues[bucket.id] ?? "";
          }
          return next;
        });
      }
      setLoadedPeriod(pk);
      writeCache<LogPeriodCache>(logCacheKey(userId, year, month), {
        ownerId,
        buckets: bucketRows,
        savedPeriods: savedList,
        carryForward: carried,
        base,
      });
    } catch (err) {
      if (request === requestRef.current) setError(err instanceof Error ? err.message : "Failed to load log");
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [userId, year, month, applyDraftSnapshot, setLoadedPeriod]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    // Only persist drafts for the month that's actually on screen.
    if (!userId || loading || loadedPeriod !== periodKey(year, month)) return;
    saveDraftSnapshot(userId, year, month, { draftValues, netIncomeDraft });
  }, [userId, year, month, draftValues, netIncomeDraft, loading, loadedPeriod]);

  // Keep the cached bucket list in step with adds, edits and deletes.
  useEffect(() => {
    if (!userId || loadedPeriod !== periodKey(year, month)) return;
    const key = logCacheKey(userId, year, month);
    const cached = readCache<LogPeriodCache>(key);
    if (cached) writeCache<LogPeriodCache>(key, { ...cached, buckets, savedPeriods: [...savedPeriods] });
  }, [userId, year, month, loadedPeriod, buckets, savedPeriods]);

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
    editedRef.current = true;
    setDraftValues((prev) => ({ ...prev, [bucketId]: value }));
    setSaved(false);
  }, []);

  const handleSetNetIncomeDraft = useCallback((value: string) => {
    editedRef.current = true;
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

  const setSelectedPeriod = useCallback(
    (nextYear: number, nextMonth: number) => {
      if (selectedPeriod.year === nextYear && selectedPeriod.month === nextMonth) return;
      setSelectedPeriodState({ year: nextYear, month: nextMonth });
      setSaved(false);
      // A month seen before appears at once; otherwise the current one stays,
      // dimmed, until the new month arrives (see periodLoading).
      applyCached(nextYear, nextMonth);
    },
    [selectedPeriod, applyCached],
  );

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
      // Refresh quietly so the cached copy of this month matches the server again.
      editedRef.current = false;
      void refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete log");
      throw err;
    } finally {
      setSavingLog(false);
    }
  }, [budgetOwnerId, year, month, userId, buckets, applyDraftSnapshot, refresh]);

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
      editedRef.current = false;
      if (userId && budgetOwnerId) {
        writeCache<LogPeriodCache>(logCacheKey(userId, year, month), {
          ownerId: budgetOwnerId,
          buckets,
          savedPeriods: [...savedPeriods, periodKey(year, month)],
          carryForward: null,
          base: { draftValues, netIncomeDraft },
        });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save log");
      throw err;
    } finally {
      setSavingLog(false);
    }
  }, [buckets, draftValues, netIncomeDraft, summary, year, month, userId, budgetOwnerId, savedPeriods]);

  return {
    loading,
    periodLoading,
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
