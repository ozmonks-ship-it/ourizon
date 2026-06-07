import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { AssetGroupId, AssetWithBalance, NetWorthPoint } from "@/lib/supabase/database.types";
import {
  buildAssetsWithBalances,
  buildNetWorthHistory,
  buildSparklineData,
  createAsset,
  deleteAsset,
  fetchAssets,
  fetchSnapshots,
  saveBalanceSnapshot,
} from "../lib/assetsApi";

interface UseAssetsResult {
  loading: boolean;
  saving: boolean;
  error: string | null;
  assets: AssetWithBalance[];
  netWorthHistory: NetWorthPoint[];
  totalNetWorth: number;
  hasAssets: boolean;
  hasSnapshots: boolean;
  getSparkline: (assetId: string) => number[];
  addAsset: (input: { name: string; institution: string; groupId: AssetGroupId }) => Promise<void>;
  removeAsset: (assetId: string) => Promise<void>;
  saveBalances: (balances: Record<string, number>) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAssets(session: Session | null): UseAssetsResult {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetWithBalance[]>([]);
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthPoint[]>([]);
  const [snapshots, setSnapshots] = useState<Awaited<ReturnType<typeof fetchSnapshots>>>([]);

  const refresh = useCallback(async () => {
    if (!session?.user.id) {
      setAssets([]);
      setNetWorthHistory([]);
      setSnapshots([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [assetRows, snapshotRows] = await Promise.all([
        fetchAssets(session.user.id),
        fetchSnapshots(session.user.id),
      ]);

      setSnapshots(snapshotRows);
      setAssets(buildAssetsWithBalances(assetRows, snapshotRows));
      setNetWorthHistory(buildNetWorthHistory(snapshotRows));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assets");
    } finally {
      setLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totalNetWorth = useMemo(() => {
    if (netWorthHistory.length === 0) return 0;
    return netWorthHistory[netWorthHistory.length - 1].value;
  }, [netWorthHistory]);

  const getSparkline = useCallback(
    (assetId: string) => buildSparklineData(assetId, snapshots),
    [snapshots],
  );

  const addAsset = useCallback(
    async (input: { name: string; institution: string; groupId: AssetGroupId }) => {
      if (!session?.user.id) return;

      setSaving(true);
      setError(null);

      try {
        await createAsset(session.user.id, input);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add asset");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [refresh, session?.user.id],
  );

  const removeAsset = useCallback(
    async (assetId: string) => {
      setSaving(true);
      setError(null);

      try {
        await deleteAsset(assetId);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete asset");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [refresh],
  );

  const saveBalances = useCallback(
    async (balances: Record<string, number>) => {
      setSaving(true);
      setError(null);

      try {
        const entries = assets.map((asset) => ({
          asset_id: asset.id,
          balance: balances[asset.id] ?? 0,
        }));

        await saveBalanceSnapshot(entries);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save balances");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [assets, refresh],
  );

  return {
    loading,
    saving,
    error,
    assets,
    netWorthHistory,
    totalNetWorth,
    hasAssets: assets.length > 0,
    hasSnapshots: netWorthHistory.length > 0,
    getSparkline,
    addAsset,
    removeAsset,
    saveBalances,
    refresh,
  };
}
