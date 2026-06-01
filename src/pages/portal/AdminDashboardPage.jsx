import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import PageHeader from "../../components/portal/PageHeader";
import ActionInbox from "../../components/portal/ActionInbox";
import SignatureCanvas from "../../components/portal/SignatureCanvas";
import { useAuth } from "../../hooks/useAuth";

const OPEN_STATUSES = ["OPEN", "IN_PROGRESS", "ESCALATED"];
const ONLINE_THRESHOLD_MINUTES = 20;

export default function AdminDashboardPage() {
  const { profile, setProfile } = useAuth();
  const [counts, setCounts] = useState({
    totalRooms: 0,
    activeTenants: 0,
    openTickets: 0,
    onlineDevices: 0,
    totalDevices: 0,
  });
  const [loading, setLoading] = useState(true);

  // Signature section state
  const sigRef = useRef(null);
  const [showSigEditor, setShowSigEditor] = useState(false);
  const [sigSaving, setSigSaving] = useState(false);
  const [sigMessage, setSigMessage] = useState(null);

  async function handleSaveSignature() {
    const sigData = sigRef.current?.getSignatureData();
    if (!sigData) {
      setSigMessage({ type: "error", text: "Please draw or type a signature first." });
      return;
    }
    setSigSaving(true);
    setSigMessage(null);
    const { error } = await supabase
      .from("tenant_profiles")
      .update({ saved_signature: sigData })
      .eq("id", profile.id);
    if (error) {
      setSigMessage({ type: "error", text: "Failed to save: " + error.message });
    } else {
      setSigMessage({ type: "success", text: "Signature saved." });
      setShowSigEditor(false);
      // Refresh profile in context by refetching
      const { data: updated } = await supabase
        .from("tenant_profiles")
        .select("*, rooms(name, unit_code, property_id), properties(name, code), onboarding_progress(*)")
        .eq("id", profile.id)
        .single();
      if (updated && setProfile) setProfile(updated);
    }
    setSigSaving(false);
  }

  async function handleClearSignature() {
    setSigSaving(true);
    setSigMessage(null);
    const { error } = await supabase
      .from("tenant_profiles")
      .update({ saved_signature: null })
      .eq("id", profile.id);
    if (error) {
      setSigMessage({ type: "error", text: "Failed to clear: " + error.message });
    } else {
      setSigMessage({ type: "success", text: "Signature cleared." });
      setShowSigEditor(false);
      const { data: updated } = await supabase
        .from("tenant_profiles")
        .select("*, rooms(name, unit_code, property_id), properties(name, code), onboarding_progress(*)")
        .eq("id", profile.id)
        .single();
      if (updated && setProfile) setProfile(updated);
    }
    setSigSaving(false);
  }

  useEffect(() => {
    async function fetchCounts() {
      const onlineThreshold = new Date(
        Date.now() - ONLINE_THRESHOLD_MINUTES * 60 * 1000
      ).toISOString();

      const [rooms, tenants, tickets, devices, allDevices] = await Promise.all([
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
      to: "/portal/admin/onboarding",
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

      {/* Action Inbox — top 8, link to /portal/admin/inbox for full list */}
      <div className="mb-10">
        <ActionInbox limit={8} />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: "Onboarding Tracker", desc: "Monitor member onboarding progress", icon: "how_to_reg", to: "/portal/admin/onboarding" },
          { label: "Rent Management", desc: "Generate records and track payments", icon: "receipt_long", to: "/portal/admin/rent" },
          { label: "Announcements", desc: "Send updates to residents", icon: "campaign", to: "/portal/admin/announcements" },
          { label: "Documents", desc: "Create and send member documents", icon: "description", to: "/portal/admin/documents" },
          { label: "Expense Tracking", desc: "Log and review property expenses", icon: "account_balance", to: "/portal/admin/expenses" },
          { label: "Financial Reports", desc: "Monthly P&L and distributions", icon: "bar_chart", to: "/portal/admin/financials" },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="bg-surface rounded-2xl p-6 border border-border hover:border-accent/30 transition-all flex items-start gap-4 group"
          >
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-accent transition-colors">
              <span className="material-symbols-outlined text-accent group-hover:text-white text-[20px] transition-colors">
                {item.icon}
              </span>
            </div>
            <div>
              <p className="font-['Inter'] font-bold text-foreground text-sm">{item.label}</p>
              <p className="font-['Inter'] text-foreground-variant text-xs mt-0.5">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* My Signature */}
      {profile && (
        <div className="mt-8 bg-surface rounded-2xl border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-accent text-[20px]">draw</span>
              </div>
              <div>
                <p className="font-['Inter'] font-bold text-foreground text-sm">My Signature</p>
                <p className="font-['Inter'] text-foreground-variant text-xs mt-0.5">
                  This signature will be used when counter-signing member agreements.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {profile.saved_signature && (
                <button
                  type="button"
                  onClick={handleClearSignature}
                  disabled={sigSaving}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-500/25 text-red-300 hover:bg-red-500/15 transition-colors disabled:opacity-50"
                >
                  Clear Saved Signature
                </button>
              )}
              <button
                type="button"
                onClick={() => { setShowSigEditor((v) => !v); setSigMessage(null); }}
                className="px-3 py-1.5 text-xs font-semibold rounded-full bg-white/5 text-accent hover:bg-accent hover:text-white transition-colors"
              >
                {showSigEditor ? "Cancel" : profile.saved_signature ? "Update Signature" : "Add Signature"}
              </button>
            </div>
          </div>

          {/* Saved signature preview */}
          {profile.saved_signature && !showSigEditor && (
            <div className="rounded-xl border border-border bg-white p-3 inline-block">
              <img
                src={profile.saved_signature}
                alt="Saved signature"
                className="max-h-[80px] max-w-[320px] object-contain"
              />
            </div>
          )}

          {/* Signature editor */}
          {showSigEditor && (
            <div className="space-y-3 pt-1">
              <SignatureCanvas signatureRef={sigRef} />
              <button
                type="button"
                onClick={handleSaveSignature}
                disabled={sigSaving}
                className="px-4 py-2 text-sm font-semibold rounded-full bg-accent text-white hover:bg-accent transition-colors disabled:opacity-50"
              >
                {sigSaving ? "Saving…" : "Save Signature"}
              </button>
            </div>
          )}

          {/* Feedback message */}
          {sigMessage && (
            <p
              className={`text-xs font-medium ${
                sigMessage.type === "error" ? "text-red-400" : "text-accent"
              }`}
            >
              {sigMessage.text}
            </p>
          )}
        </div>
      )}
    </PortalLayout>
  );
}
