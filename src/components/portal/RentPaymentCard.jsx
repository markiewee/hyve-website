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

  const statusIcon = status === "PAID" ? "check_circle" : status === "OVERDUE" ? "error" : "schedule";
  const iconColor = status === "PAID" ? "text-green-500" : status === "OVERDUE" ? "text-red-500" : "text-[#006b5f]";

  return (
    <div className="flex items-center gap-4 px-6 py-5">
      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        status === "PAID" ? "bg-green-50" : status === "OVERDUE" ? "bg-red-50" : "bg-[#eff4ff]"
      }`}>
        <span className={`material-symbols-outlined text-[20px] ${iconColor}`} style={{ fontVariationSettings: "'FILL' 1" }}>
          {statusIcon}
        </span>
      </div>

      {/* Details */}
      <div className="min-w-0 flex-1">
        <p className="font-['Manrope'] font-bold text-sm text-[#121c2a]">{formatMonth(month)}</p>
        <p className="font-['Inter'] text-xs text-[#6c7a77] mt-0.5">
          {status === "PAID" && (
            <>
              Paid {formatDate(paid_at)}
              {is_late ? (
                <span className="text-red-500 ml-1">· {daysLate}d late</span>
              ) : (
                <span className="text-green-600 ml-1">· On time</span>
              )}
            </>
          )}
          {status === "OVERDUE" && due_date && (
            <>
              Due {formatDate(due_date)}
              {daysOverdue > 0 && <span className="text-red-500 ml-1">· {daysOverdue}d overdue</span>}
            </>
          )}
          {status === "PENDING" && due_date && <>Due {formatDate(due_date)}</>}
          {status === "PARTIAL" && <>Paid {formatSGD(paid_amount ?? 0)} of {formatSGD(rent_amount)}</>}
        </p>
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <p className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a]">{formatSGD(rent_amount)}</p>
        {(late_fee > 0 || calculatedLateFee > 0) && (
          <p className="font-['Inter'] text-[10px] text-red-500">+{formatSGD(calculatedLateFee || late_fee)} late fee</p>
        )}
      </div>

      {/* Badge */}
      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-['Inter'] font-bold uppercase tracking-wider shrink-0 ${badgeClass}`}>
        {status}
      </span>
    </div>
  );
}
