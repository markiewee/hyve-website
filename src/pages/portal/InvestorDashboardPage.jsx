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
    <div className="bg-white rounded-[2rem] p-8 border border-[#E8E0CE]/10 shadow-sm space-y-4">
      <div className="h-5 w-1/3 bg-[#F2D88A] animate-pulse rounded" />
      <div className="h-4 w-full bg-[#F2D88A] animate-pulse rounded" />
      <div className="h-4 w-2/3 bg-[#F2D88A] animate-pulse rounded" />
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
          <h2 className="font-['Plus_Jakarta_Sans'] text-4xl font-extrabold text-[#1F2937] tracking-tight mb-2">
            Portfolio Overview
          </h2>
          <p className="font-['Manrope'] text-[#6B7280] text-lg leading-relaxed">
            Your investment performance across Lazybee properties.
            {returnRate > 0 && (
              <> Your portfolio is performing{" "}
                <span className="text-[#A87813] font-bold">+{returnRate.toFixed(1)}%</span> return.
              </>
            )}
          </p>
        </div>
      </section>

      {/* Bento Grid Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-12">
        {/* ROI Widget (Bento Large) */}
        <div className="md:col-span-4 bg-[#F2D88A] p-8 rounded-[2rem] flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-[#A87813]/10 rounded-full blur-3xl group-hover:bg-[#A87813]/20 transition-colors" />
          <div>
            <span className="font-['Inter'] text-xs font-bold tracking-widest text-[#A87813] uppercase mb-1 block">
              Total Return Rate
            </span>
            {dashLoading ? (
              <div className="h-16 w-32 bg-[#FAF0CC] animate-pulse rounded mt-2" />
            ) : (
              <>
                <h3 className="font-['Plus_Jakarta_Sans'] text-6xl font-black text-[#1F2937] mb-2">
                  {returnRate.toFixed(1)}<span className="text-[#D9A441]">%</span>
                </h3>
                <p className="font-['Manrope'] text-sm text-[#6B7280]">
                  Annualised portfolio return
                </p>
              </>
            )}
          </div>
          <div className="mt-8">
            <div className="h-1 w-full bg-[#E8E0CE]/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#A87813] rounded-full transition-all"
                style={{ width: `${Math.min(returnRate * 5, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-[10px] font-bold font-['Inter'] text-[#6B7280] uppercase tracking-tighter">
              <span>Target 15%</span>
              <span>Current {returnRate.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Financial Metrics */}
        <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-[#E8E0CE]/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#A87813]/10 flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-[#A87813]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  account_balance
                </span>
              </div>
              <span className="font-['Plus_Jakarta_Sans'] font-bold text-[#1F2937]">Capital Contribution</span>
            </div>
            {dashLoading ? (
              <div className="h-10 w-40 bg-[#F2D88A] animate-pulse rounded" />
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="font-['Plus_Jakarta_Sans'] text-4xl font-black text-[#1F2937]">
                    ${totalCapital.toLocaleString("en-SG", { minimumFractionDigits: 0 })}
                  </span>
                  <span className="font-['Inter'] text-sm text-[#E8E0CE]">SGD</span>
                </div>
                <p className="mt-4 font-['Manrope'] text-sm text-[#6B7280]">
                  Across {investments.length} active propert{investments.length !== 1 ? "ies" : "y"}.
                </p>
              </>
            )}
          </div>

          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-[#E8E0CE]/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#D9A441]/10 flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-[#A87813]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  payments
                </span>
              </div>
              <span className="font-['Plus_Jakarta_Sans'] font-bold text-[#1F2937]">Total Distributions</span>
            </div>
            {dashLoading ? (
              <div className="h-10 w-40 bg-[#F2D88A] animate-pulse rounded" />
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="font-['Plus_Jakarta_Sans'] text-4xl font-black text-[#1F2937]">
                    ${totalDistributions.toLocaleString("en-SG", { minimumFractionDigits: 0 })}
                  </span>
                  <span className="font-['Inter'] text-sm text-[#E8E0CE]">SGD</span>
                </div>
                <p className="mt-4 font-['Manrope'] text-sm text-[#6B7280]">
                  {thisMonthDistribution > 0
                    ? `$${thisMonthDistribution.toLocaleString("en-SG", { minimumFractionDigits: 2 })} this month`
                    : "No distribution this month"}
                </p>
              </>
            )}
          </div>
        </div>
      </div>


      {/* Property performance cards */}
      {investments.length > 0 && (
        <section className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#1F2937]">
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
      <section className="bg-white rounded-[2rem] p-10 shadow-sm border border-[#E8E0CE]/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h3 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#1F2937]">
              Distribution History
            </h3>
            <p className="font-['Manrope'] text-sm text-[#6B7280] mt-1">
              Transaction ledger for your investments
            </p>
          </div>
        </div>

        {dashLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-[#F2D88A] animate-pulse rounded-xl" />
            ))}
          </div>
        ) : (
          <DistributionTable distributions={distributions} />
        )}
      </section>
    </InvestorLayout>
  );
}
