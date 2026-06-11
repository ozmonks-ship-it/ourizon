import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { CalendarDays, Pencil, PlusCircle, Trash2 } from "lucide-react";
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
import {
  monthInputToPeriod,
  periodToMonthInput,
  useLog,
} from "../hooks/useLog";
import { fmt } from "../lib/format";
import type { AllocationMode, Bucket, BucketKind } from "@/lib/supabase/database.types";

interface BucketsScreenProps {
  session: Session;
}

export function BucketsScreen({ session }: BucketsScreenProps) {
  const {
    loading,
    saving,
    error,
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
    setNetIncomeDraft,
    addBucket,
    editBucket,
    removeBucket,
    saveBuckets,
    setSelectedPeriod,
  } = useLog(session);

  const [addOpen, setAddOpen] = useState(false);
  const [editingBucket, setEditingBucket] = useState<Bucket | null>(null);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-medium text-foreground mb-1">Buckets 🪣</h1>
          <p className="text-muted-foreground text-sm mb-3">
            Set income and expense allocations for a month
          </p>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <CalendarDays className="size-4 text-muted-foreground shrink-0" aria-hidden />
            <span className="sr-only">Month</span>
            <input
              type="month"
              value={periodToMonthInput(year, month)}
              onChange={(e) => {
                const next = monthInputToPeriod(e.target.value);
                setSelectedPeriod(next.year, next.month);
              }}
              className="bg-muted rounded-lg px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-shadow [color-scheme:dark]"
            />
          </label>
        </div>

        <AddBucketDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onAdd={addBucket}
          saving={saving}
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
            <label className="block text-sm font-medium text-foreground mb-2">Net income 💸</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                $
              </span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={netIncomeDraft}
                onChange={(e) => setNetIncomeDraft(e.target.value)}
                className="w-full bg-muted rounded-lg pl-7 pr-3 py-3 text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-shadow"
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
            summary={summary}
            onValueChange={setDraftValue}
            onEdit={setEditingBucket}
            onDelete={removeBucket}
            saving={saving}
          />
        )}

        <BucketSection
          title="Expense buckets"
          emoji="🪣"
          buckets={expenseBuckets}
          draftValues={draftValues}
          summary={summary}
          onValueChange={setDraftValue}
          onEdit={setEditingBucket}
          onDelete={removeBucket}
          saving={saving}
          showResolved
          percentOfRemaining={expenseBuckets.some((b) => b.allocation_mode === "amount")}
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
        disabled={saving}
        onClick={() => void saveBuckets()}
        className="w-full bg-foreground text-background font-medium rounded-xl py-3.5 hover:opacity-90 active:scale-[0.98] transition-all duration-150 disabled:opacity-50"
      >
        {saving ? "Saving…" : `Save ${monthLabel}`}
      </button>

      {editingBucket && (
        <EditBucketDialog
          bucket={editingBucket}
          open={editingBucket !== null}
          onOpenChange={(open) => !open && setEditingBucket(null)}
          onSave={editBucket}
          onDelete={removeBucket}
          saving={saving}
        />
      )}
    </div>
  );
}

function BucketSection({
  title,
  emoji,
  buckets,
  draftValues,
  summary,
  onValueChange,
  onEdit,
  onDelete,
  saving,
  showResolved = false,
  percentOfRemaining = false,
}: {
  title: string;
  emoji: string;
  buckets: Bucket[];
  draftValues: Record<string, string>;
  summary: ReturnType<typeof import("../lib/bucketAllocation").calculateAllocationSummary>;
  onValueChange: (bucketId: string, value: string) => void;
  onEdit: (bucket: Bucket) => void;
  onDelete: (bucketId: string) => Promise<void>;
  saving: boolean;
  showResolved?: boolean;
  percentOfRemaining?: boolean;
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
          const subtitle = isPercent
            ? `${draftValues[bucket.id] || bucket.default_value}% of ${
                percentOfRemaining ? "remaining" : "income"
              }`
            : "Fixed amount";

          return (
            <div
              key={bucket.id}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/50"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{bucket.name}</p>
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
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                      $
                    </span>
                  )}
                  <input
                    type="number"
                    min={0}
                    max={isPercent ? 100 : undefined}
                    step={isPercent ? 0.1 : 0.01}
                    value={draftValues[bucket.id] ?? ""}
                    onChange={(e) => onValueChange(bucket.id, e.target.value)}
                    className={`w-20 bg-background rounded-lg py-2 text-xs text-foreground text-right font-medium focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-shadow ${
                      isPercent ? "px-2 pr-6" : "pl-6 pr-2"
                    }`}
                  />
                  {isPercent && (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
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
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void onDelete(bucket.id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                  aria-label={`Delete ${bucket.name}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Daily Expenses 🛒"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type</label>
            <Select value={kind} onValueChange={(v) => setKind(v as BucketKind)}>
              <SelectTrigger>
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
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Allocation
              </label>
              <Select
                value={allocationMode}
                onValueChange={(v) => setAllocationMode(v as AllocationMode)}
              >
                <SelectTrigger>
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
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Default {kind === "expense" && allocationMode === "percent" ? "percentage" : "amount"}
            </label>
            <Input
              type="number"
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

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const value = defaultValue.trim() === "" ? 0 : parseFloat(defaultValue);
    if (Number.isNaN(value) || value < 0) return;

    await onSave(bucket.id, {
      name: trimmed,
      allocationMode: bucket.kind === "income" ? "amount" : allocationMode,
      defaultValue: value,
    });
    onOpenChange(false);
  };

  const handleDelete = async () => {
    await onDelete(bucket.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-medium">Edit bucket</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {bucket.kind === "expense" && (
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Allocation</label>
              <Select
                value={allocationMode}
                onValueChange={(v) => setAllocationMode(v as AllocationMode)}
              >
                <SelectTrigger>
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
            <label className="text-xs text-muted-foreground mb-1.5 block">
              Default{" "}
              {bucket.kind === "expense" && allocationMode === "percent" ? "percentage" : "amount"}
            </label>
            <Input
              type="number"
              min={0}
              step={bucket.kind === "expense" && allocationMode === "percent" ? 0.1 : 0.01}
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
              Save
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
