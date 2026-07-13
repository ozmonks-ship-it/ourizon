import { createClient } from "@/lib/supabase/client";
import type { Budget, BudgetExpense, BudgetWithSpend } from "@/lib/supabase/database.types";
import { resolveBudgetOwnerId } from "./collaborationApi";

interface BudgetRowWithExpenses extends Budget {
  budget_expenses: BudgetExpense[];
}

export { resolveBudgetOwnerId };

export async function fetchBudgets(budgetOwnerId: string): Promise<BudgetWithSpend[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("budgets")
    .select(
      "id, user_id, name, amount, sort_order, created_at, updated_at, " +
        "budget_expenses(id, budget_id, name, amount, incurred_at, created_at)",
    )
    .eq("user_id", budgetOwnerId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as unknown as BudgetRowWithExpenses[];
  return rows.map(buildBudgetWithSpend);
}

function buildBudgetWithSpend(row: BudgetRowWithExpenses): BudgetWithSpend {
  const { budget_expenses, ...budget } = row;

  const expenses = [...(budget_expenses ?? [])].sort((a, b) =>
    a.incurred_at === b.incurred_at
      ? a.created_at.localeCompare(b.created_at)
      : b.incurred_at.localeCompare(a.incurred_at),
  );

  const amount = Number(budget.amount);
  const spent = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const remaining = amount - spent;
  const spentPercent = amount > 0 ? (spent / amount) * 100 : spent > 0 ? 100 : 0;

  return {
    ...budget,
    amount,
    expenses,
    spent,
    remaining,
    spentPercent,
    remainingPercent: Math.max(0, 100 - spentPercent),
    overspent: remaining < 0,
  };
}

export async function createBudget(
  budgetOwnerId: string,
  input: { name: string; amount: number },
): Promise<Budget> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("budgets")
    .insert({
      user_id: budgetOwnerId,
      name: input.name.trim(),
      amount: input.amount,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateBudget(
  budgetId: string,
  input: { name: string; amount: number },
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("budgets")
    .update({ name: input.name.trim(), amount: input.amount })
    .eq("id", budgetId);

  if (error) throw error;
}

export async function deleteBudget(budgetId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("budgets").delete().eq("id", budgetId);
  if (error) throw error;
}

export async function createExpense(
  budgetId: string,
  input: { name: string; amount: number; incurredAt?: string },
): Promise<BudgetExpense> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("budget_expenses")
    .insert({
      budget_id: budgetId,
      name: input.name.trim(),
      amount: input.amount,
      ...(input.incurredAt ? { incurred_at: input.incurredAt } : {}),
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("budget_expenses").delete().eq("id", expenseId);
  if (error) throw error;
}
