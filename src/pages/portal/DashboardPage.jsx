import { useAuth } from "../../hooks/useAuth";
import { useAcStatus } from "../../hooks/useAcStatus";
import { useAcUsage } from "../../hooks/useAcUsage";
import { useUsageData } from "../../hooks/useUsageData";
import PortalLayout from "../../components/portal/PortalLayout";
import AcStatusIndicator from "../../components/portal/AcStatusIndicator";
import UsageProgressBar from "../../components/portal/UsageProgressBar";
import UsageChart from "../../components/portal/UsageChart";
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
  const roomName = profile?.rooms?.name ?? "Your Room";
  const propertyName = profile?.properties?.name ?? "";

  const { status, loading: statusLoading } = useAcStatus(roomId);
  const { usage, todayHours, loading: usageLoading } = useAcUsage(roomId);
  const usageChart = useUsageData(roomId);

  const totalHours = usage?.total_hours ?? 0;
  const dayOfMonth = getDayOfMonth();
  const daysInMonth = getDaysInMonth();
  const projected = dayOfMonth > 0 ? (totalHours / dayOfMonth) * daysInMonth : 0;

  return (
    <PortalLayout>
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{roomName}</h1>
        {propertyName && (
          <p className="text-muted-foreground text-sm mt-1">{propertyName}</p>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* AC Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground font-medium">
              AC Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusLoading ? (
              <div className="h-5 w-24 bg-gray-100 animate-pulse rounded" />
            ) : (
              <AcStatusIndicator status={status} />
            )}
          </CardContent>
        </Card>

        {/* Today's hours */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Today's Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            {usageLoading ? (
              <div className="h-7 w-16 bg-gray-100 animate-pulse rounded" />
            ) : (
              <p className="text-2xl font-bold text-foreground">
                {todayHours.toFixed(1)}
                <span className="text-base font-normal text-muted-foreground ml-1">h</span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Projected monthly */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Projected Monthly
            </CardTitle>
          </CardHeader>
          <CardContent>
            {usageLoading ? (
              <div className="h-7 w-16 bg-gray-100 animate-pulse rounded" />
            ) : (
              <p
                className={`text-2xl font-bold ${
                  projected > FREE_HOURS ? "text-red-600" : "text-foreground"
                }`}
              >
                {projected.toFixed(0)}
                <span className="text-base font-normal text-muted-foreground ml-1">h</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Usage chart — Day / Month / Year toggle */}
      <Card className="mb-4">
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

      {/* Monthly usage progress bar */}
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
            Day {dayOfMonth} of {daysInMonth} &mdash; {totalHours.toFixed(1)}h used this month
          </p>
        </CardContent>
      </Card>
    </PortalLayout>
  );
}
