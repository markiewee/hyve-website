import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const PRIORITY_BG = {
  INFO: "#006b5f",
  WARNING: "#d97706",
  URGENT: "#ba1a1a",
};

function getHighestPriority(announcements) {
  const order = { URGENT: 3, WARNING: 2, INFO: 1 };
  let highest = "INFO";
  for (const a of announcements) {
    if ((order[a.priority] ?? 0) > (order[highest] ?? 0)) {
      highest = a.priority;
    }
  }
  return highest;
}

export default function AnnouncementBanner({ propertyId }) {
  const [announcements, setAnnouncements] = useState([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (propertyId === undefined) return;

    async function fetchAnnouncements() {
      const now = new Date().toISOString();

      let query = supabase
        .from("announcements")
        .select("id, title, content, priority, created_at, property_id")
        .eq("is_active", true)
        .or(
          propertyId
            ? `property_id.eq.${propertyId},property_id.is.null`
            : "property_id.is.null"
        )
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching announcements:", error);
        return;
      }
      setAnnouncements(data ?? []);
    }

    fetchAnnouncements();
  }, [propertyId]);

  if (announcements.length === 0) return null;

  const highestPriority = getHighestPriority(announcements);
  const bgColor = PRIORITY_BG[highestPriority] ?? PRIORITY_BG.INFO;

  const tickerText = announcements
    .map((a) => `${a.title}: ${a.content}`)
    .join("  \u2022  ");

  return (
    <div className="mb-4">
      {/* Ticker bar */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full overflow-hidden cursor-pointer border-0 outline-none"
        style={{
          height: "40px",
          backgroundColor: bgColor,
          borderRadius: expanded ? "8px 8px 0 0" : "8px",
        }}
        aria-expanded={expanded}
        aria-label="Toggle announcements"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: "100%",
            whiteSpace: "nowrap",
            color: "white",
            fontSize: "14px",
            fontWeight: 500,
            fontFamily: "'Manrope', sans-serif",
            animation: "marquee 20s linear infinite",
            paddingLeft: "100%",
          }}
        >
          {tickerText}
        </div>
      </button>

      {/* Expanded announcements */}
      {expanded && (
        <div
          className="space-y-3 p-4"
          style={{
            backgroundColor: bgColor,
            borderRadius: "0 0 8px 8px",
            opacity: 0.95,
          }}
        >
          {announcements.map((a) => (
            <div key={a.id} className="text-white">
              <p className="text-sm font-bold">{a.title}</p>
              <p className="text-sm opacity-90 mt-0.5">{a.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Marquee keyframes */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
