import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export function useDailyUsage(roomId) {
  const [dailyData, setDailyData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    supabase
      .from("ac_events")
      .select("state, timestamp")
      .eq("room_id", roomId)
      .gte("timestamp", monthStart.toISOString())
      .order("timestamp", { ascending: true })
      .then(({ data: events }) => {
        if (!events || events.length === 0) {
          // Generate empty days up to today
          const days = [];
          for (let d = 1; d <= now.getDate(); d++) {
            days.push({ day: d, hours: 0 });
          }
          setDailyData(days);
          setLoading(false);
          return;
        }

        // Group events by day and calculate hours per day
        const daysInMonth = now.getDate();
        const dayHours = {};
        for (let d = 1; d <= daysInMonth; d++) {
          dayHours[d] = 0;
        }

        let lastOnTime = null;

        for (const event of events) {
          const ts = new Date(event.timestamp);
          const day = ts.getDate();

          if (event.state === "ON" && !lastOnTime) {
            lastOnTime = ts;
          } else if (event.state === "OFF" && lastOnTime) {
            // AC was on from lastOnTime to ts — may span multiple days
            let cursor = new Date(lastOnTime);
            while (cursor < ts) {
              const cursorDay = cursor.getDate();
              const endOfDay = new Date(cursor);
              endOfDay.setHours(23, 59, 59, 999);
              const segmentEnd = ts < endOfDay ? ts : endOfDay;
              const ms = segmentEnd - cursor;
              if (dayHours[cursorDay] !== undefined) {
                dayHours[cursorDay] += ms / 3600000;
              }
              // Move to start of next day
              cursor = new Date(endOfDay.getTime() + 1);
            }
            lastOnTime = null;
          }
        }

        // If AC is still ON, count up to now
        if (lastOnTime) {
          let cursor = new Date(lastOnTime);
          while (cursor < now) {
            const cursorDay = cursor.getDate();
            const endOfDay = new Date(cursor);
            endOfDay.setHours(23, 59, 59, 999);
            const segmentEnd = now < endOfDay ? now : endOfDay;
            const ms = segmentEnd - cursor;
            if (dayHours[cursorDay] !== undefined) {
              dayHours[cursorDay] += ms / 3600000;
            }
            cursor = new Date(endOfDay.getTime() + 1);
          }
        }

        const days = Object.entries(dayHours).map(([day, hours]) => ({
          day: parseInt(day),
          hours: Math.round(hours * 10) / 10,
        }));

        setDailyData(days);
        setLoading(false);
      });
  }, [roomId]);

  return { dailyData, loading };
}
