import { useState, useMemo, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useViewings } from "../../hooks/useViewings";
import { useViewingPoll } from "../../hooks/useViewingPoll";
import AvailabilityGrid from "../../components/viewing/AvailabilityGrid";
import PortalLayout from "../../components/portal/PortalLayout";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name) {
  if (!name) return "??";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function relativeTime(dateStr) {
  if (!dateStr) return "";
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return then.toLocaleDateString("en-SG", { day: "numeric", month: "short" });
}

function relativeUpcoming(dateStr) {
  if (!dateStr) return "";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diffDay = Math.round((target - now) / 86400000);

  if (diffDay === 0) return "Today";
  if (diffDay === 1) return "Tomorrow";
  if (diffDay < 0) return `${Math.abs(diffDay)}d ago`;
  return `In ${diffDay} days`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-SG", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h12}:${m} ${period}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InitialsAvatar({ name, size = "w-14 h-14 text-lg" }) {
  return (
    <div
      className={`${size} rounded-full bg-[#d9e3f6] flex items-center justify-center text-[#006b5f] font-bold shrink-0`}
    >
      {getInitials(name)}
    </div>
  );
}

function ViewingTypeBadge({ type }) {
  const isVirtual =
    type === "virtual" || type === "VIRTUAL" || type === "Virtual Tour";

  if (isVirtual) {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-[#006b5f]">
        <span className="material-symbols-outlined text-sm">video_chat</span>
        Virtual
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-sm text-[#006b5f]">
      <span className="material-symbols-outlined text-sm">person</span>
      In-Person
    </span>
  );
}

function StatusPill({ status }) {
  const config = {
    REQUESTED: {
      label: "Waiting for you",
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
    },
    POLLING: {
      label: "Waiting for you",
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
    },
    CONFIRMED: {
      label: "Confirmed",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
    },
    COMPLETED: {
      label: "Completed",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
    },
    CANCELLED: {
      label: "Cancelled",
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
    },
  };

  const c = config[status] ?? config.REQUESTED;
  return (
    <span
      className={`${c.bg} ${c.text} border ${c.border} px-2.5 py-0.5 rounded-full text-xs font-bold tracking-tight`}
    >
      {c.label}
    </span>
  );
}

function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-[slideUp_0.3s_ease-out]">
      <div className="bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3">
        <span className="material-symbols-outlined text-[20px]">
          check_circle
        </span>
        <span className="font-['Manrope'] font-semibold text-sm">
          {message}
        </span>
        <button onClick={onClose} className="ml-2 hover:opacity-70">
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline Availability Grid wrapper — uses useViewingPoll per card
// ---------------------------------------------------------------------------

function AvailabilitySection({ viewing, onConfirmed }) {
  const poll = viewing.viewing_polls?.[0];
  const captainToken = poll?.captain_token;

  const {
    poll: pollData,
    loading: pollLoading,
    submitted,
    matchedSlot,
    submitAvailability,
  } = useViewingPoll(captainToken, "captain");

  const [selectedSlots, setSelectedSlots] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const startDate = useMemo(() => {
    if (pollData?.poll_start) return new Date(pollData.poll_start);
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d;
  }, [pollData]);

  const days = useMemo(() => {
    if (pollData?.poll_start && pollData?.poll_end) {
      const s = new Date(pollData.poll_start);
      const e = new Date(pollData.poll_end);
      return Math.max(
        7,
        Math.ceil((e - s) / 86400000) + 1
      );
    }
    return 7;
  }, [pollData]);

  async function handleSubmit() {
    if (selectedSlots.length === 0) return;
    setSubmitting(true);
    try {
      const result = await submitAvailability(selectedSlots);
      if (result.matched) {
        onConfirmed?.();
      }
    } catch (err) {
      console.error("Error submitting availability:", err);
    } finally {
      setSubmitting(false);
    }
  }

  if (pollLoading) {
    return (
      <div className="mt-4 h-32 bg-gray-50 animate-pulse rounded-2xl" />
    );
  }

  if (submitted && !matchedSlot) {
    return (
      <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3">
        <span className="material-symbols-outlined text-emerald-600 text-[24px]">
          schedule_send
        </span>
        <div>
          <p className="font-['Manrope'] font-bold text-emerald-800 text-sm">
            Availability submitted
          </p>
          <p className="font-['Manrope'] text-emerald-700 text-xs">
            Waiting for the prospect to respond. We'll notify you when a match
            is found.
          </p>
        </div>
      </div>
    );
  }

  if (matchedSlot) {
    return (
      <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3">
        <span className="material-symbols-outlined text-emerald-600 text-[24px]">
          event_available
        </span>
        <div>
          <p className="font-['Manrope'] font-bold text-emerald-800 text-sm">
            Viewing confirmed!
          </p>
          <p className="font-['Manrope'] text-emerald-700 text-xs">
            {matchedSlot.toLocaleDateString("en-SG", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}{" "}
            at{" "}
            {matchedSlot.toLocaleTimeString("en-SG", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <AvailabilityGrid
        startDate={startDate}
        days={days}
        selectedSlots={selectedSlots}
        onSlotsChange={setSelectedSlots}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#6c7a77] font-['Manrope']">
          {selectedSlots.length} slot{selectedSlots.length !== 1 ? "s" : ""}{" "}
          selected
        </p>
        <button
          onClick={handleSubmit}
          disabled={selectedSlots.length === 0 || submitting}
          className="bg-[#006b5f] text-white px-5 py-2.5 rounded-xl font-['Manrope'] font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-all flex items-center gap-2"
        >
          {submitting ? (
            <>
              <span className="material-symbols-outlined text-[16px] animate-spin">
                progress_activity
              </span>
              Submitting...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[16px]">
                send
              </span>
              Submit Availability
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card components for each tab
// ---------------------------------------------------------------------------

function IncomingCard({ viewing, onConfirmed }) {
  const [expanded, setExpanded] = useState(false);
  const poll = viewing.viewing_polls?.[0];

  return (
    <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-6 flex flex-col md:flex-row gap-5 items-start md:items-center">
        <InitialsAvatar name={viewing.prospect_name} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h3 className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#121c2a]">
              {viewing.prospect_name}
            </h3>
            <StatusPill status={viewing.status} />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#6c7a77]">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">bed</span>
              {viewing.rooms?.unit_code ?? viewing.rooms?.name ?? "Room"}
            </span>
            <ViewingTypeBadge type={poll?.viewing_type ?? viewing.viewing_type} />
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">
                schedule
              </span>
              {relativeTime(viewing.created_at)}
            </span>
          </div>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full md:w-auto px-5 py-2.5 bg-[#006b5f] text-white font-['Manrope'] font-bold text-sm rounded-xl hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[16px]">
            {expanded ? "expand_less" : "event_available"}
          </span>
          {expanded ? "Close" : "Mark Your Availability"}
        </button>
      </div>
      {expanded && (
        <div className="px-6 pb-6">
          <AvailabilitySection viewing={viewing} onConfirmed={onConfirmed} />
        </div>
      )}
    </div>
  );
}

function UpcomingCard({ viewing }) {
  const dayLabel = relativeUpcoming(viewing.viewing_date);
  const isToday = dayLabel === "Today";
  const poll = viewing.viewing_polls?.[0];

  return (
    <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm p-6 flex flex-col md:flex-row gap-5 items-start md:items-center">
      <div
        className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 ${
          isToday ? "bg-[#006b5f] text-white" : "bg-[#eff4ff] text-[#121c2a]"
        }`}
      >
        <span
          className="text-lg font-bold leading-none"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {viewing.viewing_date
            ? new Date(viewing.viewing_date).getDate()
            : "--"}
        </span>
        <span className="text-[10px] uppercase tracking-wide opacity-80">
          {viewing.viewing_date
            ? new Date(viewing.viewing_date).toLocaleDateString("en-SG", {
                month: "short",
              })
            : ""}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <h3 className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#121c2a]">
            {viewing.prospect_name}
          </h3>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-bold tracking-tight ${
              isToday
                ? "bg-[#006b5f]/10 text-[#006b5f]"
                : "bg-[#eff4ff] text-[#6c7a77]"
            }`}
          >
            {dayLabel}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#6c7a77]">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">bed</span>
            {viewing.rooms?.unit_code ?? viewing.rooms?.name ?? "Room"}
          </span>
          <ViewingTypeBadge type={poll?.viewing_type ?? viewing.viewing_type} />
          {viewing.viewing_time && (
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">
                schedule
              </span>
              {formatTime(viewing.viewing_time)}
            </span>
          )}
        </div>
      </div>
      <div className="text-right hidden md:block">
        <p className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#121c2a]">
          {viewing.viewing_date ? formatDate(viewing.viewing_date) : ""}
        </p>
        {viewing.viewing_time && (
          <p className="font-['Manrope'] text-sm text-[#6c7a77]">
            {formatTime(viewing.viewing_time)}
          </p>
        )}
      </div>
    </div>
  );
}

function PastCard({ viewing }) {
  const poll = viewing.viewing_polls?.[0];

  return (
    <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm p-6 flex flex-col md:flex-row gap-5 items-start md:items-center opacity-70">
      <InitialsAvatar name={viewing.prospect_name} size="w-12 h-12 text-base" />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#121c2a]">
            {viewing.prospect_name}
          </h3>
          <StatusPill status={viewing.status === "CONFIRMED" ? "COMPLETED" : viewing.status} />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#6c7a77]">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">bed</span>
            {viewing.rooms?.unit_code ?? viewing.rooms?.name ?? "Room"}
          </span>
          <ViewingTypeBadge type={poll?.viewing_type ?? viewing.viewing_type} />
          {viewing.viewing_date && (
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">
                calendar_today
              </span>
              {formatDate(viewing.viewing_date)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, description }) {
  return (
    <div className="bg-white rounded-2xl p-12 border border-[#bbcac6]/15 shadow-sm flex flex-col items-center text-center">
      <div className="w-16 h-16 bg-[#eff4ff] rounded-2xl flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-[#006b5f] text-[32px]">
          {icon}
        </span>
      </div>
      <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] text-lg mb-2">
        {title}
      </h3>
      <p className="text-[#6c7a77] font-['Manrope'] text-sm max-w-sm">
        {description}
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm"
        >
          <div className="flex gap-5 items-center">
            <div className="w-14 h-14 rounded-full bg-[#eff4ff] animate-pulse" />
            <div className="flex-1 space-y-3">
              <div className="flex gap-3">
                <div className="h-5 w-32 bg-[#eff4ff] animate-pulse rounded-full" />
                <div className="h-5 w-24 bg-[#eff4ff] animate-pulse rounded-full" />
              </div>
              <div className="h-4 w-2/3 bg-[#eff4ff] animate-pulse rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const TABS = [
  { key: "incoming", label: "Incoming", icon: "inbox" },
  { key: "upcoming", label: "Upcoming", icon: "event" },
  { key: "past", label: "Past", icon: "history" },
];

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CaptainViewingsPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState("incoming");
  const [toast, setToast] = useState(null);

  const propertyName =
    profile?.properties?.name ?? profile?.rooms?.name ?? "your property";

  // Fetch all viewings for this captain
  const { viewings, loading, refetch } = useViewings({
    captainId: profile?.id,
  });

  // Split viewings into tabs
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const incoming = useMemo(
    () =>
      viewings.filter(
        (v) => v.status === "REQUESTED" || v.status === "POLLING"
      ),
    [viewings]
  );

  const upcoming = useMemo(
    () =>
      viewings.filter(
        (v) =>
          v.status === "CONFIRMED" &&
          v.viewing_date &&
          new Date(v.viewing_date) >= today
      ),
    [viewings, today]
  );

  const past = useMemo(
    () =>
      viewings.filter(
        (v) =>
          v.status === "COMPLETED" ||
          v.status === "CANCELLED" ||
          (v.status === "CONFIRMED" &&
            v.viewing_date &&
            new Date(v.viewing_date) < today)
      ),
    [viewings, today]
  );

  const tabData = { incoming, upcoming, past };

  const handleConfirmed = useCallback(() => {
    setToast("Viewing confirmed!");
    refetch();
    setTimeout(() => setToast(null), 4000);
  }, [refetch]);

  return (
    <PortalLayout>
      {/* Page header */}
      <div className="mb-10">
        <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
          Viewings
        </h1>
        <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">
          Manage viewing requests for{" "}
          <span className="font-semibold text-[#121c2a]">{propertyName}</span>.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-8 border-b border-[#bbcac6]/20 mb-8">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = tabData[tab.key]?.length ?? 0;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-['Manrope'] font-medium transition-all flex items-center gap-2 ${
                isActive
                  ? "text-[#006b5f] font-bold border-b-2 border-[#006b5f]"
                  : "text-[#6c7a77] hover:text-[#121c2a]"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isActive
                      ? "bg-[#006b5f]/10 text-[#006b5f]"
                      : "bg-[#eff4ff] text-[#6c7a77]"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* Incoming */}
          {activeTab === "incoming" &&
            (incoming.length === 0 ? (
              <EmptyState
                icon="mark_email_read"
                title="No incoming requests"
                description="You're all caught up. New viewing requests will appear here when prospects want to visit."
              />
            ) : (
              <div className="space-y-4">
                {incoming.map((v) => (
                  <IncomingCard
                    key={v.id}
                    viewing={v}
                    onConfirmed={handleConfirmed}
                  />
                ))}
              </div>
            ))}

          {/* Upcoming */}
          {activeTab === "upcoming" &&
            (upcoming.length === 0 ? (
              <EmptyState
                icon="event_upcoming"
                title="No upcoming viewings"
                description="Once a viewing is confirmed, it will show here with the date and time."
              />
            ) : (
              <div className="space-y-4">
                {upcoming.map((v) => (
                  <UpcomingCard key={v.id} viewing={v} />
                ))}
              </div>
            ))}

          {/* Past */}
          {activeTab === "past" &&
            (past.length === 0 ? (
              <EmptyState
                icon="history"
                title="No past viewings"
                description="Completed and cancelled viewings will appear here for your records."
              />
            ) : (
              <div className="space-y-4">
                {past.map((v) => (
                  <PastCard key={v.id} viewing={v} />
                ))}
              </div>
            ))}
        </>
      )}

      <Toast message={toast} onClose={() => setToast(null)} />
    </PortalLayout>
  );
}
