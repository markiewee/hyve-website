import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

function formatSGD(amount) {
  return `$${Number(amount ?? 0).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function PropertyPerformanceCard({ property, investment, financial }) {
  const netProfit = Number(financial?.net_profit ?? 0);
  const isProfitable = netProfit >= 0;

  const revenue = Number(financial?.total_revenue ?? financial?.revenue ?? 0);
  const expenses = Number(financial?.total_expenses ?? financial?.expenses ?? 0);
  const sharePercent = Number(investment?.share_percentage ?? 0);
  const yourShare = (netProfit * sharePercent) / 100;

  const occupancyRate = financial?.occupancy_rate;

  return (
    <Card className="border-l-4 border-l-green-500">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{property?.name ?? "Property"}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {property?.code}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs font-medium bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
              {sharePercent.toFixed(1)}% ownership
            </span>
            {occupancyRate != null && (
              <p className="text-xs text-muted-foreground mt-1">
                Occupancy: {(Number(occupancyRate) * 100).toFixed(0)}%
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-center justify-between py-3 px-4 bg-muted/40 rounded-md">
          <p className="text-sm text-muted-foreground">Capital Contributed</p>
          <p className="text-lg font-bold tabular-nums text-[#121c2a]">
            SGD {formatSGD(investment?.capital_contributed)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
