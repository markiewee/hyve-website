import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { confirmCancel, fetchCancelDetails } from "./_bookApi";

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-SG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Singapore",
  });
}

function fmtTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-SG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Singapore",
  });
}

// /book/cancel?token=xxx — public flow.
// Two states:
//   1. confirm — read-only summary + Confirm cancel + Keep buttons
//   2. cancelled — success message
export default function BookCancelPage() {
  const [params] = useSearchParams();
  const token = params.get("token");

  const [viewing, setViewing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError("Missing cancel token. Check the link in your email.");
      setLoading(false);
      return undefined;
    }
    let active = true;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await fetchCancelDetails(token);
        if (!active) return;
        setViewing(data?.viewing || null);
        if (!data?.viewing) {
          setLoadError("This cancel link is invalid or expired.");
        }
      } catch (err) {
        if (active) setLoadError(err.message || "Couldn't load this cancellation.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  async function handleCancel() {
    if (!token) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await confirmCancel(token);
      setDone(true);
    } catch (err) {
      setSubmitError(err.message || "Cancel failed. Try again or WhatsApp us.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
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

  if (loadError || !viewing) {
    return (
      <div className="min-h-screen bg-[#FAF6EC] font-['Inter'] text-[#191c1e] flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-2xl editorial-shadow p-8 text-center">
          <span className="material-symbols-outlined text-5xl text-[#ba1a1a] mb-4 block">
            error_outline
          </span>
          <h1 className="font-['Plus_Jakarta_Sans'] text-xl font-bold mb-2">
            {loadError || "Booking not found"}
          </h1>
          <p className="text-[#1F2937] text-sm mb-6">
            If you booked recently, the link may not have synced yet.
          </p>
          <a
            href="https://wa.me/6580885410"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#A87813] text-white rounded-lg font-['Plus_Jakarta_Sans'] font-bold text-sm"
          >
            <span className="material-symbols-outlined text-sm">chat</span>
            WhatsApp Lazybee
          </a>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#FAF6EC] font-['Inter'] text-[#191c1e] flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-2xl editorial-shadow p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-[#D9A441]/15 rounded-full flex items-center justify-center">
            <span
              className="material-symbols-outlined text-[#A87813] text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              event_busy
            </span>
          </div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold mb-2 tracking-tight">
            Viewing cancelled
          </h1>
          <p className="text-[#1F2937] text-sm mb-6">
            All sorted. We&apos;ve let the captain know. You can book another any time.
          </p>
          <Link
            to="/book"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#A87813] text-white rounded-lg font-['Plus_Jakarta_Sans'] font-bold text-sm"
          >
            <span className="material-symbols-outlined text-sm">calendar_month</span>
            Book a new time
          </Link>
        </div>
      </div>
    );
  }

  const startISO = viewing.slot_start;
  const propertyName = viewing.property_name || viewing.property || "Lazybee";

  return (
    <div className="min-h-screen bg-[#FAF6EC] font-['Inter'] text-[#191c1e] flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl editorial-shadow p-8">
        <div className="text-center mb-6">
          <span className="material-symbols-outlined text-5xl text-[#A87813] mb-3 block">
            event
          </span>
          <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold tracking-tight mb-2">
            Cancel this viewing?
          </h1>
          <p className="text-[#1F2937] text-sm">
            Hi {viewing.prospect_name || "there"} — sorry to see you go.
          </p>
        </div>

        <div className="bg-[#f2f4f6] rounded-xl p-5 mb-6 space-y-3">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[#A87813] text-base mt-0.5">
              calendar_month
            </span>
            <div className="text-sm">
              <p className="font-bold">{fmtDate(startISO)}</p>
              <p className="text-[#1F2937]">{fmtTime(startISO)} (SGT)</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[#A87813] text-base mt-0.5">
              location_on
            </span>
            <p className="text-sm font-bold">{propertyName}</p>
          </div>
        </div>

        {submitError && (
          <div className="flex items-center gap-2 p-3 bg-[#ffdad6] rounded-lg mb-4">
            <span className="material-symbols-outlined text-[#93000a] text-sm">error</span>
            <p className="text-sm text-[#93000a] font-medium">{submitError}</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={handleCancel}
            disabled={submitting}
            className="w-full py-4 bg-[#ba1a1a] text-white font-['Plus_Jakarta_Sans'] font-bold text-sm tracking-wide rounded-lg hover:bg-[#ba1a1a]/90 active:scale-[0.98] transition-all editorial-shadow flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Cancelling…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">event_busy</span>
                Confirm cancel
              </>
            )}
          </button>
          <Link
            to="/book"
            className="w-full py-3 bg-[#e6e8ea] text-[#191c1e] font-['Plus_Jakarta_Sans'] font-bold text-sm rounded-lg text-center hover:bg-[#dee0e2] transition-all"
          >
            Keep my viewing
          </Link>
        </div>
      </div>
    </div>
  );
}
