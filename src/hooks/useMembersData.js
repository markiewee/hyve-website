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
          id, name, unit_code,
          tenant_profiles(
            id, user_id, role, moved_in_at, moved_out_at, is_active,
            lease_end
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

    const enriched = (properties ?? []).map((p) => {
      const rooms = (p.rooms ?? []).map((r) => {
        const activeTenant = (r.tenant_profiles ?? []).find((tp) => tp.is_active);
        return {
          id: r.id,
          name: r.name,
          unit_code: r.unit_code,
          tenant: activeTenant ?? null,
        };
      }).sort((a, b) => (a.unit_code ?? "").localeCompare(b.unit_code ?? ""));

      const captains = (p.rooms ?? [])
        .flatMap((r) => r.tenant_profiles ?? [])
        .filter((tp) => tp.is_active && tp.role === "HOUSE_CAPTAIN");

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
