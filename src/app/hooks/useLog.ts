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
import {
  createBucket,
  deleteBucket,
  fetchBuckets,
  fetchMonthlyLog,
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
  hasIncomeBuckets: boolean;
  summary: ReturnType<typeof calculateAllocationSummary>;
  saved: boolean;
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
  saveBuckets: () => Promise<void>;
  setSelectedPeriod: (year: number, month: number) => void;
  refresh: () => Promise<void>;
}

export function useLog(session: Session | null): UseLogResult {
  const [selectedPeriod, setSelectedPeriodState] = useState(currentPeriod);
  const { year, month } = selectedPeriod;
  const monthLabel = new Date(year, month - 1, 1).toLocaleString("default", {
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
  const [saved, setSaved] = useState(false);
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
        setBudgetOwnerId(null);
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
        const fromServer = buildDraftFromServer(bucketRows, log?.net_income ?? 0, entryMap);
        const stored = loadDraftSnapshot(userId, year, month);
        applyDraftSnapshot(
          stored ? restoreDraftSnapshot(fromServer, stored, bucketRows) : fromServer,
        );
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
    setLoading(true);
    setSelectedPeriodState({ year: nextYear, month: nextMonth });
    setSaved(false);
  }, []);

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
    hasIncomeBuckets,
    summary,
    saved,
    setDraftValue,
    setNetIncomeDraft: handleSetNetIncomeDraft,
    addBucket,
    editBucket,
    removeBucket,
    saveBuckets,
    setSelectedPeriod,
    refresh,
  };
}
