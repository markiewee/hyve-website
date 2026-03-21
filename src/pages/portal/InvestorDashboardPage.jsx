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
    <div className="rounded-lg border bg-card p-5 space-y-3">
      <div className="h-5 w-1/3 bg-gray-100 animate-pulse rounded" />
      <div className="h-4 w-full bg-gray-100 animate-pulse rounded" />
      <div className="h-4 w-2/3 bg-gray-100 animate-pulse rounded" />
    </div>
  );
}

export default function InvestorDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { investor, investments: invList, isInvestor, loading: invLoading } = useInvestor();

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
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonCard key={i} />
            ))}
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

  // Get most recent financial per property
  function getLatestFinancial(propertyId) {
    return financials.find((f) => f.property_id === propertyId) ?? null;
  }

  return (
    <InvestorLayout>
      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Portfolio Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your investment performance across Hyve properties.
        </p>
      </div>

      {/* Summary stats */}
      <div className="mb-8">
        <PortfolioSummary
          totalCapital={totalCapital}
          thisMonthDistribution={thisMonthDistribution}
          totalDistributions={totalDistributions}
          returnRate={returnRate}
          loading={dashLoading}
        />
      </div>

      {/* Property performance cards */}
      {investments.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Properties</h2>
          {dashLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </div>
      )}

      {/* Distribution history */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Distributions</h2>
        {dashLoading ? (
          <SkeletonCard />
        ) : (
          <DistributionTable distributions={distributions} />
        )}
      </div>
    </InvestorLayout>
  );
}
