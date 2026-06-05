import { useEffect, useState } from "react";
import { format } from "date-fns";
import PortalLayout from "../../components/portal/PortalLayout";
import PageHeader from "../../components/portal/PageHeader";
import { supabase } from "../../lib/supabase";

/**
 * Past Tenants — reads from v_tenant_status WHERE status='ARCHIVED'.
 * Powered by the auto-archive cron (`auto-archive-tenants`, daily 02:00 SGT)
 * which flips a tenant to ARCHIVED 30 days after their moved_out_at.
 */
export default function AdminPastTenantsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [propertyFilter, setPropertyFilter] = useState("ALL");
  const [allProperties, setAllProperties] = useState([]);

  useEffect(() => {
    supabase
      .from("properties")
      .select("id, name")
      .order("name")
      .then(({ data }) => setAllProperties(data ?? []));
  }, []);

  useEffect(() => {
    setLoading(true);
    let q = supabase
      .from("v_tenant_status")
      .select(`
        id, room_id, property_id, role, monthly_rent,
        moved_in_at, moved_out_at, archived_at, lease_end, status,
        tenant_details(full_name, email, phone),
        rooms(unit_code, name),
        properties(name)
      `)
      .eq("status", "ARCHIVED")
      .order("archived_at", { ascending: false })
      .limit(200);

    if (propertyFilter !== "ALL") q = q.eq("property_id", propertyFilter);

    q.then(({ data, error }) => {
      if (error) console.error("Past tenants:", error);
      setRows(data ?? []);
      setLoading(false);
    });
  }, [propertyFilter]);

  return (
    <PortalLayout>
      <div className="space-y-4">
        <PageHeader
          title="Past Tenants"
          action={
            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="rounded border border-border bg-background px-3 py-1 text-sm text-foreground"
            >
              <option value="ALL">All Properties</option>
              {allProperties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          }
        />

        {loading && <div className="text-sm text-foreground-variant">Loading…</div>}

        {!loading && rows.length === 0 && (
          <div className="rounded border border-border bg-surface p-6 text-center text-sm text-foreground-variant">
            No archived tenants yet. Tenants auto-archive 30 days after move-out.
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-background/40 text-xs uppercase text-foreground-variant">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Property / Room</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Moved In</th>
                  <th className="px-3 py-2 text-left">Moved Out</th>
                  <th className="px-3 py-2 text-left">Archived</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-white/5">
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">{r.tenant_details?.full_name ?? "—"}</div>
                      <div className="text-xs text-foreground-variant">
                        {r.tenant_details?.email ?? r.tenant_details?.phone ?? ""}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-foreground">{r.properties?.name ?? "—"}</div>
                      <div className="text-xs text-foreground-variant">{r.rooms?.unit_code ?? ""}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-foreground-variant">{r.role}</td>
                    <td className="px-3 py-2 text-xs text-foreground-variant">
                      {r.moved_in_at ? format(new Date(r.moved_in_at), "d MMM yyyy") : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-foreground-variant">
                      {r.moved_out_at ? format(new Date(r.moved_out_at), "d MMM yyyy") : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-foreground-variant">
                      {r.archived_at ? format(new Date(r.archived_at), "d MMM yyyy") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
