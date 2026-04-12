import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { aspire } from "../../lib/aspire";
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

const CHARGE_CATEGORIES = ["STAMPING", "KEY_REPLACEMENT", "DAMAGE", "CLEANING", "LATE_CHECKOUT", "AC_OVERAGE", "OTHER"];

const CHARGE_STATUS_BADGE = {
  PENDING: "bg-amber-100 text-amber-700",
  PAID: "bg-[#d1fae5] text-[#065f46]",
};

export default function AdminRentPage() {
  const [rentPayments, setRentPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [paymentForm, setPaymentForm] = useState(null); // { id, paid_amount, paid_at, payment_method }

  // Ad-hoc charges state
  const [members, setMembers] = useState([]);
  const [charges, setCharges] = useState([]);
  const [chargesLoading, setChargesLoading] = useState(true);
  const [chargeForm, setChargeForm] = useState({ tenant_profile_id: "", description: "", amount: "", due_date: "", category: "OTHER" });
  const [chargeSaving, setChargeSaving] = useState(false);
  const [chargeActionLoading, setChargeActionLoading] = useState(null);

  // Reconciliation state
  const [aspireTransactions, setAspireTransactions] = useState([]);
  const [aspireLoading, setAspireLoading] = useState(false);
  const [aspireError, setAspireError] = useState(null);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [matchedPairs, setMatchedPairs] = useState([]);
  const [reconcileMonth, setReconcileMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const fetchPayments = useCallback(async () => {
    const { data, error } = await supabase
      .from("rent_payments")
      .select(
        `id, tenant_profile_id, room_id, month, rent_amount, late_fee, due_date,
         paid_at, paid_amount, payment_method, is_late, status, notes, created_at,
         tenant_profiles(id, monthly_rent, late_fee_per_day, username, rooms(unit_code), tenant_details(full_name))`
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

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase
      .from("tenant_profiles")
      .select("id, username, full_name, rooms(unit_code)")
      .eq("is_active", true)
      .order("username");
    setMembers(data ?? []);
  }, []);

  const fetchCharges = useCallback(async () => {
    const { data, error } = await supabase
      .from("member_charges")
      .select("*, tenant_profiles(username, rooms(unit_code))")
      .order("created_at", { ascending: false });
    if (!error) setCharges(data ?? []);
    setChargesLoading(false);
  }, []);

  async function handleFetchAspire() {
    setAspireLoading(true);
    setAspireError(null);
    try {
      const accounts = await aspire.getAccounts();
      if (!accounts.length) throw new Error("No Aspire accounts found");
      const accountId = accounts[0].id ?? accounts[0].account_id ?? accounts[0].accountId;
      const [year, month] = reconcileMonth.split("-");
      const from_date = `${year}-${month}-01`;
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const to_date = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
      const txns = await aspire.getTransactions(accountId, { from_date, to_date });
      const credits = txns.filter(t => t.transaction_type === "INCOME" && t.amount > 0);
      setAspireTransactions(credits);
    } catch (err) {
      console.error("Aspire fetch error:", err);
      setAspireError(err.message);
    }
    setAspireLoading(false);
  }

  async function handleMatch(rentPayment) {
    if (!selectedTxn) return;
    const { error } = await supabase
      .from("rent_payments")
      .update({
        status: "PAID",
        paid_at: selectedTxn.transaction_date,
        paid_amount: rentPayment.rent_amount,
        payment_reference: selectedTxn.reference,
        payment_method: "PAYNOW",
      })
      .eq("id", rentPayment.id);
    if (error) { console.error("Match error:", error); return; }
    setMatchedPairs(prev => [...prev, {
      rentPaymentId: rentPayment.id,
      transactionRef: selectedTxn.reference,
      tenantName: rentPayment.tenant_profiles?.tenant_details?.full_name || rentPayment.tenant_profiles?.username || "—",
      unitCode: rentPayment.tenant_profiles?.rooms?.unit_code || "—",
      rentAmount: rentPayment.rent_amount,
      txnAmount: selectedTxn.amount,
      txnDate: selectedTxn.transaction_date,
      txnDescription: selectedTxn.description,
    }]);
    setAspireTransactions(prev => prev.filter(t => t.reference !== selectedTxn.reference));
    setRentPayments(prev => prev.map(p =>
      p.id === rentPayment.id
        ? { ...p, status: "PAID", paid_at: selectedTxn.transaction_date, paid_amount: p.rent_amount, payment_method: "PAYNOW", payment_reference: selectedTxn.reference }
        : p
    ));
    setSelectedTxn(null);
  }

  async function handleUnmatch(pair) {
    const { error } = await supabase
      .from("rent_payments")
      .update({ status: "PENDING", paid_at: null, paid_amount: null, payment_reference: null, payment_method: null })
      .eq("id", pair.rentPaymentId);
    if (error) { console.error("Unmatch error:", error); return; }
    setAspireTransactions(prev => [...prev, {
      transaction_date: pair.txnDate, description: pair.txnDescription,
      amount: pair.txnAmount, reference: pair.transactionRef, transaction_type: "INCOME",
    }]);
    setRentPayments(prev => prev.map(p =>
      p.id === pair.rentPaymentId
        ? { ...p, status: "PENDING", paid_at: null, paid_amount: null, payment_method: null, payment_reference: null }
        : p
    ));
    setMatchedPairs(prev => prev.filter(mp => mp.rentPaymentId !== pair.rentPaymentId));
  }

  useEffect(() => {
    fetchPayments();
    fetchMembers();
    fetchCharges();
  }, [fetchPayments, fetchMembers, fetchCharges]);

  async function handleGenerateThisMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const monthStr = `${year}-${month}-01`;
    const dueDateStr = monthStr;

    // Check if rent records already exist for this month before confirming
    const { data: existingCheck } = await supabase
      .from("rent_payments")
      .select("id")
      .eq("month", monthStr)
      .limit(1);

    if (existingCheck && existingCheck.length > 0) {
      if (!window.confirm(
        `Rent records already exist for ${formatMonth(monthStr)}. Do you want to continue and generate records for any remaining tenants?`
      )) return;
    } else {
      if (!window.confirm(
        `Generate rent records for all active tenants for ${formatMonth(monthStr)}?`
      )) return;
    }

    setGenerating(true);
    setGenerateResult(null);

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

  function openPaymentForm(payment) {
    setPaymentForm({
      id: payment.id,
      paid_amount: String(payment.rent_amount),
      paid_at: new Date().toISOString().split("T")[0],
      payment_method: "PAYNOW",
    });
  }

  async function handleConfirmPayment(payment) {
    if (!paymentForm) return;
    setActionLoading(payment.id);

    const paidAmount = Number(paymentForm.paid_amount);
    const paidAt = new Date(paymentForm.paid_at);
    const dueDate = payment.due_date ? new Date(payment.due_date) : null;
    const isLate = dueDate ? paidAt > dueDate : false;
    const daysLate = isLate && dueDate ? daysBetween(dueDate, paidAt) : 0;
    const lateFeePerDay = payment.tenant_profiles?.late_fee_per_day ?? 5;
    const lateFee = isLate ? daysLate * lateFeePerDay : 0;
    const isPartial = paidAmount < Number(payment.rent_amount);

    const { error } = await supabase
      .from("rent_payments")
      .update({
        status: isPartial ? "PARTIAL" : "PAID",
        paid_at: paidAt.toISOString(),
        paid_amount: paidAmount,
        payment_method: paymentForm.payment_method,
        is_late: isLate,
        late_fee: lateFee,
      })
      .eq("id", payment.id);

    if (error) {
      console.error("Error recording payment:", error);
    } else {
      setRentPayments((prev) =>
        prev.map((p) =>
          p.id === payment.id
            ? {
                ...p,
                status: isPartial ? "PARTIAL" : "PAID",
                paid_at: paidAt.toISOString(),
                paid_amount: paidAmount,
                payment_method: paymentForm.payment_method,
                is_late: isLate,
                late_fee: lateFee,
              }
            : p
        )
      );
      setPaymentForm(null);
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

  async function handleCreateCharge() {
    if (!chargeForm.tenant_profile_id) { alert("Select a member."); return; }
    if (!chargeForm.description.trim()) { alert("Description is required."); return; }
    if (!chargeForm.amount || isNaN(Number(chargeForm.amount)) || Number(chargeForm.amount) <= 0) { alert("Enter a valid amount."); return; }
    setChargeSaving(true);
    const { error } = await supabase.from("member_charges").insert({
      tenant_profile_id: chargeForm.tenant_profile_id,
      description: chargeForm.description.trim(),
      amount: Number(chargeForm.amount),
      due_date: chargeForm.due_date || new Date().toISOString().split("T")[0],
      category: chargeForm.category,
      status: "PENDING",
    });
    if (error) {
      alert("Failed to create charge: " + error.message);
    } else {
      setChargeForm({ tenant_profile_id: "", description: "", amount: "", due_date: "", category: "OTHER" });
      await fetchCharges();
    }
    setChargeSaving(false);
  }

  async function handleMarkChargePaid(chargeId) {
    if (!confirm("Mark this charge as paid?")) return;
    setChargeActionLoading(chargeId);
    const { error } = await supabase.from("member_charges").update({ status: "PAID", paid_at: new Date().toISOString() }).eq("id", chargeId);
    if (!error) {
      setCharges(prev => prev.map(c => c.id === chargeId ? { ...c, status: "PAID", paid_at: new Date().toISOString() } : c));
    }
    setChargeActionLoading(null);
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
                  <th className="text-left px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold whitespace-nowrap">Tenant</th>
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
                  const tp = p.tenant_profiles;
                  const unitCode = tp?.rooms?.unit_code ?? "—";
                  const tenantName = tp?.tenant_details?.full_name || tp?.username || "—";
                  const lateFee = p.late_fee ?? 0;
                  const showForm = paymentForm?.id === p.id;
                  const total = Number(p.rent_amount) + Number(lateFee);
                  const badgeClass = STATUS_BADGE[p.status] ?? STATUS_BADGE.PENDING;
                  const isActionLoading = actionLoading === p.id;
                  const canMarkPaid = p.status === "PENDING" || p.status === "OVERDUE";
                  const canAddLateFee =
                    (p.status === "PENDING" || p.status === "OVERDUE") &&
                    p.due_date &&
                    new Date(p.due_date) < new Date();

                  return (
                    <React.Fragment key={p.id}>
                    <tr
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
                      <td className="px-4 py-4 font-['Manrope'] text-sm text-[#121c2a] whitespace-nowrap truncate max-w-[120px]" title={tenantName}>
                        {tenantName}
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
                          {canMarkPaid && !showForm && (
                            <button
                              onClick={() => openPaymentForm(p)}
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
                    {showForm && (
                      <tr className="bg-[#f0fdf4]">
                        <td colSpan={9} className="px-8 py-4">
                          <div className="flex flex-wrap items-end gap-4">
                            <div>
                              <label className="block text-[10px] font-['Inter'] font-bold uppercase tracking-widest text-[#6c7a77] mb-1">Amount Received</label>
                              <input
                                type="number"
                                step="0.01"
                                value={paymentForm.paid_amount}
                                onChange={(e) => setPaymentForm(f => ({ ...f, paid_amount: e.target.value }))}
                                className="w-32 px-3 py-2 rounded-lg border border-[#bbcac6]/30 text-sm font-['Manrope'] font-semibold"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-['Inter'] font-bold uppercase tracking-widest text-[#6c7a77] mb-1">Date Received</label>
                              <input
                                type="date"
                                value={paymentForm.paid_at}
                                onChange={(e) => setPaymentForm(f => ({ ...f, paid_at: e.target.value }))}
                                className="px-3 py-2 rounded-lg border border-[#bbcac6]/30 text-sm font-['Manrope']"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-['Inter'] font-bold uppercase tracking-widest text-[#6c7a77] mb-1">Method</label>
                              <select
                                value={paymentForm.payment_method}
                                onChange={(e) => setPaymentForm(f => ({ ...f, payment_method: e.target.value }))}
                                className="px-3 py-2 rounded-lg border border-[#bbcac6]/30 text-sm font-['Manrope']"
                              >
                                <option value="PAYNOW">PayNow</option>
                                <option value="BANK_TRANSFER">Bank Transfer</option>
                                <option value="CASH">Cash</option>
                                <option value="OTHER">Other</option>
                              </select>
                            </div>
                            <button
                              onClick={() => handleConfirmPayment(p)}
                              disabled={isActionLoading}
                              className="px-4 py-2 rounded-lg bg-[#006b5f] text-white text-sm font-['Manrope'] font-bold hover:opacity-90 disabled:opacity-50"
                            >
                              {isActionLoading ? "Saving…" : "Confirm Payment"}
                            </button>
                            <button
                              onClick={() => setPaymentForm(null)}
                              className="px-4 py-2 rounded-lg border border-[#bbcac6]/30 text-sm font-['Manrope'] font-semibold text-[#6c7a77] hover:bg-white"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* ── Reconciliation Panel ── */}
      <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden mt-8">
        <div className="px-8 py-6 border-b border-[#bbcac6]/15 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#121c2a]">Reconcile with Aspire</h2>
            <p className="font-['Manrope'] text-[#6c7a77] text-xs mt-0.5">Match incoming bank transfers to tenant rent records.</p>
          </div>
          <div className="flex items-center gap-3">
            <input type="month" value={reconcileMonth} onChange={(e) => setReconcileMonth(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[#bbcac6]/30 text-sm font-['Manrope'] focus:outline-none focus:ring-2 focus:ring-[#006b5f]" />
            <button onClick={handleFetchAspire} disabled={aspireLoading}
              className="px-5 py-2.5 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 shrink-0">
              <span className="material-symbols-outlined text-[18px]">account_balance</span>
              {aspireLoading ? "Fetching…" : "Fetch Aspire"}
            </button>
          </div>
        </div>

        {aspireError && (
          <div className="px-8 py-3 bg-[#ffdad6]/30 text-[#ba1a1a] font-['Manrope'] text-sm">{aspireError}</div>
        )}

        {selectedTxn && (
          <div className="px-8 py-3 bg-[#d1fae5] font-['Manrope'] text-sm text-[#065f46] flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            Selected: {selectedTxn.description} — {formatSGD(selectedTxn.amount)} ({selectedTxn.transaction_date})
            <button onClick={() => setSelectedTxn(null)} className="ml-auto text-xs underline">Cancel</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#bbcac6]/15">
          {/* LEFT: Unpaid Rent */}
          <div className="p-6">
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-4">
              Unpaid Rent ({rentPayments.filter(p => p.status === "PENDING" || p.status === "OVERDUE").length})
            </p>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {rentPayments
                .filter(p => p.status === "PENDING" || p.status === "OVERDUE")
                .map(p => {
                  const tp = p.tenant_profiles;
                  const unitCode = tp?.rooms?.unit_code ?? "—";
                  const name = tp?.tenant_details?.full_name || tp?.username || "—";
                  return (
                    <button key={p.id} onClick={() => selectedTxn ? handleMatch(p) : null} disabled={!selectedTxn}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3 ${
                        selectedTxn ? "border-[#14b8a6] hover:bg-[#006b5f]/5 cursor-pointer" : "border-[#bbcac6]/15 opacity-60 cursor-default"
                      }`}>
                      <span className="font-['Inter'] text-xs font-bold text-[#006b5f] bg-[#eff4ff] px-2 py-1 rounded shrink-0">{unitCode}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-['Manrope'] text-sm font-semibold text-[#121c2a] truncate">{name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-['Plus_Jakarta_Sans'] font-bold text-sm tabular-nums">{formatSGD(p.rent_amount)}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${STATUS_BADGE[p.status]}`}>{p.status}</span>
                      </div>
                    </button>
                  );
                })}
              {rentPayments.filter(p => p.status === "PENDING" || p.status === "OVERDUE").length === 0 && (
                <p className="text-center text-[#6c7a77] font-['Manrope'] text-sm py-8">All rent paid!</p>
              )}
            </div>
          </div>

          {/* RIGHT: Aspire Transactions */}
          <div className="p-6">
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-4">
              Aspire Incoming ({aspireTransactions.length})
            </p>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {aspireTransactions.map((txn, idx) => {
                const isSelected = selectedTxn?.reference === txn.reference;
                return (
                  <button key={txn.reference || idx} onClick={() => setSelectedTxn(isSelected ? null : txn)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3 ${
                      isSelected ? "border-[#14b8a6] ring-2 ring-[#14b8a6] bg-[#006b5f]/5" : "border-[#bbcac6]/15 hover:border-[#14b8a6] hover:bg-[#f8f9ff]"
                    }`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-['Manrope'] text-sm font-semibold text-[#121c2a] truncate">{txn.description || "Unknown"}</p>
                      <p className="font-['Manrope'] text-xs text-[#6c7a77]">{txn.transaction_date}</p>
                    </div>
                    <p className="font-['Plus_Jakarta_Sans'] font-bold text-sm tabular-nums text-[#006b5f] shrink-0">{formatSGD(txn.amount)}</p>
                  </button>
                );
              })}
              {aspireTransactions.length === 0 && !aspireLoading && (
                <p className="text-center text-[#6c7a77] font-['Manrope'] text-sm py-8">
                  {aspireError ? "Failed to load" : "Click \"Fetch Aspire\" to load transactions"}
                </p>
              )}
              {aspireLoading && (
                <div className="py-8 text-center">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#006b5f] border-r-transparent" />
                </div>
              )}
            </div>
          </div>
        </div>

        {matchedPairs.length > 0 && (
          <div className="border-t border-[#bbcac6]/15 p-6">
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-4">
              Matched This Session ({matchedPairs.length})
            </p>
            <div className="space-y-2">
              {matchedPairs.map(pair => (
                <div key={pair.rentPaymentId} className="flex items-center gap-3 p-3 rounded-xl bg-[#d1fae5]/30 border border-[#d1fae5]">
                  <span className="font-['Inter'] text-xs font-bold text-[#006b5f] bg-[#eff4ff] px-2 py-1 rounded">{pair.unitCode}</span>
                  <p className="font-['Manrope'] text-sm text-[#121c2a] flex-1">{pair.tenantName} — {formatSGD(pair.rentAmount)}</p>
                  <span className="text-[#6c7a77] font-['Manrope'] text-xs">←</span>
                  <p className="font-['Manrope'] text-sm text-[#121c2a]">{pair.txnDescription} — {formatSGD(pair.txnAmount)}</p>
                  {Number(pair.txnAmount) !== Number(pair.rentAmount) && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-amber-100 text-amber-700">Mismatch</span>
                  )}
                  <button onClick={() => handleUnmatch(pair)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-[#bbcac6]/30 text-[#6c7a77] hover:bg-white font-['Manrope'] font-bold shrink-0">
                    Unmatch
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Charge Section */}
      <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden mt-8">
        <div className="px-8 py-6 border-b border-[#bbcac6]/15">
          <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#121c2a]">
            Add One-Off Charge
          </h2>
          <p className="font-['Manrope'] text-[#6c7a77] text-xs mt-0.5">
            Charge a member for stamping fees, key replacement, damage, etc.
          </p>
        </div>
        <div className="px-8 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-1">Member *</label>
              <select
                value={chargeForm.tenant_profile_id}
                onChange={(e) => setChargeForm(f => ({ ...f, tenant_profile_id: e.target.value }))}
                className="w-full border border-[#bbcac6]/30 rounded-xl px-3 py-2.5 text-sm font-['Manrope'] focus:outline-none focus:ring-2 focus:ring-[#006b5f] bg-white"
              >
                <option value="">Select member...</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.rooms?.unit_code ?? "—"} — {m.full_name || m.username}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-1">Description *</label>
              <input
                type="text"
                value={chargeForm.description}
                onChange={(e) => setChargeForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Stamping fee"
                className="w-full border border-[#bbcac6]/30 rounded-xl px-3 py-2.5 text-sm font-['Manrope'] focus:outline-none focus:ring-2 focus:ring-[#006b5f]"
              />
            </div>
            <div>
              <label className="block font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-1">Amount SGD *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={chargeForm.amount}
                onChange={(e) => setChargeForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                className="w-full border border-[#bbcac6]/30 rounded-xl px-3 py-2.5 text-sm font-['Manrope'] focus:outline-none focus:ring-2 focus:ring-[#006b5f]"
              />
            </div>
            <div>
              <label className="block font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-1">Category</label>
              <select
                value={chargeForm.category}
                onChange={(e) => setChargeForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-[#bbcac6]/30 rounded-xl px-3 py-2.5 text-sm font-['Manrope'] focus:outline-none focus:ring-2 focus:ring-[#006b5f] bg-white"
              >
                {CHARGE_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-1">Due Date</label>
              <input
                type="date"
                value={chargeForm.due_date}
                onChange={(e) => setChargeForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full border border-[#bbcac6]/30 rounded-xl px-3 py-2.5 text-sm font-['Manrope'] focus:outline-none focus:ring-2 focus:ring-[#006b5f]"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleCreateCharge}
                disabled={chargeSaving}
                className="px-6 py-2.5 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                {chargeSaving ? "Creating..." : "Create Charge"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* All Charges Table */}
      <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden mt-8">
        <div className="px-8 py-6 border-b border-[#bbcac6]/15">
          <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#121c2a]">
            All Ad-hoc Charges
          </h2>
        </div>

        {chargesLoading ? (
          <div className="divide-y divide-[#bbcac6]/10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-8 py-5 flex items-center gap-4">
                <div className="h-4 w-16 bg-[#eff4ff] animate-pulse rounded" />
                <div className="h-4 w-24 bg-[#eff4ff] animate-pulse rounded" />
                <div className="h-4 w-20 bg-[#eff4ff] animate-pulse rounded ml-auto" />
              </div>
            ))}
          </div>
        ) : charges.length === 0 ? (
          <div className="px-8 py-12 text-center">
            <p className="text-[#6c7a77] font-['Manrope'] text-sm">No ad-hoc charges yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#eff4ff]">
                <tr>
                  <th className="text-left px-8 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold whitespace-nowrap">Room</th>
                  <th className="text-left px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold whitespace-nowrap">Description</th>
                  <th className="text-left px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold whitespace-nowrap">Category</th>
                  <th className="text-right px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold whitespace-nowrap">Amount</th>
                  <th className="text-left px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold whitespace-nowrap">Due Date</th>
                  <th className="text-left px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold whitespace-nowrap">Status</th>
                  <th className="text-left px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold whitespace-nowrap hidden md:table-cell">Created</th>
                  <th className="px-4 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#bbcac6]/10">
                {charges.map((c) => {
                  const unitCode = c.tenant_profiles?.rooms?.unit_code ?? "—";
                  const badgeClass = CHARGE_STATUS_BADGE[c.status] ?? CHARGE_STATUS_BADGE.PENDING;
                  const isLoading = chargeActionLoading === c.id;
                  return (
                    <tr key={c.id} className="hover:bg-[#f8f9ff] transition-colors">
                      <td className="px-8 py-4">
                        <span className="font-['Inter'] text-xs font-bold text-[#006b5f] bg-[#eff4ff] px-2 py-1 rounded">
                          {unitCode}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-['Manrope'] text-sm text-[#121c2a]">{c.description}</td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#eff4ff] text-[#555f6f]">
                          {c.category?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-['Plus_Jakarta_Sans'] font-bold text-sm tabular-nums">{formatSGD(c.amount)}</td>
                      <td className="px-4 py-4 font-['Manrope'] text-sm text-[#121c2a] whitespace-nowrap">{formatDate(c.due_date)}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${badgeClass}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-['Manrope'] text-sm text-[#6c7a77] whitespace-nowrap hidden md:table-cell">
                        {formatDate(c.created_at)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {c.status === "PENDING" && (
                          <button
                            onClick={() => handleMarkChargePaid(c.id)}
                            disabled={isLoading}
                            className="text-xs px-3 py-1.5 rounded-lg bg-[#006b5f] text-white hover:opacity-90 disabled:opacity-50 transition-all font-['Manrope'] font-bold whitespace-nowrap"
                          >
                            {isLoading ? "..." : "Mark Paid"}
                          </button>
                        )}
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
