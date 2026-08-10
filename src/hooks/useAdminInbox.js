// useAdminInbox, single source of "what needs admin attention right now."
// Aggregates 9 query sources, tags severity, sorts by severity then time.
// Consumed by AdminDashboardPage (top 5) and AdminInboxPage (full list).

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const SEVERITY_RANK = { red: 0, amber: 1, info: 2 };

const safeArray = (rel) => (Array.isArray(rel) ? rel[0] : rel);

const tenantLabel = (tp) => {
  if (!tp) return "Unknown";
  const name = tp?.tenant_details?.full_name || tp?.username || "Unknown";
  const unit = tp?.rooms?.unit_code;
  return unit ? `${name} (${unit})` : name;
};

export function useAdminInbox() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const out = [];

      // ── 1. Overdue rent, RED
      const { data: overdueRent } = await supabase
        .from("rent_payments")
        .select(
          "id, month, rent_amount, tenant_profiles(username, rooms(unit_code), tenant_details(full_name))"
        )
        .eq("status", "OVERDUE");
      (overdueRent ?? []).forEach((r) => {
        out.push({
          key: `rent-${r.id}`,
          severity: "red",
          icon: "warning",
          label: `Overdue rent, ${tenantLabel(safeArray(r.tenant_profiles))}`,
          meta: r.rent_amount ? `SGD ${r.rent_amount}` : null,
          to: "/portal/admin/billing",
          time: r.month,
        });
      });

      // ── 2. Tickets escalated, RED
      const { data: escalatedTickets } = await supabase
        .from("maintenance_tickets")
        .select("id, title, created_at, properties(code, name), rooms(unit_code)")
        .eq("status", "ESCALATED");
      (escalatedTickets ?? []).forEach((t) => {
        const unit = t.rooms?.unit_code || t.properties?.code;
        out.push({
          key: `ticket-${t.id}`,
          severity: "red",
          icon: "error",
          label: `Ticket escalated, ${t.title}`,
          meta: unit ? `${unit}` : null,
          to: "/portal/admin/tickets",
          time: t.created_at,
        });
      });

      // ── 3. Viewings without captain in next 24h, RED
      const next24h = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const nowIso = new Date().toISOString();
      const { data: unstaffedViewings } = await supabase
        .from("property_viewings")
        .select("id, prospect_name, slot_start, properties(code), captain_id")
        .gt("slot_start", nowIso)
        .lt("slot_start", next24h)
        .is("captain_id", null)
        .neq("status", "cancelled");
      (unstaffedViewings ?? []).forEach((v) => {
        out.push({
          key: `viewing-${v.id}-noCaptain`,
          severity: "red",
          icon: "person_off",
          label: `Viewing has no captain, ${v.prospect_name || "Prospect"}`,
          meta: v.properties?.code,
          to: `/portal/admin/viewings/${v.id}`,
          time: v.slot_start,
        });
      });

      // ── 4. TAs waiting for admin counter-signature, AMBER
      const { data: pendingTAs } = await supabase
        .from("onboarding_progress")
        .select(
          "id, ta_signed_url, updated_at, tenant_profiles(username, rooms(unit_code), tenant_details(full_name))"
        )
        .not("ta_signed_url", "is", null)
        .or("ta_countersigned_url.is.null,ta_countersigned_at.is.null");
      (pendingTAs ?? []).forEach((ta) => {
        out.push({
          key: `counter-${ta.id}`,
          severity: "amber",
          icon: "draw",
          label: `Counter-sign TA, ${tenantLabel(safeArray(ta.tenant_profiles))}`,
          to: `/portal/admin/onboarding/${ta.id}`,
          time: ta.updated_at,
        });
      });

      // ── 5. Deposits pending verification, AMBER
      const { data: pendingDeposits } = await supabase
        .from("onboarding_progress")
        .select(
          "id, deposit_amount, updated_at, tenant_profiles(username, rooms(unit_code), tenant_details(full_name))"
        )
        .eq("current_step", "DEPOSIT")
        .eq("deposit_verified", false);
      (pendingDeposits ?? []).forEach((d) => {
        out.push({
          key: `deposit-${d.id}`,
          severity: "amber",
          icon: "account_balance",
          label: `Verify deposit, ${tenantLabel(safeArray(d.tenant_profiles))}`,
          meta: d.deposit_amount ? `SGD ${d.deposit_amount}` : null,
          to: `/portal/admin/onboarding/${d.id}`,
          time: d.updated_at,
        });
      });

      // ── 6. Leads needing follow-up, AMBER
      // Any active lead that has gone quiet past its per-stage SLA surfaces here
      // so a hot prospect never silently rots on the Kanban. Cleared the moment
      // the lead is messaged (last_message_at bumps) or its stage advances.
      const FOLLOWUP_SLA_DAYS = {
        new: 2,            // qualify fast or lose them
        qualified: 3,      // send a room / book a viewing
        viewing_booked: 2, // confirm slot + host
        viewed: 3,         // close the loop after a viewing
        viewing_done: 3,
        agreement_sent: 2, // chase the signature
      };
      const FOLLOWUP_LABEL = {
        new: "qualify",
        qualified: "send room / book viewing",
        viewing_booked: "confirm viewing",
        viewed: "follow up post-viewing",
        viewing_done: "follow up post-viewing",
        agreement_sent: "chase signature",
      };
      const { data: followupLeads } = await supabase
        .from("leads")
        .select("id, name, status, last_message_at, updated_at, intent")
        .in("status", Object.keys(FOLLOWUP_SLA_DAYS));
      (followupLeads ?? []).forEach((l) => {
        const slaDays = FOLLOWUP_SLA_DAYS[l.status];
        if (!slaDays) return;
        const lastTouch = l.last_message_at || l.updated_at;
        if (!lastTouch) return;
        const ageDays = (Date.now() - new Date(lastTouch).getTime()) / 86400000;
        if (ageDays < slaDays) return;
        const props = Array.isArray(l.intent?.properties) ? l.intent.properties.join("/") : null;
        out.push({
          key: `lead-${l.id}`,
          severity: "amber",
          icon: "track_changes",
          label: `Lead needs follow-up (${FOLLOWUP_LABEL[l.status] || l.status}), ${l.name || "Prospect"}`,
          meta: props,
          to: "/portal/admin/leads",
          time: lastTouch,
        });
      });

      // ── 7. Documents pending member signature, AMBER
      const { data: pendingDocs } = await supabase
        .from("document_signing_sessions")
        .select(
          "id, created_at, tenant_profiles(username, rooms(unit_code), tenant_details(full_name)), document_templates(name)"
        )
        .eq("status", "PENDING");
      (pendingDocs ?? []).forEach((doc) => {
        const docName = doc.document_templates?.name || "Document";
        out.push({
          key: `doc-${doc.id}`,
          severity: "amber",
          icon: "description",
          label: `Awaiting signature, ${docName} for ${tenantLabel(safeArray(doc.tenant_profiles))}`,
          to: "/portal/admin/documents",
          time: doc.created_at,
        });
      });

      // ── 8. Leases expiring in next 60 days, AMBER
      const in60d = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();
      const { data: expiringLeases } = await supabase
        .from("tenant_profiles")
        .select(
          "id, lease_end, username, tenant_details(full_name), rooms(unit_code)"
        )
        .lt("lease_end", in60d)
        .gt("lease_end", nowIso)
        .eq("is_active", true);
      (expiringLeases ?? []).forEach((tp) => {
        out.push({
          key: `lease-${tp.id}`,
          severity: "amber",
          icon: "event_busy",
          label: `Lease expiring, ${tenantLabel(tp)}`,
          meta: new Date(tp.lease_end).toLocaleDateString("en-SG", {
            day: "numeric",
            month: "short",
          }),
          to: `/portal/admin/members`,
          time: tp.lease_end,
        });
      });

      // ── 9. Devices offline > 24h, INFO
      const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: offlineDevices } = await supabase
        .from("device_status")
        .select("room_id, last_heartbeat, rooms(unit_code, properties(code))")
        .lt("last_heartbeat", dayAgo);
      (offlineDevices ?? []).forEach((d) => {
        out.push({
          key: `device-${d.room_id}`,
          severity: "info",
          icon: "wifi_off",
          label: `Device offline, ${d.rooms?.unit_code || d.room_id}`,
          meta: d.rooms?.properties?.code,
          to: "/portal/admin/devices",
          time: d.last_heartbeat,
        });
      });

      // Sort: severity first, then most-recent (or upcoming) time
      out.sort((a, b) => {
        const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
        if (s !== 0) return s;
        const ta = a.time ? new Date(a.time).getTime() : 0;
        const tb = b.time ? new Date(b.time).getTime() : 0;
        return tb - ta;
      });

      if (!cancelled) {
        setItems(out);
        setLoading(false);
      }
    }

    load().catch((err) => {
      console.error("useAdminInbox load failed:", err);
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const counts = items.reduce(
    (acc, it) => {
      acc.total++;
      acc[it.severity]++;
      return acc;
    },
    { total: 0, red: 0, amber: 0, info: 0 }
  );

  return { items, counts, loading };
}
