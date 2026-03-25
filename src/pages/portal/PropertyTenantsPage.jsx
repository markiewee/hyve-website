import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";

const ROLE_BADGE = {
  HOUSE_CAPTAIN: "bg-blue-100 text-blue-700",
  TENANT: "bg-[#e6eeff] text-[#555f6f]",
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
      {/* Page header */}
      <div className="mb-10">
        <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
          Members
        </h1>
        {propertyName && (
          <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">{propertyName}</p>
        )}
      </div>

      {/* Stat */}
      {!loading && (
        <div className="mb-8">
          <div className="bg-[#006b5f] rounded-2xl p-6 inline-flex flex-col">
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#71f8e4]/80 font-bold mb-2">Active Members</p>
            <p className="font-['Plus_Jakarta_Sans'] text-4xl font-extrabold text-white">{tenants.length}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden">
          <div className="divide-y divide-[#bbcac6]/10">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="px-8 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#eff4ff] animate-pulse rounded-full" />
                  <div className="space-y-2">
                    <div className="h-4 w-20 bg-[#eff4ff] animate-pulse rounded" />
                    <div className="h-3 w-28 bg-[#eff4ff] animate-pulse rounded" />
                  </div>
                </div>
                <div className="h-5 w-20 bg-[#eff4ff] animate-pulse rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ) : tenants.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-[#bbcac6]/15 shadow-sm text-center">
          <p className="text-[#6c7a77] font-['Manrope'] text-sm">No active members found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#eff4ff]">
              <tr>
                <th className="text-left px-8 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">Room</th>
                <th className="text-left px-6 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">Role</th>
                <th className="text-left px-6 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold hidden sm:table-cell">Since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#bbcac6]/10">
              {tenants.map((tenant) => {
                const roleBadgeClass = ROLE_BADGE[tenant.role] ?? "bg-[#e6eeff] text-[#555f6f]";
                const initials = (tenant.rooms?.unit_code ?? "??").slice(0, 2).toUpperCase();

                return (
                  <tr key={tenant.id} className="hover:bg-[#f8f9ff] transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#d9e3f6] flex items-center justify-center text-[#006b5f] font-bold text-xs shrink-0">
                          {initials}
                        </div>
                        <div>
                          <span className="font-['Inter'] text-xs font-bold text-[#006b5f] bg-[#eff4ff] px-2 py-0.5 rounded block w-fit mb-0.5">
                            {tenant.rooms?.unit_code ?? "—"}
                          </span>
                          <span className="font-['Manrope'] text-sm text-[#121c2a] font-medium">
                            {tenant.rooms?.name ?? "—"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${roleBadgeClass}`}>
                        {tenant.role === "HOUSE_CAPTAIN" ? "House Captain" : "Member"}
                      </span>
                    </td>
                    <td className="px-6 py-5 font-['Manrope'] text-sm text-[#6c7a77] hidden sm:table-cell">
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
