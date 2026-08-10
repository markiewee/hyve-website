import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export function useTenantDashboard(profileId, roomId) {
  const [documents, setDocuments] = useState([]);
  const [checkout, setCheckout] = useState(null);
  const [openTickets, setOpenTickets] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileId) return;

    async function loadData() {
      const [docsRes, checkoutRes, ticketsRes] = await Promise.all([
        supabase
          .from("tenant_documents")
          .select("*")
          .eq("tenant_profile_id", profileId)
          .order("created_at", { ascending: false }),
        supabase
          .from("checkout_status")
          .select("*")
          .eq("tenant_profile_id", profileId)
          .single(),
        supabase
          .from("maintenance_tickets")
          .select("id", { count: "exact", head: true })
          .eq("room_id", roomId)
          .in("status", ["OPEN", "IN_PROGRESS"]),
      ]);
      setDocuments(docsRes.data || []);
      setCheckout(checkoutRes.data || null);
      setOpenTickets(ticketsRes.count || 0);
      setLoading(false);
    }

    loadData();

    // Realtime, keep the open-ticket count live as tickets are raised/resolved
    // on this tenant's room. (maintenance_tickets is in the realtime publication.)
    const channel = supabase.channel(`tenant_dashboard_${profileId}`);
    if (roomId) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "maintenance_tickets", filter: `room_id=eq.${roomId}` },
        () => loadData()
      );
    }
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, roomId]);

  return { documents, checkout, openTickets, loading };
}
