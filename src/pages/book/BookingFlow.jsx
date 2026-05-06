import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getPropertyByCode, isValidPhone, normalizeSource } from "./_propertyMeta";
import { fetchSlots, createBooking } from "./_bookApi";

// Singapore timezone helpers — all slot maths happen in SGT to match the API
// contract (slots come back as ISO strings with +08:00 offset).

function todaySGT() {
  const now = new Date();
  const sgt = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Singapore" }));
  sgt.setHours(0, 0, 0, 0);
  return sgt;
}

function isoDate(d) {
  // YYYY-MM-DD in local-day terms (we already pinned to SGT midnight)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function getNextDays(count = 14) {
  const start = todaySGT();
  // Skip today — BOOKING_LEAD_TIME_HOURS default is 12h so same-day is unlikely.
  start.setDate(start.getDate() + 1);
  const days = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function fmtDayLabel(d) {
  return d.toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" });
}

function fmtSlotTime(iso) {
  return new Date(iso).toLocaleTimeString("en-SG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Singapore",
  });
}

function isWeekend(d) {
  const day = d.getDay();
  return day === 0 || day === 6;
}

export default function BookingFlow({ propertyCode, roomCode }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const property = useMemo(() => getPropertyByCode(propertyCode), [propertyCode]);

  // Source attribution: prefer ?src= URL param, else default per existing channels.
  const source = useMemo(() => normalizeSource(params.get("src") || "organic"), [params]);

  // Room data — looked up directly from Supabase (read-only, public-safe).
  const [room, setRoom] = useState(null);
  const [allRooms, setAllRooms] = useState([]);
  const [selectedRoomCode, setSelectedRoomCode] = useState(roomCode || "");
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState(null);

  // Date + slots
  const days = useMemo(() => getNextDays(14), []);
  const [selectedDate, setSelectedDate] = useState(isoDate(days[0]));
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("+65");
  const [notes, setNotes] = useState("");
  const [honeypot, setHoneypot] = useState("");

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [slotConflict, setSlotConflict] = useState(false);

  const slotsAbortRef = useRef(null);

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
        // Look up the Supabase property row (id needed for room query).
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
            // Room slug doesn't resolve — fall back to property-level booking.
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

  // -- Load slots whenever date or property/room changes --
  useEffect(() => {
    if (!property || !selectedDate) return undefined;
    if (slotsAbortRef.current) slotsAbortRef.current.abort();
    const ctrl = new AbortController();
    slotsAbortRef.current = ctrl;

    setSlotsLoading(true);
    setSlotsError(null);
    setSelectedSlot(null);
    setSlotConflict(false);

    fetchSlots({
      property: property.code,
      date: selectedDate,
      room: selectedRoomCode || undefined,
      signal: ctrl.signal,
    })
      .then((data) => {
        setSlots(Array.isArray(data?.slots) ? data.slots : []);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("Slot fetch failed", err);
        setSlots([]);
        setSlotsError("Couldn't load times — tap a different day or refresh.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setSlotsLoading(false);
      });

    return () => ctrl.abort();
  }, [property, selectedDate, selectedRoomCode]);

  async function reloadSlots() {
    if (!property) return;
    setSlotsLoading(true);
    try {
      const data = await fetchSlots({
        property: property.code,
        date: selectedDate,
        room: selectedRoomCode || undefined,
      });
      setSlots(Array.isArray(data?.slots) ? data.slots : []);
    } catch (err) {
      console.error("Slot reload failed", err);
    } finally {
      setSlotsLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (honeypot) return; // bot caught
    if (!selectedSlot) {
      setSubmitError("Pick a time slot first.");
      return;
    }
    const phone = `${phoneCountry}${phoneLocal.replace(/\s|-/g, "")}`;
    if (!isValidPhone(phone)) {
      setSubmitError(
        "That phone doesn't look right. Use SG (+65 XXXXXXXX) or MY (+60 XXXXXXXXX)."
      );
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
      });
      if (result?.viewing_id) {
        navigate(`/book/confirmed/${result.viewing_id}`);
      } else {
        setSubmitError("Booking succeeded but we didn't get a confirmation ID. Check your email.");
        setSubmitting(false);
      }
    } catch (err) {
      console.error("Booking failed", err);
      // 409 = slot taken between load and submit
      if (err.status === 409) {
        setSlotConflict(true);
        setSubmitError("Someone just took that slot. Pick another.");
        await reloadSlots();
      } else {
        setSubmitError(err.message || "Booking failed. Try again or WhatsApp us.");
      }
      setSubmitting(false);
    }
  }

  // -- Loading + error guards --
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

  return (
    <div className="min-h-screen bg-[#f8f9ff] font-['Inter'] text-[#191c1e]">
      {/* Sticky header with back link */}
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
              Hyve · {property.name}
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
        <div className="w-full max-w-lg bg-white rounded-2xl editorial-shadow overflow-hidden">
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
                  Hyve · {property.code}
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
                Pick a slot below — we&apos;ll confirm it instantly with calendar invite + door
                instructions.
              </p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit} noValidate>
              {/* Optional room selector — hidden when we already have one via URL */}
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

              {/* Date picker — horizontal scroll on mobile */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-[#3c4947] mb-2 ml-1">
                  Pick a day
                </label>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
                  {days.map((d) => {
                    const iso = isoDate(d);
                    const active = iso === selectedDate;
                    const weekend = isWeekend(d);
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => setSelectedDate(iso)}
                        className={`shrink-0 min-w-[76px] py-3 px-2 rounded-lg text-center transition-all border ${
                          active
                            ? "bg-[#006b5f] text-white border-[#006b5f] shadow-md"
                            : weekend
                              ? "bg-[#14b8a6]/10 border-[#14b8a6]/30 text-[#00423b] hover:bg-[#14b8a6]/20"
                              : "bg-[#e6e8ea] border-transparent text-[#3c4947] hover:bg-[#14b8a6]/15"
                        }`}
                      >
                        <span className="block text-[10px] font-bold uppercase tracking-wide opacity-80">
                          {d.toLocaleDateString("en-SG", { weekday: "short" })}
                        </span>
                        <span className="block text-base font-extrabold">{d.getDate()}</span>
                        <span className="block text-[10px] font-medium opacity-80">
                          {d.toLocaleDateString("en-SG", { month: "short" })}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-[#6c7a77] mt-1 ml-1">
                  Weekday slots: 7–9pm · Weekend slots: 11am–3pm · All times SGT
                </p>
              </div>

              {/* Slot list */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-[#3c4947] mb-2 ml-1">
                  Available times · {fmtDayLabel(new Date(`${selectedDate}T00:00:00+08:00`))}
                </label>
                {slotsLoading ? (
                  <div className="flex items-center gap-2 text-[#6c7a77] text-sm py-3">
                    <div className="w-4 h-4 border-2 border-[#006b5f] border-t-transparent rounded-full animate-spin" />
                    Loading times…
                  </div>
                ) : slotsError ? (
                  <div className="flex items-center gap-2 p-3 bg-[#ffdad6] rounded-lg">
                    <span className="material-symbols-outlined text-[#93000a] text-sm">error</span>
                    <p className="text-sm text-[#93000a] font-medium">{slotsError}</p>
                  </div>
                ) : slots.length === 0 ? (
                  <div className="text-sm text-[#6c7a77] italic py-3">
                    No free slots that day — try another.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {slots.map((s) => {
                      const active = selectedSlot?.start === s.start;
                      return (
                        <button
                          key={s.start}
                          type="button"
                          onClick={() => setSelectedSlot(s)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            active
                              ? "bg-[#006b5f] text-white shadow-md scale-105"
                              : "bg-[#e6e8ea] text-[#3c4947] hover:bg-[#14b8a6]/20 hover:text-[#00423b]"
                          }`}
                        >
                          {fmtSlotTime(s.start)}
                        </button>
                      );
                    })}
                  </div>
                )}
                {slotConflict && (
                  <p className="text-xs text-[#93000a] font-medium mt-2">
                    Slots refreshed — pick another.
                  </p>
                )}
              </div>

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

              {/* Hidden source — observed via URL, no UI */}
              <input type="hidden" name="source" value={source} />

              {/* Honeypot */}
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
                    Confirm — {fmtDayLabel(new Date(`${selectedDate}T00:00:00+08:00`))} ·{" "}
                    {fmtSlotTime(selectedSlot.start)}
                    <span className="material-symbols-outlined text-sm">check</span>
                  </>
                ) : (
                  <>
                    Pick a time slot above
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

        <footer className="mt-10 opacity-50 hover:opacity-100 transition-opacity flex flex-col items-center gap-2">
          <span className="text-teal-700 font-['Plus_Jakarta_Sans'] font-black text-lg">Hyve</span>
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

// Route entry: /book/:property
export function BookPropertyPage() {
  const { property } = useParams();
  return <BookingFlow propertyCode={property} />;
}

// Route entry: /book/:property/:room
export function BookRoomPage() {
  const { property, room } = useParams();
  return <BookingFlow propertyCode={property} roomCode={room} />;
}
