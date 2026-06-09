import type { AllocationMode, BucketKind } from "@/lib/supabase/database.types";

export interface BucketAllocationInput {
  id: string;
  kind: BucketKind;
  allocationMode: AllocationMode;
  value: number;
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
  return Math.round(n);
}

/**
 * Expense buckets with allocation_mode = 'amount' use their value directly.
 * Expense buckets with allocation_mode = 'percent':
 *   - If no amount-mode expense buckets exist → % of total income
 *   - If amount-mode expense buckets exist → % of (total income − sum of amount buckets)
 */
export function calculateExpenseAllocations(
  totalIncome: number,
  expenseBuckets: BucketAllocationInput[],
): Map<string, BucketAllocationResult> {
  const results = new Map<string, BucketAllocationResult>();

  const amountBuckets = expenseBuckets.filter((b) => b.allocationMode === "amount");
  const percentBuckets = expenseBuckets.filter((b) => b.allocationMode === "percent");

  const amountTotal = amountBuckets.reduce((sum, b) => sum + b.value, 0);
  const hasAmountBuckets = amountBuckets.length > 0;
  const percentBase = hasAmountBuckets ? Math.max(0, totalIncome - amountTotal) : totalIncome;

  for (const bucket of amountBuckets) {
    const displayPercent = totalIncome > 0 ? (bucket.value / totalIncome) * 100 : null;
    results.set(bucket.id, {
      resolvedAmount: roundAmount(bucket.value),
      displayPercent: displayPercent !== null ? Math.round(displayPercent * 10) / 10 : null,
    });
  }

  for (const bucket of percentBuckets) {
    const resolvedAmount = roundAmount((percentBase * bucket.value) / 100);
    results.set(bucket.id, {
      resolvedAmount,
      displayPercent: bucket.value,
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

  const expenseResults = calculateExpenseAllocations(totalIncome, expenseBuckets);

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

  const totalExpenses = expenseBuckets.reduce(
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
