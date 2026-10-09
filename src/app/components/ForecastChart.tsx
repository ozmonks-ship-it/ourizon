import { useMemo } from "react";
import {
  CartesianGrid,
  Label,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ForecastPoint } from "../lib/forecast";
import type { NetWorthPoint } from "@/lib/supabase/database.types";
import { fmt, fmtK } from "../lib/format";

interface ChartRow {
  t: number;
  recorded?: number;
  forecast?: number;
}

const toYearFraction = (date: Date) =>
  date.getFullYear() + (date.getMonth() + (date.getDate() - 1) / 31) / 12;

const AXIS_TICK = { fontSize: 12, fill: "var(--muted-foreground)", fontWeight: 600 };

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { dataKey: string; value: number; payload: ChartRow }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const recorded = row.recorded;
  const forecast = row.forecast;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm shadow-lg">
      <p className="font-bold text-foreground">{Math.floor(row.t)}</p>
      {recorded !== undefined && <p className="text-muted-foreground">Recorded: <span className="font-bold text-foreground">{fmt(recorded)}</span></p>}
      {forecast !== undefined && recorded === undefined && (
        <p className="text-muted-foreground">Forecast: <span className="font-bold text-foreground">{fmt(forecast)}</span></p>
      )}
    </div>
  );
}

/**
 * Recorded net worth (solid) followed by the savings forecast (dashed), with a
 * labelled "Today" line. The surrounding card provides the text alternative.
 */
export function ForecastChart({
  history,
  forecast,
  horizon,
  summary,
}: {
  history: NetWorthPoint[];
  forecast: ForecastPoint[];
  horizon: number;
  /** One-sentence description read by screen readers. */
  summary: string;
}) {
  const { rows, ticks, todayT, domainMax } = useMemo(() => {
    const todayT = toYearFraction(new Date());
    const recorded: ChartRow[] = history.map((point) => ({
      t: toYearFraction(new Date(point.recordedAt)),
      recorded: point.value,
    }));
    const future: ChartRow[] = forecast
      .slice(0, horizon + 1)
      .map((point, k) => ({ t: todayT + k, forecast: point.projected }));
    const rows = [...recorded, ...future].sort((a, b) => a.t - b.t);

    const minT = rows.length ? rows[0].t : todayT;
    const maxT = rows.length ? rows[rows.length - 1].t : todayT + horizon;
    const step = maxT - minT > 6 ? 2 : 1;
    const ticks: number[] = [];
    for (let year = Math.ceil(minT - 0.1); year <= Math.floor(maxT); year += step) ticks.push(year);

    const maxValue = Math.max(0, ...rows.map((row) => row.recorded ?? row.forecast ?? 0));
    return { rows, ticks, todayT, domainMax: Math.ceil((maxValue * 1.1) / 50_000) * 50_000 || 1000 };
  }, [history, forecast, horizon]);

  return (
    <div role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={rows} margin={{ top: 28, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            ticks={ticks}
            tickFormatter={(t: number) => String(t)}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, domainMax]}
            tickFormatter={fmtK}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip content={<ChartTooltip />} />
          <ReferenceLine x={todayT} stroke="var(--muted-foreground)" strokeDasharray="2 4">
            <Label value="Today" position="top" fill="var(--foreground)" fontSize={12} fontWeight={700} />
          </ReferenceLine>
          <Line
            type="monotone"
            dataKey="recorded"
            stroke="var(--primary)"
            strokeWidth={3}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="forecast"
            stroke="var(--primary)"
            strokeWidth={3}
            strokeDasharray="7 6"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-hidden="true">
      <span className="inline-flex items-center gap-2">
        <span className="inline-block w-6 border-t-[3px] border-primary" />
        Recorded
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="inline-block w-6 border-t-[3px] border-dashed border-primary" />
        Forecast
      </span>
    </div>
  );
}
