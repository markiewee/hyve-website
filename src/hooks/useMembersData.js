import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useMembersData(propertyFilter = "ALL") {
  const [data, setData] = useState({ properties: [], loading: true });

  const fetchData = useCallback(async () => {
    setData((d) => ({ ...d, loading: true }));

    let propsQuery = supabase
      .from("properties")
      .select(`
        id, name,
        rooms(
          id, name, unit_code, room_type,
          tenant_profiles(
            id, user_id, role, moved_in_at, moved_out_at, is_active,
            is_primary, archived_at, monthly_rent, lease_end,
            tenant_details(full_name, email, phone),
            onboarding_progress(status, current_step)
          )
        ),
        maintenance_tickets(id, status, created_at)
      `)
      .order("name");

    if (propertyFilter !== "ALL") {
      propsQuery = propsQuery.eq("id", propertyFilter);
    }

    const { data: properties, error } = await propsQuery;
    if (error) {
      console.error("useMembersData error:", error);
      setData({ properties: [], loading: false });
      return;
    }

    // tenant_details + onboarding_progress are children of tenant_profiles,
    // so Supabase embeds them as ARRAYS. Normalise to single objects.
    const pick1 = (x) => (Array.isArray(x) ? x[0] ?? null : x ?? null);

    const enriched = (properties ?? []).map((p) => {
      // Lettable bedrooms only — skip common areas / kitchens / yards / toilets
      const lettable = (p.rooms ?? []).filter((r) => r.room_type != null);
      const rooms = lettable.map((r) => {
        // Filter: active and not archived (skips tenants past their 30-day grace)
        const live = (r.tenant_profiles ?? [])
          .filter((tp) => tp.is_active && !tp.archived_at)
          .map((tp) => ({
            ...tp,
            tenant_details: pick1(tp.tenant_details),
            onboarding_progress: pick1(tp.onboarding_progress),
          }));
        // Primary tenant first (the rent-paying one); fall back to first live tenant
        const primary = live.find((tp) => tp.is_primary) ?? live[0] ?? null;
        // Roommates: registered +1s (is_primary = false), e.g. couples/partners
        const roommates = live.filter((tp) => tp !== primary);
        return {
          id: r.id,
          name: r.name,
          unit_code: r.unit_code,
          tenant: primary, // kept as `tenant` for backwards compat
          roommates,
          occupants: live, // primary + roommates combined, in original order
        };
      }).sort((a, b) => (a.unit_code ?? "").localeCompare(b.unit_code ?? ""));

      const captains = (p.rooms ?? [])
        .flatMap((r) => r.tenant_profiles ?? [])
        .filter((tp) => tp.is_active && !tp.archived_at && tp.role === "HOUSE_CAPTAIN");

      const openTickets = (p.maintenance_tickets ?? [])
        .filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS");

      const occupancy = {
        filled: rooms.filter((r) => r.tenant).length,
        total: rooms.length,
      };

      return {
        id: p.id,
        name: p.name,
        rooms,
        captain: captains[0] ?? null,
        openTickets,
        occupancy,
      };
    });

    setData({ properties: enriched, loading: false });
  }, [propertyFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { ...data, refetch: fetchData };
}
