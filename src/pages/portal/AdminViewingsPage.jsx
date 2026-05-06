import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import { PROPERTY_META, PROPERTY_CODES, getPropertyByCode } from "../book/_propertyMeta";
import { blockSlot, cancelViewingAdmin } from "../book/_bookApi";

/* ───────────────────────────── helpers ───────────────────────────── */

const PROPERTY_BADGE = {
  TG: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-500", label: "TG" },
  IH: { bg: "bg-teal-100", text: "text-teal-700", border: "border-teal-500", label: "IH" },
  CP: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-500", label: "CP" },
};

const LEAD_STATUSES = [
  { key: "new", label: "New", color: "bg-slate-200 text-slate-700" },
  { key: "viewing_booked", label: "Viewing booked", color: "bg-teal-100 text-teal-700" },
  { key: "viewed", label: "Viewed", color: "bg-blue-100 text-blue-700" },
  { key: "closed_won", label: "Closed (won)", color: "bg-emerald-100 text-emerald-700" },
  { key: "closed_lost", label: "Closed (lost)", color: "bg-red-100 text-red-700" },
];

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function fmtDate(iso, opts = { weekday: "short", day: "numeric", month: "short" }) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-SG", { ...opts, timeZone: "Asia/Singapore" });
}

function fmtTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-SG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Singapore",
  });
}

function startOfDaySGT(d) {
  const sgt = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Singapore" }));
  sgt.setHours(0, 0, 0, 0);
  return sgt;
}

// Build a 14-day horizon starting today.
function buildDayHorizon(count = 14) {
  const start = startOfDaySGT(new Date());
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

// Hour rows for the grid. Cover the union of weekday + weekend bands plus a
// half-hour buffer top & bottom so manual blocks fit.
const GRID_HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

function hashSlotKey(dayIso, hour, half) {
  return `${dayIso}|${hour}:${half ? "30" : "00"}`;
}

/* ───────────────────────────── tabs ───────────────────────────── */

function TabButton({ active, onClick, children, count }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-['Plus_Jakarta_Sans'] font-bold text-sm transition-all ${
        active
          ? "bg-[#006b5f] text-white shadow-md"
          : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
      }`}
    >
      {children}
      {typeof count === "number" && (
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
            active ? "bg-white/20" : "bg-slate-100 text-slate-600"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* ───────────────────────────── Calendar tab ───────────────────────────── */

function CalendarTab({ viewings, refetch }) {
  const days = useMemo(() => buildDayHorizon(14), []);
  const [propertyFilter, setPropertyFilter] = useState("");
  const [activeViewing, setActiveViewing] = useState(null);
  const [activeBlock, setActiveBlock] = useState(null);

  const filteredViewings = useMemo(() => {
    if (!propertyFilter) return viewings;
    return viewings.filter((v) => v.properties?.code === propertyFilter);
  }, [viewings, propertyFilter]);

  // Index viewings by slot key for O(1) lookup in cells.
  const slotMap = useMemo(() => {
    const map = new Map();
    for (const v of filteredViewings) {
      const startISO = v.slot_start;
      if (!startISO) continue;
      const d = new Date(startISO);
      const dayIso = isoDate(
        new Date(d.toLocaleString("en-US", { timeZone: "Asia/Singapore" }))
      );
      const sgtParts = new Date(
        d.toLocaleString("en-US", { timeZone: "Asia/Singapore" })
      );
      const key = hashSlotKey(dayIso, sgtParts.getHours(), sgtParts.getMinutes() >= 30);
      map.set(key, v);
    }
    return map;
  }, [filteredViewings]);

  // Upcoming list (chronological, future-only).
  const upcoming = useMemo(() => {
    const now = Date.now();
    return [...filteredViewings]
      .filter((v) => {
        const s = v.slot_start ? new Date(v.slot_start).getTime() : 0;
        return s > now && v.status !== "cancelled" && v.status !== "CANCELLED";
      })
      .sort((a, b) => new Date(a.slot_start) - new Date(b.slot_start));
  }, [filteredViewings]);

  return (
    <>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative">
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="appearance-none bg-white border border-slate-200 text-slate-900 text-sm rounded-lg px-4 py-2.5 pr-10 focus:ring-teal-500 focus:border-teal-500 font-medium"
          >
            <option value="">All properties</option>
            {PROPERTY_CODES.map((code) => (
              <option key={code} value={code}>
                {PROPERTY_META[code].name}
              </option>
            ))}
          </select>
          <span className="material-symbols-outlined absolute right-3 top-2.5 text-slate-400 pointer-events-none text-[20px]">
            expand_more
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium ml-auto">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> free
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-teal-500" /> booked
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-300" /> blocked
          </span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <div className="min-w-[1100px]">
            {/* Header row */}
            <div className="grid grid-cols-[80px_repeat(14,minmax(0,1fr))] bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <div className="p-2 text-[10px] uppercase tracking-widest text-slate-400 font-bold border-r border-slate-200" />
              {days.map((d) => {
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div
                    key={isoDate(d)}
                    className={`p-2 text-center border-r border-slate-200 last:border-r-0 ${
                      isWeekend ? "bg-teal-50" : ""
                    }`}
                  >
                    <div className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">
                      {d.toLocaleDateString("en-SG", { weekday: "short" })}
                    </div>
                    <div className="text-sm font-extrabold text-slate-900">{d.getDate()}</div>
                    <div className="text-[9px] text-slate-400 font-medium">
                      {d.toLocaleDateString("en-SG", { month: "short" })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Body rows: hour, then :00 / :30 cells */}
            {GRID_HOURS.map((hour) => (
              <div
                key={hour}
                className="grid grid-cols-[80px_repeat(14,minmax(0,1fr))] border-b border-slate-100"
              >
                <div className="p-2 text-[10px] text-slate-500 font-bold border-r border-slate-200 bg-slate-50/40">
                  {hour > 12 ? `${hour - 12}pm` : `${hour}${hour === 12 ? "pm" : "am"}`}
                </div>
                {days.map((d) => {
                  const dayIso = isoDate(d);
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <div
                      key={`${dayIso}-${hour}`}
                      className={`grid grid-rows-2 border-r border-slate-100 last:border-r-0 ${
                        isWeekend ? "bg-teal-50/30" : ""
                      }`}
                    >
                      {[0, 1].map((half) => {
                        const key = hashSlotKey(dayIso, hour, half === 1);
                        const viewing = slotMap.get(key);
                        const blocked =
                          viewing?.status === "blocked" || viewing?.status === "BLOCKED";
                        const cancelled =
                          viewing?.status === "cancelled" || viewing?.status === "CANCELLED";
                        const free = !viewing;
                        return (
                          <button
                            key={`${key}-${half}`}
                            onClick={() => {
                              if (free) {
                                setActiveBlock({
                                  property: propertyFilter || "TG",
                                  slot_start: `${dayIso}T${String(hour).padStart(2, "0")}:${
                                    half ? "30" : "00"
                                  }:00+08:00`,
                                  slot_end: `${dayIso}T${String(hour + (half ? 1 : 0)).padStart(
                                    2,
                                    "0"
                                  )}:${half ? "00" : "30"}:00+08:00`,
                                });
                              } else if (!cancelled) {
                                setActiveViewing(viewing);
                              }
                            }}
                            className={`block min-h-[16px] border-b border-slate-50 last:border-b-0 transition-colors ${
                              blocked
                                ? "bg-slate-300 hover:bg-slate-400"
                                : cancelled
                                  ? "bg-red-50 hover:bg-red-100"
                                  : viewing
                                    ? "bg-teal-500 hover:bg-teal-600"
                                    : "bg-emerald-50/50 hover:bg-emerald-100"
                            }`}
                            title={
                              viewing
                                ? `${viewing.prospect_name || "Booked"} · ${
                                    viewing.properties?.code || ""
                                  }`
                                : `Block ${dayIso} ${hour}:${half ? "30" : "00"}`
                            }
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upcoming list */}
      <div className="mt-8">
        <h2 className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-slate-900 mb-3 tracking-tight">
          Upcoming viewings ({upcoming.length})
        </h2>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-500 italic p-6 text-center">No upcoming viewings.</p>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                <tr>
                  <th className="px-4 py-2 text-left">When</th>
                  <th className="px-4 py-2 text-left">Property</th>
                  <th className="px-4 py-2 text-left">Prospect</th>
                  <th className="px-4 py-2 text-left">Captain</th>
                  <th className="px-4 py-2 text-right">Source</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((v) => {
                  const code = v.properties?.code;
                  const badge = PROPERTY_BADGE[code] || {
                    bg: "bg-slate-100",
                    text: "text-slate-600",
                  };
                  return (
                    <tr
                      key={v.id}
                      onClick={() => setActiveViewing(v)}
                      className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 cursor-pointer text-sm"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {fmtDate(v.slot_start)} · {fmtTime(v.slot_start)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`${badge.bg} ${badge.text} text-[10px] font-bold px-2 py-1 rounded`}>
                          {code || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {v.prospect_name || "Unknown"}
                        {v.rooms?.unit_code ? (
                          <span className="text-slate-400 ml-2 text-xs">{v.rooms.unit_code}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {v.captain?.full_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-400 uppercase tracking-wider">
                        {v.source || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Viewing modal */}
      {activeViewing && (
        <ViewingModal
          viewing={activeViewing}
          onClose={() => setActiveViewing(null)}
          onChanged={refetch}
        />
      )}
      {activeBlock && (
        <BlockSlotModal
          slot={activeBlock}
          onClose={() => setActiveBlock(null)}
          onBlocked={refetch}
        />
      )}
    </>
  );
}

function ViewingModal({ viewing, onClose, onChanged }) {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState(null);
  const code = viewing.properties?.code;
  const meta = code ? getPropertyByCode(code) : null;

  async function handleCancel() {
    if (!window.confirm("Cancel this viewing? The prospect will be emailed.")) return;
    setCancelling(true);
    setError(null);
    try {
      // Try the dedicated admin endpoint first; fall back to direct Supabase update if backend hasn't shipped it yet.
      try {
        await cancelViewingAdmin(viewing.id);
      } catch (apiErr) {
        if (apiErr.status === 404) {
          await supabase
            .from("property_viewings")
            .update({ status: "cancelled" })
            .eq("id", viewing.id);
        } else {
          throw apiErr;
        }
      }
      onChanged?.();
      onClose();
    } catch (err) {
      setError(err.message || "Cancel failed.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-slate-900">
            Viewing details
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">When</p>
            <p className="font-medium text-slate-900">
              {fmtDate(viewing.slot_start, { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <p className="text-slate-600">
              {fmtTime(viewing.slot_start)} – {fmtTime(viewing.slot_end)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Property</p>
            <p className="font-medium text-slate-900">{viewing.properties?.name || meta?.name || "—"}</p>
            {viewing.rooms && (
              <p className="text-slate-600 text-xs">
                Room: {viewing.rooms.unit_code || viewing.rooms.name}
              </p>
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Prospect</p>
            <p className="font-medium text-slate-900">{viewing.prospect_name || "—"}</p>
            <p className="text-slate-600 text-xs">{viewing.prospect_email}</p>
            <p className="text-slate-600 text-xs">{viewing.prospect_whatsapp}</p>
          </div>
          {viewing.notes && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Notes</p>
              <p className="text-slate-700">{viewing.notes}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Source</p>
            <p className="text-slate-700 uppercase tracking-wider text-xs">{viewing.source || "—"}</p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
        )}

        <div className="mt-6 flex gap-2">
          <Link
            to={`/portal/admin/viewings/${viewing.id}`}
            className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-bold text-sm text-center hover:bg-slate-200 transition-colors"
          >
            Open detail
          </Link>
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {cancelling ? "Cancelling…" : "Cancel viewing"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BlockSlotModal({ slot, onClose, onBlocked }) {
  const [property, setProperty] = useState(slot.property || "TG");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleBlock() {
    setSaving(true);
    setError(null);
    try {
      await blockSlot({
        property,
        slot_start: slot.slot_start,
        slot_end: slot.slot_end,
        reason: reason.trim() || undefined,
      });
      onBlocked?.();
      onClose();
    } catch (err) {
      // If backend hasn't shipped /api/book/block yet we surface a friendly message
      // rather than crashing — Mark can still cancel in-cal manually.
      if (err.status === 404) {
        setError("Blocking endpoint not deployed yet. Add the block manually in Google Calendar.");
      } else {
        setError(err.message || "Couldn't block that slot.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-slate-900">Block slot</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          {fmtDate(slot.slot_start, { weekday: "short", day: "numeric", month: "short" })} ·{" "}
          {fmtTime(slot.slot_start)} — {fmtTime(slot.slot_end)}
        </p>
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-1">
              Property
            </label>
            <select
              value={property}
              onChange={(e) => setProperty(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
            >
              {PROPERTY_CODES.map((c) => (
                <option key={c} value={c}>
                  {PROPERTY_META[c].name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-1">
              Reason (optional)
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Captain unavailable…"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <button
          onClick={handleBlock}
          disabled={saving}
          className="w-full py-2.5 bg-slate-700 text-white rounded-lg font-bold text-sm hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {saving ? "Blocking…" : "Block this slot"}
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────────── Leads tab ───────────────────────────── */

function LeadsTab() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [activeLead, setActiveLead] = useState(null);
  const [hasLeadsTable, setHasLeadsTable] = useState(true);

  async function fetchLeads() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*, viewing:property_viewings!viewing_id(*)")
        .order("first_contact_at", { ascending: false })
        .limit(500);
      if (error) {
        // Table may not exist yet (backend agent's migration hasn't landed) — degrade gracefully.
        if (
          error.code === "42P01" ||
          /relation .* does not exist/i.test(error.message || "")
        ) {
          setHasLeadsTable(false);
          setLeads([]);
        } else {
          console.error("Leads fetch failed", error);
          setLeads([]);
        }
      } else {
        setLeads(data || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLeads();
  }, []);

  const filtered = useMemo(() => {
    if (!statusFilter) return leads;
    return leads.filter((l) => l.status === statusFilter);
  }, [leads, statusFilter]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(LEAD_STATUSES.map((s) => [s.key, 0]));
    for (const l of leads) {
      if (c[l.status] != null) c[l.status] += 1;
    }
    return c;
  }, [leads]);

  if (!hasLeadsTable) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <span className="material-symbols-outlined text-4xl text-slate-400 mb-3 block">
          deployed_code
        </span>
        <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-slate-900 mb-1">
          Leads table not deployed yet
        </h3>
        <p className="text-sm text-slate-500">
          Once the backend migration applies the <code>leads</code> table, this tab will populate
          automatically.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Status filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button
          onClick={() => setStatusFilter("")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            !statusFilter
              ? "bg-[#006b5f] text-white"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          All ({leads.length})
        </button>
        {LEAD_STATUSES.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              statusFilter === s.key
                ? "bg-[#006b5f] text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {s.label}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                statusFilter === s.key ? "bg-white/20" : s.color
              }`}
            >
              {counts[s.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="material-symbols-outlined text-teal-600 text-3xl animate-spin">
              progress_activity
            </span>
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-10 text-sm text-slate-500 italic text-center">No leads match.</p>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Contact</th>
                <th className="px-4 py-2 text-left">Interest</th>
                <th className="px-4 py-2 text-left">Source</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">First contact</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const status = LEAD_STATUSES.find((s) => s.key === l.status);
                return (
                  <tr
                    key={l.id}
                    onClick={() => setActiveLead(l)}
                    className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 cursor-pointer text-sm"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{l.name}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      <div>{l.email}</div>
                      <div>{l.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {(l.property_interest || []).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs uppercase tracking-wider text-slate-400">
                      {l.source || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`${status?.color || "bg-slate-100 text-slate-600"} text-[10px] font-bold px-2 py-1 rounded`}>
                        {status?.label || l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-500">
                      {fmtDate(l.first_contact_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Side drawer */}
      {activeLead && (
        <LeadDrawer
          lead={activeLead}
          onClose={() => setActiveLead(null)}
          onUpdated={fetchLeads}
        />
      )}
    </>
  );
}

function LeadDrawer({ lead, onClose, onUpdated }) {
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState(lead.notes || "");
  const [error, setError] = useState(null);

  async function setStatus(next) {
    setSaving(true);
    setError(null);
    try {
      const { error: dbErr } = await supabase
        .from("leads")
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq("id", lead.id);
      if (dbErr) throw dbErr;
      onUpdated?.();
    } catch (err) {
      setError(err.message || "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function saveNotes() {
    setSaving(true);
    setError(null);
    try {
      const { error: dbErr } = await supabase
        .from("leads")
        .update({ notes, updated_at: new Date().toISOString() })
        .eq("id", lead.id);
      if (dbErr) throw dbErr;
      onUpdated?.();
    } catch (err) {
      setError(err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 p-5 flex items-start justify-between">
          <div>
            <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-slate-900">
              {lead.name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              First contact {fmtDate(lead.first_contact_at)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Contact */}
          <section>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
              Contact
            </p>
            <p className="text-sm">{lead.email || "—"}</p>
            <p className="text-sm">{lead.phone || "—"}</p>
            <div className="flex gap-2 mt-2">
              {lead.phone && (
                <a
                  href={`https://wa.me/${lead.phone.replace(/[^\d]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-[#25D366]/15 text-[#0c6c40] rounded-lg font-bold hover:bg-[#25D366]/25 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">chat</span> WA
                </a>
              )}
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">mail</span> Email
                </a>
              )}
            </div>
          </section>

          {/* Status */}
          <section>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">
              Status
            </p>
            <div className="grid grid-cols-2 gap-2">
              {LEAD_STATUSES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStatus(s.key)}
                  disabled={saving}
                  className={`text-xs font-bold py-2 rounded-lg border transition-all ${
                    lead.status === s.key
                      ? "border-[#006b5f] bg-[#006b5f] text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-[#006b5f] hover:text-[#006b5f]"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>

          {/* Linked viewing */}
          {lead.viewing && (
            <section>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
                Linked viewing
              </p>
              <Link
                to={`/portal/admin/viewings/${lead.viewing.id}`}
                className="block bg-slate-50 hover:bg-slate-100 transition-colors rounded-lg p-3 text-sm"
              >
                <p className="font-medium text-slate-900">
                  {fmtDate(lead.viewing.slot_start)} · {fmtTime(lead.viewing.slot_start)}
                </p>
                <p className="text-xs text-slate-500">
                  Status: {lead.viewing.status || "—"}
                </p>
              </Link>
            </section>
          )}

          {/* Notes */}
          <section>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
              Notes
            </p>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none"
              placeholder="Internal notes…"
            />
            <button
              onClick={saveNotes}
              disabled={saving}
              className="mt-2 px-4 py-2 bg-[#006b5f] text-white rounded-lg font-bold text-xs hover:bg-[#006b5f]/90 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save notes"}
            </button>
          </section>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── Page shell ───────────────────────────── */

export default function AdminViewingsPage() {
  const [tab, setTab] = useState("calendar");
  const [viewings, setViewings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCopyMenu, setShowCopyMenu] = useState(false);

  async function fetchAll() {
    setLoading(true);
    const { data: vData } = await supabase
      .from("property_viewings")
      .select(
        "id, prospect_name, prospect_email, prospect_whatsapp, slot_start, slot_end, viewing_date, viewing_time, status, source, notes, properties(id, name, code), rooms(id, name, unit_code), captain:tenant_profiles!captain_id(id, full_name, phone)"
      )
      .order("slot_start", { ascending: true, nullsFirst: false })
      .limit(500);
    setViewings(vData || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
  }, []);

  // Copy-link helper for the V2 deep links Mark pastes into Roomies/Carousell etc.
  function copyDeepLink(url) {
    navigator.clipboard.writeText(url);
    setShowCopyMenu(false);
  }

  const upcomingCount = viewings.filter((v) => {
    const s = v.slot_start ? new Date(v.slot_start).getTime() : 0;
    return s > Date.now() && v.status !== "cancelled" && v.status !== "CANCELLED";
  }).length;

  return (
    <PortalLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-slate-900 tracking-tight">
            Viewings
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Calendar grid + leads pipeline · 14-day horizon
          </p>
        </div>

        {/* Quick deep-link copier */}
        <div className="relative">
          <button
            onClick={() => setShowCopyMenu((v) => !v)}
            className="bg-white border border-slate-200 text-slate-700 py-2.5 px-5 rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm hover:border-teal-500 hover:text-teal-700 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">link</span>
            Copy booking link
            <span className="material-symbols-outlined text-[16px]">expand_more</span>
          </button>
          {showCopyMenu && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-30 overflow-hidden">
              <DeepLinkMenu onCopy={copyDeepLink} onClose={() => setShowCopyMenu(false)} />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <TabButton
          active={tab === "calendar"}
          onClick={() => setTab("calendar")}
          count={upcomingCount}
        >
          Calendar
        </TabButton>
        <TabButton active={tab === "leads"} onClick={() => setTab("leads")}>
          Leads
        </TabButton>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="material-symbols-outlined text-teal-600 text-3xl animate-spin">
            progress_activity
          </span>
        </div>
      ) : tab === "calendar" ? (
        <CalendarTab viewings={viewings} refetch={fetchAll} />
      ) : (
        <LeadsTab />
      )}
    </PortalLayout>
  );
}

function DeepLinkMenu({ onCopy, onClose }) {
  const [rooms, setRooms] = useState([]);
  useEffect(() => {
    supabase
      .from("rooms")
      .select("id, name, unit_code, property_id, is_available, properties(code, name)")
      .order("unit_code")
      .then(({ data }) => setRooms(data || []));
  }, []);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://lazybee.sg";

  return (
    <div className="max-h-96 overflow-y-auto">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
          Property links
        </span>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 text-xs"
        >
          ✕
        </button>
      </div>
      {PROPERTY_CODES.map((code) => {
        const url = `${origin}/book/${code}`;
        return (
          <button
            key={code}
            onClick={() => onCopy(url)}
            className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center justify-between text-sm border-b border-slate-50"
          >
            <span className="font-medium">{PROPERTY_META[code].name}</span>
            <span className="text-xs text-slate-400">/{code}</span>
          </button>
        );
      })}
      <div className="px-4 py-3 border-y border-slate-100">
        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
          Room links
        </span>
      </div>
      {rooms
        .filter((r) => r.is_available !== false && r.properties?.code)
        .map((r) => {
          const url = `${origin}/book/${r.properties.code}/${r.unit_code}`;
          return (
            <button
              key={r.id}
              onClick={() => onCopy(url)}
              className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center justify-between text-xs border-b border-slate-50"
            >
              <span className="font-medium text-slate-700">
                {r.properties.code} · {r.unit_code}
              </span>
              <span className="text-slate-400">copy</span>
            </button>
          );
        })}
    </div>
  );
}
