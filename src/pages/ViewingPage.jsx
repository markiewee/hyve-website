import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

const PROPERTY_INFO = {
  "Thomson Grove 588": {
    address: "588 Yio Chu Kang Road, Singapore 787072",
    mrt: "Bright Hill MRT (TE7)",
    mrtWalk: "7 min walk",
    defaultSecurity: "Tell the guard you're visiting Hyve at Block 588",
    defaultAccess: "Take the lift to the unit level",
    mapQuery: "588+Yio+Chu+Kang+Road+Singapore+787072",
    image: "https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=800&q=80",
  },
  "Chiltern Park 135": {
    address: "135 Serangoon Avenue 3, Singapore 556112",
    mrt: "Serangoon MRT (NE12/CC13)",
    mrtWalk: "10 min walk",
    defaultSecurity: "No security guard — walk straight in through the gate",
    defaultAccess: "Walk to the unit, door code will be provided",
    mapQuery: "135+Serangoon+Avenue+3+Singapore+556112",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
  },
  "Ivory Heights 122": {
    address: "Blk 122 Jurong East St 13, Singapore 600122",
    mrt: "Jurong East MRT (NS1/EW24)",
    mrtWalk: "8 min walk",
    defaultSecurity: "Tell the guard you're visiting Hyve coliving at Block 122",
    defaultAccess: "Take the lift to the unit level",
    mapQuery: "122+Jurong+East+Street+13+Singapore+600122",
    image: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c0?w=800&q=80",
  },
};

function getCountdown(date, time) {
  if (!date) return null;
  const target = new Date(`${date}T${time || "12:00"}:00+08:00`);
  const now = new Date();
  const diff = target - now;
  if (diff < 0) return "past";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) return `in ${Math.floor(hours / 24)} day${Math.floor(hours / 24) > 1 ? "s" : ""}`;
  if (hours > 0) return `in ${hours}h ${mins}m`;
  return `in ${mins} minutes`;
}

export default function ViewingPage() {
  const { token } = useParams();
  const [viewing, setViewing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;
    supabase
      .from("property_viewings")
      .select("*, properties(name, address)")
      .eq("token", token)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) setError("Viewing not found.");
        else setViewing(data);
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center">
        <div className="animate-pulse text-[#006b5f] font-['Plus_Jakarta_Sans'] font-bold">Loading...</div>
      </div>
    );
  }

  if (error || !viewing) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
        <div className="text-center">
          <img src="/hyve-logo.png" alt="Hyve" className="h-8 mx-auto mb-6" />
          <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#121c2a] mb-2">Viewing Not Found</h1>
          <p className="text-[#555f6f] font-['Manrope']">This viewing link is invalid or has expired.</p>
          <a href="https://wa.me/6580885410" className="mt-6 inline-flex items-center gap-2 px-5 py-3 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm">
            Contact Us
          </a>
        </div>
      </div>
    );
  }

  const propertyName = viewing.properties?.name || "Hyve Property";
  const propInfo = Object.entries(PROPERTY_INFO).find(([k]) => propertyName.includes(k.split(" ")[0]))?.[1] || {};
  const address = viewing.properties?.address || propInfo.address || "";
  const countdown = getCountdown(viewing.viewing_date, viewing.viewing_time);
  const isPast = countdown === "past";

  const fmtDate = viewing.viewing_date
    ? new Date(viewing.viewing_date + "T00:00:00").toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      {/* Hero */}
      <div className="relative h-48 overflow-hidden bg-[#006b5f]">
        {propInfo.image && (
          <img src={propInfo.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[#006b5f]/80 to-[#006b5f]" />
        <div className="relative h-full flex flex-col justify-end p-6">
          <img src="/hyve-logo.png" alt="Hyve" className="h-6 brightness-0 invert mb-4" />
          <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-white tracking-tight">
            Welcome, {viewing.prospect_name}!
          </h1>
          <p className="font-['Manrope'] text-white/80 text-sm mt-1">
            Your viewing at <strong>{propertyName}</strong>
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-4 -mt-4 relative z-10">
        {/* Date & Time */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#bbcac6]/15">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#006b5f]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#006b5f] text-[24px]">event</span>
            </div>
            <div>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a]">{fmtDate}</p>
              <p className="font-['Manrope'] text-sm text-[#555f6f]">
                {viewing.viewing_time || "Time TBC"}
                {countdown && !isPast && <span className="text-[#006b5f] font-bold ml-2">{countdown}</span>}
                {isPast && <span className="text-red-500 font-bold ml-2">This viewing has passed</span>}
              </p>
            </div>
          </div>
        </div>

        {/* How to Get There */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#bbcac6]/15 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006b5f] text-[20px]">location_on</span>
            <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a]">How to Get There</h2>
          </div>
          <p className="font-['Manrope'] text-sm text-[#121c2a] font-medium">{address}</p>
          {propInfo.mrt && (
            <div className="flex items-center gap-2 text-sm text-[#555f6f] font-['Manrope']">
              <span className="material-symbols-outlined text-[16px]">train</span>
              {propInfo.mrt} — {propInfo.mrtWalk}
            </div>
          )}
          {address && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#eff4ff] text-[#006b5f] rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#e6eeff] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">directions</span>
              Open in Google Maps
            </a>
          )}
        </div>

        {/* When You Arrive */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#bbcac6]/15 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006b5f] text-[20px]">security</span>
            <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a]">When You Arrive</h2>
          </div>
          <div className="space-y-2">
            {viewing.security_instructions && (
              <div className="bg-[#006b5f]/5 rounded-lg p-3">
                <p className="text-xs text-[#006b5f] font-bold font-['Inter'] uppercase tracking-widest mb-1">Security / Lobby</p>
                <p className="font-['Manrope'] text-sm text-[#121c2a]">{viewing.security_instructions}</p>
              </div>
            )}
            {!viewing.security_instructions && propInfo.defaultSecurity && (
              <div className="bg-[#006b5f]/5 rounded-lg p-3">
                <p className="text-xs text-[#006b5f] font-bold font-['Inter'] uppercase tracking-widest mb-1">Security / Lobby</p>
                <p className="font-['Manrope'] text-sm text-[#121c2a]">{propInfo.defaultSecurity}</p>
              </div>
            )}
            {viewing.access_code && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700 font-bold font-['Inter'] uppercase tracking-widest mb-1">Access Code</p>
                <p className="font-['Plus_Jakarta_Sans'] text-2xl font-black text-amber-800 tracking-wider">{viewing.access_code}</p>
              </div>
            )}
          </div>
          {viewing.special_notes && (
            <div className="bg-[#f8f9ff] rounded-lg p-3">
              <p className="text-xs text-[#6c7a77] font-bold font-['Inter'] uppercase tracking-widest mb-1">Notes</p>
              <p className="font-['Manrope'] text-sm text-[#121c2a]">{viewing.special_notes}</p>
            </div>
          )}
        </div>

        {/* Join Video Tour */}
        {viewing.meet_link && (
          <div className="bg-[#006b5f] rounded-2xl p-5 shadow-lg space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#71f8e4] text-[20px]">videocam</span>
              <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-white">Join Video Tour</h2>
            </div>
            <p className="font-['Manrope'] text-sm text-white/70">
              {isPast ? "This viewing has ended." : "Your host will guide you through the property on video."}
            </p>
            {!isPast && (
              <a
                href={viewing.meet_link}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-4 bg-white text-[#006b5f] rounded-xl font-['Plus_Jakarta_Sans'] font-extrabold text-lg hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-[24px]">video_call</span>
                Join Meeting
              </a>
            )}
          </div>
        )}

        {/* Contact */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#bbcac6]/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-green-600 text-[20px]">chat</span>
            </div>
            <div className="flex-1">
              <p className="font-['Manrope'] font-bold text-sm text-[#121c2a]">Need help?</p>
              <p className="font-['Manrope'] text-xs text-[#555f6f]">WhatsApp us if you're lost or need assistance</p>
            </div>
            <a
              href="https://wa.me/6580885410"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-green-500 text-white rounded-xl font-['Manrope'] font-bold text-sm hover:bg-green-600 transition-colors"
            >
              Chat
            </a>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#bbcac6] font-['Manrope'] pb-8">
          Hyve Co-living · Makery Pte. Ltd.
        </p>
      </div>

      {/* Material Icons */}
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    </div>
  );
}
