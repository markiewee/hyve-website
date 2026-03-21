import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

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
  PENDING: "bg-gray-100 text-gray-600",
  PAID: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
  PARTIAL: "bg-yellow-100 text-yellow-700",
};

export default function AdminRentPage() {
  const [rentPayments, setRentPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // payment id being actioned

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

    // Secondary sort: within same month, sort by room unit_code
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

    // Get current month as "YYYY-MM-01"
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const monthStr = `${year}-${month}-01`;
    const dueDateStr = monthStr; // due on 1st of month

    // Fetch all active tenant_profiles with monthly_rent set
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
      setGenerateResult({ count: 0, message: "No active tenants with monthly rent configured." });
      setGenerating(false);
      return;
    }

    // Fetch existing rent_payments for this month to skip duplicates
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
        message: `Rent already generated for all ${profiles.length} tenant(s) this month.`,
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

  const isOverdue = (p) => p.status === "OVERDUE";

  return (
    <PortalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Rent Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate monthly rent records and track payment status across all tenants.
        </p>
      </div>

      {/* Generate Monthly Rent */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Generate Monthly Rent</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              onClick={handleGenerateThisMonth}
              disabled={generating}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity w-fit"
            >
              {generating ? "Generating…" : "Generate This Month's Rent"}
            </button>

            {generateResult && (
              <p
                className={`text-sm ${
                  generateResult.error ? "text-red-600" : "text-green-700"
                }`}
              >
                {generateResult.error ?? generateResult.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rent Payment Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Rent Payments</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />
              ))}
            </div>
          ) : rentPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">No rent payment records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                      Room
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                      Month
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                      Rent
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                      Late Fee
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                      Total
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                      Paid Date
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
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
                          isOverdue(p)
                            ? "bg-red-50/60 hover:bg-red-50"
                            : "hover:bg-muted/30"
                        }`}
                      >
                        <td className="px-4 py-3 font-mono text-xs font-medium">
                          {unitCode}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatMonth(p.month)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                          {formatSGD(p.rent_amount)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                          {lateFee > 0 ? (
                            <span className="text-red-600">{formatSGD(lateFee)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap font-semibold tabular-nums">
                          {formatSGD(total)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeClass}`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {formatDate(p.paid_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canMarkPaid && (
                              <button
                                onClick={() => handleMarkPaid(p)}
                                disabled={isActionLoading}
                                className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                              >
                                {isActionLoading ? "…" : "Mark Paid"}
                              </button>
                            )}
                            {canAddLateFee && (
                              <button
                                onClick={() => handleAddLateFee(p)}
                                disabled={isActionLoading}
                                className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                              >
                                {isActionLoading ? "…" : "Add Late Fee"}
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
        </CardContent>
      </Card>
    </PortalLayout>
  );
}
