import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import PortalLayout from "../../components/portal/PortalLayout";
import AvailabilityGrid from "../../components/viewing/AvailabilityGrid";

/* ──────────────────────── helpers ──────────────────────── */

function generateToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) =>
    b.toString(36)
  )
    .join("")
    .slice(0, 8);
}

function fmtDate(d) {
  if (!d) return "--";
  return new Date(d).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(d) {
  if (!d) return "--";
  return new Date(d).toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtLongDate(d) {
  if (!d) return "--";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function fmtTime(d) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function initials(name) {
  if (!name) return "??";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/* Lifecycle steps */
const LIFECYCLE_STEPS = [
  { key: "REQUESTED", label: "Requested", icon: "check", filledIcon: true },
  { key: "POLLING", label: "Polling", icon: "sync", filledIcon: true },
  { key: "CONFIRMED", label: "Confirmed", icon: "schedule", filledIcon: false },
  { key: "COMPLETED", label: "Completed", icon: "task_alt", filledIcon: false },
];

function stepIndex(status) {
  const map = {
    REQUESTED: 0,
    POLLING: 1,
    CONFIRMED: 2,
    COMPLETED: 3,
    CANCELLED: -1,
  };
  return map[status] ?? 0;
}

/* ──────────────────────── component ──────────────────────── */

export default function AdminViewingDetailPage() {
  const { id } = useParams();
  const { profile } = useAuth();

  const [viewing, setViewing] = useState(null);
  const [poll, setPoll] = useState(null);
  const [responses, setResponses] = useState([]);
  const [captain, setCaptain] = useState(null);
  const [resident, setResident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [notes, setNotes] = useState("");
  const [showForceBook, setShowForceBook] = useState(false);
  const [forceSlots, setForceSlots] = useState([]);
  const notesRef = useRef(null);
  const toastTimer = useRef(null);

  /* ── toast helper ── */
  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  /* ── data fetching ── */
  const fetchData = useCallback(async () => {
    if (!id) return;

    // Fetch viewing with joins
    const { data: v, error } = await supabase
      .from("property_viewings")
      .select("*, properties(name, code), rooms(name, unit_code), viewing_polls(*)")
      .eq("id", id)
      .single();

    if (error || !v) {
      console.error("Error fetching viewing:", error);
      setLoading(false);
      return;
    }

    setViewing(v);
    setNotes(v.special_notes || "");

    const activePoll = v.viewing_polls?.[0] ?? null;
    setPoll(activePoll);

    // Fetch poll responses
    if (activePoll) {
      const { data: resps } = await supabase
        .from("viewing_poll_responses")
        .select("*")
        .eq("poll_id", activePoll.id)
        .order("submitted_at", { ascending: false });
      setResponses(resps ?? []);
    }

    // Fetch captain name
    if (v.captain_id) {
      const { data: cap } = await supabase
        .from("tenant_profiles")
        .select("*, tenant_details(full_name)")
        .eq("id", v.captain_id)
        .single();
      setCaptain(cap);
    }

    // Fetch resident name
    if (v.resident_id) {
      const { data: res } = await supabase
        .from("tenant_profiles")
        .select("*, tenant_details(full_name)")
        .eq("id", v.resident_id)
        .single();
      setResident(res);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── actions ── */
  async function handleSaveNotes() {
    const { error } = await supabase
      .from("property_viewings")
      .update({ special_notes: notes, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      showToast("Failed to save notes", "error");
    } else {
      showToast("Notes saved");
    }
  }

  async function handleResendPoll() {
    if (!poll) return;

    const newProspectToken = generateToken();
    const newCaptainToken = generateToken();
    const newResidentToken = generateToken();

    // Reset poll tokens and status
    const { error: pollError } = await supabase
      .from("viewing_polls")
      .update({
        prospect_token: newProspectToken,
        captain_token: newCaptainToken,
        resident_token: newResidentToken,
        status: "open",
        matched_slot: null,
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", poll.id);

    // Delete old responses
    await supabase.from("viewing_poll_responses").delete().eq("poll_id", poll.id);

    // Reset viewing status back to POLLING
    await supabase
      .from("property_viewings")
      .update({ status: "POLLING", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (pollError) {
      showToast("Failed to resend poll", "error");
    } else {
      showToast("Poll resent with new tokens");
      fetchData();
    }
  }

  async function handleCancel() {
    const { error: vErr } = await supabase
      .from("property_viewings")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (poll) {
      await supabase
        .from("viewing_polls")
        .update({ status: "cancelled" })
        .eq("id", poll.id);
    }

    if (vErr) {
      showToast("Failed to cancel viewing", "error");
    } else {
      showToast("Viewing cancelled");
      fetchData();
    }
  }

  async function handleForceBook() {
    if (forceSlots.length === 0) {
      showToast("Select a slot first", "error");
      return;
    }

    const slot = forceSlots[0];
    const viewingDate = slot.toISOString().split("T")[0];
    const viewingTime = slot.toTimeString().slice(0, 5);

    const { error: vErr } = await supabase
      .from("property_viewings")
      .update({
        status: "CONFIRMED",
        viewing_date: viewingDate,
        viewing_time: viewingTime,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (poll) {
      await supabase
        .from("viewing_polls")
        .update({ status: "confirmed", matched_slot: slot.toISOString() })
        .eq("id", poll.id);
    }

    if (vErr) {
      showToast("Failed to force book", "error");
    } else {
      showToast("Viewing force-booked");
      setShowForceBook(false);
      setForceSlots([]);
      fetchData();
    }
  }

  /* ── derived data ── */
  const currentStep = stepIndex(viewing?.status);
  const captainName = captain?.tenant_details?.full_name || "Captain";
  const residentName = resident?.tenant_details?.full_name || "Resident";
  const prospectName = viewing?.prospect_name || "Prospect";

  // Group responses by respondent_type
  const responsesByType = {};
  responses.forEach((r) => {
    if (!responsesByType[r.respondent_type]) responsesByType[r.respondent_type] = [];
    responsesByType[r.respondent_type].push(r);
  });

  const captainResponded = (responsesByType.captain?.length ?? 0) > 0;
  const prospectResponded = (responsesByType.prospect?.length ?? 0) > 0;
  const residentResponded = (responsesByType.resident?.length ?? 0) > 0;

  const confirmedCount = [captainResponded, prospectResponded, residentResponded].filter(Boolean).length;

  // Build timeline entries
  const timeline = [];
  if (viewing) {
    timeline.push({
      title: "Viewing Requested",
      description: `Hyve initiated a viewing request for ${viewing.rooms?.name || "room"} at ${viewing.properties?.name || "property"}`,
      time: viewing.created_at,
      type: "created",
    });
  }
  if (poll) {
    timeline.push({
      title: "Poll Created",
      description: "Availability poll sent to captain, prospect, and resident",
      time: poll.created_at,
      type: "created",
    });
  }
  // Add response events
  Object.entries(responsesByType).forEach(([type, resps]) => {
    if (resps.length > 0) {
      const earliest = resps.reduce((min, r) =>
        new Date(r.submitted_at || r.created_at) < new Date(min.submitted_at || min.created_at)
          ? r
          : min
      );
      const nameMap = {
        captain: captainName,
        prospect: prospectName,
        resident: residentName,
      };
      const roleMap = {
        captain: "Captain",
        prospect: "Prospect",
        resident: "Resident",
      };
      timeline.push({
        title: "Availability Provided",
        description: `${nameMap[type]} (${roleMap[type]}) selected ${resps.length} preferred slot${resps.length !== 1 ? "s" : ""}`,
        time: earliest.submitted_at || earliest.created_at,
        type: "responded",
      });
    }
  });
  if (poll?.matched_slot) {
    timeline.push({
      title: "Slot Matched",
      description: `Viewing confirmed for ${fmtLongDate(poll.matched_slot)} at ${fmtTime(poll.matched_slot)}`,
      time: poll.updated_at || poll.matched_slot,
      type: "confirmed",
    });
  }
  if (viewing?.status === "CANCELLED") {
    timeline.push({
      title: "Viewing Cancelled",
      description: "This viewing was cancelled by an admin",
      time: viewing.updated_at,
      type: "cancelled",
    });
  }
  // Sort chronologically descending (newest first)
  timeline.sort((a, b) => new Date(b.time) - new Date(a.time));

  // Force book grid start date
  const gridStart = poll?.poll_start
    ? new Date(poll.poll_start)
    : new Date(Date.now() + 2 * 86400000);

  /* ── loading / not found ── */
  if (loading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <span className="material-symbols-outlined animate-spin text-[#006b5f] text-3xl">progress_activity</span>
        </div>
      </PortalLayout>
    );
  }

  if (!viewing) {
    return (
      <PortalLayout>
        <div className="text-center py-20">
          <span className="material-symbols-outlined text-5xl text-[#bbcac6] mb-4">search_off</span>
          <p className="text-[#6c7a77] font-['Manrope'] font-medium">Viewing not found.</p>
          <Link to="/portal/admin/viewings" className="text-[#006b5f] font-['Manrope'] font-bold text-sm mt-4 inline-block hover:underline">
            Back to Viewings
          </Link>
        </div>
      </PortalLayout>
    );
  }

  /* ── render ── */
  return (
    <PortalLayout>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-['Manrope'] font-bold transition-all ${toast.type === "error" ? "bg-[#ffdad6] text-[#ba1a1a]" : "bg-[#d1fae5] text-[#065f46]"}`}>
          {toast.msg}
        </div>
      )}

      {/* Force Book Modal */}
      {showForceBook && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#121c2a]">Force Book Viewing</h3>
                <button onClick={() => { setShowForceBook(false); setForceSlots([]); }} className="p-2 rounded-lg hover:bg-[#e0e3e5] transition-colors">
                  <span className="material-symbols-outlined text-[#6c7a77]">close</span>
                </button>
              </div>
              <p className="text-sm text-[#6c7a77] font-['Manrope'] mb-6">
                Select a time slot to confirm this viewing. This overrides the polling process.
              </p>
              <AvailabilityGrid
                startDate={gridStart}
                days={7}
                selectedSlots={forceSlots}
                onSlotsChange={(slots) => setForceSlots(slots.slice(-1))}
              />
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => { setShowForceBook(false); setForceSlots([]); }} className="px-5 py-2.5 rounded-xl font-['Manrope'] font-semibold text-sm text-[#121c2a] bg-[#e0e3e5] hover:bg-[#d8dadc] transition-colors">
                  Cancel
                </button>
                <button onClick={handleForceBook} disabled={forceSlots.length === 0}
                  className="px-6 py-2.5 rounded-xl font-['Manrope'] font-bold text-sm text-white bg-[#006b5f] hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 shadow-md shadow-[#006b5f]/20">
                  Confirm Slot
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header & Action Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 rounded-xl shadow-sm">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="bg-[#dae2fd] text-[#5c647a] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">
                {viewing.status === "CANCELLED" ? "Cancelled" : "In Progress"}
              </span>
              <h2 className="text-2xl font-bold font-['Plus_Jakarta_Sans'] tracking-tight text-[#191c1e]">Viewing Detail</h2>
            </div>
            <p className="text-[#3c4947] text-sm font-['Manrope']">
              Requested on {fmtDate(viewing.created_at)}
              {poll?.expires_at && viewing.status === "POLLING" && (
                <> &middot; {Math.max(0, Math.ceil((new Date(poll.expires_at) - Date.now()) / 86400000))} day{Math.ceil((new Date(poll.expires_at) - Date.now()) / 86400000) !== 1 ? "s" : ""} remaining to confirm</>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={handleResendPoll}
              className="bg-[#e0e3e5] text-[#191c1e] font-semibold px-5 py-2.5 rounded-lg text-sm font-['Manrope'] hover:bg-[#d8dadc] transition-colors flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">refresh</span>
              Resend Poll
            </button>
            <button onClick={() => showToast("Reminder sent via Claudine")}
              className="bg-[#e0e3e5] text-[#191c1e] font-semibold px-5 py-2.5 rounded-lg text-sm font-['Manrope'] hover:bg-[#d8dadc] transition-colors flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">notifications_active</span>
              Send Reminder
            </button>
            <button onClick={handleCancel}
              className="bg-[#ba1a1a]/10 text-[#ba1a1a] font-semibold px-5 py-2.5 rounded-lg text-sm font-['Manrope'] hover:bg-[#ba1a1a]/20 transition-colors flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">cancel</span>
              Cancel
            </button>
            <button onClick={() => setShowForceBook(true)}
              className="bg-[#006b5f] text-white font-bold px-6 py-2.5 rounded-lg text-sm font-['Manrope'] shadow-md shadow-[#006b5f]/20 hover:opacity-90 active:scale-95 transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">verified</span>
              Force Book
            </button>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* ─── Left Column: Prospect Info ─── */}
          <div className="lg:col-span-4 space-y-8">
            <section className="bg-white rounded-xl p-8 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#14b8a6]" />

              {/* Avatar + Name */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-full bg-[#d9e3f6] flex items-center justify-center text-[#006b5f] font-bold text-xl shrink-0 border-2 border-[#14b8a6]/20">
                  {initials(viewing.prospect_name)}
                </div>
                <div>
                  <h3 className="text-xl font-bold font-['Plus_Jakarta_Sans'] text-[#191c1e]">{viewing.prospect_name}</h3>
                  <p className="text-[#3c4947] font-medium text-sm font-['Manrope']">Prospect</p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Contact Details */}
                <div>
                  <span className="block text-[10px] font-bold text-[#6c7a77] uppercase tracking-widest mb-1">Contact Details</span>
                  <div className="flex flex-col gap-2">
                    {viewing.prospect_email && (
                      <a className="flex items-center gap-3 text-[#191c1e] hover:text-[#006b5f] transition-colors" href={`mailto:${viewing.prospect_email}`}>
                        <span className="material-symbols-outlined text-[#14b8a6]">mail</span>
                        <span className="text-sm font-medium font-['Manrope']">{viewing.prospect_email}</span>
                      </a>
                    )}
                    {viewing.prospect_phone && (
                      <a className="flex items-center gap-3 text-[#191c1e] hover:text-[#006b5f] transition-colors"
                        href={`https://wa.me/${viewing.prospect_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                        <span className="material-symbols-outlined text-[#14b8a6]">chat_bubble</span>
                        <span className="text-sm font-medium font-['Manrope']">{viewing.prospect_phone}</span>
                        <span className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded font-bold">WhatsApp</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Move-in / Source */}
                <div className="grid grid-cols-2 gap-4">
                  {viewing.move_in_date && (
                    <div>
                      <span className="block text-[10px] font-bold text-[#6c7a77] uppercase tracking-widest mb-1">Move-in Date</span>
                      <p className="font-semibold text-[#191c1e] font-['Manrope']">{fmtDate(viewing.move_in_date)}</p>
                    </div>
                  )}
                  {viewing.source && (
                    <div>
                      <span className="block text-[10px] font-bold text-[#6c7a77] uppercase tracking-widest mb-1">Source</span>
                      <p className="font-semibold text-[#191c1e] font-['Manrope']">{viewing.source}</p>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <span className="block text-[10px] font-bold text-[#6c7a77] uppercase tracking-widest mb-1">Private Notes</span>
                  <div className="bg-[#f2f4f6] rounded-lg mt-2">
                    <textarea
                      ref={notesRef}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      onBlur={handleSaveNotes}
                      rows={3}
                      placeholder="Add private notes about this prospect..."
                      className="w-full bg-transparent p-4 text-sm text-[#3c4947] font-['Manrope'] leading-relaxed italic resize-none outline-none focus:ring-2 focus:ring-[#14b8a6] rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Matched Slot Card */}
            {poll?.matched_slot && (
              <section className="bg-[#006b5f] p-8 rounded-xl text-white shadow-xl shadow-[#006b5f]/20 relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 opacity-10">
                  <span className="material-symbols-outlined text-[120px]">event_available</span>
                </div>
                <span className="block text-[10px] font-bold uppercase tracking-widest mb-4 opacity-80">Currently Matched Slot</span>
                <div className="space-y-1">
                  <p className="text-3xl font-black font-['Plus_Jakarta_Sans'] leading-none">{fmtLongDate(poll.matched_slot)}</p>
                  <p className="text-xl font-medium opacity-90">{fmtTime(poll.matched_slot)}</p>
                </div>
                <div className="mt-6 flex items-center gap-2 bg-white/20 w-fit px-3 py-1.5 rounded-full">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-xs font-bold">{confirmedCount}/3 Confirmed availability</span>
                </div>
              </section>
            )}
          </div>

          {/* ─── Right Column: Status & Timeline ─── */}
          <div className="lg:col-span-8 space-y-8">

            {/* Lifecycle Progress Bar */}
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <h3 className="text-sm font-bold font-['Plus_Jakarta_Sans'] text-[#191c1e] mb-8 uppercase tracking-tighter">Viewing Lifecycle</h3>
              <div className="relative px-4">
                {/* Progress line background */}
                <div className="absolute top-1/2 left-0 w-full h-[2px] bg-[#e0e3e5] -translate-y-1/2" />
                {/* Progress line active */}
                <div
                  className="absolute top-1/2 left-0 h-[2px] bg-[#14b8a6] -translate-y-1/2 transition-all"
                  style={{ width: `${Math.max(0, (currentStep / (LIFECYCLE_STEPS.length - 1)) * 100)}%` }}
                />
                <div className="relative flex justify-between">
                  {LIFECYCLE_STEPS.map((step, i) => {
                    const isPast = i < currentStep;
                    const isCurrent = i === currentStep;
                    const isFuture = i > currentStep;

                    let circleClass = "w-8 h-8 rounded-full flex items-center justify-center z-10 ";
                    let labelClass = "text-xs font-bold ";
                    let iconStyle = {};

                    if (isPast) {
                      circleClass += "bg-[#006b5f] text-white";
                      labelClass += "text-[#191c1e]";
                      iconStyle = { fontVariationSettings: "'FILL' 1" };
                    } else if (isCurrent) {
                      circleClass += "bg-white border-2 border-[#14b8a6] text-[#14b8a6]";
                      labelClass += "text-[#006b5f]";
                    } else {
                      circleClass += "bg-white border border-[#e0e3e5] text-[#bbcac6]";
                      labelClass += "text-[#bbcac6]";
                    }

                    return (
                      <div key={step.key} className="flex flex-col items-center gap-3">
                        <div className={circleClass}>
                          <span className="material-symbols-outlined text-sm" style={iconStyle}>
                            {isPast ? "check" : step.icon}
                          </span>
                        </div>
                        <span className={labelClass}>{step.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Respondent Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Captain */}
              <div className="bg-white p-6 rounded-xl border-l-4 border-[#006b5f] shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-bold text-[#006b5f] uppercase tracking-widest">Captain</span>
                  <span className="material-symbols-outlined text-[#006b5f]" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                </div>
                <h4 className="font-bold text-[#191c1e] font-['Manrope']">{captainName}</h4>
                <p className="text-xs text-[#3c4947] font-['Manrope'] mb-4">House Captain</p>
                {captainResponded ? (
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 w-fit px-3 py-1 rounded-full">
                    <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    <span className="text-[10px] font-bold">Responded</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[#9b4426] bg-[#9b4426]/10 w-fit px-3 py-1 rounded-full">
                    <span className="material-symbols-outlined text-xs">pending</span>
                    <span className="text-[10px] font-bold">Waiting...</span>
                  </div>
                )}
              </div>

              {/* Prospect */}
              <div className="bg-white p-6 rounded-xl border-l-4 border-[#14b8a6] shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-bold text-[#006b5f] uppercase tracking-widest">Prospect</span>
                  <span className="material-symbols-outlined text-[#14b8a6]">person</span>
                </div>
                <h4 className="font-bold text-[#191c1e] font-['Manrope']">{prospectName}</h4>
                <p className="text-xs text-[#3c4947] font-['Manrope'] mb-4">Prospect</p>
                {prospectResponded ? (
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 w-fit px-3 py-1 rounded-full">
                    <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    <span className="text-[10px] font-bold">Responded</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[#9b4426] bg-[#9b4426]/10 w-fit px-3 py-1 rounded-full">
                    <span className="material-symbols-outlined text-xs">pending</span>
                    <span className="text-[10px] font-bold">Waiting...</span>
                  </div>
                )}
              </div>

              {/* Resident */}
              <div className="bg-white p-6 rounded-xl border-l-4 border-[#bbcac6] shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-bold text-[#bbcac6] uppercase tracking-widest">Resident</span>
                  <span className="material-symbols-outlined text-[#bbcac6]">home</span>
                </div>
                <h4 className="font-bold text-[#191c1e] font-['Manrope']">{residentName}</h4>
                <p className="text-xs text-[#3c4947] font-['Manrope'] mb-4">Current Tenant</p>
                {residentResponded ? (
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 w-fit px-3 py-1 rounded-full">
                    <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    <span className="text-[10px] font-bold">Responded</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[#9b4426] bg-[#9b4426]/10 w-fit px-3 py-1 rounded-full">
                    <span className="material-symbols-outlined text-xs">pending</span>
                    <span className="text-[10px] font-bold">Waiting... <span className="text-[#6c7a77]">(courtesy)</span></span>
                  </div>
                )}
              </div>
            </div>

            {/* Activity Timeline */}
            <section className="bg-white rounded-xl p-8 shadow-sm">
              <h3 className="text-sm font-bold font-['Plus_Jakarta_Sans'] text-[#191c1e] mb-8 uppercase tracking-tighter">Activity Timeline</h3>
              {timeline.length === 0 ? (
                <p className="text-sm text-[#6c7a77] font-['Manrope']">No activity yet.</p>
              ) : (
                <div className="space-y-8 relative">
                  <div className="absolute top-0 left-3 w-[2px] h-full bg-[#f2f4f6]" />
                  {timeline.map((entry, i) => {
                    let dotClass = "absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center ";
                    let dotInner = null;

                    if (entry.type === "responded" || entry.type === "confirmed") {
                      dotClass += "bg-[#006b5f]";
                      dotInner = (
                        <span className="material-symbols-outlined text-white text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                      );
                    } else if (entry.type === "cancelled") {
                      dotClass += "bg-[#ba1a1a]";
                      dotInner = (
                        <span className="material-symbols-outlined text-white text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>close</span>
                      );
                    } else {
                      dotClass += "bg-[#14b8a6]/20";
                      dotInner = <div className="w-2 h-2 rounded-full bg-[#14b8a6]" />;
                    }

                    return (
                      <div key={i} className="relative pl-10">
                        <div className={dotClass}>{dotInner}</div>
                        <div>
                          <p className="text-sm font-bold text-[#191c1e] font-['Manrope']">{entry.title}</p>
                          <p className="text-xs text-[#3c4947] font-['Manrope'] mb-2">{entry.description}</p>
                          <span className="text-[10px] text-[#6c7a77] font-medium font-['Manrope']">{fmtDateTime(entry.time)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
