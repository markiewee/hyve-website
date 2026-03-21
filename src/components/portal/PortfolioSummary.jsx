import { Card, CardContent } from "../ui/card";

function formatSGD(amount) {
  return `SGD $${Number(amount ?? 0).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function StatCard({ label, value, loading }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        {loading ? (
          <div className="h-7 w-32 bg-gray-100 animate-pulse rounded" />
        ) : (
          <p className="text-2xl font-bold tabular-nums">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function PortfolioSummary({
  totalCapital,
  thisMonthDistribution,
  totalDistributions,
  returnRate,
  loading,
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard
        label="Total Capital Invested"
        value={formatSGD(totalCapital)}
        loading={loading}
      />
      <StatCard
        label="This Month's Distribution"
        value={formatSGD(thisMonthDistribution)}
        loading={loading}
      />
      <StatCard
        label="Cumulative Returns"
        value={formatSGD(totalDistributions)}
        loading={loading}
      />
      <StatCard
        label="Return Rate"
        value={`${Number(returnRate ?? 0).toFixed(1)}%`}
        loading={loading}
      />
    </div>
  );
}
