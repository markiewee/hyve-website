import { format } from "date-fns";
import CaptainBadge from "./CaptainBadge";

function RoomRow({ room }) {
  const t = room.tenant;
  return (
    <div className="rounded border border-border p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-foreground-variant">{room.unit_code}</div>
          <div className="font-medium">{room.name}</div>
        </div>
        {!t && <span className="text-xs text-foreground-variant">Vacant</span>}
      </div>
      {t && (
        <div className="mt-2 text-sm">
          <div className="font-medium">{t.user_id ? "Tenant" : "—"}</div>
          {t.lease_end && (
            <div className="text-xs text-foreground-variant">
              Lease ends {format(new Date(t.lease_end), "d MMM yyyy")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MembersRoster({ properties, loading }) {
  if (loading) return <div className="text-sm text-foreground-variant">Loading…</div>;
  if (properties.length === 0) {
    return <div className="text-sm text-foreground-variant">No properties match.</div>;
  }

  return (
    <div className={`grid gap-4 ${properties.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-3"}`}>
      {properties.map((p) => (
        <div key={p.id} className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-semibold">{p.name}</h2>
            <span className="text-xs text-foreground-variant">
              {p.occupancy.filled}/{p.occupancy.total} filled
            </span>
          </div>

          {p.captain && (
            <div className="mb-3 rounded border-2 border-blue-500/25 bg-blue-500/10 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Captain</div>
                <CaptainBadge size="sm" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            {p.rooms.map((r) => <RoomRow key={r.id} room={r} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
