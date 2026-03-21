import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days !== 1 ? "s" : ""} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months !== 1 ? "s" : ""} ago`;
}

const PRIORITY_STYLES = {
  INFO: {
    wrapper: "bg-blue-50 border-blue-400",
    title: "text-blue-900",
    content: "text-blue-800",
    time: "text-blue-600",
  },
  WARNING: {
    wrapper: "bg-yellow-50 border-yellow-400",
    title: "text-yellow-900",
    content: "text-yellow-800",
    time: "text-yellow-600",
  },
  URGENT: {
    wrapper: "bg-red-50 border-red-500",
    title: "text-red-900 font-bold",
    content: "text-red-800",
    time: "text-red-600",
  },
};

export default function AnnouncementBanner({ propertyId }) {
  const [announcements, setAnnouncements] = useState([]);

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

  return (
    <div className="space-y-2 mb-6">
      {announcements.map((a) => {
        const styles = PRIORITY_STYLES[a.priority] ?? PRIORITY_STYLES.INFO;
        return (
          <div
            key={a.id}
            className={`border-l-4 rounded-r-md px-4 py-3 ${styles.wrapper}`}
          >
            <p className={`text-sm font-semibold ${styles.title}`}>
              {a.title}
            </p>
            <p className={`text-sm mt-0.5 ${styles.content}`}>{a.content}</p>
            <p className={`text-xs mt-1 ${styles.time}`}>
              {relativeTime(a.created_at)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
