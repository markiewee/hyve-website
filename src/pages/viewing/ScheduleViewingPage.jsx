import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";

const SOURCE_OPTIONS = [
  "Roomies",
  "Carousell",
  "Airbnb",
  "Facebook",
  "Friend/Referral",
  "Google",
  "Other",
];

const HERO_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDFW2cVbsvrWWJOpM1oY_6y4QSF9AdTVA2mQjykHHfqm_7FyWVzVhBNcD29yz_HahiJNmRhT26vtpfe8yEEkfbhqLXoqEW05w7gClciP9c7KUxCvqonJ2cNaPwEugPz5cdNdm_BJ9fwixiXi3W16mMOR8bhFb7xg8oqHCi8CjzQbtVRzDOkohGUoe7QUGecIFqzSoI_CmkO5nbaVojyCHLkU2K0XLrroP_bPuhlJHSilwsNJKLB6YJTlHehvGRrEwRVHtxfPfrJ88E";

// Evening slots on Saturdays: 5pm–8pm, 30-min intervals
const TIME_SLOTS = ["17:00", "17:30", "18:00", "18:30", "19:00", "19:30"];

function formatTime(t) {
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour;
  return `${display}:${m} ${suffix}`;
}

function getNextSaturdays(count = 4) {
  const saturdays = [];
  const today = new Date();
  const d = new Date(today);
  // Find next Saturday
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  for (let i = 0; i < count; i++) {
    saturdays.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return saturdays;
}

function formatDateShort(date) {
  return date.toLocaleDateString("en-SG", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatDateISO(date) {
  return date.toISOString().split("T")[0];
}

function generateToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) =>
    b.toString(36)
  )
    .join("")
    .slice(0, 8);
}

async function fetchProperty(slug) {
  const { data: byCode } = await supabase
    .from("properties")
    .select("*")
    .eq("code", slug.toUpperCase())
    .single();
  if (byCode) return byCode;

  const { data: byName } = await supabase
    .from("properties")
    .select("*")
    .ilike("name", `%${slug.replace(/-/g, " ")}%`)
    .single();
  return byName || null;
}

async function fetchRoom(slug) {
  const { data } = await supabase
    .from("rooms")
    .select("*")
    .eq("unit_code", slug)
    .single();
  return data || null;
}

export default function ScheduleViewingPage() {
  const { propertySlug, roomSlug } = useParams();

  // Data
  const [property, setProperty] = useState(null);
  const [room, setRoom] = useState(null);
  const [allRooms, setAllRooms] = useState([]);
  const [existingViewings, setExistingViewings] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState(null);

  // Form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null); // { date: "YYYY-MM-DD", time: "HH:MM" }
  const [moveInDate, setMoveInDate] = useState("");
  const [source, setSource] = useState("Roomies");
  const [specialNotes, setSpecialNotes] = useState("");

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [confirmedViewing, setConfirmedViewing] = useState(null);

  const saturdays = getNextSaturdays(4);

  useEffect(() => {
    async function load() {
      setPageLoading(true);
      setPageError(null);
      try {
        const prop = await fetchProperty(propertySlug);
        if (!prop) {
          setPageError("Property not found.");
          setPageLoading(false);
          return;
        }
        setProperty(prop);

        const [{ data: rooms }, { data: viewings }] = await Promise.all([
          supabase
            .from("rooms")
            .select("id, name, unit_code")
            .eq("property_id", prop.id)
            .order("unit_code"),
          supabase
            .from("property_viewings")
            .select("viewing_date, viewing_time")
            .eq("property_id", prop.id)
            .in("status", ["CONFIRMED", "POLLING", "SCHEDULED"]),
        ]);
        setAllRooms(rooms || []);
        setExistingViewings(viewings || []);

        if (roomSlug) {
          const rm = await fetchRoom(roomSlug);
          if (rm) {
            setRoom(rm);
            setSelectedRoomId(rm.id);
          }
        }
      } catch (err) {
        console.error("Error loading schedule page:", err);
        setPageError("Something went wrong loading this page.");
      }
      setPageLoading(false);
    }
    load();
  }, [propertySlug, roomSlug]);

  function isSlotTaken(dateStr, time) {
    return existingViewings.some(
      (v) => v.viewing_date === dateStr && v.viewing_time === time
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedSlot) {
      setSubmitError("Please pick a viewing time slot.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);

    const token = generateToken();

    // Auto-assign captain
    let captainId = null;
    if (property?.id) {
      const { data: captains } = await supabase
        .from("tenant_profiles")
        .select("id")
        .eq("property_id", property.id)
        .eq("role", "HOUSE_CAPTAIN")
        .eq("is_active", true)
        .limit(1);
      if (captains?.length) captainId = captains[0].id;
    }

    const { data: viewing, error: insertError } = await supabase
      .from("property_viewings")
      .insert({
        token,
        prospect_name: fullName.trim(),
        prospect_email: email.trim(),
        prospect_whatsapp: `+65${whatsapp.replace(/\s/g, "")}`,
        property_id: property.id,
        room_id: selectedRoomId || room?.id || null,
        viewing_date: selectedSlot.date,
        viewing_time: selectedSlot.time,
        viewing_type: "in_person",
        preferred_move_in: moveInDate || null,
        source: source.toLowerCase().replace(/\/.*/, ""),
        special_notes: specialNotes.trim() || null,
        status: "CONFIRMED",
        captain_id: captainId,
      })
      .select("*, properties(name, code, address), rooms(name, unit_code)")
      .single();

    if (insertError) {
      setSubmitError(insertError.message || "Failed to book. Please try again.");
      setSubmitting(false);
      return;
    }

    setConfirmedViewing(viewing);
    setSubmitting(false);
  }

  // --- Loading ---
  if (pageLoading) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#006b5f] border-t-transparent rounded-full animate-spin" />
          <span className="text-[#006b5f] font-['Plus_Jakarta_Sans'] font-bold text-sm tracking-wide">
            Loading...
          </span>
        </div>
      </div>
    );
  }

  // --- Error ---
  if (pageError) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] font-['Inter'] text-[#191c1e] flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-2xl editorial-shadow p-8 text-center">
          <span className="material-symbols-outlined text-5xl text-[#ba1a1a] mb-4 block">error_outline</span>
          <h1 className="font-['Plus_Jakarta_Sans'] text-xl font-bold mb-2">{pageError}</h1>
          <p className="text-[#3c4947] text-sm">Check the URL and try again, or contact us on WhatsApp.</p>
          <a href="https://wa.me/6580885410" className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-[#006b5f] text-white rounded-lg font-['Plus_Jakarta_Sans'] font-bold text-sm">
            <span className="material-symbols-outlined text-sm">chat</span>
            Contact Us
          </a>
        </div>
      </div>
    );
  }

  // --- Confirmed ---
  if (confirmedViewing) {
    const viewingDate = new Date(confirmedViewing.viewing_date + "T00:00:00");
    const dateDisplay = viewingDate.toLocaleDateString("en-SG", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    return (
      <div className="min-h-screen bg-[#f8f9ff] font-['Inter'] text-[#191c1e] flex flex-col items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-lg bg-white rounded-2xl editorial-shadow overflow-hidden">
          <div className="bg-[#006b5f] p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
            </div>
            <h2 className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-white mb-1 tracking-tight">
              Viewing Confirmed!
            </h2>
            <p className="text-white/80 text-sm">We'll see you there.</p>
          </div>

          <div className="p-8 space-y-6">
            <div className="flex items-start gap-4">
              <span className="material-symbols-outlined text-[#006b5f] mt-0.5">calendar_month</span>
              <div>
                <p className="font-bold text-[#191c1e]">{dateDisplay}</p>
                <p className="text-[#3c4947] text-sm">{formatTime(confirmedViewing.viewing_time)}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <span className="material-symbols-outlined text-[#006b5f] mt-0.5">location_on</span>
              <div>
                <p className="font-bold text-[#191c1e]">{confirmedViewing.properties?.name}</p>
                <p className="text-[#3c4947] text-sm">{confirmedViewing.properties?.address}</p>
              </div>
            </div>

            {confirmedViewing.rooms && (
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined text-[#006b5f] mt-0.5">bed</span>
                <div>
                  <p className="font-bold text-[#191c1e]">{confirmedViewing.rooms.name || confirmedViewing.rooms.unit_code}</p>
                </div>
              </div>
            )}

            <div className="bg-[#f2f4f6] rounded-xl p-4 text-sm text-[#3c4947]">
              <p className="font-bold text-[#191c1e] mb-1">What's next?</p>
              <p>We'll send you the access details on WhatsApp before the viewing. Just head to the address at the scheduled time.</p>
            </div>

            <a
              href={`https://wa.me/6580885410?text=${encodeURIComponent(`Hi, I've booked a viewing at ${confirmedViewing.properties?.name} on ${dateDisplay} at ${formatTime(confirmedViewing.viewing_time)}. My name is ${confirmedViewing.prospect_name}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 bg-[#006b5f] text-white font-['Plus_Jakarta_Sans'] font-bold text-sm tracking-wide rounded-lg hover:bg-[#006b5f]/90 active:scale-[0.98] transition-all editorial-shadow flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">chat</span>
              Message Us on WhatsApp
            </a>
          </div>
        </div>

        <footer className="mt-12 opacity-40 hover:opacity-100 transition-opacity flex flex-col items-center gap-2">
          <span className="text-teal-700 font-['Plus_Jakarta_Sans'] font-black text-lg">Hyve</span>
          <div className="flex gap-4 text-xs font-medium text-slate-500">
            <a href="/">About</a>
            <a href="/properties">Properties</a>
            <a href="https://wa.me/6580885410">Support</a>
          </div>
        </footer>
      </div>
    );
  }

  // --- Form ---
  const propertyName = property?.name || "Property";

  return (
    <div className="min-h-screen bg-[#f8f9ff] font-['Inter'] text-[#191c1e]">
      <header className="bg-white shadow-sm flex justify-between items-center px-6 py-3 w-full border-b border-slate-100 sticky top-0 z-50">
        <span className="text-xl font-bold tracking-tighter text-teal-700 font-['Plus_Jakarta_Sans']">Hyve</span>
        <a href="https://wa.me/6580885410" className="material-symbols-outlined text-slate-500 cursor-pointer hover:bg-slate-50 p-2 rounded-full transition-colors">
          help_outline
        </a>
      </header>

      <main className="flex flex-col items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-lg bg-white rounded-2xl editorial-shadow overflow-hidden">
          {/* Hero */}
          <div className="relative aspect-[16/9] w-full">
            <img alt={`${propertyName} interior`} className="w-full h-full object-cover" src={property?.image_url || HERO_IMAGE} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
              <div>
                <span className="inline-block px-3 py-1 mb-2 bg-[#14b8a6] text-[#00423b] text-[10px] font-bold uppercase tracking-wider rounded-full">
                  Viewings on Saturdays
                </span>
                <h1 className="text-white font-['Plus_Jakarta_Sans'] text-2xl font-extrabold tracking-tight">{propertyName}</h1>
                {property?.address && (
                  <p className="text-white/80 text-sm flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">location_on</span>
                    {property.address}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="p-8">
            <div className="mb-8">
              <div className="w-10 h-1 bg-[#14b8a6] mb-4" />
              <h2 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#191c1e] mb-2 tracking-tight">
                Book a Viewing
              </h2>
              <p className="text-[#3c4947] text-sm leading-relaxed">
                Pick a Saturday evening slot and we'll confirm it instantly.
              </p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Name / Email / Phone */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-[#3c4947] mb-1.5 ml-1">Full Name</label>
                  <input className="w-full px-4 py-3 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#14b8a6] transition-all text-sm placeholder:text-[#bbcac6]" placeholder="Sarah Tan" type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[#3c4947] mb-1.5 ml-1">Email</label>
                    <input className="w-full px-4 py-3 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#14b8a6] transition-all text-sm placeholder:text-[#bbcac6]" placeholder="sarah@example.com" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[#3c4947] mb-1.5 ml-1">WhatsApp</label>
                    <div className="flex gap-2">
                      <span className="flex items-center justify-center px-3 bg-[#eceef0] rounded-lg text-sm text-[#3c4947] font-medium">+65</span>
                      <input className="w-full px-4 py-3 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#14b8a6] transition-all text-sm placeholder:text-[#bbcac6]" placeholder="8123 4567" type="tel" required value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Room Selector */}
              {allRooms.length > 0 && (
                <div className="pt-4 border-t border-[#e6e8ea]">
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-[#3c4947] mb-1.5 ml-1">Room</label>
                  <select className="w-full px-4 py-3 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#14b8a6] transition-all text-sm text-[#3c4947]" value={selectedRoomId} onChange={(e) => setSelectedRoomId(e.target.value)}>
                    <option value="">Any room — show me what's available</option>
                    {allRooms.map((r) => (
                      <option key={r.id} value={r.id}>{r.name || r.unit_code}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Saturday Time Slots */}
              <div className="pt-4 border-t border-[#e6e8ea]">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-[#3c4947] mb-3 ml-1">
                  Pick a Saturday evening
                </label>
                <div className="space-y-4">
                  {saturdays.map((sat) => {
                    const dateStr = formatDateISO(sat);
                    const hasAvailable = TIME_SLOTS.some((t) => !isSlotTaken(dateStr, t));

                    return (
                      <div key={dateStr}>
                        <p className="text-sm font-bold text-[#191c1e] mb-2">{formatDateShort(sat)}</p>
                        {!hasAvailable ? (
                          <p className="text-xs text-[#bbcac6] italic">Fully booked</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {TIME_SLOTS.map((time) => {
                              const taken = isSlotTaken(dateStr, time);
                              const isSelected = selectedSlot?.date === dateStr && selectedSlot?.time === time;
                              return (
                                <button
                                  key={time}
                                  type="button"
                                  disabled={taken}
                                  onClick={() => setSelectedSlot({ date: dateStr, time })}
                                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    taken
                                      ? "bg-[#e6e8ea] text-[#bbcac6] cursor-not-allowed line-through"
                                      : isSelected
                                      ? "bg-[#006b5f] text-white shadow-md scale-105"
                                      : "bg-[#e6e8ea] text-[#3c4947] hover:bg-[#14b8a6]/20 hover:text-[#00423b]"
                                  }`}
                                >
                                  {formatTime(time)}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Move-in + Source */}
              <div className="pt-4 border-t border-[#e6e8ea]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[#3c4947] mb-1.5 ml-1">Preferred Move-in</label>
                    <input className="w-full px-4 py-3 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#14b8a6] transition-all text-sm text-[#3c4947]" type="date" value={moveInDate} onChange={(e) => setMoveInDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[#3c4947] mb-1.5 ml-1">How did you find us?</label>
                    <select className="w-full px-4 py-3 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#14b8a6] transition-all text-sm text-[#3c4947]" value={source} onChange={(e) => setSource(e.target.value)}>
                      {SOURCE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-[#3c4947] mb-1.5 ml-1">Anything else? (optional)</label>
                  <textarea className="w-full px-4 py-3 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#14b8a6] transition-all text-sm placeholder:text-[#bbcac6] resize-none" placeholder="e.g. I have a pet, I need parking..." rows={2} value={specialNotes} onChange={(e) => setSpecialNotes(e.target.value)} />
                </div>
              </div>

              {/* Error */}
              {submitError && (
                <div className="flex items-center gap-2 p-3 bg-[#ffdad6] rounded-lg">
                  <span className="material-symbols-outlined text-[#93000a] text-sm">error</span>
                  <p className="text-sm text-[#93000a] font-medium">{submitError}</p>
                </div>
              )}

              {/* CTA */}
              <button
                className="w-full py-4 bg-[#006b5f] text-white font-['Plus_Jakarta_Sans'] font-bold text-sm tracking-wide rounded-lg hover:bg-[#006b5f]/90 active:scale-[0.98] transition-all editorial-shadow flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                type="submit"
                disabled={submitting || !selectedSlot}
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Booking...
                  </>
                ) : selectedSlot ? (
                  <>
                    Confirm Viewing — {formatDateShort(new Date(selectedSlot.date + "T00:00:00"))}, {formatTime(selectedSlot.time)}
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
                <a className="underline hover:text-[#006b5f]" href="/terms-of-service">Terms of Service</a>{" "}and{" "}
                <a className="underline hover:text-[#006b5f]" href="/privacy-policy">Privacy Policy</a>.
              </p>
            </form>
          </div>
        </div>

        <footer className="mt-12 opacity-40 hover:opacity-100 transition-opacity flex flex-col items-center gap-2">
          <span className="text-teal-700 font-['Plus_Jakarta_Sans'] font-black text-lg">Hyve</span>
          <div className="flex gap-4 text-xs font-medium text-slate-500">
            <a href="/">About</a>
            <a href="/properties">Properties</a>
            <a href="https://wa.me/6580885410">Support</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
