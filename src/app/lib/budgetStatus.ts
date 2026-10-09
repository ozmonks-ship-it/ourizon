import type { BudgetWithSpend } from "@/lib/supabase/database.types";
import type { ChipTone } from "../components/ui/kit";
import { fmt } from "./format";

/** Status chip for a budget: words plus an icon, never colour alone. */
export function budgetStatus(budget: BudgetWithSpend): { tone: ChipTone; label: string } {
  if (budget.overspent) return { tone: "bad", label: `Over by ${fmt(Math.abs(budget.remaining))}` };
  if (budget.spent === 0) return { tone: "neutral", label: "Not started" };
  if (budget.spentPercent >= 90) return { tone: "warn", label: "Almost used" };
  return { tone: "good", label: "On track" };
}
