import { Line, LineChart, ResponsiveContainer } from "recharts";

export function Sparkline({ data, id }: { data: number[]; id: string }) {
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={data.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line
          key={`spark-${id}`}
          type="monotone"
          dataKey="v"
          stroke="currentColor"
          strokeWidth={2.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
