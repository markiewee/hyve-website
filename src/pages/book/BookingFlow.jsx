import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getPropertyByCode, isValidPhone, normalizeSource } from "./_propertyMeta";
import { fetchWindows, createBooking, submitOffHorizonLead } from "./_bookApi";
import {
  WINDOW_LABELS,
  WINDOW_TIMES,
  describeWindowState,
  isSlotClickable,
  slotStateClass,
  slotStateTitle,
} from "./_clusteringMeta";

// All times Asia/Singapore. Slots come back from the API as ISO strings with
// +08:00 offset already; we just format for display.

function fmtSlotTime(iso) {
  return new Date(iso).toLocaleTimeString("en-SG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Singapore",
  });
}

function fmtWindowDate(dateIso) {
  // dateIso = '2026-05-15'
  return new Date(`${dateIso}T00:00:00+08:00`).toLocaleDateString("en-SG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Singapore",
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// "2026-06-20" -> "June"; null/past -> "Available now"
function fmtAvailableMonth(nextAvailable) {
  if (!nextAvailable) return "Available now";
  const today = new Date().toISOString().slice(0, 10);
  if (nextAvailable <= today) return "Available now";
  const [y, m] = nextAvailable.split("-").map((s) => parseInt(s, 10));
  const name = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-SG", { month: "long", timeZone: "Asia/Singapore" });
  return `Available from ${name}`;
}

export default function BookingFlow({ propertyCode, roomCode }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const property = useMemo(() => getPropertyByCode(propertyCode), [propertyCode]);
  const source = useMemo(() => normalizeSource(params.get("src") || "organic"), [params]);

  // Property + rooms
  const [room, setRoom] = useState(null);
  const [allRooms, setAllRooms] = useState([]);
  // Multi-select up to MAX_ROOMS rooms. Empty array = "I'm flexible".
  // Order matters — first picked is treated as the primary room downstream.
  const MAX_ROOMS = 2;
  const [selectedRoomCodes, setSelectedRoomCodes] = useState(roomCode ? [roomCode] : []);
  const toggleRoomCode = (code) => {
    setSelectedRoomCodes((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= MAX_ROOMS) return prev; // ignore — capped
      return [...prev, code];
    });
  };
  const clearRoomSelection = () => setSelectedRoomCodes([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState(null);

  // Windows + slot
  const [windows, setWindows] = useState([]);
  const [windowsLoading, setWindowsLoading] = useState(false);
  const [windowsError, setWindowsError] = useState(null);
  const [selectedWindowKey, setSelectedWindowKey] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Form (booking)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("+65");
  const [notes, setNotes] = useState("");
  const [honeypot, setHoneypot] = useState("");

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [slotConflict, setSlotConflict] = useState(false);

  // Off-horizon mini-form
  const [ohOpen, setOhOpen] = useState(false);
  const [ohName, setOhName] = useState("");
  const [ohEmail, setOhEmail] = useState("");
  const [ohPhoneLocal, setOhPhoneLocal] = useState("");
  const [ohPhoneCountry, setOhPhoneCountry] = useState("+65");
  const [ohMoveInDate, setOhMoveInDate] = useState("");
  const [ohSubmitting, setOhSubmitting] = useState(false);
  const [ohError, setOhError] = useState(null);
  const [ohConfirmed, setOhConfirmed] = useState(false);

  const windowsAbortRef = useRef(null);

  // -- Load property + rooms --
  useEffect(() => {
    if (!property) {
      setPageError("Unknown property.");
      setPageLoading(false);
      return undefined;
    }
    let active = true;
    (async () => {
      setPageLoading(true);
      setPageError(null);
      try {
        const { data: propRow } = await supabase
          .from("properties")
          .select("id, code, name")
          .eq("code", property.code)
          .single();
        if (!propRow) {
          if (active) {
            setPageError("Property not yet available for online booking.");
            setPageLoading(false);
          }
          return;
        }
        const { data: roomsData } = await supabase
          .from("rooms")
          .select("id, name, unit_code, room_type, price_monthly, next_available, available_until, photos")
          .eq("property_id", propRow.id)
          .order("unit_code");
        if (!active) return;
        // Show rooms that become available within the next 4 months, or are
        // already vacant. Prospects don't book what's more than 4 months out.
        const todayIsoDate = new Date().toISOString().slice(0, 10);
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() + 4);
        const cutoffIso = cutoff.toISOString().slice(0, 10);
        const visibleRooms = (roomsData || []).filter((r) => {
          if (r.next_available && r.next_available <= cutoffIso) return true;
          // Currently vacant: no upcoming free date set AND not booked into the future.
          if (!r.next_available && (!r.available_until || r.available_until >= todayIsoDate)) {
            return true;
          }
          return false;
        });
        setAllRooms(visibleRooms);
        if (roomCode) {
          const match = visibleRooms.find(
            (r) => (r.unit_code || "").toLowerCase() === roomCode.toLowerCase()
          );
          if (match) {
            setRoom(match);
            setSelectedRoomCodes([match.unit_code]);
          } else {
            setRoom(null);
            setSelectedRoomCodes([]);
          }
        }
      } catch (err) {
        console.error("Failed to load property", err);
        if (active) setPageError("Couldn't load this property. Try again in a moment.");
      } finally {
        if (active) setPageLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [property, roomCode]);

  // -- Load windows whenever property changes --
  useEffect(() => {
    if (!property) return undefined;
    if (windowsAbortRef.current) windowsAbortRef.current.abort();
    const ctrl = new AbortController();
    windowsAbortRef.current = ctrl;
    setWindowsLoading(true);
    setWindowsError(null);
    setSelectedWindowKey(null);
    setSelectedSlot(null);
    setSlotConflict(false);

    fetchWindows({ property: property.code, signal: ctrl.signal })
      .then((data) => {
        setWindows(Array.isArray(data?.windows) ? data.windows : []);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("Windows fetch failed", err);
        setWindows([]);
        setWindowsError("Couldn't load windows — refresh and try again.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setWindowsLoading(false);
      });
    return () => ctrl.abort();
  }, [property]);

  async function reloadWindows() {
    if (!property) return;
    try {
      const data = await fetchWindows({ property: property.code });
      setWindows(Array.isArray(data?.windows) ? data.windows : []);
    } catch (err) {
      console.error("Windows reload failed", err);
    }
  }

  // Refetch windows when the tab regains focus / becomes visible again.
  // Without this, a tab left open from last week renders stale dates and
  // slot states until manual reload — a real bug we hit live.
  useEffect(() => {
    if (!property) return undefined;
    const onVisible = () => {
      if (document.visibilityState === "visible") reloadWindows();
    };
    const onFocus = () => reloadWindows();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (honeypot) return;
    if (!selectedSlot) {
      setSubmitError("Pick a time slot first.");
      return;
    }
    const phone = `${phoneCountry}${phoneLocal.replace(/\s|-/g, "")}`;
    if (!isValidPhone(phone)) {
      setSubmitError("That phone doesn't look right. Use SG (+65 XXXXXXXX) or MY (+60 XXXXXXXXX).");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setSlotConflict(false);

    try {
      const result = await createBooking({
        property: property.code,
        // Multi-room (max 2). Send `rooms` array; legacy `room` kept for any
        // older API path that still reads the singular field.
        rooms: selectedRoomCodes.length > 0 ? selectedRoomCodes : undefined,
        room: selectedRoomCodes[0] || undefined,
        slot_start: selectedSlot.start,
        name: name.trim(),
        email: email.trim(),
        phone,
        source,
        notes: notes.trim() || undefined,
        rules_version: "v1",
      });
      if (result?.viewing_id) {
        navigate(`/book/confirmed/${result.viewing_id}`);
      } else {
        setSubmitError("Booking succeeded but we didn't get a confirmation ID. Check your email.");
        setSubmitting(false);
      }
    } catch (err) {
      console.error("Booking failed", err);
      if (err.status === 409) {
        const code = err.body?.error || "";
        setSlotConflict(true);
        if (code === "not-adjacent" && Array.isArray(err.body?.suggested_slot_starts) && err.body.suggested_slot_starts.length > 0) {
          const choices = err.body.suggested_slot_starts.map(fmtSlotTime).join(" or ");
          setSubmitError(
            `We batch viewings back-to-back so Mark can host every prospect in person. The closest open slot${err.body.suggested_slot_starts.length > 1 ? "s are" : " is"} ${choices} — give one of those a try.`
          );
        } else if (code === "wrong-property" && err.body?.anchor_property) {
          setSubmitError(
            `This window is reserved for ${err.body.anchor_property} viewings only. Pick a different window or property.`
          );
        } else if (code === "travel-buffer" && err.body?.earliest_allowed) {
          setSubmitError(
            `Another property is being viewed nearby — Mark needs 30 min to travel between. The next open slot is ${fmtSlotTime(err.body.earliest_allowed)}.`
          );
        } else if (code === "would-block-existing") {
          setSubmitError("Booking that slot would push another viewing out of reach. Try the slot closest to the existing booking instead.");
        } else if (code === "slot-conflict") {
          setSubmitError("Mark has a conflict at that exact time. Pick another slot in this window.");
        } else if (code === "slot-taken") {
          setSubmitError("Someone else just locked that exact time — pick another slot from the grid.");
        } else if (code === "window-closed") {
          setSubmitError("That window just closed. Pick another, or flag a future move-in below and we will ping you when it opens.");
        } else {
          setSubmitError("We couldn't lock that slot — the grid below has been refreshed, please pick another.");
        }
        await reloadWindows();
      } else {
        setSubmitError(err.message || "Something went wrong. Try again or WhatsApp us on +65 8088 5410.");
      }
      setSubmitting(false);
    }
  }

  async function handleOffHorizonSubmit(e) {
    e.preventDefault();
    setOhError(null);
    if (!ohName.trim() || ohName.trim().length < 2) {
      setOhError("Name required.");
      return;
    }
    if (!ohEmail.trim() && !ohPhoneLocal.trim()) {
      setOhError("Email or phone required.");
      return;
    }
    if (!ohMoveInDate) {
      setOhError("Pick a target move-in date.");
      return;
    }
    const moveInMs = Date.parse(`${ohMoveInDate}T00:00:00+08:00`);
    const sevenDaysFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;
    if (moveInMs < sevenDaysFromNow) {
      setOhError("If you're moving in within a week, use the windows above instead.");
      return;
    }
    let phone = null;
    if (ohPhoneLocal.trim()) {
      phone = `${ohPhoneCountry}${ohPhoneLocal.replace(/\s|-/g, "")}`;
      if (!isValidPhone(phone)) {
        setOhError("Phone doesn't look right.");
        return;
      }
    }
    setOhSubmitting(true);
    try {
      await submitOffHorizonLead({
        name: ohName.trim(),
        email: ohEmail.trim() || null,
        phone,
        property: property.code,
        // Off-horizon lead capture only stores one preferred room — use the first pick
        room_code: selectedRoomCodes[0] || null,
        target_move_in_date: ohMoveInDate,
        source,
      });
      setOhConfirmed(true);
    } catch (err) {
      console.error("Off-horizon submit failed", err);
      setOhError(err.message || "Couldn't save. Try again or WhatsApp us.");
    } finally {
      setOhSubmitting(false);
    }
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-[#FAF6EC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#A87813] border-t-transparent rounded-full animate-spin" />
          <span className="text-[#A87813] font-['Plus_Jakarta_Sans'] font-bold text-sm tracking-wide">
            Loading…
          </span>
        </div>
      </div>
    );
  }

  if (pageError || !property) {
    return (
      <div className="min-h-screen bg-[#FAF6EC] font-['Inter'] text-[#191c1e] flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-2xl editorial-shadow p-8 text-center">
          <span className="material-symbols-outlined text-5xl text-[#ba1a1a] mb-4 block">
            error_outline
          </span>
          <h1 className="font-['Plus_Jakarta_Sans'] text-xl font-bold mb-2">
            {pageError || "Property not found"}
          </h1>
          <Link
            to="/book"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-[#A87813] text-white rounded-lg font-['Plus_Jakarta_Sans'] font-bold text-sm"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back to properties
          </Link>
        </div>
      </div>
    );
  }

  const headerCopy = room
    ? `Book a viewing for ${room.name || room.unit_code}`
    : "Book a viewing";

  return (
    <div className="min-h-screen bg-[#FAF6EC] font-['Inter'] text-[#191c1e]">
      {/* Sticky header */}
      <header className="bg-white shadow-sm flex justify-between items-center px-5 py-3 w-full border-b border-slate-100 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link
            to="/book"
            className="material-symbols-outlined text-slate-500 hover:bg-slate-50 p-2 rounded-full transition-colors"
            aria-label="Back to properties"
          >
            arrow_back
          </Link>
          <div>
            <span className="text-base font-bold tracking-tighter text-honey-800 font-['Plus_Jakarta_Sans']">
              Lazybee · {property.name}
            </span>
            {(selectedRoomCodes.length > 0 || room) && (
              <span className="block text-[10px] text-[#A87813] font-bold tracking-wide uppercase">
                Viewing: {selectedRoomCodes.length > 0 ? selectedRoomCodes.join(" + ") : room.unit_code}
              </span>
            )}
          </div>
        </div>
        <a
          href="https://wa.me/6580885410"
          className="material-symbols-outlined text-slate-500 cursor-pointer hover:bg-slate-50 p-2 rounded-full transition-colors"
          aria-label="WhatsApp support"
        >
          help_outline
        </a>
      </header>

      <main className="flex flex-col items-center p-5 sm:p-10">
        {/* Wide-screen layout: 2-column at xl, side rail at 2xl */}
        <div className="w-full max-w-lg xl:max-w-[1400px] 2xl:max-w-[1700px] grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px] gap-6">
          {/* LEFT: hero + windows + booking form */}
          <div className="bg-white rounded-2xl editorial-shadow overflow-hidden">
            {/* Hero */}
            <div className="relative aspect-[16/9] w-full bg-slate-100">
              <img
                src={property.image}
                alt={`${property.name} interior`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-5">
                <div>
                  <span className="inline-block px-3 py-1 mb-2 bg-[#D9A441] text-[#A87813] text-[10px] font-bold uppercase tracking-wider rounded-full">
                    Lazybee · {property.code}
                  </span>
                  <h1 className="text-white font-['Plus_Jakarta_Sans'] text-2xl font-extrabold tracking-tight">
                    {property.name}
                  </h1>
                  <p className="text-white/80 text-sm flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">location_on</span>
                    {property.address}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="mb-7">
                <div className="w-10 h-1 bg-[#D9A441] mb-4" />
                <h2 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#191c1e] mb-1 tracking-tight">
                  {headerCopy}
                </h2>
                <p className="text-[#1F2937] text-sm leading-relaxed">
                  Mark hosts every viewing in person. Pick a window below to see the open times.
                </p>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit} noValidate>
                {/* Multi-room picker — up to 2 rooms per viewing, with photos */}
                {!room && allRooms.length > 0 && (
                  <div>
                    <div className="flex items-baseline justify-between mb-3 ml-1">
                      <label className="block text-[11px] font-bold uppercase tracking-widest text-[#1F2937]">
                        Which room{selectedRoomCodes.length > 1 ? "s" : ""}? <span className="text-[#6B7280] font-normal normal-case tracking-normal">(pick up to {MAX_ROOMS})</span>
                      </label>
                      <span className="text-[10px] text-[#6B7280] font-medium">
                        {selectedRoomCodes.length}/{MAX_ROOMS} selected
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={clearRoomSelection}
                        className={`relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all flex flex-col items-center justify-center gap-1 text-xs font-medium ${
                          selectedRoomCodes.length === 0
                            ? "border-[#A87813] bg-[#A87813] text-white shadow-md"
                            : "border-transparent bg-[#e6e8ea] text-[#1F2937] hover:border-[#D9A441]/40"
                        }`}
                      >
                        <span className="material-symbols-outlined text-2xl">apps</span>
                        <span className="text-[10px] uppercase tracking-wide">I&apos;m flexible</span>
                      </button>
                      {allRooms.map((r) => {
                        const isSelected = selectedRoomCodes.includes(r.unit_code);
                        const isCapped = !isSelected && selectedRoomCodes.length >= MAX_ROOMS;
                        const photo = Array.isArray(r.photos) && r.photos.length > 0 ? r.photos[0] : null;
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => toggleRoomCode(r.unit_code)}
                            disabled={isCapped}
                            aria-pressed={isSelected}
                            title={isCapped ? `Pick up to ${MAX_ROOMS} rooms — deselect one first` : ""}
                            className={`relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all text-left ${
                              isSelected
                                ? "border-[#A87813] shadow-md ring-2 ring-[#A87813]/30"
                                : isCapped
                                  ? "border-transparent opacity-40 cursor-not-allowed"
                                  : "border-transparent hover:border-[#D9A441]/60"
                            }`}
                          >
                            {photo ? (
                              <img
                                src={photo}
                                alt={r.name || r.unit_code}
                                className="absolute inset-0 w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="absolute inset-0 bg-[#e6e8ea] flex items-center justify-center text-[#6B7280] text-[10px]">
                                no photo
                              </div>
                            )}
                            {/* gradient for legibility */}
                            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
                            <div className="absolute bottom-1.5 left-2 right-2 text-white">
                              <div className="text-xs font-bold leading-tight">{r.unit_code}</div>
                              {r.price_monthly ? (
                                <div className="text-[10px] font-medium opacity-90">
                                  S${Number(r.price_monthly).toLocaleString()}/mo
                                </div>
                              ) : null}
                              <div className="text-[10px] font-medium opacity-90">
                                {fmtAvailableMonth(r.next_available)}
                              </div>
                            </div>
                            {isSelected && (
                              <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-[#A87813] text-white flex items-center justify-center shadow">
                                <span className="material-symbols-outlined text-sm">check</span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Windows list */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-[#1F2937] mb-2 ml-1">
                    Pick a window
                  </label>
                  {windowsLoading ? (
                    <div className="flex items-center gap-2 text-[#6B7280] text-sm py-3">
                      <div className="w-4 h-4 border-2 border-[#A87813] border-t-transparent rounded-full animate-spin" />
                      Loading windows…
                    </div>
                  ) : windowsError ? (
                    <div className="flex items-center gap-2 p-3 bg-[#ffdad6] rounded-lg">
                      <span className="material-symbols-outlined text-[#93000a] text-sm">error</span>
                      <p className="text-sm text-[#93000a] font-medium">{windowsError}</p>
                    </div>
                  ) : windows.length === 0 ? (
                    <div className="text-sm text-[#6B7280] italic py-3">
                      No windows in the next 7 days. Use the form below to flag a future move-in date.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {windows.map((w) => {
                        const desc = describeWindowState(w, property.code);
                        const isOpen = selectedWindowKey === w.key + "@" + w.date;
                        return (
                          <div
                            key={`${w.key}-${w.date}`}
                            className={`border rounded-lg transition-all ${
                              desc.clickable
                                ? "border-[#D9A441]/30 bg-white hover:border-[#D9A441]/60"
                                : "border-slate-200 bg-slate-50 opacity-70"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (!desc.clickable) return;
                                setSelectedWindowKey(isOpen ? null : w.key + "@" + w.date);
                                setSelectedSlot(null);
                              }}
                              className="w-full text-left px-4 py-3 flex items-center justify-between"
                              disabled={!desc.clickable}
                            >
                              <div>
                                <div className="font-['Plus_Jakarta_Sans'] font-bold text-[#191c1e] text-sm">
                                  {WINDOW_LABELS[w.key]} · {fmtWindowDate(w.date)}
                                </div>
                                <div className="text-xs text-[#6B7280]">
                                  {WINDOW_TIMES[w.key]} · {desc.label}
                                </div>
                              </div>
                              <span className="material-symbols-outlined text-[#1F2937] text-xl">
                                {desc.clickable
                                  ? isOpen
                                    ? "expand_less"
                                    : "expand_more"
                                  : "lock"}
                              </span>
                            </button>
                            {isOpen && desc.clickable && (
                              <div className="px-4 pb-4 pt-1 border-t border-slate-100">
                                <div className="flex flex-wrap gap-2 pt-3">
                                  {w.slots
                                    .filter((s) => isSlotClickable(s, property.code, w.anchor_property))
                                    .map((s) => {
                                      const selected = selectedSlot?.start === s.start;
                                      return (
                                        <button
                                          key={s.start}
                                          type="button"
                                          onClick={() => setSelectedSlot(s)}
                                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${slotStateClass(s, selected)}`}
                                          title={slotStateTitle(s)}
                                        >
                                          {fmtSlotTime(s.start)}
                                        </button>
                                      );
                                    })}
                                </div>
                                {/* anchor-callout removed — internal detail, noise for prospects */}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* footer line removed */}
                </div>

                {/* slotConflict signal handled by the submit-error banner below — no duplicate notice here */}

                {/* Contact form */}
                <div className="pt-4 border-t border-[#e6e8ea] space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[#1F2937] mb-1.5 ml-1">
                      Full name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Sarah Tan"
                      className="w-full px-4 py-3 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#D9A441] transition-all text-sm placeholder:text-[#E8E0CE]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[#1F2937] mb-1.5 ml-1">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="sarah@example.com"
                      className="w-full px-4 py-3 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#D9A441] transition-all text-sm placeholder:text-[#E8E0CE]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[#1F2937] mb-1.5 ml-1">
                      Phone (WhatsApp)
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={phoneCountry}
                        onChange={(e) => setPhoneCountry(e.target.value)}
                        className="px-3 bg-[#eceef0] rounded-lg text-sm text-[#1F2937] font-medium border-none focus:ring-2 focus:ring-[#D9A441]"
                      >
                        <option value="+65">+65 SG</option>
                        <option value="+60">+60 MY</option>
                      </select>
                      <input
                        type="tel"
                        required
                        value={phoneLocal}
                        onChange={(e) => setPhoneLocal(e.target.value)}
                        placeholder={phoneCountry === "+65" ? "8123 4567" : "12 345 6789"}
                        className="w-full px-4 py-3 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#D9A441] transition-all text-sm placeholder:text-[#E8E0CE]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[#1F2937] mb-1.5 ml-1">
                      Anything else? (optional)
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. move-in date, parking, pets…"
                      className="w-full px-4 py-3 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#D9A441] transition-all text-sm placeholder:text-[#E8E0CE] resize-none"
                    />
                  </div>
                </div>

                <input type="hidden" name="source" value={source} />
                <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>

                {submitError && (
                  <div className="flex items-center gap-2 p-3 bg-[#ffdad6] rounded-lg">
                    <span className="material-symbols-outlined text-[#93000a] text-sm">error</span>
                    <p className="text-sm text-[#93000a] font-medium">{submitError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !selectedSlot}
                  className="w-full py-4 bg-[#A87813] text-white font-['Plus_Jakarta_Sans'] font-bold text-sm tracking-wide rounded-lg hover:bg-[#A87813]/90 active:scale-[0.98] transition-all editorial-shadow flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Booking…
                    </>
                  ) : selectedSlot ? (
                    <>
                      Confirm — {fmtSlotTime(selectedSlot.start)}
                      {selectedRoomCodes.length > 0
                        ? ` for ${selectedRoomCodes.join(" + ")}`
                        : room?.unit_code
                          ? ` for ${room.unit_code}`
                          : ""}
                      <span className="material-symbols-outlined text-sm">check</span>
                    </>
                  ) : (
                    <>
                      Pick a slot above
                      <span className="material-symbols-outlined text-sm">calendar_month</span>
                    </>
                  )}
                </button>

                <p className="text-[10px] text-center text-[#6B7280] text-balance">
                  By booking, you agree to our{" "}
                  <Link className="underline hover:text-[#A87813]" to="/terms-of-service">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link className="underline hover:text-[#A87813]" to="/privacy-policy">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </form>
            </div>
          </div>

          {/* RIGHT: off-horizon mini-form (side rail at xl, stacks below at <xl) */}
          <aside className="bg-white rounded-2xl editorial-shadow overflow-hidden xl:sticky xl:top-20 xl:self-start">
            <div className="p-6">
              <div className="w-10 h-1 bg-[#D9A441] mb-4" />
              <h3 className="font-['Plus_Jakarta_Sans'] text-lg font-bold mb-1 tracking-tight">
                Need a date further out?
              </h3>
              <p className="text-[#1F2937] text-sm leading-relaxed mb-4">
                Tell us your move-in date and we&apos;ll ping you 7-10 days before with open slots.
              </p>

              {ohConfirmed ? (
                <div className="p-4 bg-[#D9A441]/10 rounded-lg">
                  <p className="text-sm text-[#A87813] font-medium">
                    Got it. We&apos;ll reach out 7-10 days before {ohMoveInDate} with open slots.
                  </p>
                  <p className="text-xs text-[#1F2937] mt-2">
                    Please let me know if you have any questions.
                  </p>
                  <p className="text-xs mt-2">
                    <a
                      href="https://lazybee.sg/book"
                      className="text-[#A87813] font-bold underline"
                    >
                      https://lazybee.sg/book
                    </a>
                  </p>
                </div>
              ) : !ohOpen ? (
                <button
                  type="button"
                  onClick={() => setOhOpen(true)}
                  className="w-full py-3 bg-white border border-[#A87813] text-[#A87813] font-['Plus_Jakarta_Sans'] font-bold text-sm rounded-lg hover:bg-[#A87813]/5 transition-all"
                >
                  Flag a future move-in date
                </button>
              ) : (
                <form className="space-y-3" onSubmit={handleOffHorizonSubmit} noValidate>
                  <input
                    type="text"
                    placeholder="Full name"
                    value={ohName}
                    onChange={(e) => setOhName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#D9A441] text-sm"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={ohEmail}
                    onChange={(e) => setOhEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#D9A441] text-sm"
                  />
                  <div className="flex gap-2">
                    <select
                      value={ohPhoneCountry}
                      onChange={(e) => setOhPhoneCountry(e.target.value)}
                      className="px-2 bg-[#eceef0] rounded-lg text-xs font-medium border-none focus:ring-2 focus:ring-[#D9A441]"
                    >
                      <option value="+65">+65</option>
                      <option value="+60">+60</option>
                    </select>
                    <input
                      type="tel"
                      placeholder="Phone"
                      value={ohPhoneLocal}
                      onChange={(e) => setOhPhoneLocal(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#D9A441] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1F2937] mb-1 ml-1">
                      Target move-in
                    </label>
                    <input
                      type="date"
                      value={ohMoveInDate}
                      min={todayIso()}
                      onChange={(e) => setOhMoveInDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#D9A441] text-sm"
                    />
                  </div>
                  {ohError && (
                    <div className="flex items-center gap-2 p-2 bg-[#ffdad6] rounded-lg">
                      <p className="text-xs text-[#93000a] font-medium">{ohError}</p>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={ohSubmitting}
                    className="w-full py-3 bg-[#A87813] text-white font-['Plus_Jakarta_Sans'] font-bold text-sm rounded-lg hover:bg-[#A87813]/90 transition-all disabled:opacity-50"
                  >
                    {ohSubmitting ? "Saving…" : "Notify me when slots open"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOhOpen(false)}
                    className="w-full text-xs text-[#6B7280] hover:text-[#1F2937]"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </div>
          </aside>
        </div>

        <footer className="mt-10 opacity-50 hover:opacity-100 transition-opacity flex flex-col items-center gap-2">
          <span className="text-honey-800 font-['Plus_Jakarta_Sans'] font-black text-lg">Lazybee</span>
          <div className="flex gap-4 text-xs font-medium text-slate-500">
            <Link to="/">About</Link>
            <Link to="/properties">Properties</Link>
            <a href="https://wa.me/6580885410">Support</a>
          </div>
        </footer>
      </main>
    </div>
  );
}

export function BookPropertyPage() {
  const { property } = useParams();
  return <BookingFlow propertyCode={property} />;
}

export function BookRoomPage() {
  const { property, room } = useParams();
  return <BookingFlow propertyCode={property} roomCode={room} />;
}
