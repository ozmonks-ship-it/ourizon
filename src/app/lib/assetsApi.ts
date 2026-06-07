import { createClient } from "@/lib/supabase/client";
import type {
  Asset,
  AssetGroupId,
  AssetWithBalance,
  NetWorthPoint,
} from "@/lib/supabase/database.types";

interface SnapshotEntryRow {
  asset_id: string;
  balance: number;
}

interface SnapshotWithEntries {
  id: string;
  recorded_at: string;
  total_worth: number;
  balance_snapshot_entries: SnapshotEntryRow[];
}

export async function fetchAssets(userId: string): Promise<Asset[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchSnapshots(userId: string): Promise<SnapshotWithEntries[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("balance_snapshots")
    .select("id, recorded_at, total_worth, balance_snapshot_entries(asset_id, balance)")
    .eq("user_id", userId)
    .order("recorded_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SnapshotWithEntries[];
}

export function buildAssetsWithBalances(
  assets: Asset[],
  snapshots: SnapshotWithEntries[],
): AssetWithBalance[] {
  const latestEntries = new Map<string, number>();

  for (const snapshot of snapshots) {
    for (const entry of snapshot.balance_snapshot_entries) {
      latestEntries.set(entry.asset_id, Number(entry.balance));
    }
  }

  return assets.map((asset) => ({
    ...asset,
    balance: latestEntries.get(asset.id) ?? null,
  }));
}

export function buildNetWorthHistory(snapshots: SnapshotWithEntries[]): NetWorthPoint[] {
  return snapshots.map((snapshot) => ({
    label: formatSnapshotLabel(snapshot.recorded_at),
    value: Number(snapshot.total_worth),
    recordedAt: snapshot.recorded_at,
  }));
}

export function buildSparklineData(
  assetId: string,
  snapshots: SnapshotWithEntries[],
): number[] {
  return snapshots
    .map((snapshot) => {
      const entry = snapshot.balance_snapshot_entries.find((row) => row.asset_id === assetId);
      return entry ? Number(entry.balance) : null;
    })
    .filter((value): value is number => value !== null);
}

export async function createAsset(
  userId: string,
  input: { name: string; institution: string; groupId: AssetGroupId },
): Promise<Asset> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("assets")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      institution: input.institution.trim() || "Self-managed",
      group_id: input.groupId,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAsset(assetId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("assets").delete().eq("id", assetId);
  if (error) throw error;
}

export async function saveBalanceSnapshot(
  entries: { asset_id: string; balance: number }[],
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("save_balance_snapshot", {
    p_entries: entries,
  });

  if (error) throw error;
  return data as string;
}

function formatSnapshotLabel(iso: string): string {
  const date = new Date(iso);
  const month = date.toLocaleDateString("en-AU", { month: "short" });
  const year = date.toLocaleDateString("en-AU", { year: "2-digit" });
  return `${month} '${year}`;
}
