import {
  Area,
  AreaChart,
  CartesianGrid,
  Label,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ForecastPoint } from "../lib/forecast";
import { fmtK } from "../lib/format";
import { PageLoader } from "./PageLoader";

function ForecastTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const projected = payload.find((entry) => entry.dataKey === "projected")?.value;
  const actual = payload.find((entry) => entry.dataKey === "actual")?.value;

  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs space-y-0.5">
      <p className="font-medium text-foreground">{label}</p>
      {projected !== undefined && (
        <p className="text-muted-foreground">
          Savings projection:{" "}
          <span className="font-medium text-foreground">{fmtK(projected)}</span>
        </p>
      )}
      {actual !== undefined && (
        <p className="text-muted-foreground">
          Adjusted: <span className="font-medium text-foreground">{fmtK(actual)}</span>
        </p>
      )}
    </div>
  );
}

export function ForecastCard({
  loading,
  hasSnapshots,
  forecastData,
  todayYear,
}: {
  loading: boolean;
  hasSnapshots: boolean;
  forecastData: ForecastPoint[];
  todayYear: string;
}) {
  return (
    <div className="bg-card rounded-xl p-5 border border-border">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-medium text-base text-foreground mb-0.5">Forecast 🔭</h2>
          <p className="text-muted-foreground text-xs">Your projected growth over time</p>
        </div>
      </div>

      {loading ? (
        <PageLoader />
      ) : !hasSnapshots ? (
        <p className="text-sm text-muted-foreground py-16 text-center">
          Save a balance snapshot in Assets to see your forecast.
        </p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={forecastData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                strokeOpacity={0.08}
                vertical={false}
              />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={fmtK}
                tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip content={<ForecastTooltip />} />
              <ReferenceLine
                x={todayYear}
                stroke="currentColor"
                strokeDasharray="3 3"
                strokeOpacity={0.3}
              >
                <Label value="Today" fill="currentColor" opacity={0.5} fontSize={11} fontWeight={500} />
              </ReferenceLine>
              <Area
                type="monotone"
                dataKey="projected"
                stroke="currentColor"
                strokeWidth={1}
                fill="currentColor"
                fillOpacity={0.05}
                dot={false}
                strokeDasharray="4 4"
                strokeOpacity={0.4}
                animationDuration={1200}
                animationEasing="ease-out"
              />
              <Area
                type="monotone"
                dataKey="actual"
                stroke="currentColor"
                strokeWidth={2}
                fill="currentColor"
                fillOpacity={0.1}
                dot={false}
                strokeOpacity={0.6}
                animationDuration={1200}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
