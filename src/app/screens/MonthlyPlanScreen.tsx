import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Check, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { btnOutline, btnPrimary, iconBtn } from "../components/ui/buttonStyles";
import {
  ActionSheet,
  Callout,
  ConfirmDialog,
  Field,
  FieldError,
  MoneyInput,
  StatusChip,
  describedBy,
} from "../components/ui/kit";
import { MonthPicker } from "../components/MonthPicker";
import { PageLoader } from "../components/PageLoader";
import { PlanMeter } from "../components/PlanMeter";
import { useToast } from "../components/Toast";
import { useLog } from "../hooks/useLog";
import { addMonths } from "../lib/forecast";
import { fmt, fmtMonth, fmtMonthName, toInputValue } from "../lib/format";
import { amountError, amountValue, nameError } from "../lib/validation";
import type { AllocationMode, Bucket, BucketKind } from "@/lib/supabase/database.types";

interface MonthlyPlanScreenProps {
  session: Session;
}

/** Ignore a Save tap that lands while a dialog is closing. */
const DIALOG_CLOSE_GUARD_MS = 400;

type AddTarget = { kind: BucketKind; parent: Bucket | null };

export function MonthlyPlanScreen({ session }: MonthlyPlanScreenProps) {
  const {
    loading,
    savingBucket,
    savingLog,
    error,
    incomeBuckets,
    expenseBuckets,
    subBucketsByParent,
    year,
    month,
    draftValues,
    netIncomeDraft,
    carriedFrom,
    hasIncomeBuckets,
    summary,
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
  const toast = useToast();

  const [dirty, setDirty] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [addTarget, setAddTarget] = useState<AddTarget | null>(null);
  const [menuBucket, setMenuBucket] = useState<Bucket | null>(null);
  const [editingBucket, setEditingBucket] = useState<Bucket | null>(null);
  const [bucketToDelete, setBucketToDelete] = useState<Bucket | null>(null);
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [deleteMonthOpen, setDeleteMonthOpen] = useState(false);
  const blockSaveRef = useRef(false);

  const monthName = fmtMonthName(year, month);
  const monthTitle = fmtMonth(year, month);
  const over = summary.saving < 0;
  const dialogOpen =
    addTarget !== null || editingBucket !== null || menuBucket !== null || bucketToDelete !== null || deleteMonthOpen || monthMenuOpen;

  useEffect(() => {
    setDirty(false);
    setFieldErrors({});
  }, [year, month]);

  useEffect(() => {
    if (dialogOpen) return;
    blockSaveRef.current = true;
    const timer = window.setTimeout(() => {
      blockSaveRef.current = false;
    }, DIALOG_CLOSE_GUARD_MS);
    return () => window.clearTimeout(timer);
  }, [dialogOpen]);

  const changeValue = useCallback(
    (id: string, value: string) => {
      if (id === "net-income") setNetIncomeDraft(value);
      else setDraftValue(id, value);
      setDirty(true);
      setFieldErrors((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [setDraftValue, setNetIncomeDraft],
  );

  const isPercent = (bucket: Bucket) =>
    bucket.kind === "expense" && !bucket.parent_bucket_id && bucket.allocation_mode === "percent";

  const handleSave = async () => {
    if (blockSaveRef.current || dialogOpen) return;

    const errors: Record<string, string> = {};
    const allBuckets = [
      ...incomeBuckets,
      ...expenseBuckets,
      ...expenseBuckets.flatMap((bucket) => subBucketsByParent.get(bucket.id) ?? []),
    ];
    for (const bucket of allBuckets) {
      const percent = isPercent(bucket);
      const problem = amountError(draftValues[bucket.id] ?? "", {
        required: false,
        percent,
        max: percent ? 100 : undefined,
      });
      if (problem) errors[bucket.id] = problem;
    }
    if (!hasIncomeBuckets) {
      const problem = amountError(netIncomeDraft, { required: false });
      if (problem) errors["net-income"] = problem;
    }
    setFieldErrors(errors);

    const firstError = Object.keys(errors)[0];
    if (firstError) {
      document.getElementById(firstError === "net-income" ? "net-income" : `bucket-${firstError}`)?.focus();
      toast("Fix the highlighted amounts before saving");
      return;
    }
    if (over) {
      document.getElementById("plan-summary")?.scrollIntoView({ block: "center" });
      toast(`You've planned ${fmt(Math.abs(summary.saving))} more than your income`);
      return;
    }
    if (summary.totalIncome <= 0) {
      document.getElementById(hasIncomeBuckets ? `bucket-${incomeBuckets[0].id}` : "net-income")?.focus();
      toast("Enter your take-home pay before saving");
      return;
    }

    try {
      await saveBuckets();
      setDirty(false);
      toast(`${monthTitle} plan saved`);
    } catch {
      // Error surfaced via hook state.
    }
  };

  const goToMonth = (delta: number) => {
    const next = addMonths(year, month, delta);
    setSelectedPeriod(next.year, next.month);
  };

  if (loading) {
    return <PageLoader />;
  }

  const prevMonth = addMonths(year, month, -1);
  const nextMonth = addMonths(year, month, 1);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 tabIndex={-1} className="text-2xl font-semibold text-foreground focus:outline-none">
          Monthly plan
        </h1>
        <p className="text-muted-foreground">
          Decide where each month's income goes. Whatever you don't plan to spend counts as savings.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
        <div className="-ml-3 flex items-center">
          <button
            type="button"
            className={iconBtn}
            onClick={() => goToMonth(-1)}
            aria-label={`Previous month, ${fmtMonth(prevMonth.year, prevMonth.month)}`}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <MonthPicker
            id="plan-month"
            year={year}
            month={month}
            savedPeriods={savedPeriods}
            onChange={setSelectedPeriod}
          />
          <button
            type="button"
            className={iconBtn}
            onClick={() => goToMonth(1)}
            aria-label={`Next month, ${fmtMonth(nextMonth.year, nextMonth.month)}`}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <StatusChip tone={isCurrentPeriodSaved ? "good" : "warn"}>
            {isCurrentPeriodSaved ? "Saved" : "Not saved yet"}
          </StatusChip>
          {isCurrentPeriodSaved && (
            <button
              type="button"
              className={`${iconBtn} -mr-2`}
              onClick={() => setMonthMenuOpen(true)}
              aria-label={`More options for the ${monthTitle} plan`}
            >
              <MoreHorizontal aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl border-2 border-destructive bg-card px-4 py-3 font-semibold text-destructive">
          {error}
        </p>
      )}

      {carriedFrom && !isCurrentPeriodSaved && (
        <Callout title={`Filled in from your ${fmtMonth(carriedFrom.year, carriedFrom.month)} plan`}>
          Change anything that's different this month, then save.
        </Callout>
      )}

      <section
        id="plan-summary"
        aria-labelledby="summary-heading"
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5"
      >
        <h2 id="summary-heading" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Summary
        </h2>
        <PlanMeter income={summary.totalIncome} spending={summary.totalExpenses} />
        {over && (
          <p role="alert" className="font-semibold text-destructive">
            You've planned {fmt(Math.abs(summary.saving))} more than your income. Lower a category or add income
            to save this plan.
          </p>
        )}
      </section>

      <section aria-labelledby="income-heading" className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="income-heading" className="flex-1 text-lg font-semibold text-foreground">
            Income
          </h2>
          <button type="button" className={btnOutline} onClick={() => setAddTarget({ kind: "income", parent: null })}>
            <Plus aria-hidden="true" />
            Add income
          </button>
        </div>
        <p className="text-sm text-muted-foreground">Take-home pay after tax.</p>

        {hasIncomeBuckets ? (
          <ul className="divide-y divide-border">
            {incomeBuckets.map((bucket) => (
              <PlanRow
                key={bucket.id}
                bucket={bucket}
                value={draftValues[bucket.id] ?? ""}
                error={fieldErrors[bucket.id]}
                detail={null}
                onChange={(value) => changeValue(bucket.id, value)}
                onMore={() => setMenuBucket(bucket)}
              />
            ))}
          </ul>
        ) : (
          <Field id="net-income" label="Take-home pay this month" error={fieldErrors["net-income"]}>
            <MoneyInput
              id="net-income"
              value={netIncomeDraft}
              onChange={(value) => changeValue("net-income", value)}
              error={fieldErrors["net-income"]}
              describedById={describedBy("net-income", false, fieldErrors["net-income"])}
            />
          </Field>
        )}
      </section>

      <section aria-labelledby="spending-heading" className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="spending-heading" className="flex-1 text-lg font-semibold text-foreground">
            Spending
          </h2>
          <button type="button" className={btnOutline} onClick={() => setAddTarget({ kind: "expense", parent: null })}>
            <Plus aria-hidden="true" />
            Add category
          </button>
        </div>

        {expenseBuckets.length === 0 ? (
          <p className="text-muted-foreground">
            No spending categories yet. Start with something like Bills or Groceries.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {expenseBuckets.map((bucket) => {
              const items = subBucketsByParent.get(bucket.id) ?? [];
              const allocation = summary.byBucketId.get(bucket.id);
              const amount = allocation?.resolvedAmount ?? 0;
              const remaining = allocation?.remainingAmount;
              const percent = isPercent(bucket);
              const detail = percent
                ? `${amountValue(draftValues[bucket.id] ?? "")}% of income = ${fmt(amount)}`
                : "Fixed amount each month";

              return (
                <li key={bucket.id} className="flex flex-col gap-2 py-3">
                  <PlanRow
                    as="div"
                    bucket={bucket}
                    unit={percent ? "%" : "$"}
                    value={draftValues[bucket.id] ?? ""}
                    error={fieldErrors[bucket.id]}
                    detail={detail}
                    onChange={(value) => changeValue(bucket.id, value)}
                    onMore={() => setMenuBucket(bucket)}
                  />

                  {items.length > 0 && (
                    <ul className="ml-3 flex flex-col border-l-2 border-border pl-3" aria-label={`Items in ${bucket.name}`}>
                      {items.map((item) => (
                        <li key={item.id} className="flex min-h-11 items-center gap-2">
                          <span className="min-w-0 flex-1 break-words text-foreground">{item.name}</span>
                          <span className="font-semibold text-foreground tabular-nums">
                            {fmt(amountValue(draftValues[item.id] ?? ""))}
                          </span>
                          <button
                            type="button"
                            className={`${iconBtn} -mr-2`}
                            onClick={() => setMenuBucket(item)}
                            aria-label={`More options for ${item.name}`}
                          >
                            <MoreHorizontal aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                      {remaining !== undefined && (
                        <li className={`py-1 text-sm tabular-nums ${remaining < 0 ? "font-bold text-destructive" : "text-muted-foreground"}`}>
                          {remaining >= 0
                            ? `${fmt(remaining)} of ${bucket.name} not given to an item yet`
                            : `Items are ${fmt(Math.abs(remaining))} more than ${bucket.name}`}
                        </li>
                      )}
                    </ul>
                  )}

                  <button
                    type="button"
                    className={`${btnOutline} self-start`}
                    onClick={() => setAddTarget({ kind: "expense", parent: bucket })}
                  >
                    <Plus aria-hidden="true" />
                    Add item to {bucket.name}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="sticky bottom-0 -mx-4 -mb-8 flex flex-col gap-1.5 border-t border-border bg-background px-4 pt-3 pb-4">
        {dirty && <p className="text-center text-sm font-bold text-warning">You have unsaved changes</p>}
        <button
          type="button"
          className={`${btnPrimary} w-full`}
          onClick={() => void handleSave()}
          disabled={savingLog}
          aria-disabled={over || undefined}
          aria-describedby={over ? "plan-summary" : undefined}
        >
          <Check aria-hidden="true" />
          {savingLog ? "Saving…" : `Save ${monthName} plan`}
        </button>
      </div>

      {addTarget && (
        <AddBucketDialog
          target={addTarget}
          saving={savingBucket}
          onOpenChange={(open) => !open && setAddTarget(null)}
          onAdd={async (input) => {
            await addBucket(input);
            setDirty(true);
            toast(`${input.name} added`);
          }}
        />
      )}

      <ActionSheet
        open={menuBucket !== null}
        onOpenChange={(open) => !open && setMenuBucket(null)}
        title={menuBucket?.name ?? ""}
        actions={[
          { label: "Edit", icon: <Pencil aria-hidden="true" />, onSelect: () => setEditingBucket(menuBucket) },
          {
            label: "Delete",
            icon: <Trash2 aria-hidden="true" />,
            destructive: true,
            onSelect: () => setBucketToDelete(menuBucket),
          },
        ]}
      />

      {editingBucket && (
        <EditBucketDialog
          bucket={editingBucket}
          monthValue={draftValues[editingBucket.id] ?? ""}
          monthTitle={monthTitle}
          saving={savingBucket}
          onOpenChange={(open) => !open && setEditingBucket(null)}
          onSave={async (input) => {
            await editBucket(editingBucket.id, input);
            if (editingBucket.parent_bucket_id !== null) {
              // An item's amount is edited here rather than on the plan, so it
              // also becomes this month's (unsaved) value.
              changeValue(editingBucket.id, toInputValue(input.defaultValue));
              toast(`${input.name} updated. Save the plan to keep it.`);
            } else {
              toast(`${input.name} updated`);
            }
          }}
        />
      )}

      <ConfirmDialog
        open={bucketToDelete !== null}
        onOpenChange={(open) => !open && setBucketToDelete(null)}
        title={`Delete ${bucketToDelete?.name ?? ""}?`}
        description={(() => {
          if (!bucketToDelete) return "";
          const items = subBucketsByParent.get(bucketToDelete.id) ?? [];
          const withItems = items.length > 0 ? ` and its ${items.length} ${items.length === 1 ? "item" : "items"}` : "";
          return `${bucketToDelete.name}${withItems} will be removed from your plan for every month, including months you've already saved. This can't be undone.`;
        })()}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!bucketToDelete) return;
          await removeBucket(bucketToDelete.id);
          setDirty(true);
          toast(`${bucketToDelete.name} deleted`);
        }}
      />

      <ActionSheet
        open={monthMenuOpen}
        onOpenChange={setMonthMenuOpen}
        title={`${monthTitle} plan`}
        actions={[
          {
            label: `Delete saved ${monthName} plan`,
            icon: <Trash2 aria-hidden="true" />,
            destructive: true,
            onSelect: () => setDeleteMonthOpen(true),
          },
        ]}
      />

      <ConfirmDialog
        open={deleteMonthOpen}
        onOpenChange={setDeleteMonthOpen}
        title={`Delete the saved ${monthTitle} plan?`}
        description={`Your categories stay. Only the amounts saved for ${monthTitle} are removed, and your forecast will use another month's savings instead.`}
        confirmLabel="Delete saved plan"
        onConfirm={async () => {
          await removeMonthlyLog();
          setDirty(false);
          toast(`${monthTitle} plan deleted`);
        }}
      />
    </div>
  );
}

function PlanRow({
  bucket,
  value,
  unit = "$",
  error,
  detail,
  onChange,
  onMore,
  as = "li",
}: {
  bucket: Bucket;
  value: string;
  unit?: "$" | "%";
  error?: string;
  detail: string | null;
  onChange: (value: string) => void;
  onMore: () => void;
  as?: "li" | "div";
}) {
  const Tag = as;
  const inputId = `bucket-${bucket.id}`;
  return (
    <Tag className="flex flex-col gap-1.5 py-1.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={inputId} className="break-words font-semibold text-foreground">
            {bucket.name}
          </label>
          {detail && (
            <p id={`${inputId}-hint`} className="text-sm text-muted-foreground tabular-nums">
              {detail}
            </p>
          )}
        </div>
        <MoneyInput
          id={inputId}
          value={value}
          unit={unit}
          onChange={onChange}
          error={error}
          compact
          describedById={describedBy(inputId, Boolean(detail), error)}
        />
        <button type="button" className={iconBtn} onClick={onMore} aria-label={`More options for ${bucket.name}`}>
          <MoreHorizontal aria-hidden="true" />
        </button>
      </div>
      <FieldError id={inputId} error={error} />
    </Tag>
  );
}

function AllocationChoice({
  value,
  onChange,
  name,
}: {
  value: AllocationMode;
  onChange: (mode: AllocationMode) => void;
  name: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-base font-semibold text-foreground">How do you want to plan it?</legend>
      {(
        [
          ["percent", "A share of income (%)"],
          ["amount", "A fixed amount ($)"],
        ] as const
      ).map(([mode, label]) => (
        <label key={mode} className="flex min-h-11 cursor-pointer items-center gap-3 text-foreground">
          <input
            type="radio"
            name={name}
            value={mode}
            checked={value === mode}
            onChange={() => onChange(mode)}
            className="size-5 accent-[var(--primary)]"
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

function AddBucketDialog({
  target,
  saving,
  onOpenChange,
  onAdd,
}: {
  target: AddTarget;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: {
    name: string;
    kind: BucketKind;
    allocationMode: AllocationMode;
    defaultValue: number;
    parentBucketId?: string | null;
  }) => Promise<void>;
}) {
  const isIncome = target.kind === "income";
  const isItem = target.parent !== null;
  const [name, setName] = useState("");
  const [mode, setMode] = useState<AllocationMode>("percent");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<{ name?: string | null; amount?: string | null }>({});
  const percent = !isIncome && !isItem && mode === "percent";

  const title = isIncome ? "Add income" : isItem ? `Add item to ${target.parent?.name}` : "Add spending category";
  const nameHint = isIncome
    ? "For example: Salary, Partner's salary, Rental income"
    : isItem
      ? "For example: Rent, Phone, Streaming"
      : "For example: Bills, Groceries, Transport";

  const handleSubmit = async () => {
    const next = {
      name: nameError(name, isIncome ? "income" : isItem ? "item" : "category"),
      amount: amountError(amount, { required: false, percent, max: percent ? 100 : undefined }),
    };
    setErrors(next);
    if (next.name || next.amount) {
      document.getElementById(next.name ? "add-bucket-name" : "add-bucket-amount")?.focus();
      return;
    }
    try {
      await onAdd({
        name: name.trim(),
        kind: target.kind,
        allocationMode: isIncome || isItem ? "amount" : mode,
        defaultValue: amountValue(amount),
        parentBucketId: target.parent?.id ?? null,
      });
      onOpenChange(false);
    } catch {
      // Error surfaced via hook state.
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isIncome
              ? "Add each source of take-home pay separately."
              : isItem
                ? `Items split ${target.parent?.name} into smaller parts, so you can see where it goes.`
                : "A category is money you plan to spend each month."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <Field id="add-bucket-name" label="Name" hint={nameHint} error={errors.name}>
            <Input
              id="add-bucket-name"
              value={name}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={describedBy("add-bucket-name", true, errors.name)}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
              }}
            />
          </Field>
          {!isIncome && !isItem && <AllocationChoice value={mode} onChange={setMode} name="add-bucket-mode" />}
          <Field
            id="add-bucket-amount"
            label={percent ? "Share of income each month" : "Amount each month"}
            hint="Used to fill in new months. You can change it for any month."
            error={errors.amount}
          >
            <MoneyInput
              id="add-bucket-amount"
              value={amount}
              unit={percent ? "%" : "$"}
              onChange={(value) => {
                setAmount(value);
                if (errors.amount) setErrors((prev) => ({ ...prev, amount: null }));
              }}
              error={errors.amount}
              describedById={describedBy("add-bucket-amount", true, errors.amount)}
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" className={`${btnOutline} flex-1`} onClick={() => onOpenChange(false)}>
              Cancel
            </button>
            <button type="submit" className={`${btnPrimary} flex-1`} disabled={saving}>
              {saving ? "Adding…" : isIncome ? "Add income" : isItem ? "Add item" : "Add category"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditBucketDialog({
  bucket,
  monthValue,
  monthTitle,
  saving,
  onOpenChange,
  onSave,
}: {
  bucket: Bucket;
  /** This month's value on the plan; items are edited here instead of inline. */
  monthValue: string;
  monthTitle: string;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: { name: string; allocationMode: AllocationMode; defaultValue: number }) => Promise<void>;
}) {
  const isItem = bucket.parent_bucket_id !== null;
  const canChooseMode = bucket.kind === "expense" && !isItem;
  const [name, setName] = useState(bucket.name);
  const [mode, setMode] = useState<AllocationMode>(bucket.allocation_mode);
  const [amount, setAmount] = useState(isItem ? monthValue : toInputValue(bucket.default_value));
  const [errors, setErrors] = useState<{ name?: string | null; amount?: string | null }>({});
  const percent = canChooseMode && mode === "percent";

  const handleSubmit = async () => {
    const next = {
      name: nameError(name, isItem ? "item" : bucket.kind === "income" ? "income" : "category"),
      amount: amountError(amount, { required: false, percent, max: percent ? 100 : undefined }),
    };
    setErrors(next);
    if (next.name || next.amount) {
      document.getElementById(next.name ? "edit-bucket-name" : "edit-bucket-amount")?.focus();
      return;
    }
    try {
      await onSave({
        name: name.trim(),
        allocationMode: canChooseMode ? mode : "amount",
        defaultValue: amountValue(amount),
      });
      onOpenChange(false);
    } catch {
      // Error surfaced via hook state.
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {bucket.name}</DialogTitle>
          <DialogDescription>
            {isItem
              ? `Changes ${monthTitle} and new months. Save the plan to keep them.`
              : "Changes apply to new months. This month's amount is set on the plan itself."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <Field id="edit-bucket-name" label="Name" error={errors.name}>
            <Input
              id="edit-bucket-name"
              value={name}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={describedBy("edit-bucket-name", false, errors.name)}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
              }}
            />
          </Field>
          {canChooseMode && <AllocationChoice value={mode} onChange={setMode} name="edit-bucket-mode" />}
          <Field
            id="edit-bucket-amount"
            label={isItem ? "Amount each month" : percent ? "Usual share of income" : "Usual amount each month"}
            hint={isItem ? undefined : "Used to fill in new months."}
            error={errors.amount}
          >
            <MoneyInput
              id="edit-bucket-amount"
              value={amount}
              unit={percent ? "%" : "$"}
              onChange={(value) => {
                setAmount(value);
                if (errors.amount) setErrors((prev) => ({ ...prev, amount: null }));
              }}
              error={errors.amount}
              describedById={describedBy("edit-bucket-amount", !isItem, errors.amount)}
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" className={`${btnOutline} flex-1`} onClick={() => onOpenChange(false)}>
              Cancel
            </button>
            <button type="submit" className={`${btnPrimary} flex-1`} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
