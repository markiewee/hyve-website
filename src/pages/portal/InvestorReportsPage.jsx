import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useInvestor } from "../../hooks/useInvestor";
import { useInvestorReports } from "../../hooks/useInvestorReports";
import { supabase } from "../../lib/supabase";
import InvestorLayout from "../../components/portal/InvestorLayout";

function formatMonth(monthStr) {
  if (!monthStr) return "—";
  const [year, month] = monthStr.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-SG", { month: "long", year: "numeric" });
}

function formatSGD(amount) {
  if (amount == null) return "—";
  return `$${Number(amount).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function categoryLabel(cat) {
  const labels = {
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
  return labels[cat] || cat?.replace(/_/g, " ") || "—";
}

function SkeletonRow() {
  return (
    <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/10 shadow-sm space-y-3">
      <div className="h-4 w-1/3 bg-[#eff4ff] animate-pulse rounded" />
      <div className="h-4 w-full bg-[#eff4ff] animate-pulse rounded" />
      <div className="h-4 w-2/3 bg-[#eff4ff] animate-pulse rounded" />
    </div>
  );
}

function ReportCard({ report }) {
  const [expanded, setExpanded] = useState(false);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  async function loadDetails() {
    if (details) {
      setExpanded(!expanded);
      return;
    }

    setLoading(true);
    setExpanded(true);

    const monthDate = report.month;
    const propertyId = report.property_id;

    // Fetch expense breakdown
    const { data: expenses } = await supabase
      .from("property_expenses")
      .select("category, description, amount")
      .eq("property_id", propertyId)
      .eq("month", monthDate)
      .order("amount", { ascending: false });

    // Fetch rent breakdown
    const { data: rents } = await supabase
      .from("rent_payments")
      .select("rent_amount, status, tenant_profiles(tenant_details(full_name), rooms(unit_code))")
      .eq("month", monthDate)
      .in("status", ["PAID", "PARTIAL"]);

    // Filter rents to this property via room's property
    const { data: rooms } = await supabase
      .from("rooms")
      .select("id")
      .eq("property_id", propertyId);

    const roomIds = new Set((rooms ?? []).map((r) => r.id));

    // Group expenses by category
    const expenseByCategory = {};
    for (const e of expenses ?? []) {
      const cat = e.category || "OTHER";
      if (!expenseByCategory[cat]) expenseByCategory[cat] = 0;
      expenseByCategory[cat] += Math.abs(Number(e.amount));
    }

    // Filter and map rents
    const rentList = (rents ?? [])
      .filter((r) => {
        const roomId = r.tenant_profiles?.rooms?.id;
        return roomId && roomIds.has(roomId);
      })
      .map((r) => ({
        name: r.tenant_profiles?.tenant_details?.[0]?.full_name ||
              r.tenant_profiles?.tenant_details?.full_name || "Unknown",
        room: r.tenant_profiles?.rooms?.unit_code || "—",
        amount: Number(r.rent_amount),
        status: r.status,
      }));

    setDetails({ expenseByCategory, rentList });
    setLoading(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-[#bbcac6]/10 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Header — clickable */}
      <button
        onClick={loadDetails}
        className="w-full p-6 text-left"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0 flex items-center gap-3">
            <span className={`material-symbols-outlined text-[20px] text-[#6c7a77] transition-transform ${expanded ? "rotate-90" : ""}`}>
              chevron_right
            </span>
            <div>
              <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] text-lg">
                {report.title}
              </h4>
              <p className="font-['Manrope'] text-sm text-[#555f6f] mt-1">
                {report.properties?.name ?? "—"} &middot; {formatMonth(report.month)}
              </p>
              {report.notes && (
                <p className="font-['Manrope'] text-sm text-[#6c7a77] mt-2 italic">
                  {report.notes}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6 flex-shrink-0">
            <div className="text-right">
              <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                Revenue
              </p>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] tabular-nums">
                {formatSGD(report.total_revenue)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                Expenses
              </p>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] tabular-nums">
                {formatSGD(report.total_expenses)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                Net
              </p>
              <p className={`font-['Plus_Jakarta_Sans'] font-bold tabular-nums ${
                Number(report.net_income) >= 0 ? "text-[#006b5f]" : "text-[#ba1a1a]"
              }`}>
                {formatSGD(report.net_income)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                Distributed
              </p>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-[#006b5f] tabular-nums">
                {formatSGD(report.distribution_amount)}
              </p>
            </div>

            {report.file_url && (
              <a
                href={report.file_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-semibold text-sm hover:bg-[#005a50] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                PDF
              </a>
            )}
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-6 pb-6 border-t border-[#bbcac6]/10">
          {loading ? (
            <div className="py-6 space-y-2">
              <div className="h-4 w-full bg-[#eff4ff] animate-pulse rounded" />
              <div className="h-4 w-2/3 bg-[#eff4ff] animate-pulse rounded" />
            </div>
          ) : details ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
              {/* Income breakdown */}
              <div>
                <h5 className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#006b5f] font-bold mb-4">
                  Income Breakdown
                </h5>
                {details.rentList.length === 0 ? (
                  <p className="font-['Manrope'] text-sm text-[#6c7a77]">No rent data available.</p>
                ) : (
                  <div className="space-y-2">
                    {details.rentList.map((r, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5">
                        <div className="min-w-0">
                          <p className="font-['Manrope'] text-sm text-[#121c2a] font-semibold">{r.name}</p>
                          <p className="font-['Inter'] text-[10px] text-[#6c7a77]">{r.room}</p>
                        </div>
                        <p className="font-['Plus_Jakarta_Sans'] font-bold text-sm tabular-nums text-[#121c2a] shrink-0">
                          {formatSGD(r.amount)}
                        </p>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-2 border-t border-[#bbcac6]/15">
                      <p className="font-['Manrope'] text-sm font-bold text-[#121c2a]">Total Income</p>
                      <p className="font-['Plus_Jakarta_Sans'] font-bold text-sm tabular-nums text-[#006b5f]">
                        {formatSGD(details.rentList.reduce((s, r) => s + r.amount, 0))}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Expense breakdown */}
              <div>
                <h5 className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#ba1a1a] font-bold mb-4">
                  Expense Breakdown
                </h5>
                {Object.keys(details.expenseByCategory).length === 0 ? (
                  <p className="font-['Manrope'] text-sm text-[#6c7a77]">No expense data available.</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(details.expenseByCategory)
                      .sort(([, a], [, b]) => b - a)
                      .map(([cat, amt]) => (
                        <div key={cat} className="flex items-center justify-between py-1.5">
                          <p className="font-['Manrope'] text-sm text-[#121c2a]">{categoryLabel(cat)}</p>
                          <p className="font-['Plus_Jakarta_Sans'] font-bold text-sm tabular-nums text-[#121c2a] shrink-0">
                            {formatSGD(amt)}
                          </p>
                        </div>
                      ))}
                    <div className="flex items-center justify-between pt-2 border-t border-[#bbcac6]/15">
                      <p className="font-['Manrope'] text-sm font-bold text-[#121c2a]">Total Expenses</p>
                      <p className="font-['Plus_Jakarta_Sans'] font-bold text-sm tabular-nums text-[#ba1a1a]">
                        {formatSGD(Object.values(details.expenseByCategory).reduce((s, v) => s + v, 0))}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function InvestorReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const { investor, isInvestor, loading: invLoading } = useInvestor();
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

  // Group reports by year
  const byYear = {};
  for (const r of reports) {
    const year = r.month?.slice(0, 4) ?? "Unknown";
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(r);
  }
  const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));

  return (
    <InvestorLayout>
      <section className="mb-12">
        <h2 className="font-['Plus_Jakarta_Sans'] text-4xl font-extrabold text-[#121c2a] tracking-tight mb-2">
          Reports
        </h2>
        <p className="font-['Manrope'] text-[#555f6f] text-lg leading-relaxed">
          Monthly financial reports and payout history for your properties.
        </p>
      </section>

      {reportsLoading ? (
        <div className="space-y-4">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-[2rem] p-12 border border-[#bbcac6]/10 shadow-sm text-center">
          <span className="material-symbols-outlined text-[48px] text-[#bbcac6] mb-4 block">
            description
          </span>
          <p className="font-['Manrope'] text-[#555f6f] text-lg">
            No reports available yet.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {years.map((year) => (
            <section key={year}>
              <h3 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#121c2a] mb-4">
                {year}
              </h3>
              <div className="space-y-4">
                {byYear[year].map((report) => (
                  <ReportCard key={report.id} report={report} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </InvestorLayout>
  );
}
