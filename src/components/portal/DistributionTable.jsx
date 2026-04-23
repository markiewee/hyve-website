import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

function formatMonth(monthStr) {
  if (!monthStr) return "—";
  const [year, month] = monthStr.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-SG", { month: "short", year: "numeric" });
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}

function formatSGD(amount) {
  return `$${Number(amount ?? 0).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const STATUS_BADGE = {
  PAID: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
};

function DistributionRows({ items, showCumulative }) {
  // Pre-calculate cumulative from oldest to newest, then display in original (newest-first) order
  const cumulativeMap = {};
  let runningTotal = 0;
  const sorted = [...items].sort((a, b) => (a.month ?? "").localeCompare(b.month ?? ""));
  for (const d of sorted) {
    if (d.status === "PAID") runningTotal += Number(d.amount ?? 0);
    cumulativeMap[d.id] = runningTotal;
  }

  return items.map((d) => {
    const badgeClass = STATUS_BADGE[d.status] ?? STATUS_BADGE.PENDING;
    return (
      <tr key={d.id} className="hover:bg-muted/30 transition-colors">
        <td className="px-4 py-3 whitespace-nowrap">
          {formatMonth(d.month)}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          {d.properties?.name ?? "—"}
        </td>
        <td className="px-4 py-3 text-right font-semibold tabular-nums whitespace-nowrap">
          {formatSGD(d.amount)}
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeClass}`}>
            {d.status}
          </span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
          {d.paid_at ? formatDate(d.paid_at) : "—"}
        </td>
        <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
          {d.notes || "—"}
        </td>
        {showCumulative && (
          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground whitespace-nowrap">
            {d.status === "PAID" ? formatSGD(cumulativeMap[d.id]) : "—"}
          </td>
        )}
      </tr>
    );
  });
}

export default function DistributionTable({ distributions }) {
  if (!distributions || distributions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribution History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No distributions recorded yet.</p>
        </CardContent>
      </Card>
    );
  }

  const regular = distributions.filter((d) => d.type !== "ADHOC");
  const adhoc = distributions.filter((d) => d.type === "ADHOC");

  const regularTotal = regular.reduce((sum, d) => sum + Number(d.amount ?? 0), 0);
  const adhocTotal = adhoc.reduce((sum, d) => sum + Number(d.amount ?? 0), 0);

  return (
    <div className="space-y-8">
      {/* Regular Distributions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribution History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {regular.length === 0 ? (
            <div className="p-4">
              <p className="text-sm text-muted-foreground">No distributions yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Period</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Property</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Paid On</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Notes</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Cumulative</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <DistributionRows items={regular} showCumulative={true} />
                </tbody>
                <tfoot className="border-t border-border bg-muted/30">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-right">Total</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums whitespace-nowrap">{formatSGD(regularTotal)}</td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ad-hoc / Other Payments */}
      {adhoc.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">Other Payments</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Capital returns, partner exits, and other ad-hoc transactions</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Period</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Property</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Paid On</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <DistributionRows items={adhoc} showCumulative={false} />
                </tbody>
                <tfoot className="border-t border-border bg-muted/30">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-right">Total</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums whitespace-nowrap">{formatSGD(adhocTotal)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
