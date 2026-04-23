import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useInvestor } from "../../hooks/useInvestor";
import { useInvestorReports } from "../../hooks/useInvestorReports";
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

function SkeletonRow() {
  return (
    <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/10 shadow-sm space-y-3">
      <div className="h-4 w-1/3 bg-[#eff4ff] animate-pulse rounded" />
      <div className="h-4 w-full bg-[#eff4ff] animate-pulse rounded" />
      <div className="h-4 w-2/3 bg-[#eff4ff] animate-pulse rounded" />
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
      {/* Page header */}
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
                  <div
                    key={report.id}
                    className="bg-white rounded-2xl p-6 border border-[#bbcac6]/10 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left: title + property */}
                      <div className="min-w-0">
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

                      {/* Right: financials */}
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

                        {/* PDF download */}
                        {report.file_url && (
                          <a
                            href={report.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2.5 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-semibold text-sm hover:bg-[#005a50] transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              download
                            </span>
                            PDF
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </InvestorLayout>
  );
}
