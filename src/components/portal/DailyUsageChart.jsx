import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const DAILY_AVG_FREE = 300 / 30; // ~10h/day average for free tier

export default function DailyUsageChart({ data }) {
  if (!data || data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          unit="h"
        />
        <Tooltip
          formatter={(value) => [`${value}h`, "AC Runtime"]}
          labelFormatter={(day) => `Day ${day}`}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <ReferenceLine
          y={DAILY_AVG_FREE}
          stroke="#f59e0b"
          strokeDasharray="4 4"
          label={{
            value: "~10h/day avg",
            position: "right",
            fontSize: 10,
            fill: "#f59e0b",
          }}
        />
        <Bar
          dataKey="hours"
          radius={[3, 3, 0, 0]}
          fill="#22c55e"
          maxBarSize={24}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
