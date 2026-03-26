import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
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

  // Fetch outstanding charges
  const [charges, setCharges] = useState([]);
  useEffect(() => {
    if (!profile?.id) return;
    supabase.from("member_charges").select("*").eq("tenant_profile_id", profile.id).eq("status", "PENDING")
      .then(({ data }) => setCharges(data ?? []));
  }, [profile?.id]);
  const totalCharges = charges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

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

        {/* Billing Overview — col-span-12 */}
        <section className="md:col-span-12 bg-white rounded-xl p-8 border border-[#bbcac6]/15 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#006b5f]/5 rounded-full -mr-16 -mt-16 pointer-events-none" />
          <div className="relative z-10">
            <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-xl mb-6 flex items-center gap-2 text-[#121c2a]">
              <span className="material-symbols-outlined text-[#006b5f] text-[22px]">account_balance_wallet</span>
              Billing Overview
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {/* Monthly Rent */}
              <div className="bg-[#006b5f]/5 rounded-xl p-5 border-b-2 border-[#006b5f]">
                <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#006b5f] font-bold mb-1">Monthly Rent</p>
                <p className="font-['Plus_Jakarta_Sans'] text-2xl font-black text-[#121c2a]">
                  {(profile?.monthly_rent || profile?.rooms?.rent_amount)
                    ? `$${Number(profile.monthly_rent || profile.rooms?.rent_amount).toLocaleString("en-SG", { minimumFractionDigits: 2 })}`
                    : "—"}
                </p>
                <p className="text-xs text-[#6c7a77] mt-1">Due 1st of month</p>
              </div>
              {/* Outstanding Charges */}
              <div className={`rounded-xl p-5 border-b-2 ${totalCharges > 0 ? "bg-amber-50 border-amber-400" : "bg-gray-50 border-gray-200"}`}>
                <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-1">Other Charges</p>
                <p className={`font-['Plus_Jakarta_Sans'] text-2xl font-black ${totalCharges > 0 ? "text-amber-700" : "text-[#121c2a]"}`}>
                  ${totalCharges.toLocaleString("en-SG", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-[#6c7a77] mt-1">
                  {charges.length > 0 ? charges.map(c => c.description).join(", ") : "No outstanding charges"}
                </p>
              </div>
              {/* Total Due */}
              <div className={`rounded-xl p-5 border-b-2 ${totalCharges > 0 ? "bg-red-50 border-red-400" : "bg-[#eff4ff] border-[#006b5f]/30"}`}>
                <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-1">Total Due</p>
                <p className="font-['Plus_Jakarta_Sans'] text-2xl font-black text-[#121c2a]">
                  ${((Number(profile?.monthly_rent || 0) + totalCharges)).toLocaleString("en-SG", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-[#6c7a77] mt-1">Rent + charges</p>
              </div>
            </div>
            <Link
              to="/portal/billing"
              className="bg-[#006b5f] text-white px-8 py-4 rounded-xl font-['Manrope'] font-bold text-base hover:opacity-90 transition-all inline-flex items-center gap-2"
            >
              View Billing & Pay
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </Link>
          </div>
          </div>
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
        <section className="md:col-span-5 bg-white rounded-xl p-8 border border-[#bbcac6]/15 shadow-sm">
          {dashLoading ? (
            <div className="space-y-3">
              <SkeletonLine className="h-5 w-1/3" />
              <SkeletonLine className="h-4 w-full" />
              <SkeletonLine className="h-4 w-2/3" />
            </div>
          ) : (
            <CheckoutStatusCard checkout={checkout} profile={profile} />
          )}
        </section>

        {/* ── Row 2.5: Documents — full width ── */}
        <section className="md:col-span-12 bg-white rounded-xl p-8 border border-[#bbcac6]/15 shadow-sm">
          {dashLoading ? (
            <div className="space-y-3">
              <SkeletonLine className="h-5 w-1/3" />
              <SkeletonLine className="h-4 w-full" />
            </div>
          ) : (
            <DocumentsList documents={documents} />
          )}
        </section>

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
