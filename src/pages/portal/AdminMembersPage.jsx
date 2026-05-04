import { useEffect, useState } from "react";
import PortalLayout from "../../components/portal/PortalLayout";
import MembersRoster from "../../components/portal/MembersRoster";
import MembersAlerts from "../../components/portal/MembersAlerts";
import MembersCaptains from "../../components/portal/MembersCaptains";
import MembersClaimsQueue from "../../components/portal/MembersClaimsQueue";
import { useMembersData } from "../../hooks/useMembersData";
import { supabase } from "../../lib/supabase";

const MODES = [
  { key: "ROSTER", label: "Roster" },
  { key: "ALERTS", label: "Alerts" },
  { key: "CAPTAINS", label: "Captains" },
  { key: "CLAIMS", label: "Claims" },
];

export default function AdminMembersPage() {
  const [mode, setMode] = useState("ROSTER");
  const [propertyFilter, setPropertyFilter] = useState("ALL");
  const [captainFilter, setCaptainFilter] = useState(null);
  const [allProperties, setAllProperties] = useState([]);
  const [pendingClaimCount, setPendingClaimCount] = useState(0);

  const { properties, loading } = useMembersData(propertyFilter);

  useEffect(() => {
    supabase.from("properties").select("id, name").order("name")
      .then(({ data }) => setAllProperties(data ?? []));
    supabase.from("claims").select("id", { count: "exact", head: true })
      .eq("status", "SUBMITTED")
      .then(({ count }) => setPendingClaimCount(count ?? 0));
  }, []);

  return (
    <PortalLayout>
      <div className="max-w-6xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-semibold">Members</h1>
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1 text-sm"
          >
            <option value="ALL">All Properties</option>
            {allProperties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 border-b border-gray-200">
          {MODES.map((m) => {
            const dot = m.key === "CLAIMS" && pendingClaimCount > 0;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => { setMode(m.key); setCaptainFilter(null); }}
                className={`relative px-4 py-2 text-sm font-medium ${
                  mode === m.key
                    ? "border-b-2 border-blue-600 text-blue-700"
                    : "text-gray-600"
                }`}
              >
                {m.label}
                {dot && (
                  <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] px-1.5 py-0.5">
                    {pendingClaimCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {mode === "ROSTER" && <MembersRoster properties={properties} loading={loading} />}
        {mode === "ALERTS" && <MembersAlerts properties={properties} loading={loading} />}
        {mode === "CAPTAINS" && (
          <MembersCaptains
            properties={properties}
            loading={loading}
            onViewClaims={(captainUserId) => {
              setCaptainFilter(captainUserId);
              setMode("CLAIMS");
            }}
          />
        )}
        {mode === "CLAIMS" && (
          <MembersClaimsQueue
            propertyFilter={propertyFilter}
            captainFilter={captainFilter}
          />
        )}
      </div>
    </PortalLayout>
  );
}
