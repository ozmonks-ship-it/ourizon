import type { AllocationMode, BucketKind } from "@/lib/supabase/database.types";

export interface BucketAllocationInput {
  id: string;
  kind: BucketKind;
  allocationMode: AllocationMode;
  value: number;
  parentBucketId?: string | null;
}

export interface BucketAllocationResult {
  resolvedAmount: number;
  displayPercent: number | null;
}

export interface AllocationSummary {
  totalIncome: number;
  byBucketId: Map<string, BucketAllocationResult>;
  totalExpenses: number;
  saving: number;
  savingPercent: number;
}

function roundAmount(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Expense buckets with allocation_mode = 'amount' use their value directly.
 * Expense buckets with allocation_mode = 'percent' use % of total income.
 */
export function calculateExpenseAllocations(
  totalIncome: number,
  expenseBuckets: BucketAllocationInput[],
): Map<string, BucketAllocationResult> {
  const results = new Map<string, BucketAllocationResult>();

  const amountBuckets = expenseBuckets.filter((b) => b.allocationMode === "amount");
  const percentBuckets = expenseBuckets.filter((b) => b.allocationMode === "percent");

  for (const bucket of amountBuckets) {
    const displayPercent = totalIncome > 0 ? (bucket.value / totalIncome) * 100 : null;
    results.set(bucket.id, {
      resolvedAmount: roundAmount(bucket.value),
      displayPercent: displayPercent !== null ? Math.round(displayPercent * 10) / 10 : null,
    });
  }

  for (const bucket of percentBuckets) {
    const resolvedAmount = roundAmount((totalIncome * bucket.value) / 100);
    results.set(bucket.id, {
      resolvedAmount,
      displayPercent: bucket.value,
    });
  }

  return results;
}

/** Items under a parent bucket are always fixed amounts. */
export function calculateItemAllocations(
  items: BucketAllocationInput[],
): Map<string, BucketAllocationResult> {
  const results = new Map<string, BucketAllocationResult>();

  for (const item of items) {
    results.set(item.id, {
      resolvedAmount: roundAmount(item.value),
      displayPercent: null,
    });
  }

  return results;
}

export function calculateAllocationSummary(
  incomeBuckets: BucketAllocationInput[],
  expenseBuckets: BucketAllocationInput[],
  fallbackNetIncome = 0,
): AllocationSummary {
  const incomeFromBuckets = incomeBuckets.reduce((sum, b) => sum + b.value, 0);
  const totalIncome = incomeBuckets.length > 0 ? incomeFromBuckets : fallbackNetIncome;

  const topLevelExpense = expenseBuckets.filter((b) => !b.parentBucketId);
  const expenseResults = calculateExpenseAllocations(totalIncome, topLevelExpense);

  const subBucketsByParent = new Map<string, BucketAllocationInput[]>();
  for (const bucket of expenseBuckets) {
    if (!bucket.parentBucketId) continue;
    const siblings = subBucketsByParent.get(bucket.parentBucketId) ?? [];
    siblings.push(bucket);
    subBucketsByParent.set(bucket.parentBucketId, siblings);
  }

  for (const [, items] of subBucketsByParent) {
    const itemResults = calculateItemAllocations(items);
    for (const [id, result] of itemResults) {
      expenseResults.set(id, result);
    }
  }

  const byBucketId = new Map<string, BucketAllocationResult>();

  for (const bucket of incomeBuckets) {
    const displayPercent = totalIncome > 0 ? (bucket.value / totalIncome) * 100 : null;
    byBucketId.set(bucket.id, {
      resolvedAmount: roundAmount(bucket.value),
      displayPercent: displayPercent !== null ? Math.round(displayPercent * 10) / 10 : null,
    });
  }

  for (const [id, result] of expenseResults) {
    byBucketId.set(id, result);
  }

  const totalExpenses = topLevelExpense.reduce(
    (sum, b) => sum + (expenseResults.get(b.id)?.resolvedAmount ?? 0),
    0,
  );
  const saving = roundAmount(totalIncome - totalExpenses);
  const savingPercent =
    totalIncome > 0 ? Math.round((saving / totalIncome) * 1000) / 10 : 0;

  return {
    totalIncome: roundAmount(totalIncome),
    byBucketId,
    totalExpenses,
    saving,
    savingPercent,
  };
}
