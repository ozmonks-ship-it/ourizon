import { fmt } from "../lib/format";

/** Income split into planned spending and what's left to save, in words and as a bar. */
export function PlanMeter({ income, spending }: { income: number; spending: number }) {
  const left = income - spending;
  const over = left < 0;
  const spendPercent = income > 0 ? Math.min(100, (spending / income) * 100) : spending > 0 ? 100 : 0;
  const leftPercent = income > 0 ? Math.round((Math.abs(left) / income) * 100) : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <span className={over ? "bg-destructive" : "bg-primary"} style={{ width: `${spendPercent}%` }} />
        {!over && <span className="bg-success" style={{ width: `${100 - spendPercent}%` }} />}
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 tabular-nums">
        <dt className="text-foreground">Income</dt>
        <dd className="text-right font-bold text-foreground">{fmt(income)}</dd>
        <dt className="flex items-center gap-2 text-foreground">
          <span className={`size-3 rounded-sm ${over ? "bg-destructive" : "bg-primary"}`} aria-hidden="true" />
          Planned spending
        </dt>
        <dd className="text-right font-bold text-foreground">{fmt(spending)}</dd>
        <dt className="flex items-center gap-2 text-foreground">
          <span className="size-3 rounded-sm bg-success" aria-hidden="true" />
          {over ? "Over your income by" : "Left to save"}
        </dt>
        <dd className={`text-right font-bold ${over ? "text-destructive" : "text-foreground"}`}>
          {fmt(Math.abs(left))}
          {income > 0 && <span className="ml-1 text-sm font-semibold text-muted-foreground">({leftPercent}%)</span>}
        </dd>
      </dl>
    </div>
  );
}
