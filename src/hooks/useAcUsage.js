import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function getFirstOfMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function getMidnight() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * Given an array of ac_events (sorted ascending by timestamp) since midnight,
 * calculate total hours the AC has been ON up to now.
 */
function calcTodayHours(events) {
  const midnight = getMidnight();
  const now = new Date();
  let totalMs = 0;
  let onSince = null;

  for (const ev of events) {
    const ts = new Date(ev.timestamp);
    if (ev.state === "ON") {
      onSince = ts;
    } else if (ev.state === "OFF" && onSince !== null) {
      totalMs += ts - onSince;
      onSince = null;
    }
  }

  // If still ON at the end, count up to now
  if (onSince !== null) {
    totalMs += now - onSince;
  }

  // Edge case: if the first event is OFF, AC was likely on since midnight
  // We only count from events we can see — conservative approach.

  return totalMs / (1000 * 60 * 60);
}

export function useAcUsage(roomId) {
  const [usage, setUsage] = useState(null);
  const [todayHours, setTodayHours] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    const monthStart = getFirstOfMonth();
    const midnightISO = getMidnight().toISOString();

    async function load() {
      const [monthlyResult, todayResult] = await Promise.all([
        supabase
          .from("ac_monthly_usage")
          .select("*")
          .eq("room_id", roomId)
          .eq("month", monthStart)
          .single(),
        supabase
          .from("ac_events")
          .select("state, timestamp")
          .eq("room_id", roomId)
          .gte("timestamp", midnightISO)
          .order("timestamp", { ascending: true }),
      ]);

      if (monthlyResult.error && monthlyResult.error.code !== "PGRST116") {
        console.error("Error fetching monthly usage:", monthlyResult.error);
      }
      if (todayResult.error) {
        console.error("Error fetching today's events:", todayResult.error);
      }

      setUsage(monthlyResult.data ?? null);
      setTodayHours(calcTodayHours(todayResult.data ?? []));
      setLoading(false);
    }

    load();
  }, [roomId]);

  return { usage, todayHours, loading };
}
