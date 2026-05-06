import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { buildCaptainWaLink, getPropertyByCode } from "./_propertyMeta";

// /book/confirmed/:viewing_id — final state after a successful POST /api/book/create.
// We pull the persisted row from Supabase rather than relying on URL state so a
// shared/reloaded link still works.

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

// Build a minimal RFC5545 .ics in-browser as a fallback if /api/book/ics isn't ready yet.
function buildIcs({ uid, summary, description, location, startISO, endISO }) {
  const dt = (s) =>
    new Date(s)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hyve//Viewings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dt(new Date().toISOString())}`,
    `DTSTART:${dt(startISO)}`,
    `DTEND:${dt(endISO)}`,
    `SUMMARY:${summary}`,
    description ? `DESCRIPTION:${description.replace(/\n/g, "\\n")}` : "",
    location ? `LOCATION:${location}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

export default function BookConfirmedPage() {
  const { viewing_id: viewingId } = useParams();
  const [viewing, setViewing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: dbErr } = await supabase
          .from("property_viewings")
          .select(
            "id, prospect_name, prospect_email, prospect_whatsapp, slot_start, slot_end, viewing_date, viewing_time, cancel_token, status, properties(name, code, address), rooms(name, unit_code), captain:tenant_profiles!captain_id(id, tenant_details(full_name, phone))"
          )
          .eq("id", viewingId)
          .single();
        if (!active) return;
        if (dbErr || !data) {
          setError("We couldn't find that booking. Check the link or WhatsApp us.");
        } else {
          setViewing(data);
        }
      } catch (err) {
        console.error("Confirmation load failed", err);
        if (active) setError("Couldn't load your booking right now.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [viewingId]);

  if (loading) {
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

  if (error || !viewing) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] font-['Inter'] text-[#191c1e] flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-2xl editorial-shadow p-8 text-center">
          <span className="material-symbols-outlined text-5xl text-[#ba1a1a] mb-4 block">
            error_outline
          </span>
          <h1 className="font-['Plus_Jakarta_Sans'] text-xl font-bold mb-2">
            {error || "Booking not found"}
          </h1>
          <a
            href="https://wa.me/6580885410"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-[#006b5f] text-white rounded-lg font-['Plus_Jakarta_Sans'] font-bold text-sm"
          >
            <span className="material-symbols-outlined text-sm">chat</span>
            WhatsApp Hyve
          </a>
        </div>
      </div>
    );
  }

  // Slot maths — backend writes slot_start/slot_end as timestamptz; fall back to
  // legacy viewing_date + viewing_time for V1 rows.
  const startISO =
    viewing.slot_start ||
    (viewing.viewing_date && viewing.viewing_time
      ? `${viewing.viewing_date}T${viewing.viewing_time}+08:00`
      : null);
  const endISO =
    viewing.slot_end ||
    (startISO ? new Date(new Date(startISO).getTime() + 30 * 60 * 1000).toISOString() : null);

  const propMeta = getPropertyByCode(viewing.properties?.code);
  const propertyName = viewing.properties?.name || propMeta?.name || "Hyve";
  const address = viewing.properties?.address || propMeta?.address || "";
  const meetingPoint = propMeta?.meetingPoint || "We'll send the meeting point in a reminder.";
  const captainDetails = Array.isArray(viewing.captain?.tenant_details)
    ? viewing.captain?.tenant_details?.[0]
    : viewing.captain?.tenant_details;
  const captainPhone = captainDetails?.phone || null;

  const cancelUrl = viewing.cancel_token
    ? `/book/cancel?token=${viewing.cancel_token}`
    : null;

  function downloadIcs() {
    if (!startISO || !endISO) return;
    const ics = buildIcs({
      uid: `hyve-viewing-${viewing.id}@hyve.sg`,
      summary: `Hyve Viewing — ${propertyName}`,
      description: `Viewing with Hyve at ${propertyName}.${
        viewing.rooms?.unit_code ? ` Room: ${viewing.rooms.unit_code}.` : ""
      } Cancel: https://hyve.sg/book/cancel?token=${viewing.cancel_token || ""}`,
      location: address,
      startISO,
      endISO,
    });
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hyve-viewing-${propertyName.replace(/\s+/g, "-").toLowerCase()}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff] font-['Inter'] text-[#191c1e] flex flex-col items-center p-5 sm:p-10">
      <div className="w-full max-w-lg bg-white rounded-2xl editorial-shadow overflow-hidden">
        {/* Hero confirmation */}
        <div className="bg-[#006b5f] p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center">
            <span
              className="material-symbols-outlined text-white text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
          </div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-white mb-1 tracking-tight">
            You&apos;re booked!
          </h1>
          <p className="text-white/80 text-sm">
            See you on {fmtDate(startISO)} at {fmtTime(startISO)}
          </p>
        </div>

        <div className="p-6 sm:p-8 space-y-5">
          {/* Details list */}
          <div className="flex items-start gap-4">
            <span className="material-symbols-outlined text-[#006b5f] mt-0.5">calendar_month</span>
            <div>
              <p className="font-bold text-[#191c1e]">{fmtDate(startISO)}</p>
              <p className="text-[#3c4947] text-sm">{fmtTime(startISO)} (SGT)</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <span className="material-symbols-outlined text-[#006b5f] mt-0.5">location_on</span>
            <div>
              <p className="font-bold text-[#191c1e]">{propertyName}</p>
              <p className="text-[#3c4947] text-sm">{address}</p>
            </div>
          </div>

          {viewing.rooms && (
            <div className="flex items-start gap-4">
              <span className="material-symbols-outlined text-[#006b5f] mt-0.5">bed</span>
              <div>
                <p className="font-bold text-[#191c1e]">
                  {viewing.rooms.name || viewing.rooms.unit_code}
                </p>
              </div>
            </div>
          )}

          {/* Meeting point */}
          <div className="bg-[#f2f4f6] rounded-xl p-4 text-sm text-[#3c4947]">
            <p className="font-bold text-[#191c1e] mb-1">Meeting point</p>
            <p>{meetingPoint}</p>
          </div>

          {/* Add to calendar */}
          <button
            onClick={downloadIcs}
            className="w-full py-3 bg-[#14b8a6]/15 text-[#006b5f] font-['Plus_Jakarta_Sans'] font-bold text-sm tracking-wide rounded-lg hover:bg-[#14b8a6]/25 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base">event</span>
            Add to calendar
          </button>

          {/* Captain WhatsApp */}
          <a
            href={buildCaptainWaLink({
              phone: captainPhone,
              propertyName,
              slotStart: `${fmtDate(startISO)} at ${fmtTime(startISO)}`,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 bg-[#25D366] text-white font-['Plus_Jakarta_Sans'] font-bold text-sm tracking-wide rounded-lg hover:bg-[#25D366]/90 active:scale-[0.98] transition-all editorial-shadow flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base">chat</span>
            Message us on WhatsApp
          </a>

          {cancelUrl && (
            <a
              href={cancelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-xs text-[#6c7a77] hover:text-[#006b5f] underline"
            >
              Need to cancel?
            </a>
          )}

          {/* What to expect */}
          <div className="border-t border-[#e6e8ea] pt-5 space-y-3">
            <p className="font-bold text-[#191c1e] text-sm">What to expect</p>
            <ul className="space-y-2 text-sm text-[#3c4947]">
              <li className="flex gap-2">
                <span className="material-symbols-outlined text-[#14b8a6] text-base mt-0.5">check</span>
                <span>30-min walkthrough — room, common spaces, ask anything.</span>
              </li>
              <li className="flex gap-2">
                <span className="material-symbols-outlined text-[#14b8a6] text-base mt-0.5">check</span>
                <span>You&apos;ll get a 2h-before reminder with door code + parking info.</span>
              </li>
              <li className="flex gap-2">
                <span className="material-symbols-outlined text-[#14b8a6] text-base mt-0.5">check</span>
                <span>If you love it, sign-up takes ~10 mins — no agent fees.</span>
              </li>
            </ul>
          </div>
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
    </div>
  );
}
