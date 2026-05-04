import { useEffect, useState } from "react";
import CaptainBadge from "./CaptainBadge";
import { supabase } from "../../lib/supabase";

async function fetchCaptainSummary(propertyId) {
  const start = new Date();
  start.setDate(1);
  const { data } = await supabase
    .from("claims")
    .select("amount_sgd, status")
    .eq("property_id", propertyId)
    .gte("created_at", start.toISOString());
  const list = data ?? [];
  return {
    count: list.length,
    totalSgd: list.reduce((s, c) => s + Number(c.amount_sgd), 0),
  };
}

export default function MembersCaptains({ properties, loading, onViewClaims }) {
  const [summaries, setSummaries] = useState({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        properties.filter((p) => p.captain).map(async (p) => [
          p.id,
          await fetchCaptainSummary(p.id),
        ]),
      );
      if (!cancelled) setSummaries(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [properties]);

  if (loading) return <div className="text-sm text-gray-500">Loading…</div>;

  const captains = properties.filter((p) => p.captain);
  if (captains.length === 0) {
    return <div className="text-sm text-gray-500">No captains assigned yet.</div>;
  }

  return (
    <div className="space-y-3">
      {captains.map((p) => {
        const sum = summaries[p.id] ?? { count: 0, totalSgd: 0 };
        return (
          <div key={p.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.name} captain</span>
                  <CaptainBadge size="sm" />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  This month: {sum.count} claim{sum.count === 1 ? "" : "s"}
                  {sum.count > 0 && <> · S${sum.totalSgd.toFixed(2)}</>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onViewClaims(p.captain.user_id)}
                className="rounded border border-gray-300 px-3 py-1 text-sm"
              >
                View claims
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
