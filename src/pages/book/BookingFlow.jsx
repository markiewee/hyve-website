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

export default function BookingFlow({ propertyCode, roomCode }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const property = useMemo(() => getPropertyByCode(propertyCode), [propertyCode]);
  const source = useMemo(() => normalizeSource(params.get("src") || "organic"), [params]);

  // Property + rooms
  const [room, setRoom] = useState(null);
  const [allRooms, setAllRooms] = useState([]);
  const [selectedRoomCode, setSelectedRoomCode] = useState(roomCode || "");
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
          .select("id, name, unit_code, room_type, monthly_rent, is_available")
          .eq("property_id", propRow.id)
          .order("unit_code");
        if (!active) return;
        const visibleRooms = (roomsData || []).filter((r) => r.is_available !== false);
        setAllRooms(visibleRooms);
        if (roomCode) {
          const match = visibleRooms.find(
            (r) => (r.unit_code || "").toLowerCase() === roomCode.toLowerCase()
          );
          if (match) {
            setRoom(match);
            setSelectedRoomCode(match.unit_code);
          } else {
            setRoom(null);
            setSelectedRoomCode("");
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
        room: selectedRoomCode || undefined,
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
        if (code === "wrong-property" && err.body?.anchor_property) {
          setSubmitError(
            `That window is anchored to ${err.body.anchor_property} this weekend. Pick a different window or property.`
          );
        } else if (code === "travel-buffer" && err.body?.earliest_allowed) {
          setSubmitError(
            `Mark needs 30 min travel buffer between properties. Earliest slot is ${fmtSlotTime(err.body.earliest_allowed)}.`
          );
        } else if (code === "would-block-existing") {
          setSubmitError("That slot would block an already-booked viewing at another property. Try a different time.");
        } else if (code === "window-closed") {
          setSubmitError("That window just closed. Pick another or try the off-horizon form below.");
        } else {
          setSubmitError("Someone just took that slot. Pick another.");
        }
        await reloadWindows();
      } else {
        setSubmitError(err.message || "Booking failed. Try again or WhatsApp us.");
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
        room_code: selectedRoomCode || null,
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
      <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#006b5f] border-t-transparent rounded-full animate-spin" />
          <span className="text-[#006b5f] font-['Plus_Jakarta_Sans'] font-bold text-sm tracking-wide">
            Loading…
          </span>
        </div>
      </div>
    );
  }

  if (pageError || !property) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] font-['Inter'] text-[#191c1e] flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-2xl editorial-shadow p-8 text-center">
          <span className="material-symbols-outlined text-5xl text-[#ba1a1a] mb-4 block">
            error_outline
          </span>
          <h1 className="font-['Plus_Jakarta_Sans'] text-xl font-bold mb-2">
            {pageError || "Property not found"}
          </h1>
          <Link
            to="/book"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-[#006b5f] text-white rounded-lg font-['Plus_Jakarta_Sans'] font-bold text-sm"
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

  const selectedWindow = windows.find((w) => w.key === selectedWindowKey + "-" + selectedSlot?.start) || null; // unused
  const _ = selectedWindow;

  return (
    <div className="min-h-screen bg-[#f8f9ff] font-['Inter'] text-[#191c1e]">
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
            <span className="text-base font-bold tracking-tighter text-teal-700 font-['Plus_Jakarta_Sans']">
              Lazybee · {property.name}
            </span>
            {room && (
              <span className="block text-[10px] text-slate-500 font-medium">
                {room.unit_code}
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
                  <span className="inline-block px-3 py-1 mb-2 bg-[#14b8a6] text-[#00423b] text-[10px] font-bold uppercase tracking-wider rounded-full">
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
                <div className="w-10 h-1 bg-[#14b8a6] mb-4" />
                <h2 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#191c1e] mb-1 tracking-tight">
                  {headerCopy}
                </h2>
                <p className="text-[#3c4947] text-sm leading-relaxed">
                  Mark hosts every viewing in person, so we cluster bookings into <strong>3 weekly windows</strong> — Friday evening, Saturday morning, Sunday afternoon. Pick a window with open slots.
                </p>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit} noValidate>
                {/* Optional room selector */}
                {!room && allRooms.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[#3c4947] mb-2 ml-1">
                      Which room?
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedRoomCode("")}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          !selectedRoomCode
                            ? "bg-[#006b5f] text-white shadow-md"
                            : "bg-[#e6e8ea] text-[#3c4947] hover:bg-[#14b8a6]/20"
                        }`}
                      >
                        I&apos;m flexible
                      </button>
                      {allRooms.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setSelectedRoomCode(r.unit_code)}
                          className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            selectedRoomCode === r.unit_code
                              ? "bg-[#006b5f] text-white shadow-md"
                              : "bg-[#e6e8ea] text-[#3c4947] hover:bg-[#14b8a6]/20"
                          }`}
                        >
                          {r.unit_code}
                          {r.monthly_rent ? ` · S$${r.monthly_rent}` : ""}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Windows list */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-[#3c4947] mb-2 ml-1">
                    Pick a window
                  </label>
                  {windowsLoading ? (
                    <div className="flex items-center gap-2 text-[#6c7a77] text-sm py-3">
                      <div className="w-4 h-4 border-2 border-[#006b5f] border-t-transparent rounded-full animate-spin" />
                      Loading windows…
                    </div>
                  ) : windowsError ? (
                    <div className="flex items-center gap-2 p-3 bg-[#ffdad6] rounded-lg">
                      <span className="material-symbols-outlined text-[#93000a] text-sm">error</span>
                      <p className="text-sm text-[#93000a] font-medium">{windowsError}</p>
                    </div>
                  ) : windows.length === 0 ? (
                    <div className="text-sm text-[#6c7a77] italic py-3">
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
                                ? "border-[#14b8a6]/30 bg-white hover:border-[#14b8a6]/60"
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
                                <div className="text-xs text-[#6c7a77]">
                                  {WINDOW_TIMES[w.key]} · {desc.label}
                                </div>
                              </div>
                              <span className="material-symbols-outlined text-[#3c4947] text-xl">
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
                                  {w.slots.map((s) => {
                                    const clickable = isSlotClickable(s, property.code, w.anchor_property);
                                    const selected = selectedSlot?.start === s.start;
                                    return (
                                      <button
                                        key={s.start}
                                        type="button"
                                        onClick={() => clickable && setSelectedSlot(s)}
                                        disabled={!clickable}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${slotStateClass(s, selected)}`}
                                        title={s.state}
                                      >
                                        {fmtSlotTime(s.start)}
                                      </button>
                                    );
                                  })}
                                </div>
                                {w.anchor_property === property.code && (
                                  <p className="text-[10px] text-[#00423b] mt-3">
                                    {property.code} is anchored for this window — back-to-back slots welcome.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-[10px] text-[#6c7a77] mt-2 ml-1">
                    Mark hosts every viewing — windows cluster by property to avoid 30-min cross-island runs.
                  </p>
                </div>

                {slotConflict && (
                  <p className="text-xs text-[#93000a] font-medium mt-2">
                    Windows refreshed — pick another.
                  </p>
                )}

                {/* Contact form */}
                <div className="pt-4 border-t border-[#e6e8ea] space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[#3c4947] mb-1.5 ml-1">
                      Full name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Sarah Tan"
                      className="w-full px-4 py-3 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#14b8a6] transition-all text-sm placeholder:text-[#bbcac6]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[#3c4947] mb-1.5 ml-1">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="sarah@example.com"
                      className="w-full px-4 py-3 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#14b8a6] transition-all text-sm placeholder:text-[#bbcac6]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[#3c4947] mb-1.5 ml-1">
                      Phone (WhatsApp)
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={phoneCountry}
                        onChange={(e) => setPhoneCountry(e.target.value)}
                        className="px-3 bg-[#eceef0] rounded-lg text-sm text-[#3c4947] font-medium border-none focus:ring-2 focus:ring-[#14b8a6]"
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
                        className="w-full px-4 py-3 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#14b8a6] transition-all text-sm placeholder:text-[#bbcac6]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[#3c4947] mb-1.5 ml-1">
                      Anything else? (optional)
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. move-in date, parking, pets…"
                      className="w-full px-4 py-3 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#14b8a6] transition-all text-sm placeholder:text-[#bbcac6] resize-none"
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
                  className="w-full py-4 bg-[#006b5f] text-white font-['Plus_Jakarta_Sans'] font-bold text-sm tracking-wide rounded-lg hover:bg-[#006b5f]/90 active:scale-[0.98] transition-all editorial-shadow flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Booking…
                    </>
                  ) : selectedSlot ? (
                    <>
                      Confirm — {fmtSlotTime(selectedSlot.start)}
                      <span className="material-symbols-outlined text-sm">check</span>
                    </>
                  ) : (
                    <>
                      Pick a slot above
                      <span className="material-symbols-outlined text-sm">calendar_month</span>
                    </>
                  )}
                </button>

                <p className="text-[10px] text-center text-[#6c7a77] text-balance">
                  By booking, you agree to our{" "}
                  <Link className="underline hover:text-[#006b5f]" to="/terms-of-service">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link className="underline hover:text-[#006b5f]" to="/privacy-policy">
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
              <div className="w-10 h-1 bg-[#14b8a6] mb-4" />
              <h3 className="font-['Plus_Jakarta_Sans'] text-lg font-bold mb-1 tracking-tight">
                Need a date further out?
              </h3>
              <p className="text-[#3c4947] text-sm leading-relaxed mb-4">
                Tell us your move-in date and we&apos;ll ping you 7-10 days before with open slots.
              </p>

              {ohConfirmed ? (
                <div className="p-4 bg-[#14b8a6]/10 rounded-lg">
                  <p className="text-sm text-[#00423b] font-medium">
                    Got it. We&apos;ll reach out 7-10 days before {ohMoveInDate} with open slots.
                  </p>
                  <p className="text-xs text-[#3c4947] mt-2">
                    Please let me know if you have any questions.
                  </p>
                  <p className="text-xs mt-2">
                    <a
                      href="https://lazybee.sg/book"
                      className="text-[#006b5f] font-bold underline"
                    >
                      https://lazybee.sg/book
                    </a>
                  </p>
                </div>
              ) : !ohOpen ? (
                <button
                  type="button"
                  onClick={() => setOhOpen(true)}
                  className="w-full py-3 bg-white border border-[#006b5f] text-[#006b5f] font-['Plus_Jakarta_Sans'] font-bold text-sm rounded-lg hover:bg-[#006b5f]/5 transition-all"
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
                    className="w-full px-4 py-2.5 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#14b8a6] text-sm"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={ohEmail}
                    onChange={(e) => setOhEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#14b8a6] text-sm"
                  />
                  <div className="flex gap-2">
                    <select
                      value={ohPhoneCountry}
                      onChange={(e) => setOhPhoneCountry(e.target.value)}
                      className="px-2 bg-[#eceef0] rounded-lg text-xs font-medium border-none focus:ring-2 focus:ring-[#14b8a6]"
                    >
                      <option value="+65">+65</option>
                      <option value="+60">+60</option>
                    </select>
                    <input
                      type="tel"
                      placeholder="Phone"
                      value={ohPhoneLocal}
                      onChange={(e) => setOhPhoneLocal(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#14b8a6] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#3c4947] mb-1 ml-1">
                      Target move-in
                    </label>
                    <input
                      type="date"
                      value={ohMoveInDate}
                      min={todayIso()}
                      onChange={(e) => setOhMoveInDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#14b8a6] text-sm"
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
                    className="w-full py-3 bg-[#006b5f] text-white font-['Plus_Jakarta_Sans'] font-bold text-sm rounded-lg hover:bg-[#006b5f]/90 transition-all disabled:opacity-50"
                  >
                    {ohSubmitting ? "Saving…" : "Notify me when slots open"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOhOpen(false)}
                    className="w-full text-xs text-[#6c7a77] hover:text-[#3c4947]"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </div>
          </aside>
        </div>

        <footer className="mt-10 opacity-50 hover:opacity-100 transition-opacity flex flex-col items-center gap-2">
          <span className="text-teal-700 font-['Plus_Jakarta_Sans'] font-black text-lg">Lazybee</span>
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
