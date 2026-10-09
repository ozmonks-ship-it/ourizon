import { useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { ChartLegend, ForecastChart } from "../components/ForecastChart";
import { PageLoader } from "../components/PageLoader";
import { PlanMeter } from "../components/PlanMeter";
import type { NavScreen } from "../components/AppLayout";
import { btnLink, btnOutline, btnPrimary } from "../components/ui/buttonStyles";
import { StatusChip } from "../components/ui/kit";
import { budgetStatus } from "../lib/budgetStatus";
import { useAssets } from "../hooks/useAssets";
import { useLog } from "../hooks/useLog";
import { useForecast } from "../hooks/useForecast";
import { useBudgets } from "../hooks/useBudgets";
import { ASSET_GROUPS } from "../data/assetGroups";
import { fmt, fmtDate, fmtEstimate, fmtMonthName } from "../lib/format";
import { firstNameFromUser, timeOfDayGreeting } from "../lib/userDisplay";
import { PROJECTION_HORIZONS, type ProjectionHorizon } from "../lib/forecast";

const HOME_BUDGETS_LIMIT = 4;

interface HomeScreenProps {
  session: Session;
  onNavigate: (screen: NavScreen) => void;
}

export function HomeScreen({ session, onNavigate }: HomeScreenProps) {
  const { loading: assetsLoading, assets, totalNetWorth, hasAssets, hasSnapshots, netWorthHistory } =
    useAssets(session);
  const { loading: planLoading, summary, isCurrentPeriodSaved, savedPeriods, monthLabel, year, month } =
    useLog(session);
  const { loading: forecastLoading, fullForecast, monthlySaving } = useForecast(session);
  const { loading: budgetsLoading, budgets, hasBudgets } = useBudgets(session);

  const greeting = timeOfDayGreeting();
  const firstName = firstNameFromUser(session.user);

  const assetClassTotals = useMemo(() => {
    return ASSET_GROUPS.map((group) => {
      const total = assets
        .filter((asset) => asset.group_id === group.id)
        .reduce((sum, asset) => sum + (asset.balance ?? 0), 0);
      return { ...group, total };
    })
      .filter((group) => group.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [assets]);

  if (assetsLoading || planLoading || budgetsLoading) {
    return <PageLoader />;
  }

  if (!hasAssets || !hasSnapshots) {
    return (
      <GettingStarted
        firstName={firstName}
        hasAssets={hasAssets}
        hasSnapshots={hasSnapshots}
        hasPlan={savedPeriods.size > 0}
        onNavigate={onNavigate}
      />
    );
  }

  const latest = netWorthHistory[netWorthHistory.length - 1];
  const previous = netWorthHistory[netWorthHistory.length - 2];
  const change = previous ? totalNetWorth - previous.value : null;
  const overBudgets = budgets.filter((budget) => budget.overspent);
  const monthName = fmtMonthName(year, month);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 tabIndex={-1} className="text-2xl font-semibold text-foreground focus:outline-none">
          {greeting}, {firstName}
        </h1>
        <p className="text-muted-foreground">Here's where your money stands on {fmtDate(new Date())}.</p>
      </div>

      {(overBudgets.length > 0 || !isCurrentPeriodSaved) && (
        <section aria-labelledby="attention-heading" className="flex flex-col gap-2 rounded-2xl border-2 border-warning bg-card p-4">
          <h2 id="attention-heading" className="text-lg font-semibold text-foreground">
            Needs attention
          </h2>
          <ul className="divide-y divide-border">
            {overBudgets.map((budget) => (
              <li key={budget.id} className="flex items-center gap-3 py-2">
                <p className="min-w-0 flex-1 font-semibold text-foreground">
                  {budget.name} is {fmt(Math.abs(budget.remaining))} over budget
                </p>
                <button type="button" className={btnOutline} onClick={() => onNavigate("budgets")}>
                  Review<span className="sr-only"> {budget.name}</span>
                </button>
              </li>
            ))}
            {!isCurrentPeriodSaved && (
              <li className="flex items-center gap-3 py-2">
                <p className="min-w-0 flex-1 font-semibold text-foreground">Your {monthName} plan isn't saved yet</p>
                <button type="button" className={btnOutline} onClick={() => onNavigate("monthly")}>
                  Open plan
                </button>
              </li>
            )}
          </ul>
        </section>
      )}

      <section aria-labelledby="networth-heading" className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
        <h2 id="networth-heading" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Net worth
        </h2>
        <p className="text-4xl font-semibold text-foreground tabular-nums">{fmt(totalNetWorth)}</p>
        {change !== null && previous && (
          <p className={`flex items-center gap-1.5 font-bold tabular-nums ${change >= 0 ? "text-success" : "text-destructive"}`}>
            {change >= 0 ? <ArrowUp className="size-5" aria-hidden="true" /> : <ArrowDown className="size-5" aria-hidden="true" />}
            {change >= 0 ? "Up" : "Down"} {fmt(Math.abs(change))} since {fmtDate(previous.recordedAt)}
          </p>
        )}
        <p className="text-sm text-muted-foreground">Based on the balances you recorded on {fmtDate(latest.recordedAt)}.</p>
      </section>

      {!forecastLoading && fullForecast.length > 0 && (
        <ForecastSection
          netWorthHistory={netWorthHistory}
          fullForecast={fullForecast}
          monthlySaving={monthlySaving}
          totalNetWorth={totalNetWorth}
        />
      )}

      <section aria-labelledby="own-heading" className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <h2 id="own-heading" className="flex-1 text-lg font-semibold text-foreground">
            What you own
          </h2>
          <button type="button" className={btnLink} onClick={() => onNavigate("assets")}>
            See all<span className="sr-only"> assets</span>
          </button>
        </div>
        <ul className="divide-y divide-border">
          {assetClassTotals.map((group) => {
            const share = totalNetWorth > 0 ? Math.round((group.total / totalNetWorth) * 100) : 0;
            return (
              <li key={group.id} className="flex flex-col gap-1.5 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="flex-1 font-semibold text-foreground">{group.label}</span>
                  <span className="font-bold text-foreground tabular-nums">{fmt(group.total)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div className="h-full rounded-full" style={{ width: `${share}%`, background: group.color }} />
                  </div>
                  <span className="w-24 text-right text-sm text-muted-foreground tabular-nums">{share}% of total</span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="plan-heading" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="plan-heading" className="flex-1 text-lg font-semibold text-foreground">
            {monthLabel} plan
          </h2>
          <StatusChip tone={isCurrentPeriodSaved ? "good" : "warn"}>
            {isCurrentPeriodSaved ? "Saved" : "Not saved yet"}
          </StatusChip>
        </div>
        <PlanMeter income={summary.totalIncome} spending={summary.totalExpenses} />
        <button type="button" className={`${btnOutline} self-start`} onClick={() => onNavigate("monthly")}>
          Open monthly plan
        </button>
      </section>

      <section aria-labelledby="budgets-heading" className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <h2 id="budgets-heading" className="flex-1 text-lg font-semibold text-foreground">
            Budgets
          </h2>
          <button type="button" className={btnLink} onClick={() => onNavigate("budgets")}>
            See all<span className="sr-only"> budgets</span>
          </button>
        </div>
        {!hasBudgets ? (
          <p className="text-muted-foreground">
            No budgets yet. A budget sets money aside for one occasion, like a trip.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {budgets.slice(0, HOME_BUDGETS_LIMIT).map((budget) => {
              const status = budgetStatus(budget);
              return (
                <li key={budget.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-semibold text-foreground">{budget.name}</p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {fmt(budget.spent)} of {fmt(budget.amount)} spent
                    </p>
                  </div>
                  <StatusChip tone={status.tone}>{status.label}</StatusChip>
                </li>
              );
            })}
          </ul>
        )}
        {budgets.length > HOME_BUDGETS_LIMIT && (
          <p className="text-sm text-muted-foreground">
            {budgets.length - HOME_BUDGETS_LIMIT} more in Budgets
          </p>
        )}
      </section>
    </div>
  );
}

function ForecastSection({
  netWorthHistory,
  fullForecast,
  monthlySaving,
  totalNetWorth,
}: {
  netWorthHistory: ReturnType<typeof useAssets>["netWorthHistory"];
  fullForecast: ReturnType<typeof useForecast>["fullForecast"];
  monthlySaving: number;
  totalNetWorth: number;
}) {
  const [horizon, setHorizon] = useState<ProjectionHorizon>(5);
  const future = fullForecast[horizon]?.projected ?? totalNetWorth;
  const years = horizon === 1 ? "year" : "years";
  const summary = `Net worth chart. Recorded ${fmt(netWorthHistory[0]?.value ?? 0)} on ${fmtDate(
    netWorthHistory[0]?.recordedAt ?? new Date(),
  )}, ${fmt(totalNetWorth)} today, and a forecast of about ${fmtEstimate(future)} in ${horizon} ${years}.`;

  return (
    <section aria-labelledby="forecast-heading" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="forecast-heading" className="text-lg font-semibold text-foreground">
          Forecast
        </h2>
        <fieldset className="flex rounded-xl border-2 border-field-border p-0.5">
          <legend className="sr-only">Forecast length</legend>
          {PROJECTION_HORIZONS.map((option) => (
            <label key={option} className="relative">
              <input
                type="radio"
                name="forecast-horizon"
                value={option}
                checked={horizon === option}
                onChange={() => setHorizon(option)}
                className="peer absolute inset-0 cursor-pointer opacity-0"
              />
              <span className="flex min-h-10 min-w-14 items-center justify-center rounded-lg px-2 text-sm font-bold text-muted-foreground peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:outline-3 peer-focus-visible:outline-focus peer-focus-visible:outline-solid">
                {option} {option === 1 ? "yr" : "yrs"}
              </span>
            </label>
          ))}
        </fieldset>
      </div>

      <p aria-live="polite">
        <span className="text-muted-foreground">
          In {horizon} {years} you could have about
        </span>
        <br />
        <span className="text-3xl font-semibold text-foreground tabular-nums">{fmtEstimate(future)}</span>
      </p>

      <ForecastChart history={netWorthHistory} forecast={fullForecast} horizon={horizon} summary={summary} />
      <ChartLegend />

      <p className="text-sm text-muted-foreground">
        Assumes you keep saving {fmt(monthlySaving)} a month, as in your monthly plan. It doesn't include
        investment returns, interest or inflation.
      </p>

      <details className="group">
        <summary className="flex min-h-11 cursor-pointer items-center font-bold text-primary">
          Show forecast as a table
        </summary>
        <table className="w-full text-left tabular-nums">
          <caption className="sr-only">Forecast net worth by year</caption>
          <thead>
            <tr className="border-b border-border text-sm text-muted-foreground">
              <th scope="col" className="py-2 font-semibold">When</th>
              <th scope="col" className="py-2 text-right font-semibold">Net worth</th>
            </tr>
          </thead>
          <tbody>
            {fullForecast.slice(0, horizon + 1).map((point, k) => (
              <tr key={point.year} className="border-b border-border last:border-0">
                <td className="py-2">{k === 0 ? "Today" : `In ${k} ${k === 1 ? "year" : "years"}`}</td>
                <td className="py-2 text-right font-semibold">{fmt(point.projected)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

function GettingStarted({
  firstName,
  hasAssets,
  hasSnapshots,
  hasPlan,
  onNavigate,
}: {
  firstName: string;
  hasAssets: boolean;
  hasSnapshots: boolean;
  hasPlan: boolean;
  onNavigate: (screen: NavScreen) => void;
}) {
  const steps = [
    {
      done: hasAssets,
      title: "Add what you own",
      text: "Bank accounts, shares, property, super. Names only for now; no amounts yet.",
      action: "Add an account",
      screen: "assets" as const,
    },
    {
      done: hasSnapshots,
      title: "Record today's balances",
      text: "Type in how much is in each account. Do this once a month to see your net worth change.",
      action: "Record balances",
      screen: "assets" as const,
    },
    {
      done: hasPlan,
      title: "Plan your month",
      text: "Enter your take-home pay and decide how much goes to bills, spending and savings.",
      action: "Start a monthly plan",
      screen: "monthly" as const,
    },
  ];
  const next = steps.findIndex((step) => !step.done);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 tabIndex={-1} className="text-2xl font-semibold text-foreground focus:outline-none">
          Welcome to Ourizon, {firstName}
        </h1>
        <p className="text-muted-foreground">
          Ourizon shows what you own today and what you could have in the future. It takes about 5
          minutes to set up.
        </p>
      </div>

      <section aria-labelledby="steps-heading" className="flex flex-col gap-3">
        <h2 id="steps-heading" className="text-lg font-semibold text-foreground">
          Get started in 3 steps
        </h2>
        <ol className="flex flex-col gap-3">
          {steps.map((step, index) => {
            const state = step.done ? "done" : index === next ? "next" : "later";
            return (
              <li
                key={step.title}
                className={`flex gap-3 rounded-2xl border-2 bg-card p-4 ${state === "next" ? "border-primary" : "border-border"}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full font-bold ${
                    state === "done"
                      ? "bg-success text-background"
                      : state === "next"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                  }`}
                >
                  {state === "done" ? <Check className="size-5" /> : index + 1}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <h3 className="font-bold text-foreground">
                    {step.title}
                    <span className="sr-only">{state === "done" ? " (done)" : state === "next" ? " (next step)" : ""}</span>
                  </h3>
                  <p className="text-sm text-muted-foreground">{step.text}</p>
                  {state === "next" && (
                    <button type="button" className={`${btnPrimary} mt-1 self-start`} onClick={() => onNavigate(step.screen)}>
                      {step.action}
                    </button>
                  )}
                  {state === "done" && <p className="text-sm font-bold text-success">Done</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="preview-heading" className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
        <h2 id="preview-heading" className="text-lg font-semibold text-foreground">
          What you'll see here
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
          <li>Your net worth and how it changed since last month</li>
          <li>A forecast of where you could be in 1, 5 or 10 years</li>
          <li>Budgets and monthly plans that need attention</li>
        </ul>
      </section>
    </div>
  );
}
