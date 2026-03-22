import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useInvestor } from "../../hooks/useInvestor";
import { useInvestorDashboard } from "../../hooks/useInvestorDashboard";
import InvestorLayout from "../../components/portal/InvestorLayout";
import PortfolioSummary from "../../components/portal/PortfolioSummary";
import PropertyPerformanceCard from "../../components/portal/PropertyPerformanceCard";
import DistributionTable from "../../components/portal/DistributionTable";

function SkeletonCard() {
  return (
    <div className="bg-white rounded-[2rem] p-8 border border-[#bbcac6]/10 shadow-sm space-y-4">
      <div className="h-5 w-1/3 bg-[#eff4ff] animate-pulse rounded" />
      <div className="h-4 w-full bg-[#eff4ff] animate-pulse rounded" />
      <div className="h-4 w-2/3 bg-[#eff4ff] animate-pulse rounded" />
    </div>
  );
}

export default function InvestorDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { investor, isInvestor, loading: invLoading } = useInvestor();

  const {
    investments,
    distributions,
    financials,
    totalCapital,
    totalDistributions,
    returnRate,
    thisMonthDistribution,
    loading: dashLoading,
  } = useInvestorDashboard(investor?.id);

  if (authLoading || invLoading) {
    return (
      <InvestorLayout>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-4">
            <SkeletonCard />
          </div>
          <div className="md:col-span-8 grid grid-cols-2 gap-6">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </InvestorLayout>
    );
  }

  if (!user) {
    return <Navigate to="/portal/login" replace />;
  }

  if (!isInvestor) {
    return <Navigate to="/portal/dashboard" replace />;
  }

  function getLatestFinancial(propertyId) {
    return financials.find((f) => f.property_id === propertyId) ?? null;
  }

  return (
    <InvestorLayout>
      {/* Page header */}
      <section className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="max-w-2xl">
          <h2 className="font-['Plus_Jakarta_Sans'] text-4xl font-extrabold text-[#121c2a] tracking-tight mb-2">
            Portfolio Overview
          </h2>
          <p className="font-['Manrope'] text-[#555f6f] text-lg leading-relaxed">
            Your investment performance across Hyve properties.
            {returnRate > 0 && (
              <> Your portfolio is performing{" "}
                <span className="text-[#006b5f] font-bold">+{returnRate.toFixed(1)}%</span> return.
              </>
            )}
          </p>
        </div>
      </section>

      {/* Bento Grid Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-12">
        {/* ROI Widget (Bento Large) */}
        <div className="md:col-span-4 bg-[#eff4ff] p-8 rounded-[2rem] flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-[#006b5f]/10 rounded-full blur-3xl group-hover:bg-[#006b5f]/20 transition-colors" />
          <div>
            <span className="font-['Inter'] text-xs font-bold tracking-widest text-[#006b5f] uppercase mb-1 block">
              Total Return Rate
            </span>
            {dashLoading ? (
              <div className="h-16 w-32 bg-[#d9e3f6] animate-pulse rounded mt-2" />
            ) : (
              <>
                <h3 className="font-['Plus_Jakarta_Sans'] text-6xl font-black text-[#121c2a] mb-2">
                  {returnRate.toFixed(1)}<span className="text-[#14b8a6]">%</span>
                </h3>
                <p className="font-['Manrope'] text-sm text-[#555f6f]">
                  Annualised portfolio return
                </p>
              </>
            )}
          </div>
          <div className="mt-8">
            <div className="h-1 w-full bg-[#bbcac6]/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#006b5f] rounded-full transition-all"
                style={{ width: `${Math.min(returnRate * 5, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-[10px] font-bold font-['Inter'] text-[#6c7a77] uppercase tracking-tighter">
              <span>Target 15%</span>
              <span>Current {returnRate.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Financial Metrics */}
        <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-[#bbcac6]/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#006a61]/10 flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-[#006a61]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  account_balance
                </span>
              </div>
              <span className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a]">Capital Contribution</span>
            </div>
            {dashLoading ? (
              <div className="h-10 w-40 bg-[#eff4ff] animate-pulse rounded" />
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="font-['Plus_Jakarta_Sans'] text-4xl font-black text-[#121c2a]">
                    ${totalCapital.toLocaleString("en-SG", { minimumFractionDigits: 0 })}
                  </span>
                  <span className="font-['Inter'] text-sm text-[#bbcac6]">SGD</span>
                </div>
                <p className="mt-4 font-['Manrope'] text-sm text-[#555f6f]">
                  Across {investments.length} active propert{investments.length !== 1 ? "ies" : "y"}.
                </p>
              </>
            )}
          </div>

          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-[#bbcac6]/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#14b8a6]/10 flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-[#006b5f]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  payments
                </span>
              </div>
              <span className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a]">Total Distributions</span>
            </div>
            {dashLoading ? (
              <div className="h-10 w-40 bg-[#eff4ff] animate-pulse rounded" />
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="font-['Plus_Jakarta_Sans'] text-4xl font-black text-[#121c2a]">
                    ${totalDistributions.toLocaleString("en-SG", { minimumFractionDigits: 0 })}
                  </span>
                  <span className="font-['Inter'] text-sm text-[#bbcac6]">SGD</span>
                </div>
                <p className="mt-4 font-['Manrope'] text-sm text-[#555f6f]">
                  {thisMonthDistribution > 0
                    ? `$${thisMonthDistribution.toLocaleString("en-SG", { minimumFractionDigits: 2 })} this month`
                    : "No distribution this month"}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Portfolio Summary component (catches any additional metrics) */}
      {!dashLoading && (
        <div className="mb-12">
          <PortfolioSummary
            totalCapital={totalCapital}
            thisMonthDistribution={thisMonthDistribution}
            totalDistributions={totalDistributions}
            returnRate={returnRate}
            loading={dashLoading}
          />
        </div>
      )}

      {/* Property performance cards */}
      {investments.length > 0 && (
        <section className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#121c2a]">
              Portfolio Assets
            </h3>
          </div>

          {dashLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {[1, 2].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {investments.map((inv) => (
                <PropertyPerformanceCard
                  key={inv.id}
                  property={inv.properties}
                  investment={inv}
                  financial={getLatestFinancial(inv.property_id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Distribution history */}
      <section className="bg-white rounded-[2rem] p-10 shadow-sm border border-[#bbcac6]/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h3 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#121c2a]">
              Distribution History
            </h3>
            <p className="font-['Manrope'] text-sm text-[#555f6f] mt-1">
              Transaction ledger for your investments
            </p>
          </div>
        </div>

        {dashLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-[#eff4ff] animate-pulse rounded-xl" />
            ))}
          </div>
        ) : (
          <DistributionTable distributions={distributions} />
        )}
      </section>
    </InvestorLayout>
  );
}
