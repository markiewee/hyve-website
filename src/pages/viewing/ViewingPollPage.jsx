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
    `Lazybee Viewing — ${propertyName || "Property"}`
  );
  const details = encodeURIComponent(
    `${viewingType === "virtual" ? "Virtual tour" : "In-person viewing"} at ${propertyName || "Lazybee"}.`
  );
  const location = encodeURIComponent(address || "");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}&location=${location}`;
}

// ---------------------------------------------------------------------------
// Sub-components for each state
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background antialiased">
      {/* Header skeleton */}
      <header className="bg-surface flex justify-between items-center px-6 py-3 w-full border-b border-border sticky top-0 z-50">
        <div className="w-12 h-5 bg-white/5 rounded animate-pulse" />
        <div className="flex gap-4">
          <div className="w-6 h-6 bg-white/5 rounded-full animate-pulse" />
          <div className="w-6 h-6 bg-white/5 rounded-full animate-pulse" />
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 pt-8 pb-32 space-y-8">
        <div className="bg-surface rounded-2xl p-8 border border-border">
          <div className="w-32 h-3 bg-white/5 rounded animate-pulse mb-4" />
          <div className="w-3/4 h-8 bg-white/5 rounded animate-pulse mb-3" />
          <div className="w-1/2 h-4 bg-white/5 rounded animate-pulse" />
        </div>
        <div className="bg-surface rounded-2xl p-6 border border-border">
          <div className="w-40 h-5 bg-white/5 rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="grid grid-cols-8 gap-3">
                <div className="h-4 bg-white/5 rounded animate-pulse" />
                {[...Array(7)].map((__, j) => (
                  <div
                    key={j}
                    className="h-10 bg-white/5 rounded-lg animate-pulse"
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
    <div className="min-h-screen bg-background flex items-center justify-center p-6 antialiased">
      <div className="text-center max-w-md">
        <span className="text-5xl mb-6 block">🔗</span>
        <h1
          className="text-2xl font-extrabold text-foreground mb-3"
          style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
        >
          This viewing link is invalid
        </h1>
        <p
          className="text-foreground-variant text-sm mb-8"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          The link you followed doesn't match any active viewing. It may have
          been revoked or the URL is incorrect.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="mailto:admin@lazybee.sg"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-accent text-white rounded-xl text-sm font-bold hover:scale-[1.02] active:scale-95 transition-all"
          >
            <span
              className="material-symbols-outlined text-sm"
              data-icon="mail"
            >
              mail
            </span>
            admin@lazybee.sg
          </a>
          <a
            href="https://wa.me/6580695410"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-surface border border-border text-foreground rounded-xl text-sm font-bold hover:bg-white/5 transition-all"
          >
            <span
              className="material-symbols-outlined text-sm"
              data-icon="chat"
            >
              chat
            </span>
            WhatsApp +65 8069 5410
          </a>
        </div>
      </div>
    </div>
  );
}

function ExpiredState() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 antialiased">
      <div className="text-center max-w-md">
        <span className="text-5xl mb-6 block">⏰</span>
        <h1
          className="text-2xl font-extrabold text-foreground mb-3"
          style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
        >
          This viewing link has expired
        </h1>
        <p
          className="text-foreground-variant text-sm mb-8"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          The scheduling window for this viewing has closed. Contact us to
          arrange a new one.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="mailto:admin@lazybee.sg"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-accent text-white rounded-xl text-sm font-bold hover:scale-[1.02] active:scale-95 transition-all"
          >
            <span
              className="material-symbols-outlined text-sm"
              data-icon="mail"
            >
              mail
            </span>
            admin@lazybee.sg
          </a>
          <a
            href="https://wa.me/6580695410"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-surface border border-border text-foreground rounded-xl text-sm font-bold hover:bg-white/5 transition-all"
          >
            <span
              className="material-symbols-outlined text-sm"
              data-icon="chat"
            >
              chat
            </span>
            WhatsApp +65 8069 5410
          </a>
        </div>
      </div>
    </div>
  );
}

function WaitingState() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 antialiased">
      <div className="text-center max-w-lg">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
          <span
            className="material-symbols-outlined text-accent text-3xl"
            data-icon="schedule"
          >
            schedule
          </span>
        </div>
        <h1
          className="text-2xl font-extrabold text-foreground mb-3"
          style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
        >
          Thanks! We're on it.
        </h1>
        <p
          className="text-foreground-variant text-sm leading-relaxed max-w-sm mx-auto"
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
  const propertyName = property?.name || "Lazybee Property";
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
    <div className="min-h-screen bg-background antialiased">
      {/* Header */}
      <header className="bg-surface flex justify-between items-center px-6 py-3 w-full border-b border-border sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span
            className="text-xl font-bold tracking-tighter text-accent font-headline"
            style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
          >
            Lazybee
          </span>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-12 pb-16">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center mx-auto mb-6">
            <span
              className="material-symbols-outlined text-white text-4xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
              data-icon="check_circle"
            >
              check_circle
            </span>
          </div>
          <h1
            className="text-3xl font-extrabold text-foreground mb-2"
            style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
          >
            Viewing Confirmed
          </h1>
          <p className="text-foreground-variant text-sm" style={{ fontFamily: "'Inter', sans-serif" }}>
            You're all set! Here are your viewing details.
          </p>
        </div>

        {/* Confirmation Card */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          {/* Property header */}
          <div className="bg-accent p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <span
                className="material-symbols-outlined text-white/70 text-lg"
                data-icon="location_on"
              >
                location_on
              </span>
              <div>
                <p className="font-bold text-lg" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
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
              <div className="bg-accent/10 p-2.5 rounded-lg">
                <span
                  className="material-symbols-outlined text-accent"
                  data-icon="calendar_today"
                >
                  calendar_today
                </span>
              </div>
              <div>
                <p className="text-xs font-bold text-foreground-variant uppercase tracking-widest mb-1">
                  Date & Time
                </p>
                <p
                  className="text-lg font-bold text-foreground"
                  style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
                >
                  {fmtDate}
                </p>
                <p className="text-accent font-semibold">{fmtTime}</p>
              </div>
            </div>

            {/* Door Code */}
            {doorCode && (
              <div className="flex items-start gap-4">
                <div className="bg-accent/10 p-2.5 rounded-lg">
                  <span
                    className="material-symbols-outlined text-accent"
                    data-icon="key"
                  >
                    key
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground-variant uppercase tracking-widest mb-1">
                    Door Code
                  </p>
                  <p
                    className="text-2xl font-black text-foreground tracking-widest"
                    style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
                  >
                    {doorCode}
                  </p>
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Add to Calendar */}
            <a
              href={calendarLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-accent text-white font-bold rounded-xl hover:scale-[1.02] active:scale-95 transition-all text-sm"
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

  const propertyName = property?.name || "Lazybee Property";
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
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* Top Nav Bar */}
      <header className="bg-surface flex justify-between items-center px-6 py-3 w-full border-b border-border sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span
            className="text-xl font-bold tracking-tighter text-accent font-headline"
            style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
          >
            Lazybee
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span
            className="material-symbols-outlined text-foreground-variant cursor-pointer active:scale-95 duration-200"
            data-icon="notifications"
          >
            notifications
          </span>
          <span
            className="material-symbols-outlined text-foreground-variant cursor-pointer active:scale-95 duration-200"
            data-icon="help_outline"
          >
            help_outline
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-8 pb-32">
        <div className="space-y-8">
          {/* Hero Editorial Section */}
          <div className="bg-surface rounded-2xl p-8 border border-border">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="flex-1 space-y-2">
                <span
                  className="text-xs font-bold tracking-widest text-accent uppercase"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  Viewing Schedule
                </span>
                <h1
                  className="text-3xl font-extrabold tracking-tight text-foreground leading-tight"
                  style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
                >
                  Pick times you're free for a viewing
                </h1>
                <div className="flex items-center gap-2 text-foreground-variant">
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
                <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 border border-border">
                  <img
                    alt={propertyName}
                    className="w-full h-full object-cover"
                    src={propertyImage}
                  />
                </div>
              )}
            </div>

            {/* Mode Toggle */}
            <div className="mt-8 flex p-1.5 bg-surface-container rounded-xl w-full max-w-sm mx-auto md:mx-0">
              <button
                onClick={() => setViewingType("in_person")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${
                  viewingType === "in_person"
                    ? "bg-accent text-white"
                    : "text-foreground-variant hover:text-foreground"
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
                    ? "bg-accent text-white"
                    : "text-foreground-variant hover:text-foreground"
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
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="p-6 border-b border-border">
              <h2
                className="text-lg font-bold text-foreground flex items-center gap-2"
                style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
              >
                <span className="w-1 h-5 bg-accent rounded-full" />
                Availability Grid
              </h2>
              <p
                className="text-sm text-foreground-variant mt-1"
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
          <div className="bg-surface-container rounded-2xl p-6 border border-border">
            <div className="flex items-start gap-4">
              <div className="bg-accent/15 p-2 rounded-lg text-accent">
                <span
                  className="material-symbols-outlined"
                  data-icon="info"
                >
                  info
                </span>
              </div>
              <div>
                <h4
                  className="font-bold text-foreground"
                  style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
                >
                  Scheduling Note
                </h4>
                <p
                  className="text-sm text-foreground-variant mt-1 leading-relaxed"
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
      <footer className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border p-4 md:p-6 z-50">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
              <span className="font-bold text-sm">{selectedSlots.length}</span>
            </div>
            <div>
              <p
                className="text-sm font-bold text-foreground"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {selectedSlots.length} slot{selectedSlots.length !== 1 ? "s" : ""}{" "}
                selected
              </p>
              <p
                className="text-[10px] uppercase tracking-wider font-bold text-foreground-variant"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                Minimum 3 recommended
              </p>
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={selectedSlots.length === 0 || submitting}
            className="bg-accent text-white font-bold px-8 py-3.5 rounded-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100"
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
