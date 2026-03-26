import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useAcStatus } from "../../hooks/useAcStatus";
import { useAcUsage } from "../../hooks/useAcUsage";
import { useUsageData } from "../../hooks/useUsageData";
import { useTenantDashboard } from "../../hooks/useTenantDashboard";
import PortalLayout from "../../components/portal/PortalLayout";
import AcStatusIndicator from "../../components/portal/AcStatusIndicator";
import UsageProgressBar from "../../components/portal/UsageProgressBar";
import UsageChart from "../../components/portal/UsageChart";
import DocumentsList from "../../components/portal/DocumentsList";
import CheckoutStatusCard from "../../components/portal/CheckoutStatusCard";
import AnnouncementBanner from "../../components/portal/AnnouncementBanner";

const FREE_HOURS = 300;

function getDayOfMonth() {
  return new Date().getDate();
}

function getDaysInMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function SkeletonLine({ className = "" }) {
  return <div className={`bg-[#eff4ff] animate-pulse rounded ${className}`} />;
}

export default function DashboardPage() {
  const { profile } = useAuth();

  // Admin should see admin dashboard, not tenant dashboard
  if (profile?.role === "ADMIN") {
    return <Navigate to="/portal/admin" replace />;
  }

  const roomId = profile?.room_id;

  const { status, loading: statusLoading } = useAcStatus(roomId);
  const { usage, todayHours, loading: usageLoading } = useAcUsage(roomId);
  const usageChart = useUsageData(roomId);
  const { documents, checkout, openTickets, loading: dashLoading } =
    useTenantDashboard(profile?.id, roomId);

  const totalHours = usage?.total_hours ?? 0;
  const dayOfMonth = getDayOfMonth();
  const daysInMonth = getDaysInMonth();
  const projected =
    dayOfMonth > 0 ? (totalHours / dayOfMonth) * daysInMonth : 0;

  const propertyName =
    profile?.properties?.name ??
    profile?.rooms?.name ??
    "Singapore";

  const firstName = (profile?.full_name ?? "").split(" ")[0] || "Member";

  return (
    <PortalLayout>
      {/* Editorial header */}
      <header className="mb-10 max-w-6xl">
        <h2 className="font-['Plus_Jakarta_Sans'] text-4xl lg:text-5xl font-extrabold text-[#121c2a] tracking-tight mb-3">
          Your Sanctuary in{" "}
          <span className="text-[#006b5f]">{propertyName}</span>
        </h2>
        <p className="font-['Manrope'] text-[#555f6f] text-lg max-w-2xl leading-relaxed">
          Welcome back, {firstName}.{" "}
          {!usageLoading && todayHours > 0
            ? `AC has been running for ${todayHours.toFixed(1)}h today.`
            : "Everything is set for your stay."}
        </p>
      </header>

      {/* Announcements — full-width above grid */}
      <AnnouncementBanner propertyId={profile?.property_id} />

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 max-w-6xl">

        {/* ── Row 1 ── */}

        {/* Rent / Billing card — col-span-8 */}
        <section className="md:col-span-8 bg-white rounded-xl p-8 border border-[#bbcac6]/15 shadow-sm flex flex-col justify-between relative overflow-hidden">
          {/* Decorative teal blob */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#006b5f]/5 rounded-full -mr-16 -mt-16 pointer-events-none" />
          <div className="relative z-10">
            <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-xl mb-8 flex items-center gap-2 text-[#121c2a]">
              <span className="material-symbols-outlined text-[#006b5f] text-[22px]">account_balance_wallet</span>
              Upcoming Rent
            </h3>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
              <div>
                <span className="font-['Inter'] text-xs uppercase tracking-widest text-[#555f6f] block mb-1">
                  Due 1st of month
                </span>
                <div className="text-5xl font-['Plus_Jakarta_Sans'] font-black text-[#121c2a]">
                  {(profile?.monthly_rent || profile?.rooms?.rent_amount)
                    ? `$${Number(profile.monthly_rent || profile.rooms?.rent_amount).toLocaleString("en-SG", { minimumFractionDigits: 2 })}`
                    : "—"}
                </div>
              </div>
              <Link
                to="/portal/billing"
                className="bg-[#006b5f] text-white px-8 py-4 rounded-xl font-['Manrope'] font-bold text-base hover:opacity-90 transition-all flex items-center gap-2 shrink-0"
              >
                Pay Now
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-[#bbcac6]/15 flex items-center gap-3 text-sm text-[#555f6f]">
            <span className="material-symbols-outlined text-[#006b5f] text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            Auto-pay is currently disabled.{" "}
            <Link to="/portal/billing" className="text-[#006b5f] font-bold underline underline-offset-4">
              Set up now
            </Link>
          </div>
        </section>

        {/* Announcements card — col-span-4 */}
        <section className="md:col-span-4 glass-card rounded-xl p-8 border border-[#14b8a6]/20 flex flex-col">
          <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-xl mb-6 flex items-center gap-2 text-[#121c2a]">
            <span className="material-symbols-outlined text-[#006b5f] text-[22px]">campaign</span>
            Announcements
          </h3>
          {dashLoading ? (
            <div className="space-y-4 flex-1">
              <SkeletonLine className="h-4 w-full" />
              <SkeletonLine className="h-4 w-3/4" />
              <SkeletonLine className="h-4 w-full" />
              <SkeletonLine className="h-4 w-2/3" />
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between">
              <p className="font-['Manrope'] text-sm text-[#555f6f] leading-relaxed">
                No new announcements. Check back soon for property updates and community news.
              </p>
              <Link
                to="/portal/dashboard"
                className="mt-6 text-sm font-['Manrope'] font-bold text-[#006b5f] flex items-center gap-1 group"
              >
                View all
                <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">chevron_right</span>
              </Link>
            </div>
          )}
        </section>

        {/* ── Row 2 ── */}

        {/* AC Usage chart — col-span-7 */}
        <section className="md:col-span-7 bg-white rounded-xl p-8 border border-[#bbcac6]/15 shadow-sm">
          <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-xl mb-6 flex items-center gap-2 text-[#121c2a]">
            <span className="material-symbols-outlined text-[#006b5f] text-[22px]">ac_unit</span>
            AC Usage
          </h3>
          {usageChart.loading ? (
            <div className="h-[280px] bg-[#eff4ff] animate-pulse rounded-lg" />
          ) : (
            <UsageChart {...usageChart} />
          )}
        </section>

        {/* Tenancy Status — col-span-5 */}
        <div className="md:col-span-5 flex flex-col gap-6">
          {/* Tenancy Status Card */}
          <section className="bg-white rounded-xl p-8 border border-[#bbcac6]/15 shadow-sm flex-1">
            {dashLoading ? (
              <div className="space-y-3">
                <SkeletonLine className="h-5 w-1/3" />
                <SkeletonLine className="h-4 w-full" />
                <SkeletonLine className="h-4 w-2/3" />
              </div>
            ) : (
              <CheckoutStatusCard checkout={checkout} />
            )}
          </section>

          {/* Documents */}
          <section className="bg-white rounded-xl p-8 border border-[#bbcac6]/15 shadow-sm flex-1">
            {dashLoading ? (
              <div className="space-y-3">
                <SkeletonLine className="h-5 w-1/3" />
                <SkeletonLine className="h-4 w-full" />
                <SkeletonLine className="h-4 w-3/4" />
              </div>
            ) : (
              <DocumentsList documents={documents} />
            )}
          </section>
        </div>

        {/* ── Row 3: Monthly Allowance — full width ── */}
        <section className="md:col-span-12 bg-white rounded-xl p-8 border border-[#bbcac6]/15 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-xl flex items-center gap-2 text-[#121c2a]">
              <span className="material-symbols-outlined text-[#006b5f] text-[22px]">bolt</span>
              Monthly AC Allowance
            </h3>
            <span className="font-['Inter'] text-xs uppercase tracking-widest text-[#555f6f]">
              Day {dayOfMonth} of {daysInMonth}
            </span>
          </div>
          {usageLoading ? (
            <div className="space-y-3">
              <SkeletonLine className="h-4 w-full" />
              <SkeletonLine className="h-3 w-full rounded-full" />
            </div>
          ) : (
            <>
              <UsageProgressBar totalHours={totalHours} freeHours={FREE_HOURS} />
              <p className="font-['Manrope'] text-sm text-[#555f6f] mt-4">
                {totalHours.toFixed(1)}h used this month out of {FREE_HOURS}h free allowance
              </p>
            </>
          )}
        </section>

        {/* ── Row 4: Quick Stats ── */}
        <section className="md:col-span-12 grid grid-cols-2 sm:grid-cols-4 gap-4">

          {/* AC Status */}
          <div className="bg-white rounded-xl p-6 border border-[#bbcac6]/15 shadow-sm">
            <p className="font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] mb-3">
              AC Status
            </p>
            {statusLoading ? (
              <SkeletonLine className="h-6 w-20" />
            ) : (
              <AcStatusIndicator status={status} />
            )}
          </div>

          {/* Today */}
          <div className="bg-white rounded-xl p-6 border border-[#bbcac6]/15 shadow-sm">
            <p className="font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] mb-3">
              Today
            </p>
            {usageLoading ? (
              <SkeletonLine className="h-7 w-16" />
            ) : (
              <p className="font-['Plus_Jakarta_Sans'] text-3xl font-black text-[#121c2a]">
                {todayHours.toFixed(1)}
                <span className="text-base font-['Manrope'] font-normal text-[#6c7a77] ml-1">h</span>
              </p>
            )}
          </div>

          {/* Projected */}
          <div className="bg-white rounded-xl p-6 border border-[#bbcac6]/15 shadow-sm">
            <p className="font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] mb-3">
              Projected
            </p>
            {usageLoading ? (
              <SkeletonLine className="h-7 w-16" />
            ) : (
              <p className={`font-['Plus_Jakarta_Sans'] text-3xl font-black ${projected > FREE_HOURS ? "text-[#ba1a1a]" : "text-[#121c2a]"}`}>
                {projected.toFixed(0)}
                <span className="text-base font-['Manrope'] font-normal text-[#6c7a77] ml-1">h</span>
              </p>
            )}
          </div>

          {/* Open Issues */}
          <div className="bg-white rounded-xl p-6 border border-[#bbcac6]/15 shadow-sm">
            <p className="font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] mb-3">
              Open Issues
            </p>
            {dashLoading ? (
              <SkeletonLine className="h-7 w-10" />
            ) : (
              <div className="flex items-end justify-between">
                <p className="font-['Plus_Jakarta_Sans'] text-3xl font-black text-[#121c2a]">
                  {openTickets}
                </p>
                {openTickets > 0 && (
                  <Link
                    to="/portal/issues"
                    className="font-['Inter'] text-xs font-bold text-[#006b5f] uppercase tracking-widest hover:underline"
                  >
                    View
                  </Link>
                )}
              </div>
            )}
          </div>

        </section>
      </div>
    </PortalLayout>
  );
}
