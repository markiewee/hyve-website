import { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useInvestor } from "../../hooks/useInvestor";
import { useInvestorReports } from "../../hooks/useInvestorReports";
import { supabase } from "../../lib/supabase";
import InvestorLayout from "../../components/portal/InvestorLayout";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMonth(monthStr) {
  if (!monthStr) return "\u2014";
  const [year, month] = monthStr.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-SG", { month: "long", year: "numeric" });
}

function formatSGD(amount) {
  if (amount == null) return "\u2014";
  return `$${Number(amount).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const CATEGORY_LABELS = {
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
  GOODS_TRANSPORT: "Goods Transportation",
  MANAGEMENT_FEES: "Management Fees",
  OTHER: "Other",
  OTHER_EXPENSE: "Other Expense",
};

function categoryLabel(cat) {
  return CATEGORY_LABELS[cat] || cat?.replace(/_/g, " ") || "\u2014";
}

// Ordered expense categories for consistent row display
const EXPENSE_CATEGORY_ORDER = [
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
  "GOODS_TRANSPORT",
  "OTHER",
  "OTHER_EXPENSE",
];

function SkeletonRow() {
  return (
    <div className="bg-white rounded-2xl p-6 border border-[#E8E0CE]/10 shadow-sm space-y-3">
      <div className="h-4 w-1/3 bg-[#F2D88A] animate-pulse rounded" />
      <div className="h-4 w-full bg-[#F2D88A] animate-pulse rounded" />
      <div className="h-4 w-2/3 bg-[#F2D88A] animate-pulse rounded" />
    </div>
  );
}

// ─── P&L Table Component ──────────────────────────────────────────────────────

function MonthlyPnLTable({ month, propertyIds, investments, reportsForMonth }) {
  const [loading, setLoading] = useState(true);
  const [tableData, setTableData] = useState(null);

  // Build a property lookup from investments
  const propertyMap = {};
  for (const inv of investments) {
    if (inv.properties) {
      propertyMap[inv.property_id] = inv.properties;
    }
  }

  const fetchData = useCallback(async () => {
    if (!month || propertyIds.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // The month string from investor_reports is YYYY-MM-DD format
    // We need to query property_expenses and rent_payments for this month
    const monthDate = month; // e.g. "2026-03-01"

    // 1. Fetch expenses grouped by property and category
    const { data: expenses, error: expErr } = await supabase
      .from("property_expenses")
      .select("property_id, category, amount")
      .in("property_id", propertyIds)
      .eq("month", monthDate);

    if (expErr) console.error("Error fetching expenses:", expErr);

    // 2. Fetch rooms for these properties (to join rent_payments)
    const { data: rooms, error: roomErr } = await supabase
      .from("rooms")
      .select("id, property_id, unit_code")
      .in("property_id", propertyIds);

    if (roomErr) console.error("Error fetching rooms:", roomErr);

    const roomIds = (rooms ?? []).map((r) => r.id);
    const roomToProperty = {};
    for (const r of rooms ?? []) {
      roomToProperty[r.id] = r.property_id;
    }

    // 3. Fetch rent payments for the month
    let rentPayments = [];
    if (roomIds.length > 0) {
      const { data: rents, error: rentErr } = await supabase
        .from("rent_payments")
        .select("rent_amount, paid_amount, status, room_id")
        .eq("month", monthDate)
        .in("status", ["PAID", "PARTIAL"])
        .in("room_id", roomIds);

      if (rentErr) console.error("Error fetching rents:", rentErr);
      rentPayments = rents ?? [];
    }

    // 4. Fetch monthly_financials for carried_loss data
    const { data: financials, error: finErr } = await supabase
      .from("monthly_financials")
      .select("property_id, carried_loss")
      .in("property_id", propertyIds)
      .eq("month", monthDate);

    if (finErr) console.error("Error fetching financials:", finErr);

    // ─── Aggregate data per property ───────────────────────────────────

    // Income per property (rent collected)
    const incomeByProperty = {};
    for (const pid of propertyIds) incomeByProperty[pid] = 0;
    for (const rent of rentPayments) {
      const pid = roomToProperty[rent.room_id];
      if (pid) {
        incomeByProperty[pid] =
          (incomeByProperty[pid] || 0) + Math.abs(Number(rent.paid_amount ?? rent.rent_amount));
      }
    }

    // Expenses per property per category
    const expensesByPropertyCategory = {};
    const allCategories = new Set();
    for (const pid of propertyIds) expensesByPropertyCategory[pid] = {};

    for (const exp of expenses ?? []) {
      const pid = exp.property_id;
      const cat = exp.category || "OTHER";
      allCategories.add(cat);
      if (!expensesByPropertyCategory[pid]) expensesByPropertyCategory[pid] = {};
      expensesByPropertyCategory[pid][cat] =
        (expensesByPropertyCategory[pid][cat] || 0) + Math.abs(Number(exp.amount));
    }

    // Sort categories by the defined order, then append any extras
    const orderedCategories = EXPENSE_CATEGORY_ORDER.filter((c) =>
      allCategories.has(c)
    );
    for (const c of allCategories) {
      if (!orderedCategories.includes(c) && c !== "MANAGEMENT_FEES") {
        orderedCategories.push(c);
      }
    }

    // Carried loss per property
    const carriedLossByProperty = {};
    for (const f of financials ?? []) {
      carriedLossByProperty[f.property_id] = Number(f.carried_loss ?? 0);
    }

    // Total expenses per property (excluding management fees which is separate)
    const totalExpensesByProperty = {};
    for (const pid of propertyIds) {
      let total = 0;
      for (const [cat, amt] of Object.entries(
        expensesByPropertyCategory[pid] || {}
      )) {
        if (cat !== "MANAGEMENT_FEES") {
          total += amt;
        }
      }
      totalExpensesByProperty[pid] = total;
    }

    // Management fee per property (from expenses with MANAGEMENT_FEES category)
    const mgmtFeeByProperty = {};
    for (const pid of propertyIds) {
      mgmtFeeByProperty[pid] =
        expensesByPropertyCategory[pid]?.["MANAGEMENT_FEES"] || 0;
    }

    // Net profit per property
    const netProfitByProperty = {};
    for (const pid of propertyIds) {
      const income = incomeByProperty[pid] || 0;
      const expenses = totalExpensesByProperty[pid] || 0;
      const carriedLoss = carriedLossByProperty[pid] || 0;
      const mgmtFee = mgmtFeeByProperty[pid] || 0;
      netProfitByProperty[pid] = income - expenses - carriedLoss - mgmtFee;
    }

    setTableData({
      incomeByProperty,
      expensesByPropertyCategory,
      orderedCategories,
      totalExpensesByProperty,
      carriedLossByProperty,
      mgmtFeeByProperty,
      netProfitByProperty,
    });
    setLoading(false);
  }, [month, propertyIds.join(",")]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Derive notes and PDF links from investor_reports ───────────────────────
  const notesForMonth = reportsForMonth
    .filter((r) => r.notes)
    .map((r) => ({
      property: r.properties?.name,
      notes: r.notes,
    }));

  const pdfLinks = reportsForMonth.filter((r) => r.file_url);

  // ─── Month label ────────────────────────────────────────────────────────────
  const monthLabel = formatMonth(month?.slice(0, 7));

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-[#E8E0CE]/10 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-[#E8E0CE]/10">
          <div className="h-6 w-48 bg-[#F2D88A] animate-pulse rounded" />
        </div>
        <div className="p-8 space-y-3">
          <div className="h-4 w-full bg-[#F2D88A] animate-pulse rounded" />
          <div className="h-4 w-full bg-[#F2D88A] animate-pulse rounded" />
          <div className="h-4 w-2/3 bg-[#F2D88A] animate-pulse rounded" />
          <div className="h-4 w-full bg-[#F2D88A] animate-pulse rounded" />
          <div className="h-4 w-1/2 bg-[#F2D88A] animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (!tableData) return null;

  const {
    incomeByProperty,
    expensesByPropertyCategory,
    orderedCategories,
    totalExpensesByProperty,
    carriedLossByProperty,
    mgmtFeeByProperty,
    netProfitByProperty,
  } = tableData;

  const showTotal = propertyIds.length > 1;

  // ─── Compute totals across all properties ──────────────────────────────────
  const totalIncome = propertyIds.reduce(
    (s, pid) => s + (incomeByProperty[pid] || 0),
    0
  );
  const totalExpensesAll = propertyIds.reduce(
    (s, pid) => s + (totalExpensesByProperty[pid] || 0),
    0
  );
  const totalCarriedLoss = propertyIds.reduce(
    (s, pid) => s + (carriedLossByProperty[pid] || 0),
    0
  );
  const totalMgmtFee = propertyIds.reduce(
    (s, pid) => s + (mgmtFeeByProperty[pid] || 0),
    0
  );
  const totalNetProfit = propertyIds.reduce(
    (s, pid) => s + (netProfitByProperty[pid] || 0),
    0
  );

  // Category totals across properties
  const categoryTotals = {};
  for (const cat of orderedCategories) {
    categoryTotals[cat] = propertyIds.reduce(
      (s, pid) => s + (expensesByPropertyCategory[pid]?.[cat] || 0),
      0
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const colCount = propertyIds.length + (showTotal ? 2 : 1); // label col + property cols + total col

  return (
    <div className="bg-white rounded-2xl border border-[#E8E0CE]/10 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-[#E8E0CE]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[24px] text-[#A87813]">
            analytics
          </span>
          <h3 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#1F2937]">
            {monthLabel}
          </h3>
        </div>

        {/* PDF download buttons */}
        {pdfLinks.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {pdfLinks.map((r) => (
              <a
                key={r.id}
                href={r.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#A87813] text-white rounded-xl font-['Manrope'] font-semibold text-sm hover:bg-[#A87813] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">
                  download
                </span>
                {pdfLinks.length > 1
                  ? `PDF \u2014 ${r.properties?.name || "Report"}`
                  : "Download PDF"}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      {notesForMonth.length > 0 && (
        <div className="px-8 py-4 border-b border-[#E8E0CE]/10 bg-[#F2D88A]/50">
          {notesForMonth.map((n, i) => (
            <p
              key={i}
              className="font-['Manrope'] text-sm text-[#6B7280] italic"
            >
              {n.property && (
                <span className="font-semibold not-italic text-[#1F2937]">
                  {n.property}:{" "}
                </span>
              )}
              {n.notes}
            </p>
          ))}
        </div>
      )}

      {/* P&L Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* Column headers */}
          <thead>
            <tr className="bg-[#F2D88A]">
              <th className="text-left px-6 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6B7280] font-bold whitespace-nowrap">
                &nbsp;
              </th>
              {propertyIds.map((pid) => (
                <th
                  key={pid}
                  className="text-right px-6 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6B7280] font-bold whitespace-nowrap"
                >
                  {propertyMap[pid]?.name || propertyMap[pid]?.code || "Property"}
                </th>
              ))}
              {showTotal && (
                <th className="text-right px-6 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#1F2937] font-bold whitespace-nowrap bg-[#FAF0CC]">
                  Total
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {/* ── INCOME Section ───────────────────────────────────── */}
            <tr>
              <td
                colSpan={colCount}
                className="px-6 pt-6 pb-2 font-['Inter'] text-[10px] uppercase tracking-widest text-[#A87813] font-bold"
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px]">
                    trending_up
                  </span>
                  Income
                </span>
              </td>
            </tr>

            {/* Rent Collected */}
            <tr className="hover:bg-[#FAF6EC] transition-colors">
              <td className="px-6 py-3 font-['Manrope'] text-[#1F2937] pl-10">
                Rent Collected
              </td>
              {propertyIds.map((pid) => (
                <td
                  key={pid}
                  className="px-6 py-3 text-right font-['Plus_Jakarta_Sans'] font-semibold tabular-nums text-[#A87813]"
                >
                  {formatSGD(incomeByProperty[pid] || 0)}
                </td>
              ))}
              {showTotal && (
                <td className="px-6 py-3 text-right font-['Plus_Jakarta_Sans'] font-bold tabular-nums text-[#A87813] bg-[#f5f8ff]">
                  {formatSGD(totalIncome)}
                </td>
              )}
            </tr>

            {/* Total Income row */}
            <tr className="border-t border-[#E8E0CE]/15">
              <td className="px-6 py-3 font-['Manrope'] font-bold text-[#1F2937]">
                Total Income
              </td>
              {propertyIds.map((pid) => (
                <td
                  key={pid}
                  className="px-6 py-3 text-right font-['Plus_Jakarta_Sans'] font-bold tabular-nums text-[#A87813]"
                >
                  {formatSGD(incomeByProperty[pid] || 0)}
                </td>
              ))}
              {showTotal && (
                <td className="px-6 py-3 text-right font-['Plus_Jakarta_Sans'] font-extrabold tabular-nums text-[#A87813] bg-[#f5f8ff]">
                  {formatSGD(totalIncome)}
                </td>
              )}
            </tr>

            {/* ── EXPENSES Section ─────────────────────────────────── */}
            <tr>
              <td
                colSpan={colCount}
                className="px-6 pt-8 pb-2 font-['Inter'] text-[10px] uppercase tracking-widest text-[#ba1a1a] font-bold"
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px]">
                    trending_down
                  </span>
                  Expenses
                </span>
              </td>
            </tr>

            {/* Expense category rows */}
            {orderedCategories.map((cat) => (
              <tr
                key={cat}
                className="hover:bg-[#FAF6EC] transition-colors"
              >
                <td className="px-6 py-3 font-['Manrope'] text-[#1F2937] pl-10">
                  {categoryLabel(cat)}
                </td>
                {propertyIds.map((pid) => {
                  const amt = expensesByPropertyCategory[pid]?.[cat] || 0;
                  return (
                    <td
                      key={pid}
                      className={`px-6 py-3 text-right font-['Plus_Jakarta_Sans'] font-semibold tabular-nums ${
                        amt > 0 ? "text-[#ba1a1a]" : "text-[#E8E0CE]"
                      }`}
                    >
                      {amt > 0 ? formatSGD(amt) : "\u2014"}
                    </td>
                  );
                })}
                {showTotal && (
                  <td
                    className={`px-6 py-3 text-right font-['Plus_Jakarta_Sans'] font-bold tabular-nums bg-[#f5f8ff] ${
                      categoryTotals[cat] > 0
                        ? "text-[#ba1a1a]"
                        : "text-[#E8E0CE]"
                    }`}
                  >
                    {categoryTotals[cat] > 0
                      ? formatSGD(categoryTotals[cat])
                      : "\u2014"}
                  </td>
                )}
              </tr>
            ))}

            {/* No expense categories found */}
            {orderedCategories.length === 0 && (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-6 py-4 text-center font-['Manrope'] text-sm text-[#6B7280] italic"
                >
                  No expenses recorded
                </td>
              </tr>
            )}

            {/* Total Expenses row */}
            <tr className="border-t border-[#E8E0CE]/20 bg-[#fef2f2]/30">
              <td className="px-6 py-3 font-['Manrope'] font-bold text-[#1F2937]">
                Total Expenses
              </td>
              {propertyIds.map((pid) => (
                <td
                  key={pid}
                  className="px-6 py-3 text-right font-['Plus_Jakarta_Sans'] font-bold tabular-nums text-[#ba1a1a]"
                >
                  {formatSGD(totalExpensesByProperty[pid] || 0)}
                </td>
              ))}
              {showTotal && (
                <td className="px-6 py-3 text-right font-['Plus_Jakarta_Sans'] font-extrabold tabular-nums text-[#ba1a1a] bg-[#fef2f2]/50">
                  {formatSGD(totalExpensesAll)}
                </td>
              )}
            </tr>

            {/* ── ADJUSTMENTS Section ──────────────────────────────── */}
            <tr>
              <td
                colSpan={colCount}
                className="px-6 pt-8 pb-2 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6B7280] font-bold"
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px]">
                    tune
                  </span>
                  Adjustments
                </span>
              </td>
            </tr>

            {/* Carried Loss row */}
            <tr className="hover:bg-[#FAF6EC] transition-colors">
              <td className="px-6 py-3 font-['Manrope'] text-[#1F2937] pl-10">
                Carried Loss (prev month)
              </td>
              {propertyIds.map((pid) => {
                const loss = carriedLossByProperty[pid] || 0;
                return (
                  <td
                    key={pid}
                    className={`px-6 py-3 text-right font-['Plus_Jakarta_Sans'] font-semibold tabular-nums ${
                      loss > 0 ? "text-[#ba1a1a]" : "text-[#E8E0CE]"
                    }`}
                  >
                    {loss > 0 ? formatSGD(loss) : "\u2014"}
                  </td>
                );
              })}
              {showTotal && (
                <td
                  className={`px-6 py-3 text-right font-['Plus_Jakarta_Sans'] font-bold tabular-nums bg-[#f5f8ff] ${
                    totalCarriedLoss > 0 ? "text-[#ba1a1a]" : "text-[#E8E0CE]"
                  }`}
                >
                  {totalCarriedLoss > 0 ? formatSGD(totalCarriedLoss) : "\u2014"}
                </td>
              )}
            </tr>

            {/* Management Fee row */}
            <tr className="hover:bg-[#FAF6EC] transition-colors">
              <td className="px-6 py-3 font-['Manrope'] text-[#1F2937] pl-10">
                Management Fee
              </td>
              {propertyIds.map((pid) => {
                const fee = mgmtFeeByProperty[pid] || 0;
                return (
                  <td
                    key={pid}
                    className={`px-6 py-3 text-right font-['Plus_Jakarta_Sans'] font-semibold tabular-nums ${
                      fee > 0 ? "text-[#ba1a1a]" : "text-[#E8E0CE]"
                    }`}
                  >
                    {fee > 0 ? formatSGD(fee) : "\u2014"}
                  </td>
                );
              })}
              {showTotal && (
                <td
                  className={`px-6 py-3 text-right font-['Plus_Jakarta_Sans'] font-bold tabular-nums bg-[#f5f8ff] ${
                    totalMgmtFee > 0 ? "text-[#ba1a1a]" : "text-[#E8E0CE]"
                  }`}
                >
                  {totalMgmtFee > 0 ? formatSGD(totalMgmtFee) : "\u2014"}
                </td>
              )}
            </tr>

            {/* ── NET PROFIT Row ─────────────────────────────────── */}
            <tr
              className={`border-t-2 ${
                totalNetProfit >= 0
                  ? "border-[#A87813]/30 bg-[#f0fdf4]/50"
                  : "border-[#ba1a1a]/30 bg-[#fef2f2]/50"
              }`}
            >
              <td className="px-6 py-4 font-['Plus_Jakarta_Sans'] font-extrabold text-[#1F2937] text-base">
                Net Profit
              </td>
              {propertyIds.map((pid) => {
                const net = netProfitByProperty[pid] || 0;
                return (
                  <td
                    key={pid}
                    className={`px-6 py-4 text-right font-['Plus_Jakarta_Sans'] font-extrabold tabular-nums text-base ${
                      net >= 0 ? "text-[#A87813]" : "text-[#ba1a1a]"
                    }`}
                  >
                    {formatSGD(net)}
                  </td>
                );
              })}
              {showTotal && (
                <td
                  className={`px-6 py-4 text-right font-['Plus_Jakarta_Sans'] font-extrabold tabular-nums text-base ${
                    totalNetProfit >= 0
                      ? "text-[#A87813] bg-[#f0fdf4]/80"
                      : "text-[#ba1a1a] bg-[#fef2f2]/80"
                  }`}
                >
                  {formatSGD(totalNetProfit)}
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function InvestorReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const { investor, investments, isInvestor, loading: invLoading } =
    useInvestor();
  const { reports, loading: reportsLoading } = useInvestorReports(investor?.id);

  if (authLoading || invLoading) {
    return (
      <InvestorLayout>
        <div className="space-y-4">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </InvestorLayout>
    );
  }

  if (!user) return <Navigate to="/portal/login" replace />;
  if (!isInvestor) return <Navigate to="/portal/dashboard" replace />;

  // Investor's property IDs
  const propertyIds = investments.map((i) => i.property_id);

  // Group reports by month (YYYY-MM from the month field which is YYYY-MM-DD)
  const byMonth = {};
  for (const r of reports) {
    const monthKey = r.month?.slice(0, 7) ?? "Unknown";
    if (!byMonth[monthKey]) byMonth[monthKey] = [];
    byMonth[monthKey].push(r);
  }

  // Group months by year, sorted descending
  const byYear = {};
  for (const monthKey of Object.keys(byMonth)) {
    const year = monthKey.slice(0, 4);
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(monthKey);
  }

  // Sort years descending, months within year descending
  const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));
  for (const year of years) {
    byYear[year].sort((a, b) => b.localeCompare(a));
  }

  return (
    <InvestorLayout>
      <section className="mb-12">
        <h2 className="font-['Plus_Jakarta_Sans'] text-4xl font-extrabold text-[#1F2937] tracking-tight mb-2">
          Reports
        </h2>
        <p className="font-['Manrope'] text-[#6B7280] text-lg leading-relaxed">
          Monthly P&L statements and financial reports for your properties.
        </p>
      </section>

      {reportsLoading ? (
        <div className="space-y-4">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-[2rem] p-12 border border-[#E8E0CE]/10 shadow-sm text-center">
          <span className="material-symbols-outlined text-[48px] text-[#E8E0CE] mb-4 block">
            description
          </span>
          <p className="font-['Manrope'] text-[#6B7280] text-lg">
            No reports available yet.
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {years.map((year) => (
            <section key={year}>
              <h3 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#1F2937] mb-6">
                {year}
              </h3>
              <div className="space-y-8">
                {byYear[year].map((monthKey) => {
                  // Get the month date from the first report (YYYY-MM-DD format)
                  const reportsForMonth = byMonth[monthKey];
                  const monthDate = reportsForMonth[0]?.month;

                  return (
                    <MonthlyPnLTable
                      key={monthKey}
                      month={monthDate}
                      propertyIds={propertyIds}
                      investments={investments}
                      reportsForMonth={reportsForMonth}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </InvestorLayout>
  );
}
