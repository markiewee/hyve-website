import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";

const ROLE_BADGE = {
  HOUSE_CAPTAIN: "bg-blue-100 text-blue-700",
  TENANT: "bg-gray-100 text-gray-600",
};

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-SG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function PropertyTenantsPage() {
  const { profile } = useAuth();
  const propertyId = profile?.property_id ?? profile?.rooms?.property_id;
  const propertyName = profile?.properties?.name ?? "";

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!propertyId) {
      setLoading(false);
      return;
    }

    async function fetchTenants() {
      const { data, error } = await supabase
        .from("tenant_profiles")
        .select("id, role, moved_in_at, rooms(name, unit_code)")
        .eq("property_id", propertyId)
        .eq("is_active", true);

      if (error) {
        console.error("Error fetching tenants:", error);
        setLoading(false);
        return;
      }

      // Sort client-side by unit_code (Supabase JS doesn't support ordering by joined columns)
      const sorted = (data ?? []).sort((a, b) => {
        const codeA = a.rooms?.unit_code ?? "";
        const codeB = b.rooms?.unit_code ?? "";
        return codeA.localeCompare(codeB);
      });

      setTenants(sorted);
      setLoading(false);
    }

    fetchTenants();
  }, [propertyId]);

  return (
    <PortalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Tenants</h1>
        {propertyName && (
          <p className="text-muted-foreground text-sm mt-1">{propertyName}</p>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-full bg-gray-100 animate-pulse rounded" />
          ))}
        </div>
      ) : tenants.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active tenants found.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Room</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Since</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant, index) => {
                const roleBadgeClass =
                  ROLE_BADGE[tenant.role] ?? "bg-gray-100 text-gray-600";
                return (
                  <tr
                    key={tenant.id}
                    className={`border-b last:border-b-0 ${
                      index % 2 === 0 ? "bg-card" : "bg-muted/20"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
                          {tenant.rooms?.unit_code ?? "—"}
                        </span>
                        <span className="text-foreground">
                          {tenant.rooms?.name ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${roleBadgeClass}`}
                      >
                        {tenant.role === "HOUSE_CAPTAIN" ? "House Captain" : "Tenant"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(tenant.moved_in_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PortalLayout>
  );
}
