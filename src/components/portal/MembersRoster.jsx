import { useMemo, useState } from "react";
import { format } from "date-fns";
import CaptainBadge from "./CaptainBadge";

/**
 * MembersRoster — sortable + filterable table of every room/tenant pair.
 *
 *   Sort:   unit code, move-in (new/old), move-out (soon/late), onboarding stage.
 *   Filter: onboarding stage, occupancy (occupied/vacant/shared).
 *   Search: name / unit / property / email / phone.
 *
 * Each row = one room. If the room has a primary tenant, primary's info is
 * shown; roommates are listed as small chips beneath the primary's name.
 */

const SORT_OPTIONS = [
  { key: "unit_code", label: "Unit (A→Z)" },
  { key: "moved_in_at", label: "Move-in (newest)" },
  { key: "moved_in_at_asc", label: "Move-in (oldest)" },
  { key: "moved_out_at", label: "Move-out (soonest)" },
  { key: "moved_out_at_desc", label: "Move-out (latest)" },
  { key: "onboarding", label: "Onboarding stage" },
];

const STAGE_FILTERS = [
  { value: "ALL", label: "All Stages" },
  { value: "ACTIVE", label: "Active (onboarded)" },
  { value: "PENDING", label: "In onboarding" },
  { value: "VACANT", label: "Vacant rooms" },
];

const OCCUPANCY_FILTERS = [
  { value: "ALL", label: "All Rooms" },
  { value: "OCCUPIED", label: "Occupied" },
  { value: "VACANT", label: "Vacant" },
  { value: "SHARED", label: "Shared (≥2 tenants)" },
];

function nullSort(a, b, dir = "asc") {
  if (a == null && b == null) return 0;
  if (a == null) return dir === "asc" ? 1 : -1;
  if (b == null) return dir === "asc" ? -1 : 1;
  if (a < b) return dir === "asc" ? -1 : 1;
  if (a > b) return dir === "asc" ? 1 : -1;
  return 0;
}

function RoomRow({ room, propertyName }) {
  const t = room.tenant;
  const roommates = room.roommates ?? [];
  const onboarding = t?.onboarding_progress;
  const stage = onboarding?.current_step ?? onboarding?.status ?? null;
  const tenantName = t?.tenant_details?.full_name ?? (t?.user_id ? "Tenant" : null);

  const stageBadge = stage === "ACTIVE" ? (
    <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-green-300">
      ACTIVE
    </span>
  ) : stage ? (
    <span className="rounded bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-300">
      {stage}
    </span>
  ) : null;

  return (
    <tr className="border-b border-border last:border-0 hover:bg-white/5">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{room.unit_code}</span>
          {roommates.length > 0 && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
              +{roommates.length}
            </span>
          )}
        </div>
        <div className="text-xs text-foreground-variant">{room.name}</div>
      </td>
      <td className="px-3 py-2 text-xs text-foreground-variant">{propertyName}</td>
      <td className="px-3 py-2">
        {t ? (
          <div>
            <div className="font-medium text-foreground">{tenantName ?? "—"}</div>
            {t.role === "HOUSE_CAPTAIN" && <CaptainBadge size="sm" />}
            {t.is_primary === false && (
              <span className="ml-1 text-xs text-foreground-variant">(roommate)</span>
            )}
            {roommates.map((rm) => (
              <div key={rm.id} className="mt-0.5 text-xs text-foreground-variant">
                +{rm.tenant_details?.full_name ?? "Registered"}
              </div>
            ))}
          </div>
        ) : (
          <span className="text-xs text-foreground-variant">Vacant</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-foreground-variant">
        {t?.moved_in_at ? format(new Date(t.moved_in_at), "d MMM yyyy") : "—"}
      </td>
      <td className="px-3 py-2 text-xs text-foreground-variant">
        {t?.moved_out_at ? format(new Date(t.moved_out_at), "d MMM yyyy") : "—"}
      </td>
      <td className="px-3 py-2 text-xs text-foreground-variant">
        {t?.lease_end ? format(new Date(t.lease_end), "d MMM yyyy") : "—"}
      </td>
      <td className="px-3 py-2">
        {stageBadge ?? <span className="text-xs text-foreground-variant">—</span>}
      </td>
    </tr>
  );
}

export default function MembersRoster({ properties, loading }) {
  const [sortKey, setSortKey] = useState("unit_code");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [occupancyFilter, setOccupancyFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const flat = [];
    for (const p of properties ?? []) {
      for (const r of p.rooms ?? []) {
        flat.push({ ...r, _propertyName: p.name, _propertyId: p.id });
      }
    }
    return flat;
  }, [properties]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const t = r.tenant;
      const stage = t?.onboarding_progress?.current_step ?? t?.onboarding_progress?.status ?? null;

      if (stageFilter === "ACTIVE" && stage !== "ACTIVE") return false;
      if (stageFilter === "PENDING" && (!t || stage === "ACTIVE" || !stage)) return false;
      if (stageFilter === "VACANT" && t) return false;

      const occupants = (r.occupants ?? []).length;
      if (occupancyFilter === "OCCUPIED" && !t) return false;
      if (occupancyFilter === "VACANT" && t) return false;
      if (occupancyFilter === "SHARED" && occupants < 2) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const haystack = [
          r.unit_code,
          r.name,
          r._propertyName,
          t?.tenant_details?.full_name,
          t?.tenant_details?.email,
          t?.tenant_details?.phone,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, stageFilter, occupancyFilter, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const get = (r) => {
      const t = r.tenant;
      switch (sortKey) {
        case "unit_code": return r.unit_code ?? "";
        case "moved_in_at":
        case "moved_in_at_asc":
          return t?.moved_in_at ? new Date(t.moved_in_at).getTime() : null;
        case "moved_out_at":
        case "moved_out_at_desc":
          return t?.moved_out_at ? new Date(t.moved_out_at).getTime() : null;
        case "onboarding":
          return t?.onboarding_progress?.current_step ?? t?.onboarding_progress?.status ?? "ZZZ";
        default:
          return r.unit_code ?? "";
      }
    };
    const dir =
      sortKey === "moved_in_at_asc" ? "asc"
      : sortKey === "moved_in_at" ? "desc"
      : sortKey === "moved_out_at_desc" ? "desc"
      : "asc";
    arr.sort((a, b) => nullSort(get(a), get(b), dir));
    return arr;
  }, [filtered, sortKey]);

  if (loading) return <div className="text-sm text-foreground-variant">Loading…</div>;
  if (rows.length === 0) {
    return <div className="text-sm text-foreground-variant">No rooms found.</div>;
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, unit, email, phone…"
          className="flex-1 min-w-[200px] rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-foreground-variant"
        />
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
          className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>Sort: {o.label}</option>
          ))}
        </select>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        >
          {STAGE_FILTERS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={occupancyFilter}
          onChange={(e) => setOccupancyFilter(e.target.value)}
          className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        >
          {OCCUPANCY_FILTERS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span className="text-xs text-foreground-variant">
          {sorted.length} of {rows.length} room{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-background/40 text-xs uppercase text-foreground-variant">
            <tr>
              <th className="px-3 py-2 text-left">Unit</th>
              <th className="px-3 py-2 text-left">Property</th>
              <th className="px-3 py-2 text-left">Tenant(s)</th>
              <th className="px-3 py-2 text-left">Move-In</th>
              <th className="px-3 py-2 text-left">Move-Out</th>
              <th className="px-3 py-2 text-left">Lease End</th>
              <th className="px-3 py-2 text-left">Onboarding</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <RoomRow key={r.id} room={r} propertyName={r._propertyName} />
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-foreground-variant">
            No rooms match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}
