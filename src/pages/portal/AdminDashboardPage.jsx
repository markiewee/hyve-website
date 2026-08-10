import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import PageHeader from "../../components/portal/PageHeader";
import ActionInbox from "../../components/portal/ActionInbox";

const OPEN_STATUSES = ["OPEN", "IN_PROGRESS", "ESCALATED"];
const ONLINE_THRESHOLD_MINUTES = 20;

export default function AdminDashboardPage() {
  const [counts, setCounts] = useState({
    totalRooms: 0,
    activeTenants: 0,
    openTickets: 0,
    onlineDevices: 0,
    totalDevices: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCounts() {
      const onlineThreshold = new Date(
        Date.now() - ONLINE_THRESHOLD_MINUTES * 60 * 1000
      ).toISOString();

      const nowIso = new Date().toISOString();
      const [rooms, tenants, tickets, devices, allDevices] = await Promise.all([
        // Only count lettable bedrooms (room_type set), exclude common areas,
        // kitchens, yards and shared toilets (room_type null).
        supabase.from("rooms").select("id", { count: "exact", head: true }).not("room_type", "is", null),
        // Active Members = currently in-residence tenants/captains only:
        //   is_active=true AND archived_at IS NULL
        //   AND role != ADMIN  (staff accounts aren't "members")
        //   AND moved_in_at <= now
        //   AND (moved_out_at IS NULL OR moved_out_at > now)
        // Excludes future incoming, GRACE-window movers, archived, and staff.
        supabase
          .from("tenant_profiles")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .is("archived_at", null)
          .neq("role", "ADMIN")
          .lte("moved_in_at", nowIso)
          .or(`moved_out_at.is.null,moved_out_at.gt.${nowIso}`),
        supabase
          .from("maintenance_tickets")
          .select("id", { count: "exact", head: true })
          .in("status", OPEN_STATUSES),
        supabase
          .from("device_status")
          .select("room_id", { count: "exact", head: true })
          .gte("last_heartbeat", onlineThreshold),
        supabase
          .from("device_status")
          .select("room_id", { count: "exact", head: true }),
      ]);

      const errors = [
        ["rooms", rooms.error],
        ["tenants", tenants.error],
        ["tickets", tickets.error],
        ["devices_online", devices.error],
        ["devices_total", allDevices.error],
      ].filter(([, e]) => e);
      if (errors.length) {
        console.error("[AdminDashboard] count query errors:", errors);
      }

      setCounts({
        totalRooms: rooms.count ?? 0,
        activeTenants: tenants.count ?? 0,
        openTickets: tickets.count ?? 0,
        onlineDevices: devices.count ?? 0,
        totalDevices: allDevices.count ?? 0,
      });
      setLoading(false);
    }

    fetchCounts();
  }, []);

  const stats = [
    {
      label: "Total Rooms",
      value: counts.totalRooms,
      icon: "meeting_room",
      to: "/portal/property",
      accent: "text-accent",
      bg: "bg-surface hover:bg-accent group",
      valueCls: "text-foreground group-hover:text-white",
      labelCls: "text-foreground-variant group-hover:text-white/80",
      iconCls: "text-accent group-hover:text-white",
    },
    {
      label: "Active Members",
      value: counts.activeTenants,
      icon: "group",
      to: "/portal/admin/members",
      accent: "text-foreground-variant",
      bg: "bg-surface hover:bg-white/10 group",
      valueCls: "text-foreground group-hover:text-foreground",
      labelCls: "text-foreground-variant group-hover:text-foreground",
      iconCls: "text-foreground-variant group-hover:text-foreground",
    },
    {
      label: "Open Tickets",
      value: counts.openTickets,
      icon: "build",
      to: "/portal/admin/tickets",
      accent: "text-red-400",
      bg: "bg-surface hover:bg-red-500/15 group",
      valueCls: "text-foreground group-hover:text-red-300",
      labelCls: "text-foreground-variant group-hover:text-red-300",
      iconCls: "text-red-400 group-hover:text-red-300",
    },
    {
      label: "Devices",
      value: counts.totalDevices,
      subtitle: `${counts.onlineDevices} online`,
      icon: "router",
      to: "/portal/admin/devices",
      accent: "text-accent",
      bg: "bg-surface hover:bg-accent group",
      valueCls: "text-foreground group-hover:text-white",
      labelCls: "text-foreground-variant group-hover:text-white/80",
      iconCls: "text-accent group-hover:text-white",
    },
  ];

  return (
    <PortalLayout>
      <PageHeader
        eyebrow="Admin"
        title="Admin Console"
        subtitle="Global stats, action inbox, and quick links to every admin tool."
      />

      {/* Bento stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            to={stat.to}
            className={`${stat.bg} rounded-2xl p-6 border border-border transition-all duration-300 cursor-pointer flex flex-col justify-between h-40`}
          >
            <div className="flex items-start justify-between">
              <div className={`w-10 h-10 rounded-xl bg-white/5 group-hover:bg-white/20 flex items-center justify-center transition-colors`}>
                <span className={`material-symbols-outlined text-[20px] ${stat.iconCls} transition-colors`}>
                  {stat.icon}
                </span>
              </div>
              <span className={`material-symbols-outlined text-[16px] ${stat.labelCls} transition-colors opacity-60`}>
                arrow_forward
              </span>
            </div>
            <div>
              <p className={`font-['Inter'] text-[10px] uppercase tracking-widest font-bold ${stat.labelCls} transition-colors mb-1`}>
                {stat.label}
              </p>
              {loading ? (
                <div className="h-8 w-16 bg-white/5 animate-pulse rounded" />
              ) : (
                <>
                  <p className={`font-['Hanken_Grotesk'] text-3xl font-extrabold ${stat.valueCls} transition-colors`}>
                    {stat.value}
                  </p>
                  {stat.subtitle && (
                    <p className={`font-['Inter'] text-xs mt-0.5 ${stat.labelCls} transition-colors`}>
                      {stat.subtitle}
                    </p>
                  )}
                </>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Action Inbox, full list lives at /portal/admin/inbox */}
      <div className="mb-10">
        <ActionInbox limit={8} />
      </div>
    </PortalLayout>
  );
}
