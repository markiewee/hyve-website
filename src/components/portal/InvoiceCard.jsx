const OVERAGE_RATE = 0.3;

const STATUS_BADGE = {
  PENDING: "bg-gray-100 text-gray-600",
  INVOICED: "bg-yellow-100 text-yellow-700",
  PAID: "bg-green-100 text-green-700",
};

function formatMonth(monthStr) {
  // monthStr is "YYYY-MM-DD" (first of month)
  const [year, month] = monthStr.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-SG", { month: "long", year: "numeric" });
}

export default function InvoiceCard({ invoice }) {
  const {
    month,
    total_hours = 0,
    overage_hours = 0,
    status = "PENDING",
    stripe_hosted_url,
  } = invoice;

  const amount = (overage_hours * OVERAGE_RATE).toFixed(2);
  const badgeClass = STATUS_BADGE[status] ?? STATUS_BADGE.PENDING;

  return (
    <div className="flex items-center justify-between py-4 border-b last:border-b-0">
      {/* Left: month + hours */}
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{formatMonth(month)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {total_hours.toFixed(1)}h total
          {overage_hours > 0 && (
            <span className="text-red-500 ml-1">· {overage_hours.toFixed(1)}h overage</span>
          )}
        </p>
      </div>

      {/* Right: amount + badge + action */}
      <div className="flex items-center gap-3 shrink-0 ml-4">
        <span className="text-sm font-semibold text-foreground">
          SGD ${amount}
        </span>

        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeClass}`}
        >
          {status}
        </span>

        {status === "INVOICED" && stripe_hosted_url && (
          <a
            href={stripe_hosted_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-3 py-1 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Pay Now
          </a>
        )}
      </div>
    </div>
  );
}
