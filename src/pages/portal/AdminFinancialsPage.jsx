import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import { confirm } from "../../lib/confirm";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSGD(amount) {
  if (amount == null) return "--";
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getMonthStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonthStr(ms) {
  const [y, m] = ms.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

function addMonths(ms, n) {
  const d = parseMonthStr(ms);
  d.setMonth(d.getMonth() + n);
  return getMonthStr(d);
}

function formatMonthLabel(ms) {
  const d = parseMonthStr(ms);
  return d.toLocaleDateString("en-SG", { month: "long", year: "numeric" });
}

// ─── Categories ───────────────────────────────────────────────────────────────

const INCOME_CATEGORIES = [
  "RENT",
  "DEPOSIT_IN",
  "AC_SURCHARGE",
  "ADHOC_FEE",
  "STRIPE_PAYOUT",
  "OTHER_INCOME",
];

const EXPENSE_CATEGORIES = [
  "MASTER_LEASE",
  "UTILITIES",
  "MAINTENANCE",
  "CLEANING",
  "SUPPLIES",
  "WIFI",
  "INSURANCE",
  "STAFF",
  "PLATFORM_FEES",
  "FURNISHING",
  "MARKETING",
  "OTHER_EXPENSE",
];

const CATEGORY_LABELS = {
  RENT: "Rent",
  DEPOSIT_IN: "Deposit In",
  AC_SURCHARGE: "AC Surcharge",
  ADHOC_FEE: "Ad-hoc Fee",
  STRIPE_PAYOUT: "Stripe Payout",
  OTHER_INCOME: "Other Income",
  MASTER_LEASE: "Master Lease",
  UTILITIES: "Utilities",
  MAINTENANCE: "Maintenance",
  CLEANING: "Cleaning",
  SUPPLIES: "Supplies",
  WIFI: "WiFi",
  INSURANCE: "Insurance",
  STAFF: "Staff",
  PLATFORM_FEES: "Platform Fees",
  FURNISHING: "Furnishing",
  MARKETING: "Marketing",
  OTHER_EXPENSE: "Other Expense",
};

// ─── Components ───────────────────────────────────────────────────────────────

function SummaryCard({ label, value, color, bgClass }) {
  const displayValue = value != null && !isNaN(value) ? value : 0;
  return (
    <div className={`rounded-2xl p-6 border border-border ${bgClass ?? "bg-surface"}`}>
      <p className="font-body text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-3">
        {label}
      </p>
      <p className={`font-display text-3xl font-extrabold ${color}`}>
        {formatSGD(displayValue)}
      </p>
    </div>
  );
}

function CategoryRow({ category, amount }) {
  const isIncome = INCOME_CATEGORIES.includes(category);
  return (
    <div className="flex items-center justify-between py-2 px-4 hover:bg-white/5 transition-colors rounded-lg">
      <span className="font-body text-sm text-foreground">
        {CATEGORY_LABELS[category] ?? category}
      </span>
      <span
        className={`font-display text-sm font-bold tabular-nums ${
          isIncome ? "text-emerald-400" : "text-red-300"
        }`}
      >
        {formatSGD(Math.abs(amount))}
      </span>
    </div>
  );
}

function PropertyPnL({ property, data }) {
  const { incomeByCategory, expenseByCategory, totalIncome, totalExpenses, netProfit } = data;

  const hasIncome = Object.keys(incomeByCategory).length > 0;
  const hasExpenses = Object.keys(expenseByCategory).length > 0;

  return (
    <div className="bg-surface rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-foreground text-lg">
            {property?.name ?? "Operations (No Property)"}
          </h2>
          {property?.code && (
            <p className="font-body text-foreground-variant text-sm">{property.code}</p>
          )}
        </div>
        <span
          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
            netProfit >= 0
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-red-500/15 text-red-300"
          }`}
        >
          {netProfit >= 0 ? "Profit" : "Loss"}
        </span>
      </div>

      <div className="p-8">
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-emerald-500/10 rounded-xl p-5 text-center">
            <p className="font-body text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-2">
              Income
            </p>
            <p className="font-display text-2xl font-extrabold text-emerald-400 tabular-nums">
              {formatSGD(totalIncome)}
            </p>
          </div>
          <div className="bg-red-500/10 rounded-xl p-5 text-center">
            <p className="font-body text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-2">
              Expenses
            </p>
            <p className="font-display text-2xl font-extrabold text-red-300 tabular-nums">
              {formatSGD(totalExpenses)}
            </p>
          </div>
          <div
            className={`rounded-xl p-5 text-center ${
              netProfit >= 0 ? "bg-accent" : "bg-red-500/15"
            }`}
          >
            <p
              className={`font-body text-[10px] uppercase tracking-widest font-bold mb-2 ${
                netProfit >= 0 ? "text-white/80" : "text-red-300"
              }`}
            >
              Net Profit
            </p>
            <p
              className={`font-display text-2xl font-extrabold tabular-nums ${
                netProfit >= 0 ? "text-white" : "text-red-300"
              }`}
            >
              {formatSGD(netProfit)}
            </p>
          </div>
        </div>

        {/* Income breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-body text-xs uppercase tracking-widest text-emerald-400 font-bold mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">trending_up</span>
              Income Breakdown
            </h3>
            <div className="rounded-xl border border-border divide-y divide-white/10 overflow-hidden">
              {hasIncome ? (
                INCOME_CATEGORIES.filter((c) => incomeByCategory[c]).map((cat) => (
                  <CategoryRow key={cat} category={cat} amount={incomeByCategory[cat]} />
                ))
              ) : (
                <p className="text-sm text-foreground-variant font-body p-4">No income this month</p>
              )}
            </div>
          </div>

          {/* Expense breakdown */}
          <div>
            <h3 className="font-body text-xs uppercase tracking-widest text-red-300 font-bold mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">trending_down</span>
              Expense Breakdown
            </h3>
            <div className="rounded-xl border border-border divide-y divide-white/10 overflow-hidden">
              {hasExpenses ? (
                EXPENSE_CATEGORIES.filter((c) => expenseByCategory[c]).map((cat) => (
                  <CategoryRow key={cat} category={cat} amount={expenseByCategory[cat]} />
                ))
              ) : (
                <p className="text-sm text-foreground-variant font-body p-4">No expenses this month</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminFinancialsPage() {
  const [selectedMonth, setSelectedMonth] = useState(getMonthStr(new Date()));
  const [properties, setProperties] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("ALL");
  const [confirmedTxns, setConfirmedTxns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Finalize state
  const [monthlyFinancials, setMonthlyFinancials] = useState([]);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState(null);
  const [finalizeSuccess, setFinalizeSuccess] = useState(null);

  // ─── Fetch ────────────────────────────────────────────────────────────────────

  const fetchProperties = useCallback(async () => {
    const { data } = await supabase
      .from("properties")
      .select("id, name, code")
      .order("name");
    setProperties(data ?? []);
  }, []);

  const fetchMonthlyFinancials = useCallback(async () => {
    const { data, error } = await supabase
      .from("monthly_financials")
      .select("id, property_id, month, revenue, expenses, net_profit, status, properties(name, code)")
      .order("month", { ascending: false });

    if (error) {
      console.error("Failed to fetch monthly financials:", error.message);
    }
    setMonthlyFinancials(data ?? []);
  }, []);

  const fetchConfirmedTransactions = useCallback(async () => {
    setLoading(true);

    const monthStart = `${selectedMonth}-01`;
    const nextMonth = addMonths(selectedMonth, 1);
    const monthEnd = `${nextMonth}-01`;

    let query = supabase
      .from("bank_transactions")
      .select("id, property_id, category, amount, transaction_type, transaction_date")
      .eq("status", "CONFIRMED")
      .gte("transaction_date", monthStart)
      .lt("transaction_date", monthEnd);

    if (selectedPropertyId !== "ALL" && selectedPropertyId !== "OPS") {
      query = query.eq("property_id", selectedPropertyId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Failed to fetch confirmed transactions:", error.message);
    }
    setConfirmedTxns(data ?? []);
    setLoading(false);
  }, [selectedMonth, selectedPropertyId]);

  useEffect(() => {
    fetchProperties();
    fetchMonthlyFinancials();
  }, [fetchProperties, fetchMonthlyFinancials]);

  useEffect(() => {
    fetchConfirmedTransactions();
  }, [fetchConfirmedTransactions]);

  // ─── Compute P&L by property ──────────────────────────────────────────────────

  const pnlByProperty = useMemo(() => {
    const result = {};

    // Group transactions by property_id (null = ops)
    for (const txn of confirmedTxns) {
      const key = txn.property_id ?? "__OPS__";
      if (!result[key]) {
        result[key] = { incomeByCategory: {}, expenseByCategory: {}, totalIncome: 0, totalExpenses: 0, netProfit: 0 };
      }

      const raw = Number(txn.amount ?? 0) || 0;
      const amount = Math.abs(raw);
      const cat = txn.category ?? "OTHER_EXPENSE";

      if (txn.transaction_type === "INCOME" || INCOME_CATEGORIES.includes(cat)) {
        result[key].incomeByCategory[cat] = (result[key].incomeByCategory[cat] ?? 0) + amount;
        result[key].totalIncome += amount;
      } else {
        result[key].expenseByCategory[cat] = (result[key].expenseByCategory[cat] ?? 0) + amount;
        result[key].totalExpenses += amount;
      }
    }

    // Calculate net
    for (const key of Object.keys(result)) {
      result[key].netProfit = result[key].totalIncome - result[key].totalExpenses;
    }

    return result;
  }, [confirmedTxns]);

  // ─── Totals ───────────────────────────────────────────────────────────────────

  const totals = useMemo(() => {
    let totalIncome = 0;
    let totalExpenses = 0;
    for (const d of Object.values(pnlByProperty)) {
      totalIncome += d.totalIncome;
      totalExpenses += d.totalExpenses;
    }
    return { totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses };
  }, [pnlByProperty]);

  // ─── Which properties to show ─────────────────────────────────────────────────

  const visibleProperties = useMemo(() => {
    if (selectedPropertyId === "ALL") {
      return properties;
    }
    if (selectedPropertyId === "OPS") {
      return [];
    }
    return properties.filter((p) => p.id === selectedPropertyId);
  }, [properties, selectedPropertyId]);

  const showOps =
    selectedPropertyId === "ALL" || selectedPropertyId === "OPS";

  // ─── Finalize Month ────────────────────────────────────────────────────────────

  const currentMonthFinancials = monthlyFinancials.filter(
    (mf) => mf.month === `${selectedMonth}-01`
  );
  const currentMonthStatus = currentMonthFinancials.length > 0
    ? (currentMonthFinancials.every((mf) => mf.status === "FINALIZED") ? "FINALIZED" : "DRAFT")
    : null;

  async function handleFinalizeMonth() {
    if (!await confirm({ title: `Finalize ${formatMonthLabel(selectedMonth)}?`, description: "This will lock the P&L into monthly_financials records.", destructive: true })) {
      return;
    }
    setFinalizing(true);
    setFinalizeError(null);
    setFinalizeSuccess(null);

    try {
      const monthStart = `${selectedMonth}-01`;

      // Build upsert records from pnlByProperty
      const upserts = [];
      for (const [key, data] of Object.entries(pnlByProperty)) {
        if (key === "__OPS__") continue; // skip ops for monthly_financials
        upserts.push({
          property_id: key,
          month: monthStart,
          revenue: data.totalIncome,
          expenses: data.totalExpenses,
          net_profit: data.netProfit,
          status: "FINALIZED",
        });
      }

      if (upserts.length === 0) {
        throw new Error("No property P&L data to finalize for this month.");
      }

      const { error } = await supabase
        .from("monthly_financials")
        .upsert(upserts, { onConflict: "property_id,month" });

      if (error) throw new Error(error.message);

      setFinalizeSuccess(`Finalized ${upserts.length} property record(s) for ${formatMonthLabel(selectedMonth)}.`);
      fetchMonthlyFinancials();
    } catch (err) {
      setFinalizeError(err.message);
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <PortalLayout>
      {/* Page header */}
      <div className="mb-10">
        <span className="block text-[11px] uppercase tracking-[0.4em] font-semibold text-accent mb-4">Money</span>
        <h1 className="font-display text-3xl font-extrabold text-foreground tracking-tight">
          P&L Report
        </h1>
        <p className="text-foreground-variant font-body font-medium mt-1">
          Monthly income vs expenses by property, from confirmed bank transactions.
        </p>
        <p className="text-foreground-variant/70 font-body text-xs mt-1">
          Based on categorized bank transactions
        </p>
      </div>

      {/* Month navigator + property filter */}
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <button
          onClick={() => setSelectedMonth((m) => addMonths(m, -1))}
          className="w-10 h-10 bg-surface rounded-xl border border-border flex items-center justify-center text-foreground-variant hover:bg-white/5 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">chevron_left</span>
        </button>
        <span className="font-display font-bold text-lg text-foreground min-w-[180px] text-center">
          {formatMonthLabel(selectedMonth)}
        </span>
        <button
          onClick={() => setSelectedMonth((m) => addMonths(m, 1))}
          className="w-10 h-10 bg-surface rounded-xl border border-border flex items-center justify-center text-foreground-variant hover:bg-white/5 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">chevron_right</span>
        </button>

        <div className="ml-auto">
          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="h-10 px-4 rounded-xl border border-border bg-surface font-body text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            <option value="ALL">All Properties</option>
            <option value="OPS">Ops (No Property)</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <SummaryCard
            label="Total Income"
            value={totals.totalIncome}
            color="text-emerald-400"
          />
          <SummaryCard
            label="Total Expenses"
            value={totals.totalExpenses}
            color="text-red-300"
          />
          <SummaryCard
            label="Net Profit"
            value={totals.netProfit}
            color={totals.netProfit >= 0 ? "text-white" : "text-red-300"}
            bgClass={totals.netProfit >= 0 ? "bg-accent" : "bg-red-500/15"}
          />
        </div>
      )}

      {/* Finalize Month controls */}
      {!loading && Object.keys(pnlByProperty).length > 0 && (
        <div className="bg-surface rounded-2xl p-6 border border-border mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-accent text-[24px]">lock</span>
              <div>
                <h3 className="font-display font-bold text-foreground">
                  Finalize Month
                </h3>
                <p className="font-body text-sm text-foreground-variant">
                  Lock {formatMonthLabel(selectedMonth)} P&L into monthly_financials records.
                </p>
              </div>
              {currentMonthStatus && (
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ml-2 ${
                  currentMonthStatus === "FINALIZED"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-amber-500/15 text-amber-300"
                }`}>
                  {currentMonthStatus}
                </span>
              )}
              {!currentMonthStatus && (
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ml-2 bg-white/5 text-foreground-variant">
                  NOT YET FINALIZED
                </span>
              )}
            </div>
            <button
              onClick={handleFinalizeMonth}
              disabled={finalizing}
              className="px-6 py-3 bg-accent text-white rounded-full font-body font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              {finalizing ? "Finalizing..." : currentMonthStatus === "FINALIZED" ? "Re-finalize" : "Finalize Month"}
            </button>
          </div>

          {finalizeError && (
            <div className="mt-4 p-3 bg-red-500/15 rounded-xl flex items-start gap-2">
              <span className="material-symbols-outlined text-red-300 text-[18px] shrink-0">error</span>
              <p className="font-body text-sm text-red-300">{finalizeError}</p>
            </div>
          )}
          {finalizeSuccess && (
            <div className="mt-4 p-3 bg-emerald-500/15 rounded-xl flex items-start gap-2">
              <span className="material-symbols-outlined text-emerald-300 text-[18px] shrink-0">check_circle</span>
              <p className="font-body text-sm text-emerald-300">{finalizeSuccess}</p>
            </div>
          )}
        </div>
      )}

      {/* Monthly Financials Status Overview */}
      {monthlyFinancials.length > 0 && (
        <div className="bg-surface rounded-2xl border border-border overflow-hidden mb-8">
          <div className="px-6 py-5 border-b border-border">
            <h3 className="font-display font-bold text-foreground flex items-center gap-2">
              <span className="material-symbols-outlined text-accent text-[20px]">calendar_month</span>
              Finalization Status
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-4 py-3 font-body text-[10px] uppercase tracking-widest text-foreground-variant font-bold">Month</th>
                  <th className="text-left px-4 py-3 font-body text-[10px] uppercase tracking-widest text-foreground-variant font-bold">Property</th>
                  <th className="text-right px-4 py-3 font-body text-[10px] uppercase tracking-widest text-foreground-variant font-bold">Revenue</th>
                  <th className="text-right px-4 py-3 font-body text-[10px] uppercase tracking-widest text-foreground-variant font-bold">Expenses</th>
                  <th className="text-right px-4 py-3 font-body text-[10px] uppercase tracking-widest text-foreground-variant font-bold">Net Profit</th>
                  <th className="text-center px-4 py-3 font-body text-[10px] uppercase tracking-widest text-foreground-variant font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {monthlyFinancials.slice(0, 20).map((mf) => (
                  <tr key={mf.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-body text-sm text-foreground">
                      {mf.month ? formatMonthLabel(mf.month.slice(0, 7)) : "—"}
                    </td>
                    <td className="px-4 py-3 font-body text-sm text-foreground-variant">
                      {mf.properties?.name ?? "—"}
                      {mf.properties?.code && (
                        <span className="ml-1.5 font-body text-xs font-bold bg-white/5 text-accent px-1.5 py-0.5 rounded">
                          {mf.properties.code}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-body text-sm tabular-nums text-emerald-400">
                      {formatSGD(mf.revenue)}
                    </td>
                    <td className="px-4 py-3 text-right font-body text-sm tabular-nums text-red-300">
                      {formatSGD(mf.expenses)}
                    </td>
                    <td className={`px-4 py-3 text-right font-display font-bold text-sm tabular-nums ${
                      Number(mf.net_profit ?? 0) >= 0 ? "text-emerald-400" : "text-red-300"
                    }`}>
                      {formatSGD(mf.net_profit)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        mf.status === "FINALIZED"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-amber-500/15 text-amber-300"
                      }`}>
                        {mf.status ?? "DRAFT"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-property P&L */}
      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-white/5 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Property cards */}
          {visibleProperties.map((prop) => {
            const data = pnlByProperty[prop.id] ?? {
              incomeByCategory: {},
              expenseByCategory: {},
              totalIncome: 0,
              totalExpenses: 0,
              netProfit: 0,
            };
            return (
              <PropertyPnL key={prop.id} property={prop} data={data} />
            );
          })}

          {/* Show properties that have data but weren't in visibleProperties */}
          {selectedPropertyId === "ALL" &&
            Object.keys(pnlByProperty)
              .filter(
                (key) =>
                  key !== "__OPS__" &&
                  !visibleProperties.find((p) => p.id === key)
              )
              .map((key) => {
                const data = pnlByProperty[key];
                const prop = properties.find((p) => p.id === key);
                return (
                  <PropertyPnL
                    key={key}
                    property={prop ?? { name: "Unknown Property", code: key }}
                    data={data}
                  />
                );
              })}

          {/* Ops section (no property) */}
          {showOps && pnlByProperty["__OPS__"] && (
            <PropertyPnL property={null} data={pnlByProperty["__OPS__"]} />
          )}

          {/* Empty state */}
          {Object.keys(pnlByProperty).length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 bg-surface rounded-2xl border border-border">
              <span className="material-symbols-outlined text-5xl text-foreground-variant">
                analytics
              </span>
              <p className="font-display text-base font-semibold text-accent">
                No confirmed transactions for {formatMonthLabel(selectedMonth)}
              </p>
              <p className="font-body text-sm text-foreground-variant">
                Import and confirm transactions in the Import page to see P&L data here.
              </p>
            </div>
          )}
        </div>
      )}
    </PortalLayout>
  );
}
