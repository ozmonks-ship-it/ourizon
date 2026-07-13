import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  PlusCircle,
  Target,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { PageLoader } from "../components/PageLoader";
import { useBudgets } from "../hooks/useBudgets";
import { fmt } from "../lib/format";
import type { BudgetExpense, BudgetWithSpend } from "@/lib/supabase/database.types";

interface BudgetsScreenProps {
  session: Session;
}

const fmtExpenseDate = (dateOnly: string) => {
  const [year, month, day] = dateOnly.split("-").map(Number);
  if (!year || !month || !day) return dateOnly;
  return new Date(year, month - 1, day).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export function BudgetsScreen({ session }: BudgetsScreenProps) {
  const {
    loading,
    saving,
    error,
    budgets,
    hasBudgets,
    totals,
    addBudget,
    editBudget,
    removeBudget,
    addExpense,
    removeExpense,
  } = useBudgets(session);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetWithSpend | null>(null);
  const [expenseTarget, setExpenseTarget] = useState<BudgetWithSpend | null>(null);

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-foreground mb-1">Budgets 🎯</h1>
          <p className="text-muted-foreground text-sm">
            Set aside money for an occasion, then track what you spend against it.
          </p>
        </div>

        {hasBudgets && (
          <AddBudgetDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            onAdd={addBudget}
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

      {!hasBudgets ? (
        <EmptyBudgetsState open={addOpen} onOpenChange={setAddOpen} onAdd={addBudget} saving={saving} />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <SummaryTile label="Allocated" value={totals.allocated} />
            <SummaryTile label="Spent" value={totals.spent} />
            <SummaryTile label="Remaining" value={totals.remaining} tone={totals.remaining < 0 ? "negative" : "default"} />
          </div>

          <div className="space-y-3">
            {budgets.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                saving={saving}
                onEdit={() => setEditing(budget)}
                onDelete={() => void removeBudget(budget.id)}
                onAddExpense={() => setExpenseTarget(budget)}
                onRemoveExpense={(expenseId) => void removeExpense(expenseId)}
              />
            ))}
          </div>
        </>
      )}

      {editing && (
        <EditBudgetDialog
          budget={editing}
          open={editing !== null}
          onOpenChange={(open) => !open && setEditing(null)}
          onSave={editBudget}
          saving={saving}
        />
      )}

      {expenseTarget && (
        <AddExpenseDialog
          budget={expenseTarget}
          open={expenseTarget !== null}
          onOpenChange={(open) => !open && setExpenseTarget(null)}
          onAdd={addExpense}
          saving={saving}
        />
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "negative";
}) {
  return (
    <div className="bg-card rounded-xl border border-border px-3 py-3 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p
        className={`text-sm font-medium tabular-nums ${
          tone === "negative" ? "text-destructive" : "text-foreground"
        }`}
      >
        {fmt(value)}
      </p>
    </div>
  );
}

function BudgetCard({
  budget,
  saving,
  onEdit,
  onDelete,
  onAddExpense,
  onRemoveExpense,
}: {
  budget: BudgetWithSpend;
  saving: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddExpense: () => void;
  onRemoveExpense: (expenseId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const fillWidth = Math.min(100, budget.spentPercent);
  const remainingPercentLabel = Math.round(budget.remainingPercent);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{budget.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Budget {fmt(budget.amount)}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onEdit}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={`Edit ${budget.name}`}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onDelete}
              className="p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
              aria-label={`Delete ${budget.name}`}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mt-3">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                budget.overspent ? "bg-destructive" : "bg-foreground"
              }`}
              style={{ width: `${fillWidth}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground tabular-nums">
              {fmt(budget.spent)} spent · {Math.round(budget.spentPercent)}%
            </span>
            <span
              className={`font-medium tabular-nums ${
                budget.overspent ? "text-destructive" : "text-foreground"
              }`}
            >
              {budget.overspent
                ? `${fmt(Math.abs(budget.remaining))} over`
                : `${fmt(budget.remaining)} left · ${remainingPercentLabel}%`}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onAddExpense}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background font-medium text-xs transition-all duration-150 hover:opacity-90 active:scale-95"
          >
            <PlusCircle size={14} />
            Add expense
          </button>
          {budget.expenses.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              aria-expanded={expanded}
            >
              {budget.expenses.length} {budget.expenses.length === 1 ? "expense" : "expenses"}
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {expanded && budget.expenses.length > 0 && (
        <div className="border-t border-border divide-y divide-border">
          {budget.expenses.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              saving={saving}
              onDelete={() => onRemoveExpense(expense.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ExpenseRow({
  expense,
  saving,
  onDelete,
}: {
  expense: BudgetExpense;
  saving: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="px-4 py-2.5 flex items-center gap-3 bg-muted/20">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground truncate">{expense.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{fmtExpenseDate(expense.incurred_at)}</p>
      </div>
      <p className="text-sm font-medium text-foreground tabular-nums shrink-0">
        {fmt(Number(expense.amount))}
      </p>
      <button
        type="button"
        disabled={saving}
        onClick={onDelete}
        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 shrink-0"
        aria-label={`Delete ${expense.name}`}
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

function EmptyBudgetsState({
  open,
  onOpenChange,
  onAdd,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: { name: string; amount: number }) => Promise<void>;
  saving: boolean;
}) {
  return (
    <div className="bg-card rounded-xl border border-border px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Target size={24} className="text-muted-foreground" />
      </div>
      <h2 className="text-lg font-medium text-foreground mb-2">Create your first budget</h2>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
        Name a budget for an occasion — like an annual bonus for travel and family visits — set its
        amount, then log expenses against it to see how much is left.
      </p>
      <AddBudgetDialog
        open={open}
        onOpenChange={onOpenChange}
        onAdd={onAdd}
        saving={saving}
        triggerLabel="Create a budget"
      />
    </div>
  );
}

function AddBudgetDialog({
  open,
  onOpenChange,
  onAdd,
  saving,
  triggerLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: { name: string; amount: number }) => Promise<void>;
  saving: boolean;
  triggerLabel: string;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  const reset = () => {
    setName("");
    setAmount("");
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const value = amount.trim() === "" ? 0 : parseFloat(amount);
    if (Number.isNaN(value) || value < 0) return;

    try {
      await onAdd({ name: trimmed, amount: value });
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
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-foreground text-background font-medium text-sm transition-all duration-150 hover:opacity-90 active:scale-95 shrink-0"
        >
          <PlusCircle size={16} />
          {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-medium">New budget</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label htmlFor="add-budget-name" className="block text-xs font-medium text-muted-foreground mb-1.5">
              Name
            </label>
            <Input
              id="add-budget-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Annual Bonus ✈️"
            />
          </div>
          <div>
            <label htmlFor="add-budget-amount" className="block text-xs font-medium text-muted-foreground mb-1.5">
              Budget amount
            </label>
            <Input
              id="add-budget-amount"
              type="number"
              inputMode="numeric"
              min={0}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="10000"
            />
          </div>
          <button
            type="button"
            disabled={saving || !name.trim()}
            onClick={() => void handleSubmit()}
            className="w-full py-2.5 rounded-lg bg-foreground text-background font-medium text-sm transition-all duration-150 hover:opacity-90 active:scale-95 mt-2 disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add budget"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditBudgetDialog({
  budget,
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  budget: BudgetWithSpend;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (budgetId: string, input: { name: string; amount: number }) => Promise<void>;
  saving: boolean;
}) {
  const [name, setName] = useState(budget.name);
  const [amount, setAmount] = useState(String(budget.amount));

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const value = amount.trim() === "" ? 0 : parseFloat(amount);
    if (Number.isNaN(value) || value < 0) return;

    try {
      await onSave(budget.id, { name: trimmed, amount: value });
      onOpenChange(false);
    } catch {
      // Error surfaced via hook state.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onCloseAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-medium">Edit budget</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label htmlFor="edit-budget-name" className="text-xs text-muted-foreground mb-1.5 block">
              Name
            </label>
            <Input id="edit-budget-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="edit-budget-amount" className="text-xs text-muted-foreground mb-1.5 block">
              Budget amount
            </label>
            <Input
              id="edit-budget-amount"
              type="number"
              inputMode="numeric"
              min={0}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          {budget.spent > 0 && (
            <p className="text-xs text-muted-foreground">
              {fmt(budget.spent)} already spent across {budget.expenses.length}{" "}
              {budget.expenses.length === 1 ? "expense" : "expenses"}.
            </p>
          )}
          <button
            type="button"
            disabled={saving || !name.trim()}
            onClick={() => void handleSave()}
            className="w-full bg-foreground text-background font-medium rounded-lg py-2.5 text-sm disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save budget"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddExpenseDialog({
  budget,
  open,
  onOpenChange,
  onAdd,
  saving,
}: {
  budget: BudgetWithSpend;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (
    budgetId: string,
    input: { name: string; amount: number; incurredAt?: string },
  ) => Promise<void>;
  saving: boolean;
}) {
  const today = new Date().toLocaleDateString("en-CA");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [incurredAt, setIncurredAt] = useState(today);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const value = amount.trim() === "" ? 0 : parseFloat(amount);
    if (Number.isNaN(value) || value < 0) return;

    try {
      await onAdd(budget.id, { name: trimmed, amount: value, incurredAt });
      setName("");
      setAmount("");
      setIncurredAt(today);
      onOpenChange(false);
    } catch {
      // Error surfaced via hook state.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onCloseAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-medium">Add expense</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1">
          Against {budget.name} · {fmt(budget.remaining)} left
        </p>
        <div className="space-y-3 py-2">
          <div>
            <label htmlFor="add-expense-name" className="block text-xs font-medium text-muted-foreground mb-1.5">
              What was it?
            </label>
            <Input
              id="add-expense-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Flights to Türkiye ✈️"
            />
          </div>
          <div>
            <label htmlFor="add-expense-amount" className="block text-xs font-medium text-muted-foreground mb-1.5">
              Amount
            </label>
            <Input
              id="add-expense-amount"
              type="number"
              inputMode="numeric"
              min={0}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1200"
            />
          </div>
          <div>
            <label htmlFor="add-expense-date" className="block text-xs font-medium text-muted-foreground mb-1.5">
              Date
            </label>
            <Input
              id="add-expense-date"
              type="date"
              value={incurredAt}
              onChange={(e) => setIncurredAt(e.target.value)}
            />
          </div>
          <button
            type="button"
            disabled={saving || !name.trim()}
            onClick={() => void handleSubmit()}
            className="w-full py-2.5 rounded-lg bg-foreground text-background font-medium text-sm transition-all duration-150 hover:opacity-90 active:scale-95 mt-2 disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add expense"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
