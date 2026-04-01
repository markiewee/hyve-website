import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useViewings } from "../../hooks/useViewings";
import PortalLayout from "../../components/portal/PortalLayout";

/* ──────────────────────────────────────────────
   Constants
   ────────────────────────────────────────────── */

const STATUSES = ["REQUESTED", "POLLING", "CONFIRMED", "COMPLETED", "CANCELLED"];

const STATUS_META = {
  REQUESTED: { label: "Requested", dot: "bg-slate-400", badge: "bg-slate-200 text-slate-700", border: "border-dashed border-slate-200" },
  POLLING:   { label: "Polling",   dot: "bg-teal-600",  badge: "bg-teal-100 text-teal-800",   border: "" },
  CONFIRMED: { label: "Confirmed", dot: "bg-teal-500",  badge: "bg-teal-100 text-teal-800",   border: "" },
  COMPLETED: { label: "Completed", dot: "bg-slate-300", badge: "bg-slate-100 text-slate-600",  border: "" },
  CANCELLED: { label: "Cancelled", dot: "bg-red-500",   badge: "bg-red-100 text-red-700",      border: "" },
};

const PROPERTY_BADGE = {
  TG: { bg: "bg-blue-100",  text: "text-blue-700",  border: "border-blue-500",  label: "TG - Thomson Grove" },
  IH: { bg: "bg-teal-100",  text: "text-teal-700",  border: "border-teal-500",  label: "IH - Ivory Heights" },
  CP: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-500", label: "CP - Chiltern Park" },
};

const PROPERTY_CAPTAIN_MAP = {
  // Property name substring -> auto-assign defaults (used in create modal)
  Thomson: "TG",
  Ivory: "IH",
  Chiltern: "CP",
};

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

function getPropertyCode(viewing) {
  return viewing.properties?.code || "";
}

function getPropertyBadge(viewing) {
  const code = getPropertyCode(viewing);
  return PROPERTY_BADGE[code] || { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-400", label: viewing.properties?.name || "Unknown" };
}

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-SG", { day: "numeric", month: "short" });
}

function formatViewingDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return {
    month: d.toLocaleDateString("en-SG", { month: "short" }),
    day: d.getDate(),
  };
}

/* ──────────────────────────────────────────────
   Poll Progress Component
   ────────────────────────────────────────────── */

function PollProgress({ polls }) {
  if (!polls || polls.length === 0) return null;
  const poll = polls[0]; // one poll per viewing

  // Count from viewing_poll_responses if available, otherwise estimate from poll status
  const totalParticipants = 3; // prospect, captain, resident
  let responded = 0;

  // We don't have viewing_poll_responses loaded here, so use status heuristic
  if (poll.status === "matched" || poll.status === "confirmed") {
    responded = totalParticipants;
  } else if (poll.status === "open") {
    // Can't determine exactly without responses query — show poll as active
    responded = 0;
  }

  const pct = Math.round((responded / totalParticipants) * 100);
  const isComplete = responded === totalParticipants;

  return (
    <div className="mt-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] font-bold text-teal-600">Poll Progress</span>
        <span className="text-[10px] font-bold text-slate-600">
          {isComplete ? `${responded}/${totalParticipants} Completed` : `${responded}/${totalParticipants} Responded`}
        </span>
      </div>
      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
        <div className="bg-teal-600 h-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      {isComplete && (
        <p className="text-[10px] text-teal-600 font-bold mt-1.5 flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">check_circle</span>
          Ready to Confirm
        </p>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Viewing Card Component
   ────────────────────────────────────────────── */

function ViewingCard({ viewing }) {
  const badge = getPropertyBadge(viewing);
  const roomPref = viewing.rooms?.unit_code || viewing.rooms?.name || "No preference";
  const viewingType = viewing.viewing_type || viewing.viewing_polls?.[0]?.viewing_type;
  const isVirtual = viewingType === "virtual";
  const isCompleted = viewing.status === "COMPLETED";
  const isCancelled = viewing.status === "CANCELLED";
  const isConfirmed = viewing.status === "CONFIRMED";

  const viewingDate = formatViewingDate(viewing.viewing_date);

  return (
    <Link
      to={`/portal/admin/viewings/${viewing.id}`}
      className={`block bg-white p-4 rounded-xl shadow-sm border-b-4 ${badge.border} group cursor-pointer hover:shadow-md transition-all`}
    >
      {/* Header: property badge + viewing type icon */}
      <div className="flex justify-between items-start mb-3">
        <span className={`${badge.bg} ${badge.text} text-[10px] font-bold px-2 py-1 rounded`}>
          {badge.label}
        </span>
        {isCancelled ? (
          <span className="material-symbols-outlined text-red-400 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
            cancel
          </span>
        ) : isCompleted ? (
          <span className="material-symbols-outlined text-slate-300 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
            check_circle
          </span>
        ) : (
          <span className="material-symbols-outlined text-slate-300 text-lg group-hover:text-teal-600">
            {isVirtual ? "videocam" : "person"}
          </span>
        )}
      </div>

      {/* Prospect name + initials avatar */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
          {getInitials(viewing.prospect_name)}
        </div>
        <h4 className="font-bold text-slate-900 text-sm truncate">{viewing.prospect_name || "Unknown"}</h4>
      </div>

      {/* Room preference + viewing type */}
      {!isCompleted && !isCancelled && (
        <p className="text-xs text-slate-500 mt-1.5">
          {roomPref} {viewingType ? `\u00B7 ${isVirtual ? "Virtual" : "In-person"}` : ""}
        </p>
      )}

      {/* Completed: just show date */}
      {isCompleted && viewing.viewing_date && (
        <p className="text-xs text-slate-500 mt-1.5">
          Completed {new Date(viewing.viewing_date).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
        </p>
      )}

      {/* Cancelled: show reason or date */}
      {isCancelled && (
        <p className="text-[10px] text-red-500 font-medium mt-1.5">
          Cancelled {viewing.updated_at ? `\u00B7 ${new Date(viewing.updated_at).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}` : ""}
        </p>
      )}

      {/* Confirmed: show date/time box */}
      {isConfirmed && viewingDate && (
        <div className="mt-3 p-2 bg-slate-50 rounded-lg flex items-center gap-3">
          <div className="bg-white p-1.5 rounded shadow-sm text-center min-w-[40px]">
            <p className="text-[8px] font-bold text-slate-400 uppercase">{viewingDate.month}</p>
            <p className="text-sm font-black text-slate-900">{viewingDate.day}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-900">{viewing.viewing_time || "TBD"}</p>
            {viewing.captain_id && <p className="text-[10px] text-slate-500">Captain assigned</p>}
          </div>
        </div>
      )}

      {/* Polling: show poll progress */}
      {viewing.status === "POLLING" && <PollProgress polls={viewing.viewing_polls} />}

      {/* Footer: time ago */}
      {!isCompleted && !isCancelled && (
        <div className="mt-3 flex items-center justify-end">
          <span className="text-[10px] font-medium text-slate-400">
            {viewing.status === "REQUESTED" ? "Received " : ""}{timeAgo(viewing.created_at)}
          </span>
        </div>
      )}
    </Link>
  );
}

/* ──────────────────────────────────────────────
   Kanban Column Component
   ────────────────────────────────────────────── */

function KanbanColumn({ status, viewings }) {
  const meta = STATUS_META[status];
  const isInactive = status === "COMPLETED" || status === "CANCELLED";

  return (
    <div className="flex-1 flex flex-col min-w-[260px]">
      {/* Sticky column header */}
      <div className="flex items-center justify-between mb-4 px-2 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
          <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-sm uppercase tracking-wider text-slate-600">
            {meta.label}
          </h3>
          <span className={`${meta.badge} text-[10px] px-2 py-0.5 rounded-full font-bold`}>
            {viewings.length}
          </span>
        </div>
      </div>

      {/* Card container */}
      <div
        className={`flex-1 flex flex-col gap-3 p-3 rounded-2xl overflow-y-auto ${
          status === "REQUESTED" ? "bg-slate-50/50 border-2 border-dashed border-slate-200" : "bg-slate-50/50"
        } ${isInactive ? "opacity-60" : ""}`}
      >
        {viewings.length === 0 && (
          <div className="text-center py-8 text-xs text-slate-400 font-medium">No viewings</div>
        )}
        {viewings.map((v) => (
          <ViewingCard key={v.id} viewing={v} />
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Create Viewing Modal
   ────────────────────────────────────────────── */

function CreateViewingModal({ properties, rooms, onClose, onCreated, createViewing }) {
  const [form, setForm] = useState({
    prospect_name: "",
    prospect_phone: "",
    prospect_email: "",
    property_id: "",
    room_id: "",
    viewing_type: "in_person",
    special_notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const filteredRooms = useMemo(
    () => (form.property_id ? rooms.filter((r) => r.property_id === form.property_id) : []),
    [rooms, form.property_id]
  );

  function handleChange(field, value) {
    setForm((f) => {
      const next = { ...f, [field]: value };
      // Reset room when property changes
      if (field === "property_id") next.room_id = "";
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.prospect_name.trim() || !form.property_id) {
      setError("Prospect name and property are required.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      prospect_name: form.prospect_name.trim(),
      prospect_phone: form.prospect_phone.trim() || null,
      prospect_email: form.prospect_email.trim() || null,
      property_id: form.property_id,
      room_id: form.room_id || null,
      viewing_type: form.viewing_type,
      special_notes: form.special_notes.trim() || null,
      status: "REQUESTED",
    };

    const res = await createViewing(payload);
    setSaving(false);

    if (res?.error) {
      setError(res.error.message || "Failed to create viewing.");
    } else {
      setResult(res.data);
    }
  }

  // After creation — show tokens
  if (result) {
    const poll = result.viewing_polls?.[0];
    const baseUrl = window.location.origin;
    const prospectLink = poll ? `${baseUrl}/poll/${poll.prospect_token}` : null;
    const captainLink = poll ? `${baseUrl}/poll/captain/${poll.captain_token}` : null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-teal-600">check_circle</span>
            </div>
            <div>
              <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-slate-900">Viewing Created</h3>
              <p className="text-xs text-slate-500">Poll links generated</p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            {prospectLink && (
              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-1">Prospect Poll Link</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-slate-50 px-3 py-2 rounded-lg truncate border">{prospectLink}</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(prospectLink)}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-teal-600 transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px]">content_copy</span>
                  </button>
                </div>
              </div>
            )}
            {captainLink && (
              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-1">Captain Poll Link</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-slate-50 px-3 py-2 rounded-lg truncate border">{captainLink}</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(captainLink)}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-teal-600 transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px]">content_copy</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              onCreated();
              onClose();
            }}
            className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-teal-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-slate-900">Create Viewing</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm bg-red-50 text-red-700 font-medium">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Prospect info */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Prospect Name *</label>
            <input
              type="text"
              value={form.prospect_name}
              onChange={(e) => handleChange("prospect_name", e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              placeholder="John Doe"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Phone</label>
              <input
                type="tel"
                value={form.prospect_phone}
                onChange={(e) => handleChange("prospect_phone", e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                placeholder="+65 9123 4567"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Email</label>
              <input
                type="email"
                value={form.prospect_email}
                onChange={(e) => handleChange("prospect_email", e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                placeholder="john@email.com"
              />
            </div>
          </div>

          {/* Property + Room selectors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Property *</label>
              <select
                value={form.property_id}
                onChange={(e) => handleChange("property_id", e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              >
                <option value="">Select property</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Room Preference</label>
              <select
                value={form.room_id}
                onChange={(e) => handleChange("room_id", e.target.value)}
                disabled={!form.property_id}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none disabled:opacity-40"
              >
                <option value="">No preference</option>
                {filteredRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.unit_code || r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Viewing type */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Viewing Type</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleChange("viewing_type", "in_person")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all border ${
                  form.viewing_type === "in_person"
                    ? "bg-teal-50 border-teal-500 text-teal-700"
                    : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">person</span>
                In-person
              </button>
              <button
                type="button"
                onClick={() => handleChange("viewing_type", "virtual")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all border ${
                  form.viewing_type === "virtual"
                    ? "bg-teal-50 border-teal-500 text-teal-700"
                    : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">videocam</span>
                Virtual
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Special Notes</label>
            <textarea
              value={form.special_notes}
              onChange={(e) => handleChange("special_notes", e.target.value)}
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none"
              placeholder="Any additional info..."
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-teal-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">{saving ? "progress_activity" : "add_circle"}</span>
            {saving ? "Creating..." : "Create Viewing"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Main Page Component
   ────────────────────────────────────────────── */

export default function AdminViewingsPageV2() {
  const { profile } = useAuth();

  // Filters
  const [filterProperty, setFilterProperty] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Pass property filter to hook — status filtering done client-side for kanban
  const { viewings, loading, createViewing, refetch } = useViewings({
    propertyId: filterProperty || undefined,
  });

  // Reference data
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    supabase
      .from("properties")
      .select("id, name, code")
      .then(({ data }) => setProperties(data ?? []));

    supabase
      .from("rooms")
      .select("id, name, unit_code, property_id")
      .then(({ data }) => setRooms(data ?? []));
  }, []);

  // Group viewings by status for kanban columns
  const grouped = useMemo(() => {
    const groups = {};
    STATUSES.forEach((s) => (groups[s] = []));

    const filtered = filterStatus
      ? viewings.filter((v) => v.status === filterStatus)
      : viewings;

    filtered.forEach((v) => {
      const status = v.status?.toUpperCase() || "REQUESTED";
      if (groups[status]) {
        groups[status].push(v);
      } else {
        groups.REQUESTED.push(v);
      }
    });

    return groups;
  }, [viewings, filterStatus]);

  const totalViewings = viewings.length;

  return (
    <PortalLayout>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-slate-900 tracking-tight">
            Viewings
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            All viewing requests across properties
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {/* Property filter */}
          <div className="relative">
            <select
              value={filterProperty}
              onChange={(e) => setFilterProperty(e.target.value)}
              className="appearance-none bg-white border border-slate-200 text-slate-900 text-sm rounded-lg px-4 py-2.5 pr-10 focus:ring-teal-500 focus:border-teal-500 font-medium"
            >
              <option value="">All Properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-2.5 text-slate-400 pointer-events-none text-[20px]">
              expand_more
            </span>
          </div>

          {/* Status filter */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="appearance-none bg-white border border-slate-200 text-slate-900 text-sm rounded-lg px-4 py-2.5 pr-10 focus:ring-teal-500 focus:border-teal-500 font-medium"
            >
              <option value="">All Statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-2.5 text-slate-400 pointer-events-none text-[20px]">
              filter_list
            </span>
          </div>

          {/* Clear filters */}
          {(filterProperty || filterStatus) && (
            <button
              onClick={() => {
                setFilterProperty("");
                setFilterStatus("");
              }}
              className="text-teal-600 font-bold text-sm hover:underline px-2"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Create viewing button */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-teal-600 text-white py-2.5 px-6 rounded-lg font-bold text-sm flex items-center gap-2 shadow-md hover:shadow-lg hover:bg-teal-700 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-[20px]">add_circle</span>
          Create Viewing
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <span className="material-symbols-outlined text-teal-600 text-3xl animate-spin">progress_activity</span>
        </div>
      )}

      {/* Pipeline / Kanban view */}
      {!loading && (
        <div className="overflow-x-auto pb-4 -mx-2 px-2">
          <div className="flex gap-5 min-w-[1200px]" style={{ minHeight: "calc(100vh - 320px)" }}>
            {STATUSES.map((status) => (
              <KanbanColumn key={status} status={status} viewings={grouped[status]} />
            ))}
          </div>
        </div>
      )}

      {/* Create Viewing Modal */}
      {showCreateModal && (
        <CreateViewingModal
          properties={properties}
          rooms={rooms}
          createViewing={createViewing}
          onCreated={refetch}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </PortalLayout>
  );
}
