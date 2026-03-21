function formatMonth(monthStr) {
  // monthStr is "YYYY-MM-DD" (first of month)
  const [year, month] = monthStr.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-SG", { month: "long", year: "numeric" });
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatSGD(amount) {
  return `SGD $${Number(amount).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function daysBetween(dateA, dateB) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((dateB - dateA) / msPerDay);
}

const STATUS_BADGE = {
  PENDING: "bg-gray-100 text-gray-600",
  PAID: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
  PARTIAL: "bg-yellow-100 text-yellow-700",
};

export default function RentPaymentCard({ payment, lateFeePerDay = 5 }) {
  const {
    month,
    rent_amount,
    late_fee = 0,
    due_date,
    paid_at,
    paid_amount,
    is_late,
    status = "PENDING",
  } = payment;

  const badgeClass = STATUS_BADGE[status] ?? STATUS_BADGE.PENDING;

  // Calculate days overdue for OVERDUE status
  let daysOverdue = 0;
  let calculatedLateFee = late_fee;
  if (status === "OVERDUE" && due_date) {
    daysOverdue = daysBetween(new Date(due_date), new Date());
    if (daysOverdue < 0) daysOverdue = 0;
    calculatedLateFee = daysOverdue * lateFeePerDay;
  }

  // Calculate days late for PAID status
  let daysLate = 0;
  if (status === "PAID" && is_late && paid_at && due_date) {
    daysLate = daysBetween(new Date(due_date), new Date(paid_at));
    if (daysLate < 0) daysLate = 0;
  }

  return (
    <div className="flex items-start justify-between py-4 border-b last:border-b-0 gap-4">
      {/* Left: month + details */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{formatMonth(month)}</p>

        {status === "PAID" && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Paid {formatDate(paid_at)}
            {is_late ? (
              <span className="text-red-500 ml-1">· Late — {daysLate} day{daysLate !== 1 ? "s" : ""}</span>
            ) : (
              <span className="text-green-600 ml-1">· On time</span>
            )}
            {late_fee > 0 && (
              <span className="text-red-500 ml-1">· Late fee {formatSGD(late_fee)}</span>
            )}
          </p>
        )}

        {status === "OVERDUE" && due_date && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Due {formatDate(due_date)}
            {daysOverdue > 0 && (
              <span className="text-red-500 ml-1">· {daysOverdue} day{daysOverdue !== 1 ? "s" : ""} overdue</span>
            )}
            {calculatedLateFee > 0 && (
              <span className="text-red-500 ml-1">· Late fee {formatSGD(calculatedLateFee)}</span>
            )}
          </p>
        )}

        {status === "PARTIAL" && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Paid {formatSGD(paid_amount ?? 0)} of {formatSGD(rent_amount)}
          </p>
        )}

        {status === "PENDING" && due_date && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Due {formatDate(due_date)}
          </p>
        )}
      </div>

      {/* Right: amount + badge */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-semibold text-foreground">
          {formatSGD(rent_amount)}
        </span>

        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeClass}`}
        >
          {status}
        </span>
      </div>
    </div>
  );
}
