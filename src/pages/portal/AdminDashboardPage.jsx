import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";

const OPEN_STATUSES = ["OPEN", "IN_PROGRESS", "ESCALATED"];
const ONLINE_THRESHOLD_MINUTES = 20;

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

  const stats = [
    {
      label: "Total Rooms",
      value: counts.totalRooms,
      icon: "meeting_room",
      to: "/portal/property",
      accent: "text-[#006b5f]",
      bg: "bg-white hover:bg-[#006b5f] group",
      valueCls: "text-[#121c2a] group-hover:text-white",
      labelCls: "text-[#6c7a77] group-hover:text-white/80",
      iconCls: "text-[#006b5f] group-hover:text-white",
    },
    {
      label: "Active Tenants",
      value: counts.activeTenants,
      icon: "group",
      to: "/portal/admin/onboarding",
      accent: "text-[#555f6f]",
      bg: "bg-white hover:bg-[#555f6f] group",
      valueCls: "text-[#121c2a] group-hover:text-white",
      labelCls: "text-[#6c7a77] group-hover:text-white/80",
      iconCls: "text-[#555f6f] group-hover:text-white",
    },
    {
      label: "Open Tickets",
      value: counts.openTickets,
      icon: "build",
      to: "/portal/property/tickets",
      accent: "text-[#ba1a1a]",
      bg: "bg-white hover:bg-[#ba1a1a] group",
      valueCls: "text-[#121c2a] group-hover:text-white",
      labelCls: "text-[#6c7a77] group-hover:text-white/80",
      iconCls: "text-[#ba1a1a] group-hover:text-white",
    },
    {
      label: "Online Devices",
      value: counts.onlineDevices,
      icon: "router",
      to: "/portal/admin/devices",
      accent: "text-[#006b5f]",
      bg: "bg-white hover:bg-[#006b5f] group",
      valueCls: "text-[#121c2a] group-hover:text-white",
      labelCls: "text-[#6c7a77] group-hover:text-white/80",
      iconCls: "text-[#006b5f] group-hover:text-white",
    },
  ];

  return (
    <PortalLayout>
      {/* Page header */}
      <div className="mb-10">
        <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
          Admin Console
        </h1>
        <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">
          Global stats and quick access to all management tools.
        </p>
      </div>

      {/* Bento stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            to={stat.to}
            className={`${stat.bg} rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm transition-all duration-300 cursor-pointer flex flex-col justify-between h-40`}
          >
            <div className="flex items-start justify-between">
              <div className={`w-10 h-10 rounded-xl bg-[#eff4ff] group-hover:bg-white/20 flex items-center justify-center transition-colors`}>
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
                <div className="h-8 w-16 bg-[#eff4ff] animate-pulse rounded" />
              ) : (
                <p className={`font-['Plus_Jakarta_Sans'] text-3xl font-extrabold ${stat.valueCls} transition-colors`}>
                  {stat.value}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: "Onboarding Tracker", desc: "Monitor tenant onboarding progress", icon: "how_to_reg", to: "/portal/admin/onboarding" },
          { label: "Rent Management", desc: "Generate records and track payments", icon: "receipt_long", to: "/portal/admin/rent" },
          { label: "Announcements", desc: "Send updates to residents", icon: "campaign", to: "/portal/admin/announcements" },
          { label: "Documents", desc: "Create and send tenant documents", icon: "description", to: "/portal/admin/documents" },
          { label: "Expense Tracking", desc: "Log and review property expenses", icon: "account_balance", to: "/portal/admin/expenses" },
          { label: "Financial Reports", desc: "Monthly P&L and distributions", icon: "bar_chart", to: "/portal/admin/financials" },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm hover:border-[#006b5f]/30 hover:shadow-md transition-all flex items-start gap-4 group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#eff4ff] flex items-center justify-center shrink-0 group-hover:bg-[#006b5f] transition-colors">
              <span className="material-symbols-outlined text-[#006b5f] group-hover:text-white text-[20px] transition-colors">
                {item.icon}
              </span>
            </div>
            <div>
              <p className="font-['Manrope'] font-bold text-[#121c2a] text-sm">{item.label}</p>
              <p className="font-['Manrope'] text-[#6c7a77] text-xs mt-0.5">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </PortalLayout>
  );
}
