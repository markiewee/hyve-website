import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import CaptainBadge from "../../components/portal/CaptainBadge";

export default function PropertyTenantsPage() {
  const { profile } = useAuth();
  const propertyId = profile?.property_id ?? profile?.rooms?.property_id;
  const propertyName = profile?.properties?.name ?? "";

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!propertyId) { setLoading(false); return; }
    (async () => {
      const { data, error } = await supabase
        .from("tenant_profiles")
        .select(`
          id, role, moved_in_at,
          rooms(name, unit_code)
        `)
        .eq("property_id", propertyId)
        .eq("is_active", true);

      if (error) {
        console.error("Error fetching members:", error);
        setLoading(false);
        return;
      }
      const sorted = (data ?? []).sort((a, b) => {
        const codeA = a.rooms?.unit_code ?? "";
        const codeB = b.rooms?.unit_code ?? "";
        return codeA.localeCompare(codeB);
      });
      setMembers(sorted);
      setLoading(false);
    })();
  }, [propertyId]);

  const captain = members.find((m) => m.role === "HOUSE_CAPTAIN");
  const others = members.filter((m) => m.role !== "HOUSE_CAPTAIN");

  return (
    <PortalLayout>
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">{propertyName}</h1>
          <span className="text-sm text-gray-500">
            {members.length} housemate{members.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : (
          <>
            {captain && (
              <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span aria-hidden>🏠</span>
                  <CaptainBadge size="md" />
                </div>
                <div className="font-medium">
                  {captain.rooms?.name ?? "Captain"}
                  {captain.rooms?.unit_code && (
                    <span className="text-xs text-gray-500 ml-1">{captain.rooms.unit_code}</span>
                  )}
                </div>
                <p className="text-xs text-gray-700 mt-1">
                  Your house captain handles maintenance + house issues.
                </p>
              </div>
            )}

            <div className="space-y-2">
              {others.map((m) => (
                <div key={m.id} className="rounded border border-gray-200 bg-white p-3">
                  <div className="font-medium">
                    {m.rooms?.name ?? "—"}
                    {m.rooms?.unit_code && (
                      <span className="text-xs text-gray-500 ml-1">{m.rooms.unit_code}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    Moved in {m.moved_in_at ? format(new Date(m.moved_in_at), "d MMM yyyy") : "—"}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </PortalLayout>
  );
}
