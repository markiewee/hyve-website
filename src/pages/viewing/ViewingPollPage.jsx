import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useViewingPoll } from "../../hooks/useViewingPoll";
import AvailabilityGrid from "../../components/viewing/AvailabilityGrid";

const DOOR_CODES = {
  IH: "808855",
  TG: "808856",
  CP: "112233#",
};

const PROPERTY_IMAGES = {
  "Thomson Grove": "/properties/thomson-grove.jpg",
  "Ivory Heights": "/properties/ivory-heights.jpg",
  "Chiltern Park": "/properties/chiltern-park.jpg",
};

function getDoorCode(propertyName) {
  if (!propertyName) return null;
  for (const [prefix, code] of Object.entries(DOOR_CODES)) {
    if (propertyName.includes(prefix === "CP" ? "Chiltern" : prefix === "IH" ? "Ivory" : "Thomson")) {
      return code;
    }
  }
  return null;
}

function getPropertyImage(propertyName) {
  if (!propertyName) return null;
  for (const [key, src] of Object.entries(PROPERTY_IMAGES)) {
    if (propertyName.includes(key.split(" ")[0])) return src;
  }
  return null;
}

/** Build a Google Calendar "Add Event" URL */
function buildCalendarLink(date, propertyName, address, viewingType) {
  const start = new Date(date);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const fmt = (d) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const title = encodeURIComponent(
    `Hyve Viewing — ${propertyName || "Property"}`
  );
  const details = encodeURIComponent(
    `${viewingType === "virtual" ? "Virtual tour" : "In-person viewing"} at ${propertyName || "Hyve"}.`
  );
  const location = encodeURIComponent(address || "");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}&location=${location}`;
}

// ---------------------------------------------------------------------------
// Sub-components for each state
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#f8f9ff] antialiased">
      {/* Header skeleton */}
      <header className="bg-white shadow-sm flex justify-between items-center px-6 py-3 w-full border-b border-slate-100 sticky top-0 z-50">
        <div className="w-12 h-5 bg-slate-200 rounded animate-pulse" />
        <div className="flex gap-4">
          <div className="w-6 h-6 bg-slate-200 rounded-full animate-pulse" />
          <div className="w-6 h-6 bg-slate-200 rounded-full animate-pulse" />
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 pt-8 pb-32 space-y-8">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
          <div className="w-32 h-3 bg-slate-200 rounded animate-pulse mb-4" />
          <div className="w-3/4 h-8 bg-slate-200 rounded animate-pulse mb-3" />
          <div className="w-1/2 h-4 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="w-40 h-5 bg-slate-200 rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="grid grid-cols-8 gap-3">
                <div className="h-4 bg-slate-100 rounded animate-pulse" />
                {[...Array(7)].map((__, j) => (
                  <div
                    key={j}
                    className="h-10 bg-slate-100 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function InvalidState() {
  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6 antialiased">
      <div className="text-center max-w-md">
        <span className="text-5xl mb-6 block">🔗</span>
        <h1
          className="text-2xl font-extrabold text-[#191c1e] mb-3"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          This viewing link is invalid
        </h1>
        <p
          className="text-[#3c4947] text-sm mb-8"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          The link you followed doesn't match any active viewing. It may have
          been revoked or the URL is incorrect.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="mailto:hello@hyve.sg"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#006b5f] text-white rounded-xl text-sm font-bold hover:scale-[1.02] active:scale-95 transition-all"
          >
            <span
              className="material-symbols-outlined text-sm"
              data-icon="mail"
            >
              mail
            </span>
            hello@hyve.sg
          </a>
          <a
            href="https://wa.me/6580885410"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 text-[#191c1e] rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
          >
            <span
              className="material-symbols-outlined text-sm"
              data-icon="chat"
            >
              chat
            </span>
            WhatsApp +65 8088 5410
          </a>
        </div>
      </div>
    </div>
  );
}

function ExpiredState() {
  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6 antialiased">
      <div className="text-center max-w-md">
        <span className="text-5xl mb-6 block">⏰</span>
        <h1
          className="text-2xl font-extrabold text-[#191c1e] mb-3"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          This viewing link has expired
        </h1>
        <p
          className="text-[#3c4947] text-sm mb-8"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          The scheduling window for this viewing has closed. Contact us to
          arrange a new one.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="mailto:hello@hyve.sg"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#006b5f] text-white rounded-xl text-sm font-bold hover:scale-[1.02] active:scale-95 transition-all"
          >
            <span
              className="material-symbols-outlined text-sm"
              data-icon="mail"
            >
              mail
            </span>
            hello@hyve.sg
          </a>
          <a
            href="https://wa.me/6580885410"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 text-[#191c1e] rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
          >
            <span
              className="material-symbols-outlined text-sm"
              data-icon="chat"
            >
              chat
            </span>
            WhatsApp +65 8088 5410
          </a>
        </div>
      </div>
    </div>
  );
}

function WaitingState() {
  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6 antialiased">
      <div className="text-center max-w-lg">
        <div className="w-16 h-16 rounded-full bg-[#006b5f]/10 flex items-center justify-center mx-auto mb-6">
          <span
            className="material-symbols-outlined text-[#006b5f] text-3xl"
            data-icon="schedule"
          >
            schedule
          </span>
        </div>
        <h1
          className="text-2xl font-extrabold text-[#191c1e] mb-3"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Thanks! We're on it.
        </h1>
        <p
          className="text-[#3c4947] text-sm leading-relaxed max-w-sm mx-auto"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          We're matching your schedule with the host. You'll get a confirmation
          via email and WhatsApp once everything is locked in.
        </p>
      </div>
    </div>
  );
}

function ConfirmationState({ matchedSlot, viewing, property }) {
  const propertyName = property?.name || "Hyve Property";
  const propertyAddress = viewing?.properties?.address || property?.address || "";
  const doorCode = getDoorCode(propertyName);
  const viewingType = viewing?.viewing_type || "in_person";

  const fmtDate = matchedSlot.toLocaleDateString("en-SG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const fmtTime = matchedSlot.toLocaleTimeString("en-SG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const calendarLink = buildCalendarLink(
    matchedSlot,
    propertyName,
    propertyAddress,
    viewingType
  );

  return (
    <div className="min-h-screen bg-[#f8f9ff] antialiased">
      {/* Header */}
      <header className="bg-white shadow-sm flex justify-between items-center px-6 py-3 w-full border-b border-slate-100 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span
            className="text-xl font-bold tracking-tighter text-teal-700 font-headline"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Hyve
          </span>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-12 pb-16">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-[#006b5f] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#006b5f]/20">
            <span
              className="material-symbols-outlined text-white text-4xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
              data-icon="check_circle"
            >
              check_circle
            </span>
          </div>
          <h1
            className="text-3xl font-extrabold text-[#191c1e] mb-2"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Viewing Confirmed
          </h1>
          <p className="text-[#3c4947] text-sm" style={{ fontFamily: "'Inter', sans-serif" }}>
            You're all set! Here are your viewing details.
          </p>
        </div>

        {/* Confirmation Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {/* Property header */}
          <div className="bg-[#006b5f] p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <span
                className="material-symbols-outlined text-[#71f8e4] text-lg"
                data-icon="location_on"
              >
                location_on
              </span>
              <div>
                <p className="font-bold text-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {propertyName}
                </p>
                {propertyAddress && (
                  <p className="text-sm text-white/80">{propertyAddress}</p>
                )}
              </div>
            </div>
            {/* Viewing type badge */}
            <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              <span
                className="material-symbols-outlined text-sm"
                data-icon={viewingType === "virtual" ? "videocam" : "person"}
              >
                {viewingType === "virtual" ? "videocam" : "person"}
              </span>
              {viewingType === "virtual" ? "Virtual Tour" : "In Person"}
            </span>
          </div>

          {/* Details */}
          <div className="p-6 space-y-5">
            {/* Date & Time */}
            <div className="flex items-start gap-4">
              <div className="bg-[#006b5f]/10 p-2.5 rounded-lg">
                <span
                  className="material-symbols-outlined text-[#006b5f]"
                  data-icon="calendar_today"
                >
                  calendar_today
                </span>
              </div>
              <div>
                <p className="text-xs font-bold text-[#6c7a77] uppercase tracking-widest mb-1">
                  Date & Time
                </p>
                <p
                  className="text-lg font-bold text-[#191c1e]"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {fmtDate}
                </p>
                <p className="text-[#006b5f] font-semibold">{fmtTime}</p>
              </div>
            </div>

            {/* Door Code */}
            {doorCode && (
              <div className="flex items-start gap-4">
                <div className="bg-[#006b5f]/10 p-2.5 rounded-lg">
                  <span
                    className="material-symbols-outlined text-[#006b5f]"
                    data-icon="key"
                  >
                    key
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#6c7a77] uppercase tracking-widest mb-1">
                    Door Code
                  </p>
                  <p
                    className="text-2xl font-black text-[#191c1e] tracking-widest"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    {doorCode}
                  </p>
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-slate-100" />

            {/* Add to Calendar */}
            <a
              href={calendarLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#006b5f] text-white font-bold rounded-xl shadow-lg shadow-[#006b5f]/20 hover:scale-[1.02] active:scale-95 transition-all text-sm"
            >
              <span
                className="material-symbols-outlined text-sm"
                data-icon="calendar_add_on"
              >
                calendar_add_on
              </span>
              Add to Calendar
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ViewingPollPage() {
  const { token } = useParams();
  const {
    poll,
    viewing,
    property,
    loading,
    submitted,
    matchedSlot,
    pollStatus,
    isExpired,
    submitAvailability,
  } = useViewingPoll(token, "prospect");

  const [selectedSlots, setSelectedSlots] = useState([]);
  const [viewingType, setViewingType] = useState("in_person");
  const [submitting, setSubmitting] = useState(false);
  const [justMatched, setJustMatched] = useState(null);

  const propertyName = property?.name || "Hyve Property";
  const propertyAddress =
    viewing?.properties?.address || property?.address || "";
  const propertyImage = getPropertyImage(propertyName);

  const startDate = useMemo(() => {
    if (poll?.poll_start) return new Date(poll.poll_start);
    // Fallback: tomorrow
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [poll?.poll_start]);

  async function handleSubmit() {
    if (selectedSlots.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const result = await submitAvailability(selectedSlots, viewingType);
      if (result.matched) {
        setJustMatched(result.slot);
      }
    } catch (err) {
      console.error("Failed to submit availability:", err);
    } finally {
      setSubmitting(false);
    }
  }

  // ------ State routing ------

  if (loading) return <LoadingSkeleton />;

  // Invalid / not found
  if (!poll) return <InvalidState />;

  // Expired
  if (isExpired || pollStatus === "expired") return <ExpiredState />;

  // Matched — either from hook or just submitted
  const confirmedSlot = justMatched || matchedSlot;
  if (confirmedSlot) {
    return (
      <ConfirmationState
        matchedSlot={confirmedSlot}
        viewing={viewing}
        property={property}
      />
    );
  }

  // Already submitted, waiting for match
  if (submitted) return <WaitingState />;

  // ------ Active poll interface ------
  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#191c1e] antialiased">
      {/* Top Nav Bar */}
      <header className="bg-white shadow-sm flex justify-between items-center px-6 py-3 w-full border-b border-slate-100 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span
            className="text-xl font-bold tracking-tighter text-teal-700 font-headline"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Hyve
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span
            className="material-symbols-outlined text-slate-500 cursor-pointer active:scale-95 duration-200"
            data-icon="notifications"
          >
            notifications
          </span>
          <span
            className="material-symbols-outlined text-slate-500 cursor-pointer active:scale-95 duration-200"
            data-icon="help_outline"
          >
            help_outline
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-8 pb-32">
        <div className="space-y-8">
          {/* Hero Editorial Section */}
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="flex-1 space-y-2">
                <span
                  className="text-xs font-bold tracking-widest text-[#006b5f] uppercase"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  Viewing Schedule
                </span>
                <h1
                  className="text-3xl font-extrabold tracking-tight text-[#191c1e] leading-tight"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  Pick times you're free for a viewing
                </h1>
                <div className="flex items-center gap-2 text-[#3c4947]">
                  <span
                    className="material-symbols-outlined text-sm"
                    data-icon="location_on"
                  >
                    location_on
                  </span>
                  <p className="text-sm font-medium">
                    {propertyName}
                    {propertyAddress ? `, ${propertyAddress}` : ""}
                  </p>
                </div>
              </div>
              {propertyImage && (
                <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 shadow-md">
                  <img
                    alt={propertyName}
                    className="w-full h-full object-cover"
                    src={propertyImage}
                  />
                </div>
              )}
            </div>

            {/* Mode Toggle */}
            <div className="mt-8 flex p-1.5 bg-[#eceef0] rounded-xl w-full max-w-sm mx-auto md:mx-0">
              <button
                onClick={() => setViewingType("in_person")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${
                  viewingType === "in_person"
                    ? "bg-white shadow-sm text-[#006b5f]"
                    : "text-[#3c4947] hover:text-[#191c1e]"
                }`}
              >
                <span
                  className="material-symbols-outlined text-lg"
                  data-icon="person"
                >
                  person
                </span>
                In Person
              </button>
              <button
                onClick={() => setViewingType("virtual")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${
                  viewingType === "virtual"
                    ? "bg-white shadow-sm text-[#006b5f]"
                    : "text-[#3c4947] hover:text-[#191c1e]"
                }`}
              >
                <span
                  className="material-symbols-outlined text-lg"
                  data-icon="videocam"
                >
                  videocam
                </span>
                Virtual Tour
              </button>
            </div>
          </div>

          {/* Availability Grid Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-[#eceef0]">
              <h2
                className="text-lg font-bold text-[#191c1e] flex items-center gap-2"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                <span className="w-1 h-5 bg-[#14b8a6] rounded-full" />
                Availability Grid
              </h2>
              <p
                className="text-sm text-[#3c4947] mt-1"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                Select all slots that work for your schedule.
              </p>
            </div>
            <div className="p-6">
              <AvailabilityGrid
                startDate={startDate}
                days={7}
                selectedSlots={selectedSlots}
                onSlotsChange={setSelectedSlots}
              />
            </div>
          </div>

          {/* Scheduling Note */}
          <div className="bg-[#f2f4f6] rounded-2xl p-6 border border-white/50">
            <div className="flex items-start gap-4">
              <div className="bg-[#14b8a6]/20 p-2 rounded-lg text-[#006b5f]">
                <span
                  className="material-symbols-outlined"
                  data-icon="info"
                >
                  info
                </span>
              </div>
              <div>
                <h4
                  className="font-bold text-[#191c1e]"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  Scheduling Note
                </h4>
                <p
                  className="text-sm text-[#3c4947] mt-1 leading-relaxed"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  Once you submit, we'll match your availability with our house
                  host. You'll receive a confirmation via email and WhatsApp once
                  the viewing is officially scheduled.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky Bottom Bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 md:p-6 shadow-[0_-8px_30px_rgb(0,0,0,0.04)] z-50">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#006b5f]/10 flex items-center justify-center text-[#006b5f]">
              <span className="font-bold text-sm">{selectedSlots.length}</span>
            </div>
            <div>
              <p
                className="text-sm font-bold text-[#191c1e]"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {selectedSlots.length} slot{selectedSlots.length !== 1 ? "s" : ""}{" "}
                selected
              </p>
              <p
                className="text-[10px] uppercase tracking-wider font-bold text-[#bbcac6]"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                Minimum 3 recommended
              </p>
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={selectedSlots.length === 0 || submitting}
            className="bg-[#006b5f] text-white font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-[#006b5f]/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                Submit
                <span
                  className="material-symbols-outlined text-sm"
                  data-icon="arrow_forward"
                >
                  arrow_forward
                </span>
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
