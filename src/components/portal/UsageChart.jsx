import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const VIEWS = ["day", "month", "year"];
const VIEW_LABELS = { day: "Day", month: "Month", year: "Year" };

// Reference lines per view
const REF_LINES = {
  day: null, // no meaningful daily ref
  month: { y: 10, label: "~10h/day avg" }, // 300h / 30 days
  year: { y: 300, label: "300h free" },
};

export default function UsageChart({
  view,
  setView,
  chartData,
  totalHours,
  avgHours,
  periodLabel,
  avgLabel,
  goBack,
  goForward,
  canGoForward,
}) {
  const ref = REF_LINES[view];

  return (
    <div>
      {/* View toggle */}
      <div className="flex justify-center mb-4">
        <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === v
                  ? "bg-black text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex justify-center gap-12 mb-4">
        <div className="text-center">
          <p className="text-2xl font-bold">{totalHours}</p>
          <p className="text-xs text-muted-foreground">Total(h)</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold">{avgHours}</p>
          <p className="text-xs text-muted-foreground">{avgLabel}</p>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={chartData}
          margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
        >
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            interval={view === "day" ? 2 : 0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            unit="h"
          />
          <Tooltip
            formatter={(value) => [`${value}h`, "AC Runtime"]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          {ref && (
            <ReferenceLine
              y={ref.y}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{
                value: ref.label,
                position: "right",
                fontSize: 10,
                fill: "#f59e0b",
              }}
            />
          )}
          <Bar
            dataKey="hours"
            radius={[3, 3, 0, 0]}
            fill="#22c55e"
            maxBarSize={view === "year" ? 48 : view === "month" ? 20 : 16}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Period navigation */}
      <div className="flex items-center justify-center gap-4 mt-3">
        <button
          onClick={goBack}
          className="text-gray-400 hover:text-gray-700 text-lg px-2"
        >
          &lt;
        </button>
        <span className="text-sm text-muted-foreground min-w-[100px] text-center">
          {periodLabel}
        </span>
        <button
          onClick={goForward}
          disabled={!canGoForward}
          className={`text-lg px-2 ${
            canGoForward
              ? "text-gray-400 hover:text-gray-700"
              : "text-gray-200 cursor-not-allowed"
          }`}
        >
          &gt;
        </button>
      </div>
    </div>
  );
}
