import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

function formatMonth(monthStr) {
  if (!monthStr) return "—";
  const [year, month] = monthStr.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-SG", { month: "short", year: "numeric" });
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

  // Running cumulative (PAID only)
  let cumulative = 0;
  const rows = distributions.map((d) => {
    if (d.status === "PAID") cumulative += Number(d.amount ?? 0);
    return { ...d, _cumulative: cumulative };
  });

  const total = distributions.reduce((sum, d) => sum + Number(d.amount ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Distribution History</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                  Month
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                  Property
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                  Gross Profit
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                  Share %
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                  Amount
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                  Status
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                  Cumulative
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((d) => {
                const badgeClass = STATUS_BADGE[d.status] ?? STATUS_BADGE.PENDING;
                return (
                  <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatMonth(d.month)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {d.properties?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                      {d.gross_profit != null ? formatSGD(d.gross_profit) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                      {d.share_percentage != null
                        ? `${Number(d.share_percentage).toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums whitespace-nowrap">
                      {formatSGD(d.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeClass}`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                      {d.status === "PAID" ? formatSGD(d._cumulative) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-border bg-muted/30">
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-3 text-sm font-semibold text-right"
                >
                  Total
                </td>
                <td className="px-4 py-3 text-right font-bold tabular-nums whitespace-nowrap">
                  {formatSGD(total)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
