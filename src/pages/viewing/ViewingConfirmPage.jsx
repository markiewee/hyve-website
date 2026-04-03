import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";

const PROPERTY_PHOTOS = {
  "Thomson Grove": "/properties/thomson-grove.jpg",
  "Chiltern Park": "/properties/chiltern-park.jpg",
  "Ivory Heights": "/properties/ivory-heights.jpg",
};

const PROPERTY_ADDRESSES = {
  "Thomson Grove": "Thomson Grove, 588 Yio Chu Kang Road, Singapore 787072",
  "Chiltern Park": "Chiltern Park, 135 Serangoon Avenue 3, Singapore 556112",
  "Ivory Heights": "Ivory Heights, 122 Jurong East St 13, Singapore 600122",
};

function formatViewingDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00+08:00");
  return d.toLocaleDateString("en-SG", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatViewingTime(startTime, endTime) {
  if (!startTime) return "";
  const fmt = (t) => {
    const d = new Date(`2000-01-01T${t}`);
    return d.toLocaleTimeString("en-SG", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).toUpperCase();
  };
  const start = fmt(startTime);
  if (!endTime) return start;
  return `${start} — ${fmt(endTime)}`;
}

function getPropertyPhoto(propertyName) {
  if (!propertyName) return null;
  for (const [key, url] of Object.entries(PROPERTY_PHOTOS)) {
    if (propertyName.includes(key)) return url;
  }
  return null;
}

function getPropertyAddress(propertyName, dbAddress) {
  if (dbAddress) return dbAddress;
  if (!propertyName) return "";
  for (const [key, addr] of Object.entries(PROPERTY_ADDRESSES)) {
    if (propertyName.includes(key)) return addr;
  }
  return "";
}

function getPropertyShortName(propertyName) {
  if (!propertyName) return "Hyve Property";
  for (const key of Object.keys(PROPERTY_PHOTOS)) {
    if (propertyName.includes(key)) return key;
  }
  return propertyName;
}

// WhatsApp SVG icon
function WhatsAppIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.628 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function ViewingConfirmPage() {
  const { token } = useParams();
  const [viewing, setViewing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [state, setState] = useState("default"); // "default" | "confirmed" | "reschedule"
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!token) return;
    supabase
      .from("property_viewings")
      .select("*, properties(name, code)")
      .eq("token", token)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) setError("Viewing not found or link has expired.");
        else setViewing(data);
        setLoading(false);
      });
  }, [token]);

  async function handleConfirm() {
    setUpdating(true);
    const { error: err } = await supabase
      .from("property_viewings")
      .update({ prospect_confirmed_attending: true })
      .eq("token", token);
    setUpdating(false);
    if (err) {
      setError("Something went wrong. Please try again.");
    } else {
      setState("confirmed");
    }
  }

  // -- Loading state --
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-[#006b5f] to-[#14b8a6] rounded-lg flex items-center justify-center animate-pulse">
            <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>apartment</span>
          </div>
          <p className="text-[#006b5f] font-['Plus_Jakarta_Sans'] font-bold text-lg animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  // -- Error state --
  if (error || !viewing) {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-[#006b5f] to-[#14b8a6] rounded-lg flex items-center justify-center text-white">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>apartment</span>
            </div>
            <span className="font-['Plus_Jakarta_Sans'] font-bold text-2xl tracking-tighter text-[#006b5f]">Hyve</span>
          </div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#191c1e] mb-2">Viewing Not Found</h1>
          <p className="text-[#3c4947] font-['Inter'] mb-6">
            {error || "This viewing link is invalid or has expired."}
          </p>
          <a
            href="https://wa.me/6580885410"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#006b5f] text-white rounded-lg font-['Inter'] font-semibold text-sm hover:opacity-90 transition-all"
          >
            Contact Us
          </a>
        </div>
      </div>
    );
  }

  const propertyName = viewing.properties?.name || "Hyve Property";
  const shortName = getPropertyShortName(propertyName);
  const photo = getPropertyPhoto(propertyName);
  const address = getPropertyAddress(propertyName, viewing.properties?.address);
  const dateDisplay = formatViewingDate(viewing.viewing_date);
  const timeDisplay = formatViewingTime(viewing.viewing_time, viewing.viewing_time_end);

  return (
    <div className="bg-[#f7f9fb] font-['Inter'] text-[#191c1e] min-h-screen flex flex-col">
      <main className="flex-grow flex items-center justify-center p-6 sm:p-12">
        <div className="max-w-xl w-full flex flex-col items-center">
          {/* Logo */}
          <div className="mb-12">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-[#006b5f] to-[#14b8a6] rounded-lg flex items-center justify-center text-white">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>apartment</span>
              </div>
              <span className="font-['Plus_Jakarta_Sans'] font-bold text-2xl tracking-tighter text-[#006b5f]">Hyve</span>
            </div>
          </div>

          {/* Main card */}
          <div className="w-full bg-white rounded-xl overflow-hidden" style={{ boxShadow: "0 24px 48px -12px rgba(25, 28, 30, 0.04)" }}>
            {/* Property photo banner */}
            <div className="h-48 w-full relative overflow-hidden">
              {photo ? (
                <img className="w-full h-full object-cover" src={photo} alt={shortName} />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#006b5f] to-[#14b8a6]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-6 left-8">
                <span className="text-white/80 font-['Inter'] text-xs tracking-widest uppercase mb-1 block">Scheduled Viewing</span>
                <h2 className="text-white font-['Plus_Jakarta_Sans'] text-2xl font-bold tracking-tight">{shortName}</h2>
              </div>
            </div>

            {/* Card body */}
            <div className="p-8 sm:p-10 text-center">
              {/* --- Default state: confirmation prompt --- */}
              {state === "default" && (
                <>
                  {/* Badge */}
                  <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 bg-[#e6e8ea] rounded-full">
                    <span className="material-symbols-outlined text-[#006b5f] text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>event_available</span>
                    <span className="text-[#3c4947] font-['Inter'] text-xs font-semibold tracking-wide">CONFIRMATION REQUIRED</span>
                  </div>

                  <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#191c1e] tracking-tight mb-4">
                    Are you still joining us?
                  </h1>

                  <p className="text-[#3c4947] text-md mb-10 max-w-sm mx-auto leading-relaxed">
                    Please confirm your attendance for the viewing at{" "}
                    <span className="font-semibold text-[#191c1e]">{address}</span>.
                  </p>

                  {/* Date & time block */}
                  <div className="bg-[#f2f4f6] rounded-lg p-8 mb-10 flex flex-col items-center gap-4">
                    <div className="flex items-center gap-3 text-[#006b5f]">
                      <span className="material-symbols-outlined text-3xl">calendar_today</span>
                      <span className="font-['Plus_Jakarta_Sans'] text-2xl font-bold tracking-tight">{dateDisplay}</span>
                    </div>
                    <div className="h-px w-12 bg-[#bbcac6]/30" />
                    <div className="flex items-center gap-3 text-[#191c1e]">
                      <span className="material-symbols-outlined text-3xl">schedule</span>
                      <span className="font-['Plus_Jakarta_Sans'] text-2xl font-bold tracking-tight">{timeDisplay}</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      onClick={handleConfirm}
                      disabled={updating}
                      className="bg-[#006b5f] text-white font-['Plus_Jakarta_Sans'] font-bold py-4 px-8 rounded-lg shadow-lg shadow-[#006b5f]/20 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 min-w-[200px] disabled:opacity-60"
                    >
                      {updating ? (
                        <span className="animate-pulse">Confirming...</span>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-xl">check_circle</span>
                          Yes, I'm coming!
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setState("reschedule")}
                      className="bg-white border-2 border-[#e0e3e5] text-[#3c4947] font-['Plus_Jakarta_Sans'] font-bold py-4 px-8 rounded-lg hover:bg-[#f2f4f6] active:scale-[0.98] transition-all min-w-[200px]"
                    >
                      I need to reschedule
                    </button>
                  </div>
                </>
              )}

              {/* --- Confirmed state --- */}
              {state === "confirmed" && (
                <div className="py-6">
                  <div className="w-16 h-16 bg-[#006b5f]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="material-symbols-outlined text-[#006b5f] text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  </div>
                  <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#191c1e] tracking-tight mb-3">
                    See you there!
                  </h1>
                  <p className="text-[#3c4947] text-md max-w-sm mx-auto leading-relaxed mb-8">
                    Your attendance is confirmed. We look forward to showing you{" "}
                    <span className="font-semibold text-[#191c1e]">{shortName}</span>.
                  </p>
                  <div className="bg-[#f2f4f6] rounded-lg p-6 inline-flex flex-col items-center gap-2">
                    <span className="text-[#006b5f] font-['Plus_Jakarta_Sans'] font-bold text-lg">{dateDisplay}</span>
                    <span className="text-[#3c4947] font-['Inter'] text-sm">{timeDisplay}</span>
                  </div>
                </div>
              )}

              {/* --- Reschedule state --- */}
              {state === "reschedule" && (
                <div className="py-6">
                  <div className="w-16 h-16 bg-[#f2f4f6] rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="material-symbols-outlined text-[#3c4947] text-4xl">calendar_month</span>
                  </div>
                  <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#191c1e] tracking-tight mb-3">
                    No worries!
                  </h1>
                  <p className="text-[#3c4947] text-md max-w-sm mx-auto leading-relaxed mb-8">
                    Reach out to us and we'll find a time that works for you.
                  </p>
                  <div className="bg-[#f2f4f6] rounded-lg p-6 max-w-sm mx-auto space-y-3">
                    <a
                      href="https://wa.me/6580885410"
                      className="flex items-center gap-3 justify-center px-6 py-3 bg-[#25D366] text-white rounded-lg font-bold text-sm hover:opacity-90 transition-all"
                    >
                      <WhatsAppIcon className="w-5 h-5 fill-white" />
                      WhatsApp us at +65 8088 5410
                    </a>
                    <a
                      href="mailto:hello@lazybee.sg"
                      className="flex items-center gap-3 justify-center px-6 py-3 bg-white border border-[#e0e3e5] text-[#191c1e] rounded-lg font-bold text-sm hover:bg-[#f7f9fb] transition-all"
                    >
                      <span className="material-symbols-outlined text-lg">mail</span>
                      Email hello@lazybee.sg
                    </a>
                  </div>
                  <button
                    onClick={() => setState("default")}
                    className="mt-6 text-[#006b5f] font-semibold text-sm underline decoration-[#006b5f]/30 underline-offset-4 hover:decoration-[#006b5f] transition-colors"
                  >
                    Go back
                  </button>
                </div>
              )}
            </div>

            {/* WhatsApp contact bar */}
            <div className="bg-[#f2f4f6]/50 px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#bbcac6]/10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center text-white">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
                </div>
                <div className="text-left">
                  <p className="text-xs font-['Inter'] text-[#3c4947] font-medium">Need help?</p>
                  <p className="text-sm font-['Plus_Jakarta_Sans'] font-bold text-[#191c1e]">WhatsApp us at +65 8088 5410</p>
                </div>
              </div>
              <a
                href="https://wa.me/6580885410"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-[#25D366] text-white font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">open_in_new</span>
                Chat on WhatsApp
              </a>
            </div>
          </div>

          {/* Footer links */}
          <div className="mt-12 flex flex-col items-center gap-4">
            <div className="flex gap-6 mt-4">
              <a className="text-[#3c4947]/60 text-xs hover:text-[#006b5f] transition-colors uppercase tracking-widest font-bold" href="/privacy-policy">Privacy Policy</a>
              <a className="text-[#3c4947]/60 text-xs hover:text-[#006b5f] transition-colors uppercase tracking-widest font-bold" href="https://wa.me/6580885410">Support</a>
            </div>
          </div>
        </div>
      </main>

      <footer className="p-8 text-center">
        <p className="text-[#3c4947]/40 text-xs font-['Inter']">
          &copy; {new Date().getFullYear()} Hyve. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
