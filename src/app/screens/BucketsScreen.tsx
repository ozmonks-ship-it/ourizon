import { useCallback, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Pencil, PlusCircle, Trash2 } from "lucide-react";
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
import { MonthPicker } from "../components/MonthPicker";
import { PageLoader } from "../components/PageLoader";
import { useLog } from "../hooks/useLog";
import { fmt } from "../lib/format";
import type { AllocationMode, Bucket, BucketKind } from "@/lib/supabase/database.types";

interface BucketsScreenProps {
  session: Session;
}

const DIALOG_CLOSE_GUARD_MS = 400;

export function BucketsScreen({ session }: BucketsScreenProps) {
  const {
    loading,
    saving,
    savingBucket,
    savingLog,
    error,
    incomeBuckets,
    expenseBuckets,
    subBucketsByParent,
    monthLabel,
    year,
    month,
    draftValues,
    netIncomeDraft,
    placeholderValues,
    netIncomePlaceholder,
    hasIncomeBuckets,
    summary,
    saved,
    savedPeriods,
    isCurrentPeriodSaved,
    setDraftValue,
    setNetIncomeDraft,
    addBucket,
    editBucket,
    removeBucket,
    removeMonthlyLog,
    saveBuckets,
    setSelectedPeriod,
  } = useLog(session);

  const [addOpen, setAddOpen] = useState(false);
  const [addSubBucketParentId, setAddSubBucketParentId] = useState<string | null>(null);
  const [editingBucket, setEditingBucket] = useState<Bucket | null>(null);
  const [deleteLogOpen, setDeleteLogOpen] = useState(false);
  const blockMonthlySaveRef = useRef(false);

  const dialogOpen =
    addOpen || editingBucket !== null || addSubBucketParentId !== null || deleteLogOpen;

  const guardMonthlySave = useCallback(() => {
    blockMonthlySaveRef.current = true;
    window.setTimeout(() => {
      blockMonthlySaveRef.current = false;
    }, DIALOG_CLOSE_GUARD_MS);
  }, []);

  const closeEditDialog = useCallback(() => {
    guardMonthlySave();
    setEditingBucket(null);
  }, [guardMonthlySave]);

  const closeAddSubBucketDialog = useCallback(() => {
    guardMonthlySave();
    setAddSubBucketParentId(null);
  }, [guardMonthlySave]);

  const closeDeleteLogDialog = useCallback(() => {
    guardMonthlySave();
    setDeleteLogOpen(false);
  }, [guardMonthlySave]);

  const handleDeleteMonthlyLog = useCallback(async () => {
    try {
      await removeMonthlyLog();
      closeDeleteLogDialog();
    } catch {
      // Error surfaced via hook state.
    }
  }, [removeMonthlyLog, closeDeleteLogDialog]);

  const handleSaveMonthlyLog = useCallback(() => {
    if (blockMonthlySaveRef.current || dialogOpen) return;
    void saveBuckets();
  }, [dialogOpen, saveBuckets]);

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-medium text-foreground mb-1">Buckets 🪣</h1>
          <p className="text-muted-foreground text-sm mb-3">
            Set income and expense allocations for a month
          </p>
          <label htmlFor="buckets-month" className="flex items-center gap-2 text-sm text-foreground">
            <span className="sr-only">Month</span>
            <MonthPicker
              id="buckets-month"
              year={year}
              month={month}
              savedPeriods={savedPeriods}
              onChange={setSelectedPeriod}
            />
          </label>
        </div>

        <AddBucketDialog
          open={addOpen}
          onOpenChange={(open) => {
            if (!open) guardMonthlySave();
            setAddOpen(open);
          }}
          onAdd={addBucket}
          saving={savingBucket}
          triggerLabel="Add"
        />
      </div>

      {error && (
        <div className="rounded-xl p-4 bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {error}
        </div>
      )}

      {saved && (
        <div className="rounded-xl p-4 flex items-start gap-3 bg-card border border-border">
          <span className="text-xl">✓</span>
          <div>
            <p className="font-medium text-foreground text-sm">
              Buckets saved for {monthLabel}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Keep up the consistency</p>
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {!hasIncomeBuckets && (
          <div className="p-5 border-b border-border">
            <label htmlFor="monthly-income" className="block text-sm font-medium text-foreground mb-2">
              Net income 💸
            </label>
            <div className="relative">
              <span
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm"
                aria-hidden="true"
              >
                $
              </span>
              <input
                id="monthly-income"
                type="number"
                inputMode="numeric"
                min={0}
                step={0.01}
                value={netIncomeDraft}
                onChange={(e) => setNetIncomeDraft(e.target.value)}
                placeholder={netIncomePlaceholder || undefined}
                className="w-full bg-muted rounded-lg pl-7 pr-3 py-3 text-base text-foreground font-medium placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-shadow"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              After-tax take-home, or add income buckets below
            </p>
          </div>
        )}

        {hasIncomeBuckets && (
          <BucketSection
            title="Income"
            emoji="💸"
            buckets={incomeBuckets}
            draftValues={draftValues}
            placeholderValues={placeholderValues}
            summary={summary}
            onValueChange={setDraftValue}
            onEdit={setEditingBucket}
            onDelete={removeBucket}
            saving={saving}
          />
        )}

        <ExpenseBucketSection
          buckets={expenseBuckets}
          subBucketsByParent={subBucketsByParent}
          draftValues={draftValues}
          placeholderValues={placeholderValues}
          summary={summary}
          onValueChange={setDraftValue}
          onEdit={setEditingBucket}
          onDelete={removeBucket}
          onAddSubBucket={setAddSubBucketParentId}
          saving={saving}
        />

        <div className="border-t border-border px-5 py-4 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30 border border-dashed border-border">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Saving 🏦</p>
              <p className="text-xs text-muted-foreground">
                {summary.savingPercent}% unallocated
              </p>
            </div>
            <p className="text-sm font-medium text-foreground tabular-nums">{fmt(summary.saving)}</p>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Total income</p>
            <p className="text-base font-medium text-foreground tabular-nums">
              {fmt(summary.totalIncome)}
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={savingLog || dialogOpen}
        onClick={handleSaveMonthlyLog}
        className="w-full bg-foreground text-background font-medium rounded-xl py-3.5 hover:opacity-90 active:scale-[0.98] transition-all duration-150 disabled:opacity-50"
      >
        {savingLog ? "Saving…" : `Save ${monthLabel}`}
      </button>

      {isCurrentPeriodSaved && (
        <button
          type="button"
          disabled={savingLog || dialogOpen}
          onClick={() => setDeleteLogOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-border bg-card text-destructive font-medium text-sm transition-colors hover:bg-destructive/5 disabled:opacity-50"
        >
          <Trash2 size={16} aria-hidden="true" />
          Delete {monthLabel} log
        </button>
      )}

      <DeleteMonthlyLogDialog
        monthLabel={monthLabel}
        open={deleteLogOpen}
        onOpenChange={(open) => !open && closeDeleteLogDialog()}
        onConfirm={handleDeleteMonthlyLog}
        saving={savingLog}
      />

      {editingBucket && (
        <EditBucketDialog
          bucket={editingBucket}
          open={editingBucket !== null}
          onOpenChange={(open) => !open && closeEditDialog()}
          onSave={editBucket}
          onDelete={removeBucket}
          saving={savingBucket}
        />
      )}

      {addSubBucketParentId && (
        <AddSubBucketDialog
          parentId={addSubBucketParentId}
          parentName={expenseBuckets.find((b) => b.id === addSubBucketParentId)?.name ?? "bucket"}
          open={addSubBucketParentId !== null}
          onOpenChange={(open) => !open && closeAddSubBucketDialog()}
          onAdd={addBucket}
          saving={savingBucket}
        />
      )}
    </div>
  );
}

function BucketRow({
  bucket,
  draftValues,
  placeholderValues,
  summary,
  onValueChange,
  onEdit,
  onDelete,
  saving,
  showResolved = false,
  isItem = false,
}: {
  bucket: Bucket;
  draftValues: Record<string, string>;
  placeholderValues: Record<string, string>;
  summary: ReturnType<typeof import("../lib/bucketAllocation").calculateAllocationSummary>;
  onValueChange: (bucketId: string, value: string) => void;
  onEdit: (bucket: Bucket) => void;
  onDelete: (bucketId: string) => Promise<void>;
  saving: boolean;
  showResolved?: boolean;
  isItem?: boolean;
}) {
  const resolved = summary.byBucketId.get(bucket.id);
  const isPercent = !isItem && bucket.allocation_mode === "percent";
  const placeholder = placeholderValues[bucket.id];
  const allocationLabel = isPercent
    ? `${draftValues[bucket.id] || placeholder || bucket.default_value}% of income`
    : "Fixed amount";
  const remainingLabel =
    !isItem && resolved?.remainingAmount !== undefined
      ? `${fmt(resolved.remainingAmount)} remaining`
      : null;
  const subtitle = remainingLabel ? `${allocationLabel} · ${remainingLabel}` : allocationLabel;

  const bucketInputId = `bucket-${bucket.id}`;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/50 ${isItem ? "ml-4 border-l-2 border-border" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <label htmlFor={bucketInputId} className="text-sm font-medium text-foreground cursor-pointer truncate block">
          {bucket.name}
        </label>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {showResolved && isPercent && resolved && (
          <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">
            {fmt(resolved.resolvedAmount)}
          </span>
        )}

        <div className="relative">
          {!isPercent && (
            <span
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm"
              aria-hidden="true"
            >
              $
            </span>
          )}
          <input
            id={bucketInputId}
            type="number"
            inputMode="numeric"
            min={0}
            max={isPercent ? 100 : undefined}
            step={isPercent ? 0.1 : 0.01}
            value={draftValues[bucket.id] ?? ""}
            onChange={(e) => onValueChange(bucket.id, e.target.value)}
            placeholder={placeholder || undefined}
            aria-label={`${bucket.name} allocation ${isPercent ? "percentage" : "amount"}`}
            className={`w-24 bg-background rounded-lg py-2 text-base text-foreground text-right font-medium placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-shadow ${
              isPercent ? "px-2 pr-6" : "pl-6 pr-2"
            }`}
          />
          {isPercent && (
            <span
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm"
              aria-hidden="true"
            >
              %
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => onEdit(bucket)}
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`Edit ${bucket.name}`}
        >
          <Pencil className="size-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void onDelete(bucket.id)}
          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
          aria-label={`Delete ${bucket.name}`}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function ExpenseBucketSection({
  buckets,
  subBucketsByParent,
  draftValues,
  placeholderValues,
  summary,
  onValueChange,
  onEdit,
  onDelete,
  onAddSubBucket,
  saving,
}: {
  buckets: Bucket[];
  subBucketsByParent: Map<string, Bucket[]>;
  draftValues: Record<string, string>;
  placeholderValues: Record<string, string>;
  summary: ReturnType<typeof import("../lib/bucketAllocation").calculateAllocationSummary>;
  onValueChange: (bucketId: string, value: string) => void;
  onEdit: (bucket: Bucket) => void;
  onDelete: (bucketId: string) => Promise<void>;
  onAddSubBucket: (parentId: string) => void;
  saving: boolean;
}) {
  if (buckets.length === 0) return null;

  return (
    <div className="border-b border-border px-5 py-4 last:border-b-0">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-foreground">Expense buckets 🪣</p>
      </div>
      <div className="space-y-2">
        {buckets.map((bucket) => {
          const items = subBucketsByParent.get(bucket.id) ?? [];

          return (
            <div key={bucket.id} className="space-y-2">
              <BucketRow
                bucket={bucket}
                draftValues={draftValues}
                placeholderValues={placeholderValues}
                summary={summary}
                onValueChange={onValueChange}
                onEdit={onEdit}
                onDelete={onDelete}
                saving={saving}
                showResolved
              />

              {items.map((item) => (
                <BucketRow
                  key={item.id}
                  bucket={item}
                  draftValues={draftValues}
                  placeholderValues={placeholderValues}
                  summary={summary}
                  onValueChange={onValueChange}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  saving={saving}
                  isItem
                />
              ))}

              <button
                type="button"
                onClick={() => onAddSubBucket(bucket.id)}
                className="ml-4 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <PlusCircle className="size-3" />
                Add item
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BucketSection({
  title,
  emoji,
  buckets,
  draftValues,
  placeholderValues,
  summary,
  onValueChange,
  onEdit,
  onDelete,
  saving,
  showResolved = false,
}: {
  title: string;
  emoji: string;
  buckets: Bucket[];
  draftValues: Record<string, string>;
  placeholderValues: Record<string, string>;
  summary: ReturnType<typeof import("../lib/bucketAllocation").calculateAllocationSummary>;
  onValueChange: (bucketId: string, value: string) => void;
  onEdit: (bucket: Bucket) => void;
  onDelete: (bucketId: string) => Promise<void>;
  saving: boolean;
  showResolved?: boolean;
}) {
  if (buckets.length === 0) return null;

  return (
    <div className="border-b border-border px-5 py-4 last:border-b-0">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-foreground">
          {title} {emoji}
        </p>
      </div>
      <div className="space-y-2">
        {buckets.map((bucket) => {
          const resolved = summary.byBucketId.get(bucket.id);
          const isPercent = bucket.allocation_mode === "percent";
          const placeholder = placeholderValues[bucket.id];
          const subtitle = isPercent
            ? `${draftValues[bucket.id] || placeholder || bucket.default_value}% of income`
            : "Fixed amount";

          const bucketInputId = `bucket-${bucket.id}`;

          return (
            <div
              key={bucket.id}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/50"
            >
              <div className="flex-1 min-w-0">
                <label htmlFor={bucketInputId} className="text-sm font-medium text-foreground cursor-pointer truncate block">
                  {bucket.name}
                </label>
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {showResolved && isPercent && resolved && (
                  <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">
                    {fmt(resolved.resolvedAmount)}
                  </span>
                )}

                <div className="relative">
                  {!isPercent && (
                    <span
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm"
                      aria-hidden="true"
                    >
                      $
                    </span>
                  )}
                  <input
                    id={bucketInputId}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={isPercent ? 100 : undefined}
                    step={isPercent ? 0.1 : 0.01}
                    value={draftValues[bucket.id] ?? ""}
                    onChange={(e) => onValueChange(bucket.id, e.target.value)}
                    placeholder={placeholder || undefined}
                    aria-label={`${bucket.name} allocation ${isPercent ? "percentage" : "amount"}`}
                    className={`w-24 bg-background rounded-lg py-2 text-base text-foreground text-right font-medium placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-shadow ${
                      isPercent ? "px-2 pr-6" : "pl-6 pr-2"
                    }`}
                  />
                  {isPercent && (
                    <span
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm"
                      aria-hidden="true"
                    >
                      %
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onEdit(bucket)}
                  className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={`Edit ${bucket.name}`}
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void onDelete(bucket.id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                  aria-label={`Delete ${bucket.name}`}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DeleteMonthlyLogDialog({
  monthLabel,
  open,
  onOpenChange,
  onConfirm,
  saving,
}: {
  monthLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  saving: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-medium">Delete saved log</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            Remove the saved bucket allocations for {monthLabel}? Bucket definitions are kept; only
            this month&apos;s saved values are deleted.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="flex flex-1 items-center justify-center px-3 py-2.5 rounded-lg border border-border bg-card text-foreground font-medium text-sm transition-colors hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onConfirm()}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-destructive/10 text-destructive font-medium text-sm transition-colors hover:bg-destructive/15 disabled:opacity-50"
            >
              <Trash2 size={16} aria-hidden="true" />
              {saving ? "Deleting…" : "Delete log"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddBucketDialog({
  open,
  onOpenChange,
  onAdd,
  saving,
  triggerLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: {
    name: string;
    kind: BucketKind;
    allocationMode: AllocationMode;
    defaultValue: number;
    parentBucketId?: string | null;
  }) => Promise<void>;
  saving: boolean;
  triggerLabel: string;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<BucketKind>("expense");
  const [allocationMode, setAllocationMode] = useState<AllocationMode>("percent");
  const [defaultValue, setDefaultValue] = useState("");

  const reset = () => {
    setName("");
    setKind("expense");
    setAllocationMode("percent");
    setDefaultValue("");
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const value = defaultValue.trim() === "" ? 0 : parseFloat(defaultValue);
    if (Number.isNaN(value) || value < 0) return;

    await onAdd({
      name: trimmed,
      kind,
      allocationMode: kind === "income" ? "amount" : allocationMode,
      defaultValue: value,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
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
          <DialogTitle className="font-medium">Add bucket</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label htmlFor="add-bucket-name" className="block text-xs font-medium text-muted-foreground mb-1.5">
              Name
            </label>
            <Input
              id="add-bucket-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Daily Expenses 🛒"
            />
          </div>

          <div>
            <label htmlFor="add-bucket-type" className="block text-xs font-medium text-muted-foreground mb-1.5">
              Type
            </label>
            <Select value={kind} onValueChange={(v) => setKind(v as BucketKind)}>
              <SelectTrigger id="add-bucket-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {kind === "expense" && (
            <div>
              <label
                htmlFor="add-bucket-allocation"
                className="block text-xs font-medium text-muted-foreground mb-1.5"
              >
                Allocation
              </label>
              <Select
                value={allocationMode}
                onValueChange={(v) => setAllocationMode(v as AllocationMode)}
              >
                <SelectTrigger id="add-bucket-allocation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentage (%)</SelectItem>
                  <SelectItem value="amount">Fixed amount ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label htmlFor="add-bucket-default" className="block text-xs font-medium text-muted-foreground mb-1.5">
              Default {kind === "expense" && allocationMode === "percent" ? "percentage" : "amount"}
            </label>
            <Input
              id="add-bucket-default"
              type="number"
              inputMode="numeric"
              min={0}
              step={kind === "expense" && allocationMode === "percent" ? 0.1 : 0.01}
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
              placeholder={kind === "expense" && allocationMode === "percent" ? "10" : "500"}
            />
          </div>

          <button
            type="button"
            disabled={saving || !name.trim()}
            onClick={() => void handleSubmit()}
            className="w-full py-2.5 rounded-lg bg-foreground text-background font-medium text-sm transition-all duration-150 hover:opacity-90 active:scale-95 mt-2 disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add bucket"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddSubBucketDialog({
  parentId,
  parentName,
  open,
  onOpenChange,
  onAdd,
  saving,
}: {
  parentId: string;
  parentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: {
    name: string;
    kind: BucketKind;
    allocationMode: AllocationMode;
    defaultValue: number;
    parentBucketId?: string | null;
  }) => Promise<void>;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [defaultValue, setDefaultValue] = useState("");

  const reset = () => {
    setName("");
    setDefaultValue("");
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const value = defaultValue.trim() === "" ? 0 : parseFloat(defaultValue);
    if (Number.isNaN(value) || value < 0) return;

    await onAdd({
      name: trimmed,
      kind: "expense",
      allocationMode: "amount",
      defaultValue: value,
      parentBucketId: parentId,
    });
    reset();
    onOpenChange(false);
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
          <DialogTitle className="font-medium">Add item</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1">
          Under {parentName}
        </p>
        <div className="space-y-3 py-2">
          <div>
            <label htmlFor="add-sub-bucket-name" className="block text-xs font-medium text-muted-foreground mb-1.5">
              Name
            </label>
            <Input
              id="add-sub-bucket-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Groceries 🥬"
            />
          </div>

          <div>
            <label htmlFor="add-sub-bucket-amount" className="block text-xs font-medium text-muted-foreground mb-1.5">
              Default amount
            </label>
            <Input
              id="add-sub-bucket-amount"
              type="number"
              inputMode="numeric"
              min={0}
              step={0.01}
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
              placeholder="500"
            />
          </div>

          <button
            type="button"
            disabled={saving || !name.trim()}
            onClick={() => void handleSubmit()}
            className="w-full py-2.5 rounded-lg bg-foreground text-background font-medium text-sm transition-all duration-150 hover:opacity-90 active:scale-95 mt-2 disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add item"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditBucketDialog({
  bucket,
  open,
  onOpenChange,
  onSave,
  onDelete,
  saving,
}: {
  bucket: Bucket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    bucketId: string,
    input: { name?: string; allocationMode?: AllocationMode; defaultValue?: number },
  ) => Promise<void>;
  onDelete: (bucketId: string) => Promise<void>;
  saving: boolean;
}) {
  const [name, setName] = useState(bucket.name);
  const [allocationMode, setAllocationMode] = useState<AllocationMode>(bucket.allocation_mode);
  const [defaultValue, setDefaultValue] = useState(String(bucket.default_value));

  const isItem = bucket.parent_bucket_id !== null;

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const value = defaultValue.trim() === "" ? 0 : parseFloat(defaultValue);
    if (Number.isNaN(value) || value < 0) return;

    await onSave(bucket.id, {
      name: trimmed,
      allocationMode:
        bucket.kind === "income" || isItem ? "amount" : allocationMode,
      defaultValue: value,
    });
    window.setTimeout(() => onOpenChange(false), 0);
  };

  const handleDelete = async () => {
    await onDelete(bucket.id);
    window.setTimeout(() => onOpenChange(false), 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-medium">{isItem ? "Edit item" : "Edit bucket"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label htmlFor="edit-bucket-name" className="text-xs text-muted-foreground mb-1.5 block">
              Name
            </label>
            <Input id="edit-bucket-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {bucket.kind === "expense" && !isItem && (
            <div>
              <label htmlFor="edit-bucket-allocation" className="text-xs text-muted-foreground mb-1.5 block">
                Allocation
              </label>
              <Select
                value={allocationMode}
                onValueChange={(v) => setAllocationMode(v as AllocationMode)}
              >
                <SelectTrigger id="edit-bucket-allocation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentage (%)</SelectItem>
                  <SelectItem value="amount">Fixed amount ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label htmlFor="edit-bucket-default" className="text-xs text-muted-foreground mb-1.5 block">
              Default{" "}
              {bucket.kind === "expense" && !isItem && allocationMode === "percent"
                ? "percentage"
                : "amount"}
            </label>
            <Input
              id="edit-bucket-default"
              type="number"
              inputMode="numeric"
              min={0}
              step={
                bucket.kind === "expense" && !isItem && allocationMode === "percent" ? 0.1 : 0.01
              }
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleDelete()}
              className="flex-1 bg-destructive/10 text-destructive font-medium rounded-lg py-2.5 text-sm disabled:opacity-50"
            >
              Delete
            </button>
            <button
              type="button"
              disabled={saving || !name.trim()}
              onClick={() => void handleSave()}
              className="flex-1 bg-foreground text-background font-medium rounded-lg py-2.5 text-sm disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save bucket"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
