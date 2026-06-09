import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { AllocationMode, Bucket, BucketKind } from "@/lib/supabase/database.types";
import { calculateAllocationSummary, type BucketAllocationInput } from "../lib/bucketAllocation";
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

function currentPeriod(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
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
  error: string | null;
  buckets: Bucket[];
  incomeBuckets: Bucket[];
  expenseBuckets: Bucket[];
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
  saveLog: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useLog(session: Session | null): UseLogResult {
  const { year, month } = currentPeriod();
  const monthLabel = new Date(year, month - 1, 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    () => buckets.filter((b) => b.kind === "expense"),
    [buckets],
  );
  const hasIncomeBuckets = incomeBuckets.length > 0;

  const buildDraftFromData = useCallback(
    (bucketRows: Bucket[], netIncome: number, entries: Map<string, { input_value: number }>) => {
      const nextDraft: Record<string, string> = {};
      for (const bucket of bucketRows) {
        const entry = entries.get(bucket.id);
        const value = entry?.input_value ?? bucket.default_value;
        nextDraft[bucket.id] = value === 0 ? "" : String(value);
      }
      setDraftValues(nextDraft);
      setNetIncomeDraft(netIncome === 0 ? "" : String(netIncome));
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (!session?.user.id) {
      setBuckets([]);
      setDraftValues({});
      setNetIncomeDraft("");
      setBudgetOwnerId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ownerId = await resolveBudgetOwnerId(session.user.id);
      setBudgetOwnerId(ownerId);

      let bucketRows = await fetchBuckets(ownerId);
      if (bucketRows.length === 0) {
        await seedDefaultBuckets();
        bucketRows = await fetchBuckets(ownerId);
      }

      setBuckets(bucketRows);

      const log = await fetchMonthlyLog(ownerId, year, month);
      const entryMap = new Map(
        (log?.monthly_log_entries ?? []).map((e) => [e.bucket_id, e]),
      );
      buildDraftFromData(bucketRows, log?.net_income ?? 0, entryMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load log");
    } finally {
      setLoading(false);
    }
  }, [session?.user.id, year, month, buildDraftFromData]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

    const expense = expenseBuckets.map((b) => ({
      id: b.id,
      kind: b.kind,
      allocationMode: b.allocation_mode,
      value: parseDraftValue(draftValues[b.id] ?? ""),
    }));

    return {
      income,
      expense,
      fallbackNetIncome: parseDraftValue(netIncomeDraft),
    };
  }, [incomeBuckets, expenseBuckets, draftValues, netIncomeDraft]);

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
    }) => {
      if (!budgetOwnerId) return;

      setSaving(true);
      setError(null);

      try {
        const sortOrder =
          buckets.length > 0 ? Math.max(...buckets.map((b) => b.sort_order)) + 1 : 1;
        await createBucket(budgetOwnerId, {
          name: input.name,
          kind: input.kind,
          allocationMode: input.allocationMode,
          defaultValue: input.defaultValue,
          sortOrder,
        });
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add bucket");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [budgetOwnerId, buckets, refresh],
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
      setSaving(true);
      setError(null);

      try {
        await updateBucket(bucketId, {
          name: input.name,
          allocationMode: input.allocationMode,
          defaultValue: input.defaultValue,
        });
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update bucket");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [refresh],
  );

  const removeBucket = useCallback(
    async (bucketId: string) => {
      setSaving(true);
      setError(null);

      try {
        await deleteBucket(bucketId);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete bucket");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [refresh],
  );

  const saveLog = useCallback(async () => {
    setSaving(true);
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

      await saveMonthlyLog(year, month, summary.totalIncome, entries);
      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save log");
      throw err;
    } finally {
      setSaving(false);
    }
  }, [buckets, draftValues, summary, year, month]);

  return {
    loading,
    saving,
    error,
    buckets,
    incomeBuckets,
    expenseBuckets,
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
    saveLog,
    refresh,
  };
}
