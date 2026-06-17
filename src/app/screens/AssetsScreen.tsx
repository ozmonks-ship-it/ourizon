import { useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotProps,
} from "recharts";
import { Check, Pencil, PlusCircle, Trash2, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { ASSET_GROUPS } from "../data/assetGroups";
import { useAssets } from "../hooks/useAssets";
import { fmt, fmtK, fmtSnapshotDate } from "../lib/format";
import type { AssetGroupId, AssetWithBalance, NetWorthPoint } from "@/lib/supabase/database.types";

interface AssetsScreenProps {
  session: Session;
}

export function AssetsScreen({ session }: AssetsScreenProps) {
  const {
    loading,
    saving,
    error,
    assets,
    netWorthHistory,
    totalNetWorth,
    hasAssets,
    hasSnapshots,
    addAsset,
    removeAsset,
    saveBalances,
    updateSnapshot,
    removeSnapshot,
    getSnapshotBalancesForEdit,
  } = useAssets(session);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBalances, setEditingBalances] = useState(false);
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<NetWorthPoint | null>(null);
  const [draftBalances, setDraftBalances] = useState<Record<string, string>>({});
  const [newAsset, setNewAsset] = useState({
    name: "",
    institution: "",
    groupId: "cash" as AssetGroupId,
  });

  const groupedAssets = useMemo(() => {
    return ASSET_GROUPS.map((group) => ({
      ...group,
      accounts: assets.filter((asset) => asset.group_id === group.id),
    })).filter((group) => group.accounts.length > 0);
  }, [assets]);

  const startEditingBalances = () => {
    const nextDraft: Record<string, string> = {};
    for (const asset of assets) {
      nextDraft[asset.id] = asset.balance === null ? "" : String(asset.balance);
    }
    setEditingSnapshotId(null);
    setDraftBalances(nextDraft);
    setEditingBalances(true);
  };

  const startEditingSnapshot = (snapshot: NetWorthPoint) => {
    const balances = getSnapshotBalancesForEdit(snapshot.id);
    const nextDraft: Record<string, string> = {};
    for (const asset of assets) {
      nextDraft[asset.id] = String(balances[asset.id] ?? 0);
    }
    setEditingSnapshotId(snapshot.id);
    setDraftBalances(nextDraft);
    setEditingBalances(true);
    setSelectedSnapshot(null);
  };

  const cancelEditingBalances = () => {
    setEditingBalances(false);
    setEditingSnapshotId(null);
    setDraftBalances({});
  };

  const confirmBalances = async () => {
    const parsed: Record<string, number> = {};

    for (const asset of assets) {
      const raw = draftBalances[asset.id]?.trim() ?? "";
      const value = raw === "" ? 0 : parseFloat(raw);
      if (Number.isNaN(value) || value < 0) return;
      parsed[asset.id] = value;
    }

    try {
      if (editingSnapshotId) {
        await updateSnapshot(editingSnapshotId, parsed);
      } else {
        await saveBalances(parsed);
      }
      cancelEditingBalances();
    } catch {
      // Error surfaced via hook state.
    }
  };

  const handleDeleteSnapshot = async () => {
    if (!selectedSnapshot) return;

    try {
      if (editingSnapshotId === selectedSnapshot.id) {
        cancelEditingBalances();
      }
      await removeSnapshot(selectedSnapshot.id);
      setSelectedSnapshot(null);
    } catch {
      // Error surfaced via hook state.
    }
  };

  const handleAddAsset = async () => {
    if (!newAsset.name.trim()) return;

    try {
      await addAsset({
        name: newAsset.name,
        institution: newAsset.institution,
        groupId: newAsset.groupId,
      });
      setNewAsset({ name: "", institution: "", groupId: "cash" });
      setDialogOpen(false);
    } catch {
      // Error surfaced via hook state.
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    try {
      await removeAsset(assetId);
    } catch {
      // Error surfaced via hook state.
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">Loading your assets…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-foreground mb-1">Your Assets 💼</h1>
          {hasSnapshots ? (
            <p className="text-muted-foreground text-sm">
              Total: <span className="font-medium text-foreground">{fmt(totalNetWorth)}</span>
            </p>
          ) : hasAssets ? (
            <p className="text-muted-foreground text-sm">Update balances to track your net worth.</p>
          ) : (
            <p className="text-muted-foreground text-sm">Add your accounts and investments to get started.</p>
          )}
        </div>

        {hasAssets && (
          <AddAssetDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            newAsset={newAsset}
            setNewAsset={setNewAsset}
            onAdd={handleAddAsset}
            saving={saving}
            triggerLabel="Add"
          />
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!hasAssets ? (
        <EmptyAssetsState
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          newAsset={newAsset}
          setNewAsset={setNewAsset}
          onAdd={handleAddAsset}
          saving={saving}
        />
      ) : (
        <>
          {hasSnapshots && (
            <div className="bg-card rounded-xl p-5 border border-border">
              <h2 className="font-medium text-base text-foreground mb-0.5">Net Worth 📈</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Click a point to edit or delete a snapshot
              </p>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={netWorthHistory} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={fmtK}
                    tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                  />
                  <Tooltip
                    formatter={(value: number) => [fmt(value), "Net worth"]}
                    wrapperStyle={{ pointerEvents: "none" }}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 11,
                      pointerEvents: "none",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="currentColor"
                    strokeWidth={2}
                    fill="currentColor"
                    fillOpacity={0.1}
                    strokeOpacity={0.6}
                    isAnimationActive={false}
                    dot={({ key, ...props }) => (
                      <SnapshotChartDot key={key} {...props} onSelect={setSelectedSnapshot} />
                    )}
                    activeDot={({ key, ...props }) => (
                      <SnapshotChartDot
                        key={key}
                        {...props}
                        onSelect={setSelectedSnapshot}
                        active
                      />
                    )}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <SnapshotActionDialog
            snapshot={selectedSnapshot}
            saving={saving}
            onClose={() => setSelectedSnapshot(null)}
            onEdit={() => selectedSnapshot && startEditingSnapshot(selectedSnapshot)}
            onDelete={() => void handleDeleteSnapshot()}
          />

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {editingBalances
                ? editingSnapshotId
                  ? `Editing snapshot from ${fmtSnapshotDate(
                      netWorthHistory.find((point) => point.id === editingSnapshotId)?.recordedAt ?? "",
                    )}.`
                  : "Enter balances for all assets, then save once."
                : hasSnapshots
                  ? "Balances reflect your latest saved snapshot."
                  : "Save your first balance snapshot to start the net worth chart."}
            </p>
            {!editingBalances ? (
              <button
                type="button"
                onClick={startEditingBalances}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-foreground text-background font-medium text-sm transition-all duration-150 hover:opacity-90 active:scale-95 disabled:opacity-50"
              >
                <Pencil size={16} />
                Update balances
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelEditingBalances}
                  disabled={saving}
                  className="px-3 py-2 rounded-lg bg-muted text-foreground font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmBalances()}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-foreground text-background font-medium text-sm transition-all duration-150 hover:opacity-90 active:scale-95 disabled:opacity-50"
                >
                  <Check size={16} />
                  {saving ? "Saving…" : editingSnapshotId ? "Save changes" : "Save snapshot"}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {groupedAssets.map((group) => {
              const groupTotal = group.accounts.reduce((sum, asset) => {
                if (editingBalances) {
                  const raw = draftBalances[asset.id]?.trim() ?? "";
                  const value = raw === "" ? 0 : parseFloat(raw);
                  return sum + (Number.isNaN(value) ? 0 : value);
                }
                return sum + (asset.balance ?? 0);
              }, 0);

              return (
                <div key={group.id} className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
                    <p className="font-medium text-sm flex-1 text-foreground">{group.label}</p>
                    <p className="font-medium text-foreground text-base">
                      {hasSnapshots || editingBalances ? fmtK(groupTotal) : "—"}
                    </p>
                  </div>
                  <div className="divide-y divide-border">
                    {group.accounts.map((asset) => (
                      <AssetRow
                        key={asset.id}
                        asset={asset}
                        editing={editingBalances}
                        draftValue={draftBalances[asset.id] ?? ""}
                        onDraftChange={(value) =>
                          setDraftBalances((prev) => ({ ...prev, [asset.id]: value }))
                        }
                        showBalance={hasSnapshots || editingBalances}
                        onDelete={() => void handleDeleteAsset(asset.id)}
                        saving={saving}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function SnapshotChartDot({
  cx,
  cy,
  payload,
  onSelect,
  active = false,
}: DotProps & { onSelect: (point: NetWorthPoint) => void; active?: boolean }) {
  if (cx == null || cy == null || !payload) return null;

  const point = payload as NetWorthPoint;
  const visibleRadius = active ? 7 : 5;

  return (
    <g
      className="cursor-pointer"
      style={{ pointerEvents: "all" }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(point);
      }}
    >
      <circle cx={cx} cy={cy} r={14} fill="transparent" aria-hidden="true" />
      <circle
        cx={cx}
        cy={cy}
        r={visibleRadius}
        fill="currentColor"
        stroke={active ? "var(--background)" : "none"}
        strokeWidth={active ? 2 : 0}
        className={active ? "opacity-100" : "opacity-70 hover:opacity-100"}
      />
    </g>
  );
}

function SnapshotActionDialog({
  snapshot,
  saving,
  onClose,
  onEdit,
  onDelete,
}: {
  snapshot: NetWorthPoint | null;
  saving: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Dialog open={snapshot !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-medium">Snapshot</DialogTitle>
        </DialogHeader>
        {snapshot && (
          <div className="space-y-4 py-1">
            <div>
              <p className="text-sm text-muted-foreground">{fmtSnapshotDate(snapshot.recordedAt)}</p>
              <p className="text-xl font-medium text-foreground mt-1">{fmt(snapshot.value)}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onEdit}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-foreground text-background font-medium text-sm transition-all duration-150 hover:opacity-90 active:scale-95 disabled:opacity-50"
              >
                <Pencil size={16} />
                Edit balances
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-border bg-card text-foreground font-medium text-sm transition-colors hover:bg-muted disabled:opacity-50"
              >
                <Trash2 size={16} />
                {saving ? "Deleting…" : "Delete snapshot"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EmptyAssetsState({
  open,
  onOpenChange,
  newAsset,
  setNewAsset,
  onAdd,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newAsset: { name: string; institution: string; groupId: AssetGroupId };
  setNewAsset: React.Dispatch<
    React.SetStateAction<{ name: string; institution: string; groupId: AssetGroupId }>
  >;
  onAdd: () => void | Promise<void>;
  saving: boolean;
}) {
  return (
    <div className="bg-card rounded-xl border border-border px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Wallet size={24} className="text-muted-foreground" />
      </div>
      <h2 className="text-lg font-medium text-foreground mb-2">Add your first asset</h2>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
        Start by adding your bank accounts, investments, property, or super funds. You can save
        balance snapshots later to build your net worth chart.
      </p>
      <AddAssetDialog
        open={open}
        onOpenChange={onOpenChange}
        newAsset={newAsset}
        setNewAsset={setNewAsset}
        onAdd={onAdd}
        saving={saving}
        triggerLabel="Add your first asset"
      />
    </div>
  );
}

function AddAssetDialog({
  open,
  onOpenChange,
  newAsset,
  setNewAsset,
  onAdd,
  saving,
  triggerLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newAsset: { name: string; institution: string; groupId: AssetGroupId };
  setNewAsset: React.Dispatch<
    React.SetStateAction<{ name: string; institution: string; groupId: AssetGroupId }>
  >;
  onAdd: () => void | Promise<void>;
  saving: boolean;
  triggerLabel: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-foreground text-background font-medium text-sm transition-all duration-150 hover:opacity-90 active:scale-95"
        >
          <PlusCircle size={16} />
          {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-medium">Add New Asset</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Asset Name</label>
            <Input
              placeholder="Investment Property - Sydney"
              value={newAsset.name}
              onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Institution / Provider
            </label>
            <Input
              placeholder="Ray White, Self-managed"
              value={newAsset.institution}
              onChange={(e) => setNewAsset({ ...newAsset, institution: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Asset Type</label>
            <Select
              value={newAsset.groupId}
              onValueChange={(val) => setNewAsset({ ...newAsset, groupId: val as AssetGroupId })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_GROUPS.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <button
            type="button"
            onClick={() => void onAdd()}
            disabled={saving || !newAsset.name.trim()}
            className="w-full py-2.5 rounded-lg bg-foreground text-background font-medium text-sm transition-all duration-150 hover:opacity-90 active:scale-95 mt-2 disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add Asset"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssetRow({
  asset,
  editing,
  draftValue,
  onDraftChange,
  showBalance,
  onDelete,
  saving,
}: {
  asset: AssetWithBalance;
  editing: boolean;
  draftValue: string;
  onDraftChange: (value: string) => void;
  showBalance: boolean;
  onDelete: () => void;
  saving: boolean;
}) {
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{asset.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{asset.institution}</p>
      </div>
      <div className="shrink-0 text-right">
        {editing ? (
          <input
            type="number"
            min="0"
            step="0.01"
            value={draftValue}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="0"
            className="w-28 bg-muted rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground text-right focus:outline-none focus:ring-2 focus:ring-foreground/20"
          />
        ) : showBalance ? (
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground">
              {asset.balance === null ? fmt(0) : fmt(asset.balance)}
            </p>
            {!editing && (
              <button
                type="button"
                onClick={onDelete}
                disabled={saving}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                title="Delete asset"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            title="Delete asset"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
