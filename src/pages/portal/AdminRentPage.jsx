import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { aspire } from "../../lib/aspire";
import { notifyMember } from "../../lib/notify";
import PortalLayout from "../../components/portal/PortalLayout";
import { confirm } from "../../lib/confirm";

async function fireRentPaidEmail(tenantProfileId, monthStr, amount) {
  if (!tenantProfileId || !monthStr) return;
  await notifyMember(tenantProfileId, "RENT_PAID", {
    month: formatMonth(monthStr),
    amount: Number(amount) || 0,
  });
}

function formatMonth(monthStr) {
  if (!monthStr) return "\u2014";
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
  PENDING: "bg-amber-500/15 text-amber-300",
  PAID: "bg-emerald-500/15 text-emerald-300",
  OVERDUE: "bg-red-500/15 text-red-300",
  PARTIAL: "bg-amber-500/15 text-amber-300",
};

const CHARGE_CATEGORIES = ["STAMPING", "KEY_REPLACEMENT", "DAMAGE", "CLEANING", "LATE_CHECKOUT", "AC_OVERAGE", "OTHER"];

const CHARGE_STATUS_BADGE = {
  PENDING: "bg-amber-500/15 text-amber-300",
  PAID: "bg-emerald-500/15 text-emerald-300",
};

export default function AdminRentPage() {
  const [rentPayments, setRentPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  // Month filter for the rent table — defaults to the current month so the
  // list isn't an ever-growing pile of every month ever generated.
  const [tableMonth, setTableMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Ad-hoc charges state
  const [members, setMembers] = useState([]);
  const [charges, setCharges] = useState([]);
  const [chargesLoading, setChargesLoading] = useState(true);
  const [chargeForm, setChargeForm] = useState({ tenant_profile_id: "", description: "", amount: "", due_date: "", category: "OTHER" });
  const [chargeSaving, setChargeSaving] = useState(false);
  const [chargeActionLoading, setChargeActionLoading] = useState(null);

  // Reconciliation state
  const [aspireAccounts, setAspireAccounts] = useState([]);
  const [aspireAccountId, setAspireAccountId] = useState("");
  const [accountNicknames, setAccountNicknames] = useState({});
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
      .select("id, username, rooms(unit_code), tenant_details(full_name)")
      .eq("is_active", true)
      .order("username");
    setMembers((data ?? []).map(m => ({
      ...m,
      full_name: m.tenant_details?.full_name ?? null,
    })));
  }, []);

  const fetchCharges = useCallback(async () => {
    const { data, error } = await supabase
      .from("member_charges")
      .select("*, tenant_profiles(username, rooms(unit_code))")
      .order("created_at", { ascending: false });
    if (!error) setCharges(data ?? []);
    setChargesLoading(false);
  }, []);

  async function handleLoadAspireAccounts() {
    try {
      const accs = await aspire.getAccounts();
      setAspireAccounts(accs);
      if (accs.length === 1) setAspireAccountId(accs[0].id ?? accs[0].account_id ?? accs[0].accountId ?? "");
      // Load nicknames
      const { data } = await supabase.from("account_nicknames").select("*");
      const map = {};
      (data ?? []).forEach(n => { map[n.aspire_account_id] = n.nickname; });
      setAccountNicknames(map);
    } catch (err) {
      console.error("Failed to load Aspire accounts:", err);
    }
  }

  async function handleFetchAspire() {
    if (!aspireAccountId) {
      setAspireError("Select an Aspire account first");
      return;
    }
    setAspireLoading(true);
    setAspireError(null);
    try {
      const [year, month] = reconcileMonth.split("-");
      const from_date = `${year}-${month}-01`;
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const to_date = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
      const txns = await aspire.getTransactions(aspireAccountId, { from_date, to_date });
      const credits = txns.filter(t => t.transaction_type === "INCOME" && t.amount > 0);
      // Filter out transactions already matched to rent payments
      const { data: matched } = await supabase
        .from("rent_payments")
        .select("payment_reference")
        .not("payment_reference", "is", null);
      const matchedRefs = new Set((matched ?? []).map(r => r.payment_reference));
      const unmatched = credits.filter(t => !matchedRefs.has(t.reference));
      setAspireTransactions(unmatched);
    } catch (err) {
      console.error("Aspire fetch error:", err);
      setAspireError(err.message);
    }
    setAspireLoading(false);
  }

  async function handleMatch(rentPayment) {
    if (!selectedTxn) return;
    // Calculate late fee per contract: 5% if paid after 5th from due date, +5% after 30 days
    const paidDate = new Date(selectedTxn.transaction_date);
    const dueDate = rentPayment.due_date ? new Date(rentPayment.due_date) : null;
    const duePlusFive = dueDate ? new Date(dueDate.getTime() + 5 * 86400000) : null;
    const duePlusThirty = dueDate ? new Date(dueDate.getTime() + 30 * 86400000) : null;
    const rentAmt = Number(rentPayment.rent_amount);
    let lateFee = 0;
    let isLate = false;
    let daysLate = 0;
    if (duePlusFive && paidDate > duePlusFive) {
      isLate = true;
      daysLate = Math.floor((paidDate - dueDate) / 86400000);
      lateFee = rentAmt * 0.05; // 5% per clause 2.2
      if (duePlusThirty && paidDate > duePlusThirty) {
        lateFee += rentAmt * 0.05; // additional 5% per clause 2.3
      }
    }
    const { error } = await supabase
      .from("rent_payments")
      .update({
        status: "PAID",
        paid_at: selectedTxn.transaction_date,
        paid_amount: rentPayment.rent_amount,
        payment_reference: selectedTxn.reference,
        payment_method: "PAYNOW",
        is_late: isLate,
        late_fee: lateFee,
      })
      .eq("id", rentPayment.id);
    if (error) { console.error("Match error:", error); return; }
    fireRentPaidEmail(rentPayment.tenant_profile_id, rentPayment.month, rentPayment.rent_amount);
    setMatchedPairs(prev => [...prev, {
      rentPaymentId: rentPayment.id,
      transactionRef: selectedTxn.reference,
      tenantName: rentPayment.tenant_profiles?.tenant_details?.full_name || rentPayment.tenant_profiles?.username || "—",
      unitCode: rentPayment.tenant_profiles?.rooms?.unit_code || "—",
      rentAmount: rentPayment.rent_amount,
      txnAmount: selectedTxn.amount,
      txnDate: selectedTxn.transaction_date,
      txnDescription: selectedTxn.description,
      isLate,
      daysLate,
      lateFee,
    }]);
    setAspireTransactions(prev => prev.filter(t => t.reference !== selectedTxn.reference));
    setRentPayments(prev => prev.map(p =>
      p.id === rentPayment.id
        ? { ...p, status: "PAID", paid_at: selectedTxn.transaction_date, paid_amount: p.rent_amount, payment_method: "PAYNOW", payment_reference: selectedTxn.reference, is_late: isLate, late_fee: lateFee }
        : p
    ));
    setSelectedTxn(null);
  }

  // Match a selected Aspire transaction to an ad-hoc charge. This is the ONLY
  // way a charge becomes PAID — no manual "mark paid" — so a charge is never
  // settled unless real money is seen landing in the bank.
  async function handleMatchCharge(charge) {
    if (!selectedTxn) return;
    const { error } = await supabase
      .from("member_charges")
      .update({ status: "PAID", paid_at: selectedTxn.transaction_date })
      .eq("id", charge.id);
    if (error) { console.error("Charge match error:", error); return; }
    setCharges(prev => prev.map(c =>
      c.id === charge.id ? { ...c, status: "PAID", paid_at: selectedTxn.transaction_date } : c
    ));
    setMatchedPairs(prev => [...prev, {
      rentPaymentId: `charge-${charge.id}`,
      kind: "charge",
      chargeId: charge.id,
      transactionRef: selectedTxn.reference,
      tenantName: `${charge.description}`,
      unitCode: charge.tenant_profiles?.rooms?.unit_code || "—",
      rentAmount: charge.amount,
      txnAmount: selectedTxn.amount,
      txnDate: selectedTxn.transaction_date,
      txnDescription: selectedTxn.description,
      isLate: false,
      daysLate: 0,
      lateFee: 0,
    }]);
    setAspireTransactions(prev => prev.filter(t => t.reference !== selectedTxn.reference));
    setSelectedTxn(null);
  }

  async function handleUnmatch(pair) {
    if (pair.kind === "charge") {
      const { error } = await supabase
        .from("member_charges")
        .update({ status: "PENDING", paid_at: null })
        .eq("id", pair.chargeId);
      if (error) { console.error("Charge unmatch error:", error); return; }
      setCharges(prev => prev.map(c =>
        c.id === pair.chargeId ? { ...c, status: "PENDING", paid_at: null } : c
      ));
      setAspireTransactions(prev => [...prev, {
        transaction_date: pair.txnDate, description: pair.txnDescription,
        amount: pair.txnAmount, reference: pair.transactionRef, transaction_type: "INCOME",
      }]);
      setMatchedPairs(prev => prev.filter(mp => mp.rentPaymentId !== pair.rentPaymentId));
      return;
    }
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

  async function handleWaiveLateFee(pair) {
    const { error } = await supabase
      .from("rent_payments")
      .update({ late_fee: 0, is_late: false })
      .eq("id", pair.rentPaymentId);
    if (error) { console.error("Waive error:", error); return; }
    setMatchedPairs(prev => prev.map(mp =>
      mp.rentPaymentId === pair.rentPaymentId ? { ...mp, lateFee: 0, isLate: false, daysLate: 0 } : mp
    ));
    setRentPayments(prev => prev.map(p =>
      p.id === pair.rentPaymentId ? { ...p, late_fee: 0, is_late: false } : p
    ));
  }

  useEffect(() => {
    fetchPayments();
    fetchMembers();
    fetchCharges();
  }, [fetchPayments, fetchMembers, fetchCharges]);

  async function handleGenerateThisMonth() {
    // Guard against double-fire — the confirm dialog isn't a hard input lock, so
    // rapid clicks could each pass the "already exists" check before any insert
    // lands and pile up duplicate rows. Bail if a run is already in flight.
    if (generating) return;

    // Always operate on the month the table is currently showing, so "regenerate"
    // is unambiguous about which month it refreshes.
    const [fy, fm] = tableMonth.split("-");
    const monthStr = `${fy}-${fm}-01`;
    const dueDateStr = monthStr;

    if (!await confirm({
      title: `Generate / regenerate rent for ${formatMonth(monthStr)}?`,
      description:
        "Refreshes unpaid rent records for all active tenants. Paid, partial and overdue records are left untouched — only PENDING rows are cleared and recreated, so re-running never piles up duplicates.",
    })) return;

    setGenerating(true);
    setGenerateResult(null);

    const { data: profiles, error: profilesError } = await supabase
      .from("tenant_profiles")
      .select("id, monthly_rent, late_fee_per_day, room_id, onboarding_progress(tenancy_start_date, tenancy_end_date)")
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

    // Idempotent regenerate: wipe this month's PENDING rows first (these carry no
    // payment, so they're safe to recreate). PAID / PARTIAL / OVERDUE rows stay.
    const { error: wipeError } = await supabase
      .from("rent_payments")
      .delete()
      .eq("month", monthStr)
      .eq("status", "PENDING");

    if (wipeError) {
      console.error("Error clearing pending rent rows:", wipeError);
      setGenerateResult({ error: "Failed to clear existing pending records." });
      setGenerating(false);
      return;
    }

    // Re-read remaining rows (PAID/PARTIAL/OVERDUE) so we skip those tenants.
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
      .filter((p) => {
        if (existingSet.has(p.id)) return false;
        // Skip tenants whose tenancy hasn't started yet
        const startDate = p.onboarding_progress?.tenancy_start_date;
        if (startDate) {
          const startMonth = startDate.substring(0, 7); // "2026-06"
          const currentMonth = monthStr.substring(0, 7); // "2026-04"
          if (startMonth > currentMonth) return false;
        }
        return true;
      })
      .map((p) => {
        // Prorate rent if tenant starts mid-month
        let rentAmount = Number(p.monthly_rent);
        const startDate = p.onboarding_progress?.tenancy_start_date;
        if (startDate) {
          const startMonth = startDate.substring(0, 7);
          const currentMonth = monthStr.substring(0, 7);
          if (startMonth === currentMonth) {
            const startDay = parseInt(startDate.substring(8, 10), 10);
            const monthDate = new Date(monthStr);
            const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
            const daysOccupied = daysInMonth - startDay + 1;
            rentAmount = Math.round((rentAmount * daysOccupied / daysInMonth) * 100) / 100;
          }
        }
        return {
          tenant_profile_id: p.id,
          room_id: p.room_id,
          month: monthStr,
          rent_amount: rentAmount,
          late_fee: 0,
          due_date: dueDateStr,
          status: "PENDING",
          is_late: false,
        };
      });

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

  async function handleAddLateFee(payment) {
    if (!await confirm({ title: "Are you sure you want to add a late fee?" })) return;
    setActionLoading(payment.id);

    const dueDate = payment.due_date ? new Date(payment.due_date) : null;
    if (!dueDate) {
      setActionLoading(null);
      return;
    }

    const now = new Date();
    const daysOverdue = daysBetween(dueDate, now);
    // Late fee per contract: 5% after 5 days, additional 5% after 30 days
    const outstanding = Number(payment.rent_amount);
    const newLateFee = daysOverdue > 30 ? Math.round(outstanding * 0.10 * 100) / 100 : Math.round(outstanding * 0.05 * 100) / 100;

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
    if (!await confirm({ title: "Mark this charge as paid?" })) return;
    setChargeActionLoading(chargeId);
    const { error } = await supabase.from("member_charges").update({ status: "PAID", paid_at: new Date().toISOString() }).eq("id", chargeId);
    if (!error) {
      setCharges(prev => prev.map(c => c.id === chargeId ? { ...c, status: "PAID", paid_at: new Date().toISOString() } : c));
    }
    setChargeActionLoading(null);
  }

  // Rent table is scoped to the selected month so it doesn't show every month ever.
  const monthRows = rentPayments.filter((p) => (p.month || "").startsWith(tableMonth));

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
        <span className="block text-[11px] uppercase tracking-[0.4em] font-semibold text-accent mb-4">Money</span>
        <h1 className="font-display text-3xl font-extrabold text-foreground tracking-tight">
          Rent Management
        </h1>
        <p className="text-foreground-variant font-['Inter'] font-medium mt-1">
          Generate monthly rent records and track payment status.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-8">
        <div className="bg-surface rounded-2xl p-6 border border-border">
          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-3">Pending</p>
          {loading ? (
            <div className="h-8 w-8 bg-white/5 animate-pulse rounded" />
          ) : (
            <p className="font-display text-3xl font-extrabold text-foreground">{pendingCount}</p>
          )}
        </div>
        <div className="bg-surface rounded-2xl p-6 border border-border">
          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-3">Overdue</p>
          {loading ? (
            <div className="h-8 w-8 bg-white/5 animate-pulse rounded" />
          ) : (
            <p className={`font-display text-3xl font-extrabold ${overdueCount > 0 ? "text-red-400" : "text-foreground"}`}>
              {overdueCount}
            </p>
          )}
        </div>
        <div className="bg-surface rounded-2xl p-6 border border-border">
          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-3">Paid</p>
          {loading ? (
            <div className="h-8 w-8 bg-white/5 animate-pulse rounded" />
          ) : (
            <p className="font-display text-3xl font-extrabold text-accent">{paidCount}</p>
          )}
        </div>
        <div className="bg-accent rounded-2xl p-6">
          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-white/80 font-bold mb-3">Collected</p>
          {loading ? (
            <div className="h-8 w-20 bg-white/10 animate-pulse rounded" />
          ) : (
            <p className="font-display text-2xl font-extrabold text-white">
              {formatSGD(totalCollected)}
            </p>
          )}
        </div>
      </div>

      {/* Generate button */}
      <div className="bg-surface rounded-2xl p-6 border border-border mb-8 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="font-['Inter'] font-bold text-foreground text-sm">Generate / Regenerate Rent</p>
          <p className="font-['Inter'] text-foreground-variant text-xs mt-0.5">
            Refreshes unpaid rent records for <span className="font-semibold text-foreground">{formatMonth(`${tableMonth}-01`)}</span> (the month selected below). Paid records are untouched, and re-running never creates duplicates.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {generateResult && (
            <p className={`font-['Inter'] text-sm ${generateResult.error ? "text-red-400" : "text-accent"}`}>
              {generateResult.error ?? generateResult.message}
            </p>
          )}
          <button
            onClick={handleGenerateThisMonth}
            disabled={generating}
            className="px-6 py-3 bg-accent text-white rounded-full font-['Inter'] font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            {generating ? "Generating…" : "Generate / Regenerate"}
          </button>
        </div>
      </div>

      {/* Rent Payment Table */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden relative">
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-surface to-transparent z-10 sm:hidden rounded-r-2xl"></div>
        <div className="px-8 py-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-display font-bold text-lg text-foreground">
            Rent Payments — {formatMonth(`${tableMonth}-01`)}
          </h2>
          <input
            type="month"
            value={tableMonth}
            onChange={(e) => setTableMonth(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-surface text-foreground text-sm font-['Inter'] focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {loading ? (
          <div className="divide-y divide-white/10">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="px-8 py-5 flex items-center gap-4">
                <div className="h-4 w-16 bg-white/5 animate-pulse rounded" />
                <div className="h-4 w-24 bg-white/5 animate-pulse rounded" />
                <div className="h-4 w-20 bg-white/5 animate-pulse rounded ml-auto" />
                <div className="h-5 w-16 bg-white/5 animate-pulse rounded-full" />
              </div>
            ))}
          </div>
        ) : monthRows.length === 0 ? (
          <div className="px-8 py-12 text-center">
            <p className="text-foreground-variant font-['Inter'] text-sm">
              No rent records for {formatMonth(`${tableMonth}-01`)}. Click “Generate / Regenerate” above to create them.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-surface-container">
                <tr>
                  <th className="text-left px-8 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold whitespace-nowrap">Room</th>
                  <th className="text-left px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold whitespace-nowrap">Tenant</th>
                  <th className="text-left px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold whitespace-nowrap">Month</th>
                  <th className="text-right px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold whitespace-nowrap">Rent</th>
                  <th className="text-right px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold whitespace-nowrap">Late Fee</th>
                  <th className="text-right px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold whitespace-nowrap">Total</th>
                  <th className="text-left px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold whitespace-nowrap">Status</th>
                  <th className="text-left px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold whitespace-nowrap hidden md:table-cell">Paid Date</th>
                  <th className="px-4 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {monthRows.map((p) => {
                  const tp = p.tenant_profiles;
                  const unitCode = tp?.rooms?.unit_code ?? "—";
                  const tenantName = tp?.tenant_details?.full_name || tp?.username || "—";
                  const lateFee = p.late_fee ?? 0;
                  const total = Number(p.rent_amount) + Number(lateFee);
                  const badgeClass = STATUS_BADGE[p.status] ?? STATUS_BADGE.PENDING;
                  const isActionLoading = actionLoading === p.id;
                  const canAddLateFee =
                    (p.status === "PENDING" || p.status === "OVERDUE") &&
                    p.due_date &&
                    new Date(p.due_date) < new Date();

                  return (
                    <React.Fragment key={p.id}>
                    <tr
                      className={`transition-colors ${
                        p.status === "OVERDUE"
                          ? "bg-red-500/10 hover:bg-red-500/15"
                          : "hover:bg-white/5"
                      }`}
                    >
                      <td className="px-8 py-4">
                        <span className="font-['Inter'] text-xs font-bold text-accent bg-surface-container px-2 py-1 rounded">
                          {unitCode}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-['Inter'] text-sm text-foreground whitespace-nowrap truncate max-w-[120px]" title={tenantName}>
                        {tenantName}
                      </td>
                      <td className="px-4 py-4 font-['Inter'] text-sm text-foreground whitespace-nowrap">
                        {formatMonth(p.month)}
                      </td>
                      <td className="px-4 py-4 text-right font-['Inter'] font-medium text-sm whitespace-nowrap tabular-nums text-foreground">
                        {formatSGD(p.rent_amount)}
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap tabular-nums">
                        {lateFee > 0 ? (
                          <span className="font-['Inter'] text-sm font-medium text-red-400">{formatSGD(lateFee)}</span>
                        ) : (
                          <span className="text-foreground-variant">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap font-display font-bold text-sm tabular-nums text-foreground">
                        {formatSGD(total)}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${badgeClass}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-['Inter'] text-sm text-foreground-variant whitespace-nowrap hidden md:table-cell">
                        {formatDate(p.paid_at)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canAddLateFee && (
                            <button
                              onClick={() => handleAddLateFee(p)}
                              disabled={isActionLoading}
                              className="text-xs px-3 py-1.5 rounded-lg bg-red-500/15 text-red-300 hover:bg-red-500/25 disabled:opacity-50 transition-all font-['Inter'] font-bold whitespace-nowrap"
                            >
                              {isActionLoading ? "…" : "Late Fee"}
                            </button>
                          )}
                          {(p.status === "PENDING" || p.status === "OVERDUE") && (
                            <span
                              className="text-[10px] text-foreground-variant italic whitespace-nowrap"
                              title="Rent is marked paid only by matching a real bank transfer in the Reconcile panel below."
                            >
                              reconcile to mark paid
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* ── Reconciliation Panel ── */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden mt-8">
        <div className="px-8 py-6 border-b border-border flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h2 className="font-display font-bold text-lg text-foreground">Reconcile with Aspire</h2>
            <p className="font-['Inter'] text-foreground-variant text-xs mt-0.5">Match incoming bank transfers to tenant rent records.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <input type="month" value={reconcileMonth} onChange={(e) => setReconcileMonth(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-surface text-foreground text-sm font-['Inter'] focus:outline-none focus:ring-2 focus:ring-accent" />
            {aspireAccounts.length > 0 ? (
              <>
                <select value={aspireAccountId} onChange={(e) => setAspireAccountId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-border text-sm font-['Inter'] focus:outline-none focus:ring-2 focus:ring-accent bg-surface text-foreground max-w-[200px]">
                  <option value="">Select account…</option>
                  {aspireAccounts.map(acc => {
                    const id = acc.id ?? acc.account_id ?? acc.accountId;
                    const name = accountNicknames[id] ?? acc.debit_details?.[0]?.account_name ?? acc.name ?? id;
                    return <option key={id} value={id}>{name}</option>;
                  })}
                </select>
                {aspireAccountId && (
                  <button
                    onClick={async () => {
                      const current = accountNicknames[aspireAccountId] || "";
                      const nickname = prompt("Nickname for this account:", current);
                      if (nickname === null) return;
                      const clean = nickname.trim();
                      if (clean) {
                        await supabase.from("account_nicknames").upsert(
                          { aspire_account_id: aspireAccountId, nickname: clean, account_type: "ASPIRE" },
                          { onConflict: "aspire_account_id" }
                        );
                        setAccountNicknames(prev => ({ ...prev, [aspireAccountId]: clean }));
                      } else {
                        await supabase.from("account_nicknames").delete().eq("aspire_account_id", aspireAccountId);
                        setAccountNicknames(prev => {
                          const next = { ...prev };
                          delete next[aspireAccountId];
                          return next;
                        });
                      }
                    }}
                    className="px-3 py-2 rounded-lg border border-border text-foreground-variant hover:bg-white/5 transition-colors"
                    title="Edit nickname"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                )}
              </>
            ) : (
              <button onClick={handleLoadAspireAccounts}
                className="px-4 py-2 rounded-lg border border-border text-sm font-['Inter'] font-semibold text-foreground-variant hover:bg-white/5">
                Load Accounts
              </button>
            )}
            <button onClick={handleFetchAspire} disabled={aspireLoading || !aspireAccountId}
              className="px-5 py-2.5 bg-accent text-white rounded-full font-['Inter'] font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 shrink-0">
              <span className="material-symbols-outlined text-[18px]">account_balance</span>
              {aspireLoading ? "Fetching…" : "Fetch Aspire"}
            </button>
          </div>
        </div>

        {aspireError && (
          <div className="px-8 py-3 bg-red-500/10 text-red-300 font-['Inter'] text-sm">{aspireError}</div>
        )}

        {selectedTxn && (
          <div className="px-8 py-3 bg-emerald-500/10 font-['Inter'] text-sm text-emerald-300 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            Selected: {selectedTxn.description} — {formatSGD(selectedTxn.amount)} ({selectedTxn.transaction_date})
            <button onClick={() => setSelectedTxn(null)} className="ml-auto text-xs underline">Cancel</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
          {/* LEFT: Unpaid Rent + Charges */}
          <div className="p-6">
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-4">
              Unpaid Rent &amp; Charges ({rentPayments.filter(p => p.status === "PENDING" || p.status === "OVERDUE").length + charges.filter(c => c.status === "PENDING").length})
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
                        selectedTxn ? "border-accent hover:bg-accent/5 cursor-pointer" : "border-border opacity-60 cursor-default"
                      }`}>
                      <span className="font-['Inter'] text-xs font-bold text-accent bg-surface-container px-2 py-1 rounded shrink-0">{unitCode}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-['Inter'] text-sm font-semibold text-foreground truncate">{name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-display font-bold text-sm tabular-nums text-foreground">{formatSGD(p.rent_amount)}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${STATUS_BADGE[p.status]}`}>{p.status}</span>
                      </div>
                    </button>
                  );
                })}
              {charges
                .filter(c => c.status === "PENDING")
                .map(c => {
                  const unitCode = c.tenant_profiles?.rooms?.unit_code ?? "—";
                  return (
                    <button key={`charge-${c.id}`} onClick={() => selectedTxn ? handleMatchCharge(c) : null} disabled={!selectedTxn}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3 ${
                        selectedTxn ? "border-accent hover:bg-accent/5 cursor-pointer" : "border-border opacity-60 cursor-default"
                      }`}>
                      <span className="font-['Inter'] text-xs font-bold text-accent bg-surface-container px-2 py-1 rounded shrink-0">{unitCode}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-['Inter'] text-sm font-semibold text-foreground truncate">{c.description}</p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-purple-500/15 text-purple-300">Charge · {c.category?.replace(/_/g, " ")}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-display font-bold text-sm tabular-nums text-foreground">{formatSGD(c.amount)}</p>
                      </div>
                    </button>
                  );
                })}
              {rentPayments.filter(p => p.status === "PENDING" || p.status === "OVERDUE").length === 0 &&
               charges.filter(c => c.status === "PENDING").length === 0 && (
                <p className="text-center text-foreground-variant font-['Inter'] text-sm py-8">All rent &amp; charges paid!</p>
              )}
            </div>
          </div>

          {/* RIGHT: Aspire Transactions */}
          <div className="p-6">
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-4">
              Aspire Incoming ({aspireTransactions.length})
            </p>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {aspireTransactions.map((txn, idx) => {
                const isSelected = selectedTxn?.reference === txn.reference;
                return (
                  <button key={txn.reference || idx} onClick={() => setSelectedTxn(isSelected ? null : txn)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3 ${
                      isSelected ? "border-accent ring-2 ring-accent bg-accent/5" : "border-border hover:border-accent hover:bg-white/5"
                    }`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-['Inter'] text-sm font-semibold text-foreground truncate">{txn.description || "Unknown"}</p>
                      <p className="font-['Inter'] text-xs text-foreground-variant">{txn.transaction_date}</p>
                    </div>
                    <p className="font-display font-bold text-sm tabular-nums text-accent shrink-0">{formatSGD(txn.amount)}</p>
                  </button>
                );
              })}
              {aspireTransactions.length === 0 && !aspireLoading && (
                <p className="text-center text-foreground-variant font-['Inter'] text-sm py-8">
                  {aspireError ? "Failed to load" : "Click \"Fetch Aspire\" to load transactions"}
                </p>
              )}
              {aspireLoading && (
                <div className="py-8 text-center">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-accent border-r-transparent" />
                </div>
              )}
            </div>
          </div>
        </div>

        {matchedPairs.length > 0 && (
          <div className="border-t border-border p-6">
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-4">
              Matched This Session ({matchedPairs.length})
            </p>
            <div className="space-y-2">
              {matchedPairs.map(pair => (
                <div key={pair.rentPaymentId} className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                  <span className="font-['Inter'] text-xs font-bold text-accent bg-surface-container px-2 py-1 rounded">{pair.unitCode}</span>
                  <p className="font-['Inter'] text-sm text-foreground flex-1">{pair.tenantName} — {formatSGD(pair.rentAmount)}</p>
                  <span className="text-foreground-variant font-['Inter'] text-xs">←</span>
                  <p className="font-['Inter'] text-sm text-foreground">{pair.txnDescription} — {formatSGD(pair.txnAmount)}</p>
                  {Number(pair.txnAmount) !== Number(pair.rentAmount) && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-amber-500/15 text-amber-300">Mismatch</span>
                  )}
                  {pair.isLate && pair.lateFee > 0 && (
                    <>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-red-500/15 text-red-300">
                        {pair.daysLate}d late — {formatSGD(pair.lateFee)} fee
                      </span>
                      <button onClick={() => handleWaiveLateFee(pair)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 font-['Inter'] font-bold shrink-0">
                        Waive
                      </button>
                    </>
                  )}
                  <button onClick={() => handleUnmatch(pair)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border text-foreground-variant hover:bg-white/5 font-['Inter'] font-bold shrink-0">
                    Unmatch
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Charge Section */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden mt-8">
        <div className="px-8 py-6 border-b border-border">
          <h2 className="font-display font-bold text-lg text-foreground">
            Add One-Off Charge
          </h2>
          <p className="font-['Inter'] text-foreground-variant text-xs mt-0.5">
            Charge a member for stamping fees, key replacement, damage, etc.
          </p>
        </div>
        <div className="px-8 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-1">Member *</label>
              <select
                value={chargeForm.tenant_profile_id}
                onChange={(e) => setChargeForm(f => ({ ...f, tenant_profile_id: e.target.value }))}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm font-['Inter'] focus:outline-none focus:ring-2 focus:ring-accent bg-surface text-foreground"
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
              <label className="block font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-1">Description *</label>
              <input
                type="text"
                value={chargeForm.description}
                onChange={(e) => setChargeForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Stamping fee"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm font-['Inter'] focus:outline-none focus:ring-2 focus:ring-accent bg-surface text-foreground"
              />
            </div>
            <div>
              <label className="block font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-1">Amount SGD *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={chargeForm.amount}
                onChange={(e) => setChargeForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm font-['Inter'] focus:outline-none focus:ring-2 focus:ring-accent bg-surface text-foreground"
              />
            </div>
            <div>
              <label className="block font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-1">Category</label>
              <select
                value={chargeForm.category}
                onChange={(e) => setChargeForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm font-['Inter'] focus:outline-none focus:ring-2 focus:ring-accent bg-surface text-foreground"
              >
                {CHARGE_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-1">Due Date</label>
              <input
                type="date"
                value={chargeForm.due_date}
                onChange={(e) => setChargeForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm font-['Inter'] focus:outline-none focus:ring-2 focus:ring-accent bg-surface text-foreground"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleCreateCharge}
                disabled={chargeSaving}
                className="px-6 py-2.5 bg-accent text-white rounded-full font-['Inter'] font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                {chargeSaving ? "Creating..." : "Create Charge"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* All Charges Table */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden mt-8">
        <div className="px-8 py-6 border-b border-border">
          <h2 className="font-display font-bold text-lg text-foreground">
            All Ad-hoc Charges
          </h2>
        </div>

        {chargesLoading ? (
          <div className="divide-y divide-white/10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-8 py-5 flex items-center gap-4">
                <div className="h-4 w-16 bg-white/5 animate-pulse rounded" />
                <div className="h-4 w-24 bg-white/5 animate-pulse rounded" />
                <div className="h-4 w-20 bg-white/5 animate-pulse rounded ml-auto" />
              </div>
            ))}
          </div>
        ) : charges.length === 0 ? (
          <div className="px-8 py-12 text-center">
            <p className="text-foreground-variant font-['Inter'] text-sm">No ad-hoc charges yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-surface-container">
                <tr>
                  <th className="text-left px-8 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold whitespace-nowrap">Room</th>
                  <th className="text-left px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold whitespace-nowrap">Description</th>
                  <th className="text-left px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold whitespace-nowrap">Category</th>
                  <th className="text-right px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold whitespace-nowrap">Amount</th>
                  <th className="text-left px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold whitespace-nowrap">Due Date</th>
                  <th className="text-left px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold whitespace-nowrap">Status</th>
                  <th className="text-left px-4 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold whitespace-nowrap hidden md:table-cell">Created</th>
                  <th className="px-4 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {charges.map((c) => {
                  const unitCode = c.tenant_profiles?.rooms?.unit_code ?? "—";
                  const badgeClass = CHARGE_STATUS_BADGE[c.status] ?? CHARGE_STATUS_BADGE.PENDING;
                  const isLoading = chargeActionLoading === c.id;
                  return (
                    <tr key={c.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-8 py-4">
                        <span className="font-['Inter'] text-xs font-bold text-accent bg-surface-container px-2 py-1 rounded">
                          {unitCode}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-['Inter'] text-sm text-foreground">{c.description}</td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-surface-container text-foreground-variant">
                          {c.category?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-display font-bold text-sm tabular-nums text-foreground">{formatSGD(c.amount)}</td>
                      <td className="px-4 py-4 font-['Inter'] text-sm text-foreground whitespace-nowrap">{formatDate(c.due_date)}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${badgeClass}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-['Inter'] text-sm text-foreground-variant whitespace-nowrap hidden md:table-cell">
                        {formatDate(c.created_at)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {c.status === "PENDING" && (
                          <span
                            className="text-[10px] text-foreground-variant italic whitespace-nowrap"
                            title="Charges are marked paid only by matching a real bank transfer in the Reconcile panel above."
                          >
                            reconcile to mark paid
                          </span>
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
