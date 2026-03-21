import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export function useTenantDashboard(profileId, roomId) {
  const [documents, setDocuments] = useState([]);
  const [checkout, setCheckout] = useState(null);
  const [openTickets, setOpenTickets] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileId) return;

    Promise.all([
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
    ]).then(([docsRes, checkoutRes, ticketsRes]) => {
      setDocuments(docsRes.data || []);
      setCheckout(checkoutRes.data || null);
      setOpenTickets(ticketsRes.count || 0);
      setLoading(false);
    });
  }, [profileId, roomId]);

  return { documents, checkout, openTickets, loading };
}
