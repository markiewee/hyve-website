import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Fetches maintenance tickets with photos and room info.
 *
 * @param {string|null} roomId
 * @param {string|null} propertyId
 * @param {"room"|"property"|"all"} scope - "room" filters by roomId, "property" filters by propertyId, "all" returns every ticket (admin only)
 */
export function useTickets(roomId, propertyId, scope = "room") {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const filterId = scope === "property" ? propertyId : scope === "room" ? roomId : null;
    if (scope !== "all" && !filterId) {
      setLoading(false);
      return;
    }

    async function fetchTickets() {
      const query = supabase
        .from("maintenance_tickets")
        .select("*, ticket_photos(*), rooms(name, unit_code, property_id)")
        .order("created_at", { ascending: false });

      if (scope === "property") {
        query.eq("property_id", filterId);
      } else if (scope === "room") {
        query.eq("room_id", filterId);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching tickets:", error);
        setTickets([]);
        setLoading(false);
        return;
      }

      const ticketsList = data ?? [];

      // Look up submitter roles in a second query — maintenance_tickets.submitted_by
      // references auth.users(id), not tenant_profiles, so we can't embed directly.
      const submitterIds = [...new Set(ticketsList.map((t) => t.submitted_by).filter(Boolean))];
      let roleByUserId = {};
      if (submitterIds.length > 0) {
        const { data: profiles, error: profileErr } = await supabase
          .from("tenant_profiles")
          .select("user_id, role")
          .in("user_id", submitterIds);
        if (profileErr) {
          console.error("Error fetching submitter roles:", profileErr);
        } else {
          roleByUserId = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p.role]));
        }
      }

      setTickets(
        ticketsList.map((t) => ({
          ...t,
          submitter: t.submitted_by ? { role: roleByUserId[t.submitted_by] ?? null } : null,
        }))
      );
      setLoading(false);
    }

    fetchTickets();

    // Realtime subscription — refetch on any change to maintenance_tickets
    const channel = supabase
      .channel("maintenance_tickets_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "maintenance_tickets",
        },
        () => {
          fetchTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, propertyId, scope]);

  return { tickets, loading };
}
