import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, MoreHorizontal, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { btnOutline, btnPrimary, iconBtn } from "../components/ui/buttonStyles";
import { ActionSheet, Callout, ConfirmDialog, Field, FieldError, MoneyInput, describedBy } from "../components/ui/kit";
import { PageLoader } from "../components/PageLoader";
import { useToast } from "../components/Toast";
import { ASSET_GROUPS } from "../data/assetGroups";
import { clearAssetsDraft, loadAssetsDraft, mergeDraftWithAssets, saveAssetsDraft } from "../lib/assetsDraftStorage";
import { useAssets } from "../hooks/useAssets";
import { fmt, fmtDate, fmtK, toInputValue } from "../lib/format";
import { amountError, amountValue, nameError } from "../lib/validation";
import type { AssetGroupId, AssetWithBalance, NetWorthPoint } from "@/lib/supabase/database.types";

interface AssetsScreenProps {
  session: Session;
}

const HISTORY_PREVIEW = 4;

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
  const toast = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [editingBalances, setEditingBalances] = useState(false);
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null);
  const [draftBalances, setDraftBalances] = useState<Record<string, string>>({});
  const [balanceErrors, setBalanceErrors] = useState<Record<string, string>>({});
  const [assetMenu, setAssetMenu] = useState<AssetWithBalance | null>(null);
  const [assetToRemove, setAssetToRemove] = useState<AssetWithBalance | null>(null);
  const [recordMenu, setRecordMenu] = useState<NetWorthPoint | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<NetWorthPoint | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const userId = session.user.id;
  const draftRestored = useRef(false);

  // Restore an in-progress balance edit once assets have loaded. Guards against a
  // reload (e.g. the mobile OS relaunching the PWA after an app switch) wiping the
  // values the user had already typed. Runs at most once per mount.
  useEffect(() => {
    if (loading || draftRestored.current) return;
    draftRestored.current = true;

    const stored = loadAssetsDraft(userId);
    if (stored && assets.length > 0) {
      setDraftBalances(mergeDraftWithAssets(stored.draftBalances, assets));
      setEditingSnapshotId(stored.editingSnapshotId);
      setEditingBalances(true);
    }
  }, [loading, userId, assets]);

  // Persist the draft on every change while editing so nothing is lost mid-edit.
  useEffect(() => {
    if (loading || !draftRestored.current || !editingBalances) return;
    saveAssetsDraft(userId, { editingSnapshotId, draftBalances });
  }, [loading, userId, editingBalances, editingSnapshotId, draftBalances]);

  const groupedAssets = useMemo(() => {
    return ASSET_GROUPS.map((group) => ({
      ...group,
      accounts: assets.filter((asset) => asset.group_id === group.id),
    })).filter((group) => group.accounts.length > 0);
  }, [assets]);

  const editingRecord = editingSnapshotId
    ? netWorthHistory.find((point) => point.id === editingSnapshotId) ?? null
    : null;
  const previousBalances = useMemo(
    () => (editingSnapshotId ? getSnapshotBalancesForEdit(editingSnapshotId) : null),
    [editingSnapshotId, getSnapshotBalancesForEdit],
  );
  const previousBalance = (asset: AssetWithBalance) =>
    previousBalances ? previousBalances[asset.id] ?? 0 : asset.balance;

  const draftTotal = assets.reduce((sum, asset) => sum + amountValue(draftBalances[asset.id] ?? ""), 0);
  const changedCount = assets.filter((asset) => {
    const before = previousBalance(asset);
    const raw = draftBalances[asset.id] ?? "";
    return amountError(raw) === null && amountValue(raw) !== (before ?? 0);
  }).length;

  const startEditingBalances = () => {
    const nextDraft: Record<string, string> = {};
    for (const asset of assets) {
      nextDraft[asset.id] = toInputValue(asset.balance);
    }
    setEditingSnapshotId(null);
    setDraftBalances(nextDraft);
    setBalanceErrors({});
    setEditingBalances(true);
    window.requestAnimationFrame(() => document.querySelector<HTMLInputElement>("[data-balance-input-wrap] input")?.focus());
  };

  const startEditingSnapshot = (snapshot: NetWorthPoint) => {
    const balances = getSnapshotBalancesForEdit(snapshot.id);
    const nextDraft: Record<string, string> = {};
    for (const asset of assets) {
      nextDraft[asset.id] = toInputValue(balances[asset.id] ?? 0);
    }
    setEditingSnapshotId(snapshot.id);
    setDraftBalances(nextDraft);
    setBalanceErrors({});
    setEditingBalances(true);
    document.querySelector("main")?.scrollTo({ top: 0 });
  };

  const cancelEditingBalances = () => {
    setEditingBalances(false);
    setEditingSnapshotId(null);
    setDraftBalances({});
    setBalanceErrors({});
    clearAssetsDraft(userId);
  };

  const confirmBalances = async () => {
    const errors: Record<string, string> = {};
    const parsed: Record<string, number> = {};
    for (const asset of assets) {
      const raw = draftBalances[asset.id] ?? "";
      const problem =
        raw.trim() === "" ? "Enter a balance. Use 0 if the account is empty." : amountError(raw);
      if (problem) errors[asset.id] = problem;
      else parsed[asset.id] = amountValue(raw);
    }
    setBalanceErrors(errors);

    const firstError = assets.find((asset) => errors[asset.id]);
    if (firstError) {
      document.getElementById(`asset-balance-${firstError.id}`)?.focus();
      const count = Object.keys(errors).length;
      toast(`${count} ${count === 1 ? "balance needs" : "balances need"} fixing before you can save`);
      return;
    }

    try {
      if (editingSnapshotId) {
        await updateSnapshot(editingSnapshotId, parsed);
        toast(`Balances updated for ${fmtDate(editingRecord?.recordedAt ?? new Date())}`);
      } else {
        await saveBalances(parsed);
        toast(`Balances saved for ${fmtDate(new Date())}`);
      }
      cancelEditingBalances();
    } catch {
      // Error surfaced via hook state.
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  const lastUpdated = netWorthHistory[netWorthHistory.length - 1];
  const historyNewestFirst = [...netWorthHistory].reverse();
  const visibleHistory = showAllHistory ? historyNewestFirst : historyNewestFirst.slice(0, HISTORY_PREVIEW);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 tabIndex={-1} className="text-2xl font-semibold text-foreground focus:outline-none">
          Assets
        </h1>
        {editingBalances ? (
          <p className="text-muted-foreground">
            New total <strong className="text-foreground tabular-nums">{fmt(draftTotal)}</strong>
          </p>
        ) : hasSnapshots && lastUpdated ? (
          <p className="text-muted-foreground">
            Total <strong className="text-foreground tabular-nums">{fmt(totalNetWorth)}</strong> · last updated{" "}
            {fmtDate(lastUpdated.recordedAt)}
          </p>
        ) : hasAssets ? (
          <p className="text-muted-foreground">Record your balances to start tracking your net worth.</p>
        ) : (
          <p className="text-muted-foreground">Everything you own that has a dollar value.</p>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-2xl border-2 border-destructive bg-card px-4 py-3 font-semibold text-destructive">
          {error}
        </p>
      )}

      {!hasAssets ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-10 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted" aria-hidden="true">
            <Wallet className="size-6 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Add your first account</h2>
          <p className="max-w-sm text-muted-foreground">
            Start with your everyday bank account. You can add shares, property and super afterwards.
          </p>
          <button type="button" className={btnPrimary} onClick={() => setAddOpen(true)}>
            <Plus aria-hidden="true" />
            Add an account
          </button>
        </section>
      ) : (
        <>
          {editingBalances ? (
            <Callout
              title={
                editingRecord
                  ? `Editing the balances you recorded on ${fmtDate(editingRecord.recordedAt)}`
                  : `Recording balances for ${fmtDate(new Date())}`
              }
            >
              Change any amount that's different, then save. {changedCount} of {assets.length} changed.
            </Callout>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`${btnPrimary} flex-1`} onClick={startEditingBalances} disabled={saving}>
                <Pencil aria-hidden="true" />
                {hasSnapshots ? "Update balances" : "Record balances"}
              </button>
              <button type="button" className={btnOutline} onClick={() => setAddOpen(true)}>
                <Plus aria-hidden="true" />
                Add account
              </button>
            </div>
          )}

          {groupedAssets.map((group) => {
            const groupTotal = group.accounts.reduce(
              (sum, asset) =>
                sum + (editingBalances ? amountValue(draftBalances[asset.id] ?? "") : asset.balance ?? 0),
              0,
            );
            return (
              <section
                key={group.id}
                aria-labelledby={`group-${group.id}`}
                className="flex flex-col rounded-2xl border border-border bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3 pb-1">
                  <h2 id={`group-${group.id}`} className="flex-1 text-lg font-semibold text-foreground">
                    {group.label}
                  </h2>
                  {(hasSnapshots || editingBalances) && (
                    <span className="font-bold text-foreground tabular-nums">{fmt(groupTotal)}</span>
                  )}
                </div>
                <ul className="divide-y divide-border">
                  {group.accounts.map((asset) => (
                    <AssetRow
                      key={asset.id}
                      asset={asset}
                      editing={editingBalances}
                      showBalance={hasSnapshots}
                      draftValue={draftBalances[asset.id] ?? ""}
                      previousBalance={previousBalance(asset)}
                      error={balanceErrors[asset.id]}
                      onDraftChange={(value) => {
                        setDraftBalances((prev) => ({ ...prev, [asset.id]: value }));
                        if (balanceErrors[asset.id]) {
                          setBalanceErrors((prev) => {
                            const next = { ...prev };
                            delete next[asset.id];
                            return next;
                          });
                        }
                      }}
                      onMore={() => setAssetMenu(asset)}
                    />
                  ))}
                </ul>
              </section>
            );
          })}

          {!editingBalances && hasSnapshots && (
            <section aria-labelledby="history-heading" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
              <h2 id="history-heading" className="text-lg font-semibold text-foreground">
                Balance history
              </h2>
              <p className="text-sm text-muted-foreground">
                Each time you save balances, a record is added here. Fix a past record if you typed something
                wrong.
              </p>
              {netWorthHistory.length > 1 && <NetWorthChart history={netWorthHistory} />}
              <ul className="divide-y divide-border">
                {visibleHistory.map((point) => (
                  <li key={point.id} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{fmtDate(point.recordedAt)}</p>
                      <p className="text-sm text-muted-foreground tabular-nums">Net worth {fmt(point.value)}</p>
                    </div>
                    <button
                      type="button"
                      className={iconBtn}
                      onClick={() => setRecordMenu(point)}
                      aria-label={`More options for the ${fmtDate(point.recordedAt)} record`}
                    >
                      <MoreHorizontal aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
              {netWorthHistory.length > HISTORY_PREVIEW && (
                <button
                  type="button"
                  className={`${btnOutline} self-start`}
                  aria-expanded={showAllHistory}
                  onClick={() => setShowAllHistory((prev) => !prev)}
                >
                  {showAllHistory ? "Show fewer" : `Show all ${netWorthHistory.length} records`}
                </button>
              )}
            </section>
          )}

          {editingBalances && (
            <div className="sticky bottom-0 -mx-4 -mb-8 flex gap-2 border-t border-border bg-background px-4 pt-3 pb-4">
              <button type="button" className={`${btnOutline} flex-1`} onClick={cancelEditingBalances} disabled={saving}>
                Cancel
              </button>
              <button type="button" className={`${btnPrimary} flex-1`} onClick={() => void confirmBalances()} disabled={saving}>
                <Check aria-hidden="true" />
                {saving ? "Saving…" : "Save balances"}
              </button>
            </div>
          )}
        </>
      )}

      <AddAssetDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        saving={saving}
        onAdd={async (input) => {
          await addAsset(input);
          toast(`${input.name.trim()} added`);
        }}
      />

      <ActionSheet
        open={assetMenu !== null}
        onOpenChange={(next) => !next && setAssetMenu(null)}
        title={assetMenu?.name ?? ""}
        description={assetMenu?.institution}
        actions={[
          {
            label: "Remove account",
            icon: <Trash2 aria-hidden="true" />,
            destructive: true,
            onSelect: () => setAssetToRemove(assetMenu),
          },
        ]}
      />

      <ConfirmDialog
        open={assetToRemove !== null}
        onOpenChange={(next) => !next && setAssetToRemove(null)}
        title={`Remove ${assetToRemove?.name ?? "this account"}?`}
        description={
          netWorthHistory.length > 0
            ? `Its balance will be removed from all ${netWorthHistory.length} balance records, so your past net worth will change. This can't be undone.`
            : "This can't be undone."
        }
        confirmLabel="Remove account"
        onConfirm={async () => {
          if (!assetToRemove) return;
          await removeAsset(assetToRemove.id);
          toast(`${assetToRemove.name} removed`);
        }}
      />

      <ActionSheet
        open={recordMenu !== null}
        onOpenChange={(next) => !next && setRecordMenu(null)}
        title={recordMenu ? fmtDate(recordMenu.recordedAt) : ""}
        description={recordMenu ? `Net worth ${fmt(recordMenu.value)}` : undefined}
        actions={[
          {
            label: "Edit balances",
            icon: <Pencil aria-hidden="true" />,
            onSelect: () => recordMenu && startEditingSnapshot(recordMenu),
          },
          {
            label: "Delete record",
            icon: <Trash2 aria-hidden="true" />,
            destructive: true,
            onSelect: () => setRecordToDelete(recordMenu),
          },
        ]}
      />

      <ConfirmDialog
        open={recordToDelete !== null}
        onOpenChange={(next) => !next && setRecordToDelete(null)}
        title="Delete this balance record?"
        description={`The balances you recorded on ${
          recordToDelete ? fmtDate(recordToDelete.recordedAt) : ""
        } will be removed from your history and charts. This can't be undone.`}
        confirmLabel="Delete record"
        onConfirm={async () => {
          if (!recordToDelete) return;
          if (editingSnapshotId === recordToDelete.id) cancelEditingBalances();
          await removeSnapshot(recordToDelete.id);
          toast("Balance record deleted");
        }}
      />
    </div>
  );
}

function NetWorthChart({ history }: { history: NetWorthPoint[] }) {
  const first = history[0];
  const last = history[history.length - 1];
  const summary = `Net worth went from ${fmt(first.value)} on ${fmtDate(first.recordedAt)} to ${fmt(
    last.value,
  )} on ${fmtDate(last.recordedAt)}. Each record is listed below.`;

  return (
    <div role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height={170}>
        <AreaChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "var(--muted-foreground)", fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tickFormatter={fmtK}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)", fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            formatter={(value: number) => [fmt(value), "Net worth"]}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontSize: 14,
              color: "var(--foreground)",
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--primary)"
            strokeWidth={3}
            fill="var(--primary)"
            fillOpacity={0.15}
            dot={{ r: 3, fill: "var(--primary)", strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function AssetRow({
  asset,
  editing,
  showBalance,
  draftValue,
  previousBalance,
  error,
  onDraftChange,
  onMore,
}: {
  asset: AssetWithBalance;
  editing: boolean;
  showBalance: boolean;
  draftValue: string;
  previousBalance: number | null;
  error?: string;
  onDraftChange: (value: string) => void;
  onMore: () => void;
}) {
  const inputId = `asset-balance-${asset.id}`;

  if (editing) {
    return (
      <li className="flex flex-col gap-1.5 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-36 flex-1">
            <label htmlFor={inputId} className="break-words font-semibold text-foreground">
              {asset.name}
            </label>
            <p id={`${inputId}-hint`} className="text-sm text-muted-foreground">
              {asset.institution}
              {previousBalance !== null && ` · was ${fmt(previousBalance)}`}
            </p>
          </div>
          <div data-balance-input-wrap>
            <MoneyInput
              id={inputId}
              value={draftValue}
              onChange={onDraftChange}
              error={error}
              compact
              describedById={describedBy(inputId, true, error)}
            />
          </div>
        </div>
        <FieldError id={inputId} error={error} />
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="break-words font-semibold text-foreground">{asset.name}</p>
        <p className="text-sm text-muted-foreground">{asset.institution}</p>
      </div>
      <span className="font-semibold text-foreground tabular-nums">
        {showBalance ? fmt(asset.balance ?? 0) : "No balance yet"}
      </span>
      <button type="button" className={iconBtn} onClick={onMore} aria-label={`More options for ${asset.name}`}>
        <MoreHorizontal aria-hidden="true" />
      </button>
    </li>
  );
}

function AddAssetDialog({
  open,
  onOpenChange,
  onAdd,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: { name: string; institution: string; groupId: AssetGroupId }) => Promise<void>;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [groupId, setGroupId] = useState<AssetGroupId>("cash");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setInstitution("");
    setGroupId("cash");
    setError(null);
  };

  const handleSubmit = async () => {
    const problem = nameError(name, "account");
    setError(problem);
    if (problem) {
      document.getElementById("asset-name")?.focus();
      return;
    }
    try {
      await onAdd({ name, institution, groupId });
      reset();
      onOpenChange(false);
    } catch {
      // Error surfaced via hook state.
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add an account</DialogTitle>
          <DialogDescription>Add the name now. You'll enter its balance when you update balances.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <Field id="asset-name" label="Account name" hint="For example: Everyday account, Home loan offset" error={error}>
            <Input
              id="asset-name"
              value={name}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy("asset-name", true, error)}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
            />
          </Field>
          <Field id="asset-institution" label="Bank or provider (optional)">
            <Input
              id="asset-institution"
              placeholder="e.g. CommBank"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            />
          </Field>
          <Field id="asset-type" label="Type">
            <Select value={groupId} onValueChange={(val) => setGroupId(val as AssetGroupId)}>
              <SelectTrigger id="asset-type">
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
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" className={`${btnOutline} flex-1`} onClick={() => onOpenChange(false)}>
              Cancel
            </button>
            <button type="submit" className={`${btnPrimary} flex-1`} disabled={saving}>
              {saving ? "Adding…" : "Add account"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
