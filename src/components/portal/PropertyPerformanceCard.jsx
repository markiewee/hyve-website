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

  const revenue = Number(financial?.revenue ?? 0);
  const expenses = Number(financial?.expenses ?? 0);
  const sharePercent = Number(investment?.share_percentage ?? 0);
  const yourShare = (netProfit * sharePercent) / 100;

  const occupancyRate = financial?.occupancy_rate;

  return (
    <Card
      className={`border-l-4 ${
        isProfitable ? "border-l-green-500" : "border-l-red-500"
      }`}
    >
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
        {/* Financial row */}
        <div className="grid grid-cols-3 gap-2 text-center mb-4 py-3 bg-muted/40 rounded-md">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Revenue</p>
            <p className="text-sm font-semibold tabular-nums">{formatSGD(revenue)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Expenses</p>
            <p className="text-sm font-semibold tabular-nums text-red-600">
              {formatSGD(expenses)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Net Profit</p>
            <p
              className={`text-sm font-semibold tabular-nums ${
                isProfitable ? "text-green-700" : "text-red-600"
              }`}
            >
              {formatSGD(netProfit)}
            </p>
          </div>
        </div>

        {/* Your share */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Your Share ({sharePercent.toFixed(1)}%)</p>
          <p
            className={`text-sm font-bold tabular-nums ${
              yourShare >= 0 ? "text-green-700" : "text-red-600"
            }`}
          >
            SGD {formatSGD(yourShare)}
          </p>
        </div>

        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-muted-foreground">Capital Contributed</p>
          <p className="text-xs font-medium tabular-nums">
            SGD {formatSGD(investment?.capital_contributed)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
