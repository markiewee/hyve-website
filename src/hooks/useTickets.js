import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Fetches maintenance tickets with photos and room info.
 *
 * @param {string|null} roomId
 * @param {string|null} propertyId
 * @param {"room"|"property"} scope - "room" filters by roomId, "property" filters by propertyId
 */
export function useTickets(roomId, propertyId, scope = "room") {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const filterId = scope === "property" ? propertyId : roomId;
    if (!filterId) {
      setLoading(false);
      return;
    }

    async function fetchTickets() {
      const query = supabase
        .from("maintenance_tickets")
        .select("*, ticket_photos(*), rooms(name, unit_code)")
        .order("created_at", { ascending: false });

      if (scope === "property") {
        query.eq("property_id", filterId);
      } else {
        query.eq("room_id", filterId);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching tickets:", error);
      }
      setTickets(data ?? []);
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
