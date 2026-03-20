import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

const OPEN_STATUSES = ["OPEN", "IN_PROGRESS", "ESCALATED"];
const ONLINE_THRESHOLD_MINUTES = 20;

function StatCard({ label, value, loading }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground font-medium">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-16 bg-gray-100 animate-pulse rounded" />
        ) : (
          <p className="text-3xl font-bold text-foreground">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const [counts, setCounts] = useState({
    totalRooms: 0,
    activeTenants: 0,
    openTickets: 0,
    onlineDevices: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCounts() {
      const onlineThreshold = new Date(
        Date.now() - ONLINE_THRESHOLD_MINUTES * 60 * 1000
      ).toISOString();

      const [rooms, tenants, tickets, devices] = await Promise.all([
        supabase.from("rooms").select("id", { count: "exact", head: true }),
        supabase
          .from("tenant_profiles")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),
        supabase
          .from("maintenance_tickets")
          .select("id", { count: "exact", head: true })
          .in("status", OPEN_STATUSES),
        supabase
          .from("device_status")
          .select("id", { count: "exact", head: true })
          .gte("last_heartbeat", onlineThreshold),
      ]);

      setCounts({
        totalRooms: rooms.count ?? 0,
        activeTenants: tenants.count ?? 0,
        openTickets: tickets.count ?? 0,
        onlineDevices: devices.count ?? 0,
      });
      setLoading(false);
    }

    fetchCounts();
  }, []);

  return (
    <PortalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Rooms" value={counts.totalRooms} loading={loading} />
        <StatCard label="Active Tenants" value={counts.activeTenants} loading={loading} />
        <StatCard label="Open Tickets" value={counts.openTickets} loading={loading} />
        <StatCard label="Online Devices" value={counts.onlineDevices} loading={loading} />
      </div>
    </PortalLayout>
  );
}
