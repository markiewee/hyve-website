import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useAcStatus } from "../../hooks/useAcStatus";
import { useAcUsage } from "../../hooks/useAcUsage";
import { useUsageData } from "../../hooks/useUsageData";
import { useTenantDashboard } from "../../hooks/useTenantDashboard";
import PortalLayout from "../../components/portal/PortalLayout";
import AcStatusIndicator from "../../components/portal/AcStatusIndicator";
import UsageProgressBar from "../../components/portal/UsageProgressBar";
import UsageChart from "../../components/portal/UsageChart";
import TenantProfileCard from "../../components/portal/TenantProfileCard";
import DocumentsList from "../../components/portal/DocumentsList";
import CheckoutStatusCard from "../../components/portal/CheckoutStatusCard";
import AnnouncementBanner from "../../components/portal/AnnouncementBanner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

const FREE_HOURS = 300;

function getDayOfMonth() {
  return new Date().getDate();
}

function getDaysInMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

export default function DashboardPage() {
  const { profile } = useAuth();
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

  return (
    <PortalLayout>
      {/* Announcements */}
      <AnnouncementBanner propertyId={profile?.property_id} />

      {/* Profile card */}
      <div className="mb-6">
        <TenantProfileCard profile={profile} />
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">AC Status</p>
            {statusLoading ? (
              <div className="h-5 w-20 bg-gray-100 animate-pulse rounded" />
            ) : (
              <AcStatusIndicator status={status} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Today</p>
            {usageLoading ? (
              <div className="h-6 w-12 bg-gray-100 animate-pulse rounded" />
            ) : (
              <p className="text-xl font-bold">
                {todayHours.toFixed(1)}
                <span className="text-sm font-normal text-muted-foreground ml-0.5">
                  h
                </span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Projected</p>
            {usageLoading ? (
              <div className="h-6 w-12 bg-gray-100 animate-pulse rounded" />
            ) : (
              <p
                className={`text-xl font-bold ${
                  projected > FREE_HOURS ? "text-red-600" : ""
                }`}
              >
                {projected.toFixed(0)}
                <span className="text-sm font-normal text-muted-foreground ml-0.5">
                  h
                </span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Open Issues</p>
            {dashLoading ? (
              <div className="h-6 w-8 bg-gray-100 animate-pulse rounded" />
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-xl font-bold">{openTickets}</p>
                {openTickets > 0 && (
                  <Link
                    to="/portal/issues"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Two-column layout: chart + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Usage chart — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">AC Usage</CardTitle>
          </CardHeader>
          <CardContent>
            {usageChart.loading ? (
              <div className="h-[320px] bg-gray-100 animate-pulse rounded" />
            ) : (
              <UsageChart {...usageChart} />
            )}
          </CardContent>
        </Card>

        {/* Sidebar: tenancy + docs */}
        <div className="space-y-4">
          <CheckoutStatusCard checkout={checkout} />
          <DocumentsList documents={documents} />
        </div>
      </div>

      {/* Monthly allowance bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Allowance</CardTitle>
        </CardHeader>
        <CardContent>
          {usageLoading ? (
            <div className="space-y-2">
              <div className="h-4 w-full bg-gray-100 animate-pulse rounded" />
              <div className="h-2 w-full bg-gray-100 animate-pulse rounded-full" />
            </div>
          ) : (
            <UsageProgressBar totalHours={totalHours} freeHours={FREE_HOURS} />
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Day {dayOfMonth} of {daysInMonth} &mdash; {totalHours.toFixed(1)}h
            used this month
          </p>
        </CardContent>
      </Card>
    </PortalLayout>
  );
}
