import { useMemo } from "react";
import type { Session } from "@supabase/supabase-js";
import { ForecastCard } from "../components/ForecastCard";
import { useAssets } from "../hooks/useAssets";
import { currentPeriod, useLog } from "../hooks/useLog";
import { useForecast } from "../hooks/useForecast";
import { ASSET_GROUPS } from "../data/assetGroups";
import { fmt, fmtK } from "../lib/format";
import { firstNameFromUser, timeOfDayGreeting } from "../lib/userDisplay";

interface HomeScreenProps {
  session: Session;
}

export function HomeScreen({ session }: HomeScreenProps) {
  const { loading: assetsLoading, assets, totalNetWorth, hasSnapshots } = useAssets(session);
  const { loading: bucketsLoading, expenseBuckets, summary, error: bucketsError } = useLog(session);
  const {
    loading: forecastLoading,
    hasSnapshots: forecastReady,
    forecastData,
  } = useForecast(session);
  const { year: todayYear } = currentPeriod();

  const assetClassTotals = useMemo(() => {
    return ASSET_GROUPS.map((group) => {
      const total = assets
        .filter((asset) => asset.group_id === group.id)
        .reduce((sum, asset) => sum + (asset.balance ?? 0), 0);
      return { id: group.id, label: group.label, total };
    }).filter((group) => group.total > 0);
  }, [assets]);

  const parentBuckets = useMemo(
    () => expenseBuckets.filter((bucket) => bucket.parent_bucket_id === null),
    [expenseBuckets],
  );

  const greeting = timeOfDayGreeting();
  const firstName = firstNameFromUser(session.user);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-muted-foreground text-sm mb-1">
          {greeting}, {firstName}
        </p>
        <h1 className="text-2xl font-medium text-foreground mb-6">Home 🏠</h1>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-muted-foreground text-xs mb-1">Net worth today 💎</p>
          <p className="text-3xl font-medium text-foreground">
            {assetsLoading ? "Loading..." : hasSnapshots ? fmt(totalNetWorth) : "No snapshot yet"}
          </p>
          {!assetsLoading && !hasSnapshots && (
            <p className="text-xs text-muted-foreground mt-1">
              Save a balance snapshot in Assets to see this value.
            </p>
          )}
        </div>

        <ComingSoonCard
          title="Projected value"
          subtitle="Long-term projections will appear here."
        />
      </div>

      <ForecastCard
        loading={forecastLoading}
        hasSnapshots={forecastReady}
        forecastData={forecastData}
        todayYear={String(todayYear)}
      />

      <div>
        <h2 className="font-medium text-base text-foreground mb-3">Assets 💼</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {assetsLoading ? (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm text-muted-foreground">Loading asset totals...</p>
            </div>
          ) : assetClassTotals.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm text-muted-foreground">
                No snapshot totals yet. Add assets and save balances first.
              </p>
            </div>
          ) : (
            assetClassTotals.map((group) => (
              <div key={group.id} className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">{group.label}</p>
                <p className="text-lg font-medium text-foreground">{fmtK(group.total)}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl p-5 border border-border">
        <h2 className="font-medium text-base text-foreground mb-3">Buckets 🪣</h2>
        {bucketsLoading ? (
          <p className="text-sm text-muted-foreground">Loading current month buckets...</p>
        ) : bucketsError ? (
          <p className="text-sm text-destructive">{bucketsError}</p>
        ) : parentBuckets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No parent expense buckets found for the current month.
          </p>
        ) : (
          <div className="space-y-2">
            {parentBuckets.map((bucket) => {
              const allocation = summary.byBucketId.get(bucket.id);
              const resolvedAmount = allocation?.resolvedAmount ?? 0;
              const allocatedPercent =
                allocation?.displayPercent !== null && allocation?.displayPercent !== undefined
                  ? allocation.displayPercent
                  : 0;

              return (
                <div key={bucket.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{bucket.name}</p>
                    <p className="text-xs text-muted-foreground">{allocatedPercent}% allocated</p>
                  </div>
                  <p className="text-sm font-medium text-foreground">{fmt(resolvedAmount)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ComingSoonCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <p className="text-muted-foreground text-xs mb-2">{title}</p>
      <p className="text-xl font-medium text-foreground mb-1">Coming soon</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}
