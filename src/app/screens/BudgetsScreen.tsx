import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { MoreHorizontal, Pencil, Plus, Target, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { btnOutline, btnPrimary, iconBtn } from "../components/ui/buttonStyles";
import { ActionSheet, ConfirmDialog, Field, MoneyInput, StatusChip, describedBy } from "../components/ui/kit";
import { ScreenSkeleton } from "../components/ScreenSkeleton";
import { useToast } from "../components/Toast";
import { useBudgets } from "../hooks/useBudgets";
import { fmt, fmtDate, toInputValue } from "../lib/format";
import { amountError, amountValue, nameError } from "../lib/validation";
import { budgetStatus } from "../lib/budgetStatus";
import type { BudgetExpense, BudgetWithSpend } from "@/lib/supabase/database.types";

interface BudgetsScreenProps {
  session: Session;
}

const fmtExpenseDate = (dateOnly: string) => {
  const [year, month, day] = dateOnly.split("-").map(Number);
  if (!year || !month || !day) return dateOnly;
  return fmtDate(new Date(year, month - 1, day));
};

export function BudgetsScreen({ session }: BudgetsScreenProps) {
  const { loading, saving, error, budgets, hasBudgets, totals, addBudget, editBudget, removeBudget, addExpense, removeExpense } =
    useBudgets(session);
  const toast = useToast();

  const [budgetDialog, setBudgetDialog] = useState<{ budget: BudgetWithSpend | null } | null>(null);
  const [menuBudget, setMenuBudget] = useState<BudgetWithSpend | null>(null);
  const [budgetToDelete, setBudgetToDelete] = useState<BudgetWithSpend | null>(null);
  const [expenseTarget, setExpenseTarget] = useState<BudgetWithSpend | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<BudgetExpense | null>(null);

  if (loading) {
    return <ScreenSkeleton title="Budgets" shape="budgets" />;
  }

  return (
    <div className="screen-enter flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 tabIndex={-1} className="text-2xl font-semibold text-foreground focus:outline-none">
          Budgets
        </h1>
        <p className="text-muted-foreground">
          Money set aside for one occasion, like a trip or a holiday season. Log what you spend to see what's left.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl border-2 border-destructive bg-card px-4 py-3 font-semibold text-destructive">
          {error}
        </p>
      )}

      {!hasBudgets ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-10 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted" aria-hidden="true">
            <Target className="size-6 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Create your first budget</h2>
          <p className="max-w-sm text-muted-foreground">
            Pick something specific, like "Christmas gifts" with $1,200, then log each purchase against it.
          </p>
          <button type="button" className={btnPrimary} onClick={() => setBudgetDialog({ budget: null })}>
            <Plus aria-hidden="true" />
            New budget
          </button>
        </section>
      ) : (
        <>
          <button type="button" className={btnPrimary} onClick={() => setBudgetDialog({ budget: null })}>
            <Plus aria-hidden="true" />
            New budget
          </button>

          <section aria-label="All budgets" className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Set aside</p>
              <p className="font-bold text-foreground tabular-nums">{fmt(totals.allocated)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Spent</p>
              <p className="font-bold text-foreground tabular-nums">{fmt(totals.spent)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{totals.remaining < 0 ? "Over" : "Left"}</p>
              <p className={`font-bold tabular-nums ${totals.remaining < 0 ? "text-destructive" : "text-foreground"}`}>
                {fmt(Math.abs(totals.remaining))}
              </p>
            </div>
          </section>

          {budgets.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              onMore={() => setMenuBudget(budget)}
              onLogExpense={() => setExpenseTarget(budget)}
              onRemoveExpense={setExpenseToDelete}
            />
          ))}
        </>
      )}

      {budgetDialog && (
        <BudgetDialog
          budget={budgetDialog.budget}
          saving={saving}
          onOpenChange={(open) => !open && setBudgetDialog(null)}
          onSave={async (input) => {
            if (budgetDialog.budget) {
              await editBudget(budgetDialog.budget.id, input);
              toast(`${input.name} updated`);
            } else {
              await addBudget(input);
              toast(`${input.name} created`);
            }
          }}
        />
      )}

      <ActionSheet
        open={menuBudget !== null}
        onOpenChange={(open) => !open && setMenuBudget(null)}
        title={menuBudget?.name ?? ""}
        description={menuBudget ? `Budget ${fmt(menuBudget.amount)}` : undefined}
        actions={[
          { label: "Edit", icon: <Pencil aria-hidden="true" />, onSelect: () => setBudgetDialog({ budget: menuBudget }) },
          { label: "Delete budget", icon: <Trash2 aria-hidden="true" />, destructive: true, onSelect: () => setBudgetToDelete(menuBudget) },
        ]}
      />

      <ConfirmDialog
        open={budgetToDelete !== null}
        onOpenChange={(open) => !open && setBudgetToDelete(null)}
        title={`Delete ${budgetToDelete?.name ?? "this budget"}?`}
        description={
          budgetToDelete && budgetToDelete.expenses.length > 0
            ? `Its ${budgetToDelete.expenses.length} logged ${budgetToDelete.expenses.length === 1 ? "expense" : "expenses"} (${fmt(
                budgetToDelete.spent,
              )}) will be deleted too. This can't be undone.`
            : "This can't be undone."
        }
        confirmLabel="Delete budget"
        onConfirm={async () => {
          if (!budgetToDelete) return;
          await removeBudget(budgetToDelete.id);
          toast(`${budgetToDelete.name} deleted`);
        }}
      />

      {expenseTarget && (
        <LogExpenseDialog
          budget={expenseTarget}
          saving={saving}
          onOpenChange={(open) => !open && setExpenseTarget(null)}
          onAdd={async (input) => {
            await addExpense(expenseTarget.id, input);
            const left = expenseTarget.remaining - input.amount;
            toast(`Logged. ${expenseTarget.name} has ${left < 0 ? `${fmt(Math.abs(left))} over` : `${fmt(left)} left`}.`);
          }}
        />
      )}

      <ConfirmDialog
        open={expenseToDelete !== null}
        onOpenChange={(open) => !open && setExpenseToDelete(null)}
        title={`Remove ${expenseToDelete?.name ?? "this expense"}?`}
        description={
          expenseToDelete
            ? `${fmt(Number(expenseToDelete.amount))} from ${fmtExpenseDate(expenseToDelete.incurred_at)} will be removed and added back to what's left.`
            : ""
        }
        confirmLabel="Remove expense"
        onConfirm={async () => {
          if (!expenseToDelete) return;
          await removeExpense(expenseToDelete.id);
          toast(`${expenseToDelete.name} removed`);
        }}
      />
    </div>
  );
}

function BudgetCard({
  budget,
  onMore,
  onLogExpense,
  onRemoveExpense,
}: {
  budget: BudgetWithSpend;
  onMore: () => void;
  onLogExpense: () => void;
  onRemoveExpense: (expense: BudgetExpense) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = budgetStatus(budget);
  const fillWidth = Math.min(100, budget.spentPercent);
  const listId = `expenses-${budget.id}`;
  const count = budget.expenses.length;

  return (
    <section aria-labelledby={`budget-${budget.id}`} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 id={`budget-${budget.id}`} className="break-words text-lg font-semibold text-foreground">
            {budget.name}
          </h2>
          <p className="text-sm text-muted-foreground tabular-nums">Budget {fmt(budget.amount)}</p>
        </div>
        <StatusChip tone={status.tone}>{status.label}</StatusChip>
        <button type="button" className={`${iconBtn} -mt-2 -mr-2`} onClick={onMore} aria-label={`More options for ${budget.name}`}>
          <MoreHorizontal aria-hidden="true" />
        </button>
      </div>

      <div
        className="h-2.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={`${budget.name} spending`}
        aria-valuemin={0}
        aria-valuemax={budget.amount}
        aria-valuenow={Math.min(budget.spent, budget.amount)}
        aria-valuetext={`${fmt(budget.spent)} of ${fmt(budget.amount)} spent`}
      >
        <div
          className={`h-full rounded-full ${budget.overspent ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${fillWidth}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-1 tabular-nums">
        <span className="text-foreground">
          {fmt(budget.spent)} spent ({Math.round(budget.spentPercent)}%)
        </span>
        <strong className={budget.overspent ? "text-destructive" : "text-foreground"}>
          {budget.overspent ? `${fmt(Math.abs(budget.remaining))} over` : `${fmt(budget.remaining)} left`}
        </strong>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} onClick={onLogExpense}>
          <Plus aria-hidden="true" />
          Log expense
        </button>
        {count > 0 && (
          <button
            type="button"
            className={btnOutline}
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? "Hide" : "Show"} {count} {count === 1 ? "expense" : "expenses"}
          </button>
        )}
      </div>

      {expanded && count > 0 && (
        <ul id={listId} className="divide-y divide-border border-t border-border" aria-label={`Expenses for ${budget.name}`}>
          {budget.expenses.map((expense) => (
            <li key={expense.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="break-words font-semibold text-foreground">{expense.name}</p>
                <p className="text-sm text-muted-foreground">{fmtExpenseDate(expense.incurred_at)}</p>
              </div>
              <span className="font-semibold text-foreground tabular-nums">{fmt(Number(expense.amount))}</span>
              <button
                type="button"
                className={iconBtn}
                onClick={() => onRemoveExpense(expense)}
                aria-label={`Remove ${expense.name}`}
              >
                <X aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BudgetDialog({
  budget,
  saving,
  onOpenChange,
  onSave,
}: {
  budget: BudgetWithSpend | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: { name: string; amount: number }) => Promise<void>;
}) {
  const [name, setName] = useState(budget?.name ?? "");
  const [amount, setAmount] = useState(budget ? toInputValue(budget.amount) : "");
  const [errors, setErrors] = useState<{ name?: string | null; amount?: string | null }>({});

  const handleSubmit = async () => {
    const next = { name: nameError(name, "budget"), amount: amountError(amount, { allowZero: false }) };
    setErrors(next);
    if (next.name || next.amount) {
      document.getElementById(next.name ? "budget-name" : "budget-amount")?.focus();
      return;
    }
    try {
      await onSave({ name: name.trim(), amount: amountValue(amount) });
      onOpenChange(false);
    } catch {
      // Error surfaced via hook state.
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{budget ? `Edit ${budget.name}` : "New budget"}</DialogTitle>
          <DialogDescription>
            {budget && budget.spent > 0
              ? `${fmt(budget.spent)} is already logged against this budget.`
              : "Set money aside for one occasion."}
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
          <Field id="budget-name" label="What is it for?" hint="For example: Christmas gifts, Japan trip" error={errors.name}>
            <Input
              id="budget-name"
              value={name}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={describedBy("budget-name", true, errors.name)}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
              }}
            />
          </Field>
          <Field id="budget-amount" label="How much are you setting aside?" error={errors.amount}>
            <MoneyInput
              id="budget-amount"
              value={amount}
              onChange={(value) => {
                setAmount(value);
                if (errors.amount) setErrors((prev) => ({ ...prev, amount: null }));
              }}
              error={errors.amount}
              describedById={describedBy("budget-amount", false, errors.amount)}
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" className={`${btnOutline} flex-1`} onClick={() => onOpenChange(false)}>
              Cancel
            </button>
            <button type="submit" className={`${btnPrimary} flex-1`} disabled={saving}>
              {saving ? "Saving…" : budget ? "Save changes" : "Create budget"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LogExpenseDialog({
  budget,
  saving,
  onOpenChange,
  onAdd,
}: {
  budget: BudgetWithSpend;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: { name: string; amount: number; incurredAt?: string }) => Promise<void>;
}) {
  const today = new Date().toLocaleDateString("en-CA");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [incurredAt, setIncurredAt] = useState(today);
  const [errors, setErrors] = useState<{ name?: string | null; amount?: string | null; date?: string | null }>({});

  const handleSubmit = async () => {
    const next = {
      name: nameError(name, "expense"),
      amount: amountError(amount, { allowZero: false }),
      date: incurredAt ? null : "Choose the date you spent it.",
    };
    setErrors(next);
    if (next.name || next.amount || next.date) {
      document.getElementById(next.name ? "expense-name" : next.amount ? "expense-amount" : "expense-date")?.focus();
      return;
    }
    try {
      await onAdd({ name: name.trim(), amount: amountValue(amount), incurredAt });
      onOpenChange(false);
    } catch {
      // Error surfaced via hook state.
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log expense</DialogTitle>
          <DialogDescription>
            For {budget.name}.{" "}
            {budget.overspent ? `${fmt(Math.abs(budget.remaining))} over budget.` : `${fmt(budget.remaining)} left.`}
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
          <Field id="expense-name" label="What did you buy?" error={errors.name}>
            <Input
              id="expense-name"
              value={name}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={describedBy("expense-name", false, errors.name)}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
              }}
            />
          </Field>
          <Field id="expense-amount" label="Amount" error={errors.amount}>
            <MoneyInput
              id="expense-amount"
              value={amount}
              onChange={(value) => {
                setAmount(value);
                if (errors.amount) setErrors((prev) => ({ ...prev, amount: null }));
              }}
              error={errors.amount}
              describedById={describedBy("expense-amount", false, errors.amount)}
            />
          </Field>
          <Field id="expense-date" label="Date" error={errors.date}>
            <Input
              id="expense-date"
              type="date"
              value={incurredAt}
              aria-invalid={errors.date ? true : undefined}
              aria-describedby={describedBy("expense-date", false, errors.date)}
              onChange={(e) => setIncurredAt(e.target.value)}
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" className={`${btnOutline} flex-1`} onClick={() => onOpenChange(false)}>
              Cancel
            </button>
            <button type="submit" className={`${btnPrimary} flex-1`} disabled={saving}>
              {saving ? "Logging…" : "Log expense"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
