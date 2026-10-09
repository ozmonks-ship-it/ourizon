import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { BudgetWithSpend } from "@/lib/supabase/database.types";
import {
  createBudget,
  createExpense,
  deleteBudget,
  deleteExpense,
  fetchBudgets,
  resolveBudgetOwnerId,
  updateBudget,
} from "../lib/budgetsApi";
import { readCache, trackBusy, writeCache } from "../lib/dataCache";

interface BudgetsCache {
  ownerId: string;
  budgets: BudgetWithSpend[];
}

interface UseBudgetsResult {
  loading: boolean;
  saving: boolean;
  error: string | null;
  budgets: BudgetWithSpend[];
  hasBudgets: boolean;
  totals: { allocated: number; spent: number; remaining: number };
  addBudget: (input: { name: string; amount: number }) => Promise<void>;
  editBudget: (budgetId: string, input: { name: string; amount: number }) => Promise<void>;
  removeBudget: (budgetId: string) => Promise<void>;
  addExpense: (
    budgetId: string,
    input: { name: string; amount: number; incurredAt?: string },
  ) => Promise<void>;
  removeExpense: (expenseId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useBudgets(session: Session | null): UseBudgetsResult {
  const [cached] = useState(() => readCache<BudgetsCache>(`budgets:${session?.user.id ?? ""}`));
  const [loading, setLoading] = useState(!cached);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [budgets, setBudgets] = useState<BudgetWithSpend[]>(cached?.budgets ?? []);
  const [budgetOwnerId, setBudgetOwnerId] = useState<string | null>(cached?.ownerId ?? null);
  const hasData = useRef(Boolean(cached));

  const refresh = useCallback(async () => {
    if (!session?.user.id) {
      setBudgets([]);
      setBudgetOwnerId(null);
      setLoading(false);
      return;
    }

    if (!hasData.current) setLoading(true);
    setError(null);

    try {
      const { ownerId, rows } = await trackBusy(
        (async () => {
          const ownerId = await resolveBudgetOwnerId(session.user.id);
          return { ownerId, rows: await fetchBudgets(ownerId) };
        })(),
      );
      setBudgetOwnerId(ownerId);
      setBudgets(rows);
      hasData.current = true;
      writeCache<BudgetsCache>(`budgets:${session.user.id}`, { ownerId, budgets: rows });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load budgets");
    } finally {
      setLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runMutation = useCallback(
    async (mutation: () => Promise<void>, fallbackMessage: string) => {
      setSaving(true);
      setError(null);
      try {
        await mutation();
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : fallbackMessage);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [refresh],
  );

  const addBudget = useCallback(
    async (input: { name: string; amount: number }) => {
      if (!budgetOwnerId) return;
      await runMutation(async () => {
        await createBudget(budgetOwnerId, input);
      }, "Failed to add budget");
    },
    [budgetOwnerId, runMutation],
  );

  const editBudget = useCallback(
    (budgetId: string, input: { name: string; amount: number }) =>
      runMutation(async () => {
        await updateBudget(budgetId, input);
      }, "Failed to update budget"),
    [runMutation],
  );

  const removeBudget = useCallback(
    (budgetId: string) =>
      runMutation(async () => {
        await deleteBudget(budgetId);
      }, "Failed to delete budget"),
    [runMutation],
  );

  const addExpense = useCallback(
    (budgetId: string, input: { name: string; amount: number; incurredAt?: string }) =>
      runMutation(async () => {
        await createExpense(budgetId, input);
      }, "Failed to add expense"),
    [runMutation],
  );

  const removeExpense = useCallback(
    (expenseId: string) =>
      runMutation(async () => {
        await deleteExpense(expenseId);
      }, "Failed to delete expense"),
    [runMutation],
  );

  const totals = useMemo(() => {
    const allocated = budgets.reduce((sum, budget) => sum + budget.amount, 0);
    const spent = budgets.reduce((sum, budget) => sum + budget.spent, 0);
    return { allocated, spent, remaining: allocated - spent };
  }, [budgets]);

  return {
    loading,
    saving,
    error,
    budgets,
    hasBudgets: budgets.length > 0,
    totals,
    addBudget,
    editBudget,
    removeBudget,
    addExpense,
    removeExpense,
    refresh,
  };
}
