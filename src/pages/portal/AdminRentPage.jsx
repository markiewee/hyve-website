import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";

function formatMonth(monthStr) {
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
  if (amount == null) return "—";
  return `$${Number(amount).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function daysBetween(dateA, dateB) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.floor((dateB - dateA) / msPerDay));
}

const STATUS_BADGE = {
  PENDING: "bg-[#e6eeff] text-[#555f6f]",
  PAID: "bg-[#d1fae5] text-[#065f46]",
  OVERDUE: "bg-[#ffdad6] text-[#ba1a1a]",
  PARTIAL: "bg-amber-100 text-amber-700",
};

export default function AdminRentPage() {
  const [rentPayments, setRentPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchPayments = useCallback(async () => {
    const { data, error } = await supabase
      .from("rent_payments")
      .select(
        `id, tenant_profile_id, room_id, month, rent_amount, late_fee, due_date,
         paid_at, paid_amount, payment_method, is_late, status, notes, created_at,
         tenant_profiles(id, monthly_rent, late_fee_per_day, rooms(unit_code))`
      )
      .order("month", { ascending: false });

    if (error) {
      console.error("Error fetching rent payments:", error);
      return;
    }

    const sorted = (data ?? []).slice().sort((a, b) => {
      if (a.month !== b.month) return a.month > b.month ? -1 : 1;
      const ua = a.tenant_profiles?.rooms?.unit_code ?? "";
      const ub = b.tenant_profiles?.rooms?.unit_code ?? "";
      return ua.localeCompare(ub);
    });

    setRentPayments(sorted);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  async function handleGenerateThisMonth() {
    setGenerating(true);
    setGenerateResult(null);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const monthStr = `${year}-${month}-01`;
    const dueDateStr = monthStr;

    const { data: profiles, error: profilesError } = await supabase
      .from("tenant_profiles")
      .select("id, monthly_rent, late_fee_per_day, room_id")
      .eq("is_active", true)
      .not("monthly_rent", "is", null)
      .gt("monthly_rent", 0);

    if (profilesError) {
      console.error("Error fetching tenant profiles:", profilesError);
      setGenerateResult({ error: "Failed to fetch tenant profiles." });
      setGenerating(false);
      return;
    }

    if (!profiles || profiles.length === 0) {
      setGenerateResult({ count: 0, message: "No active members with monthly rent configured." });
      setGenerating(false);
      return;
    }

    const { data: existing, error: existingError } = await supabase
      .from("rent_payments")
      .select("tenant_profile_id")
      .eq("month", monthStr);

    if (existingError) {
      console.error("Error checking existing payments:", existingError);
      setGenerateResult({ error: "Failed to check existing records." });
      setGenerating(false);
      return;
    }

    const existingSet = new Set((existing ?? []).map((r) => r.tenant_profile_id));

    const toInsert = profiles
      .filter((p) => !existingSet.has(p.id))
      .map((p) => ({
        tenant_profile_id: p.id,
        room_id: p.room_id,
        month: monthStr,
        rent_amount: p.monthly_rent,
        late_fee: 0,
        due_date: dueDateStr,
        status: "PENDING",
        is_late: false,
      }));

    if (toInsert.length === 0) {
      setGenerateResult({
        count: 0,
        message: `Rent already generated for all ${profiles.length} member(s) this month.`,
      });
      setGenerating(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("rent_payments")
      .insert(toInsert);

    if (insertError) {
      console.error("Error inserting rent payments:", insertError);
      setGenerateResult({ error: "Failed to generate rent payments." });
      setGenerating(false);
      return;
    }

    setGenerateResult({
      count: toInsert.length,
      message: `Generated ${toInsert.length} rent record${toInsert.length !== 1 ? "s" : ""} for ${formatMonth(monthStr)}.`,
    });
    setGenerating(false);
    fetchPayments();
  }

  async function handleMarkPaid(payment) {
    if (!confirm("Are you sure you want to mark this payment as paid?")) return;
    setActionLoading(payment.id);

    const now = new Date();
    const dueDate = payment.due_date ? new Date(payment.due_date) : null;
    const isLate = dueDate ? now > dueDate : false;
    const daysLate = isLate && dueDate ? daysBetween(dueDate, now) : 0;
    const lateFeePerDay = payment.tenant_profiles?.late_fee_per_day ?? 5;
    const lateFee = isLate ? daysLate * lateFeePerDay : 0;
    const totalAmount = Number(payment.rent_amount) + lateFee;

    const { error } = await supabase
      .from("rent_payments")
      .update({
        status: "PAID",
        paid_at: now.toISOString(),
        paid_amount: totalAmount,
        is_late: isLate,
        late_fee: lateFee,
      })
      .eq("id", payment.id);

    if (error) {
      console.error("Error marking payment as paid:", error);
    } else {
      setRentPayments((prev) =>
        prev.map((p) =>
          p.id === payment.id
            ? {
                ...p,
                status: "PAID",
                paid_at: now.toISOString(),
                paid_amount: totalAmount,
                is_late: isLate,
                late_fee: lateFee,
              }
            : p
        )
      );
    }

    setActionLoading(null);
  }

  async function handleAddLateFee(payment) {
    if (!confirm("Are you sure you want to add a late fee?")) return;
    setActionLoading(payment.id);

    const dueDate = payment.due_date ? new Date(payment.due_date) : null;
    if (!dueDate) {
      setActionLoading(null);
      return;
    }

    const now = new Date();
    const daysOverdue = daysBetween(dueDate, now);
    const lateFeePerDay = payment.tenant_profiles?.late_fee_per_day ?? 5;
    const newLateFee = daysOverdue * lateFeePerDay;

    const { error } = await supabase
      .from("rent_payments")
      .update({
        late_fee: newLateFee,
        status: "OVERDUE",
        is_late: true,
      })
      .eq("id", payment.id);

    if (error) {
      console.error("Error adding late fee:", error);
    } else {
      setRentPayments((prev) =>
        prev.map((p) =>
          p.id === payment.id
            ? { ...p, late_fee: newLateFee, status: "OVERDUE", is_late: true }
            : p
        )
      );
    }

    setActionLoading(null);
  }

  const pendingCount = rentPayments.filter((p) => p.status === "PENDING").length;
  const overdueCount = rentPayments.filter((p) => p.status === "OVERDUE").length;
  const paidCount = rentPayments.filter((p) => p.status === "PAID").length;
  const totalCollected = rentPayments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + (Number(p.paid_amount) || 0), 0);

  return (
    <PortalLayout>
      {/* Page header */}
      <div className="mb-10">
        <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
          Rent Management
        </h1>
        <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">
          Generate monthly rent records and track payment status.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">Pending</p>
          {loading ? (
            <div className="h-8 w-8 bg-[#eff4ff] animate-pulse rounded" />
          ) : (
            <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a]">{pendingCount}</p>
          )}
        </div>
        <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">Overdue</p>
          {loading ? (
            <div className="h-8 w-8 bg-[#eff4ff] animate-pulse rounded" />
          ) : (
            <p className={`font-['Plus_Jakarta_Sans'] text-3xl font-extrabold ${overdueCount > 0 ? "text-[#ba1a1a]" : "text-[#121c2a]"}`}>
              {overdueCount}
            </p>
          )}
        </div>
        <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">Paid</p>
          {loading ? (
            <div className="h-8 w-8 bg-[#eff4ff] animate-pulse rounded" />
          ) : (
            <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#006b5f]">{paidCount}</p>
          )}
        </div>
        <div className="bg-[#006b5f] rounded-2xl p-6">
          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#71f8e4]/80 font-bold mb-3">Collected</p>
          {loading ? (
            <div className="h-8 w-20 bg-white/10 animate-pulse rounded" />
          ) : (
            <p className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-white">
              {formatSGD(totalCollected)}
            </p>
          )}
        </div>
      </div>

      {/* Generate button */}
      <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm mb-8 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="font-['Manrope'] font-bold text-[#121c2a] text-sm">Generate Monthly Rent</p>
          <p className="font-['Manrope'] text-[#6c7a77] text-xs mt-0.5">
            Create rent records for all active tenants for the current month.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {generateResult && (
            <p className={`font-['Manrope'] text-sm ${generateResult.error ? "text-[#ba1a1a]" : "text-[#006b5f]"}`}>
              {generateResult.error ?? generateResult.message}
            </p>
          )}
          <button
            onClick={handleGenerateThisMonth}
            disabled={generating}
            className="px-6 py-3 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            {generating ? "Generating…" : "Generate This Month"}
          </button>
        </div>
      </div>

      {/* Rent Payment Table */}
      <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-[#bbcac6]/15">
          <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#121c2a]">
            All Rent Payments
          </h2>
        </div>

        {loading ? (
          <div className="divide-y divide-[#bbcac6]/10">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="px-8 py-5 flex items-center gap-4">
                <div className="h-4 w-16 bg-[#eff4ff] animate-pulse rounded" />
                <div className="h-4 w-24 bg-[#eff4ff] animate-pulse rounded" />
                <div className="h-4 w-20 bg-[#eff4ff] animate-pulse rounded ml-auto" />
                <div className="h-5 w-16 bg-[#eff4ff] animate-pulse rounded-full" />
              </div>
            ))}
          </div>
        ) : rentPayments.length === 0 ? (
          <div className="px-8 py-12 text-center">
            <p className="text-[#6c7a77] font-['Manrope'] text-sm">No rent payment records yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#eff4ff]">
                <tr>
                  <th className="text-left px-8 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold whitespace-nowrap">Room</th>
                  <th className="text-left px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold whitespace-nowrap">Month</th>
                  <th className="text-right px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold whitespace-nowrap">Rent</th>
                  <th className="text-right px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold whitespace-nowrap">Late Fee</th>
                  <th className="text-right px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold whitespace-nowrap">Total</th>
                  <th className="text-left px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold whitespace-nowrap">Status</th>
                  <th className="text-left px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold whitespace-nowrap hidden md:table-cell">Paid Date</th>
                  <th className="px-4 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#bbcac6]/10">
                {rentPayments.map((p) => {
                  const unitCode = p.tenant_profiles?.rooms?.unit_code ?? "—";
                  const lateFee = p.late_fee ?? 0;
                  const total = Number(p.rent_amount) + Number(lateFee);
                  const badgeClass = STATUS_BADGE[p.status] ?? STATUS_BADGE.PENDING;
                  const isActionLoading = actionLoading === p.id;
                  const canMarkPaid = p.status === "PENDING" || p.status === "OVERDUE";
                  const canAddLateFee =
                    (p.status === "PENDING" || p.status === "OVERDUE") &&
                    p.due_date &&
                    new Date(p.due_date) < new Date();

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${
                        p.status === "OVERDUE"
                          ? "bg-[#ffdad6]/20 hover:bg-[#ffdad6]/30"
                          : "hover:bg-[#f8f9ff]"
                      }`}
                    >
                      <td className="px-8 py-4">
                        <span className="font-['Inter'] text-xs font-bold text-[#006b5f] bg-[#eff4ff] px-2 py-1 rounded">
                          {unitCode}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-['Manrope'] text-sm text-[#121c2a] whitespace-nowrap">
                        {formatMonth(p.month)}
                      </td>
                      <td className="px-4 py-4 text-right font-['Manrope'] font-medium text-sm whitespace-nowrap tabular-nums">
                        {formatSGD(p.rent_amount)}
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap tabular-nums">
                        {lateFee > 0 ? (
                          <span className="font-['Manrope'] text-sm font-medium text-[#ba1a1a]">{formatSGD(lateFee)}</span>
                        ) : (
                          <span className="text-[#bbcac6]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap font-['Plus_Jakarta_Sans'] font-bold text-sm tabular-nums">
                        {formatSGD(total)}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${badgeClass}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-['Manrope'] text-sm text-[#6c7a77] whitespace-nowrap hidden md:table-cell">
                        {formatDate(p.paid_at)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canMarkPaid && (
                            <button
                              onClick={() => handleMarkPaid(p)}
                              disabled={isActionLoading}
                              className="text-xs px-3 py-1.5 rounded-lg bg-[#006b5f] text-white hover:opacity-90 disabled:opacity-50 transition-all font-['Manrope'] font-bold whitespace-nowrap"
                            >
                              {isActionLoading ? "…" : "Mark Paid"}
                            </button>
                          )}
                          {canAddLateFee && (
                            <button
                              onClick={() => handleAddLateFee(p)}
                              disabled={isActionLoading}
                              className="text-xs px-3 py-1.5 rounded-lg bg-[#ffdad6] text-[#ba1a1a] hover:bg-[#ba1a1a] hover:text-white disabled:opacity-50 transition-all font-['Manrope'] font-bold whitespace-nowrap"
                            >
                              {isActionLoading ? "…" : "Late Fee"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
