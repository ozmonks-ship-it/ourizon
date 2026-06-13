import { createClient } from "@/lib/supabase/client";
import type { AllocationMode, Bucket, BucketKind, MonthlyLog } from "@/lib/supabase/database.types";
import { resolveBudgetOwnerId } from "./collaborationApi";

export interface MonthlyLogWithEntries extends MonthlyLog {
  monthly_log_entries: {
    bucket_id: string;
    input_value: number;
    resolved_amount: number;
  }[];
}

export async function seedDefaultBuckets(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("seed_default_buckets");
  if (error) throw error;
}

export async function fetchBuckets(budgetOwnerId: string): Promise<Bucket[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("buckets")
    .select("*")
    .eq("user_id", budgetOwnerId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchMonthlyLog(
  budgetOwnerId: string,
  year: number,
  month: number,
): Promise<MonthlyLogWithEntries | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("monthly_logs")
    .select("*, monthly_log_entries(bucket_id, input_value, resolved_amount)")
    .eq("user_id", budgetOwnerId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (error) throw error;
  return data as MonthlyLogWithEntries | null;
}

export async function createBucket(
  budgetOwnerId: string,
  input: {
    name: string;
    kind: BucketKind;
    allocationMode: AllocationMode;
    defaultValue: number;
    sortOrder: number;
    parentBucketId?: string | null;
  },
): Promise<Bucket> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("buckets")
    .insert({
      user_id: budgetOwnerId,
      name: input.name.trim(),
      kind: input.kind,
      allocation_mode: input.allocationMode,
      default_value: input.defaultValue,
      sort_order: input.sortOrder,
      parent_bucket_id: input.parentBucketId ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateBucket(
  bucketId: string,
  input: {
    name?: string;
    allocationMode?: AllocationMode;
    defaultValue?: number;
    sortOrder?: number;
  },
): Promise<void> {
  const supabase = createClient();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.allocationMode !== undefined) patch.allocation_mode = input.allocationMode;
  if (input.defaultValue !== undefined) patch.default_value = input.defaultValue;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

  const { error } = await supabase.from("buckets").update(patch).eq("id", bucketId);
  if (error) throw error;
}

export async function deleteBucket(bucketId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("buckets").delete().eq("id", bucketId);
  if (error) throw error;
}

export async function saveMonthlyLog(
  year: number,
  month: number,
  netIncome: number,
  entries: { bucket_id: string; input_value: number; resolved_amount: number }[],
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("save_monthly_log", {
    p_year: year,
    p_month: month,
    p_net_income: netIncome,
    p_entries: entries,
  });

  if (error) throw error;
  return data as string;
}

export { resolveBudgetOwnerId };
