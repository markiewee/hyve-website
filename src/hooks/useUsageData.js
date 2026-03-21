import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

// Calculate hours from ON/OFF event pairs
function calcHoursFromEvents(events, periodEnd) {
  let totalMs = 0;
  let lastOn = null;

  for (const e of events) {
    const ts = new Date(e.timestamp);
    if (e.state === "ON" && !lastOn) {
      lastOn = ts;
    } else if (e.state === "OFF" && lastOn) {
      totalMs += ts - lastOn;
      lastOn = null;
    }
  }
  if (lastOn) {
    totalMs += periodEnd - lastOn;
  }
  return totalMs / 3600000;
}

export function useUsageData(roomId) {
  const [view, setView] = useState("month"); // "day" | "month" | "year"
  const [offset, setOffset] = useState(0); // 0 = current, -1 = previous, etc.
  const [chartData, setChartData] = useState([]);
  const [totalHours, setTotalHours] = useState(0);
  const [avgHours, setAvgHours] = useState(0);
  const [periodLabel, setPeriodLabel] = useState("");
  const [avgLabel, setAvgLabel] = useState("");
  const [loading, setLoading] = useState(true);

  const goBack = useCallback(() => setOffset((o) => o - 1), []);
  const goForward = useCallback(() => setOffset((o) => Math.min(o + 1, 0)), []);

  useEffect(() => {
    if (!roomId) return;
    setLoading(true);

    const now = new Date();

    if (view === "day") {
      // Hourly bars for a single day
      const target = new Date(now);
      target.setDate(target.getDate() + offset);
      const dayStart = new Date(target.getFullYear(), target.getMonth(), target.getDate());
      const dayEnd = offset === 0 ? now : new Date(dayStart.getTime() + 86400000 - 1);

      setPeriodLabel(
        target.toLocaleDateString("en-SG", { month: "short", day: "numeric" })
      );
      setAvgLabel("Hourly average(h)");

      supabase
        .from("ac_events")
        .select("state, timestamp")
        .eq("room_id", roomId)
        .gte("timestamp", dayStart.toISOString())
        .lte("timestamp", dayEnd.toISOString())
        .order("timestamp", { ascending: true })
        .then(({ data: events }) => {
          const hours = new Array(24).fill(0);
          if (events && events.length > 0) {
            let lastOn = null;
            for (const e of events) {
              const ts = new Date(e.timestamp);
              if (e.state === "ON" && !lastOn) lastOn = ts;
              else if (e.state === "OFF" && lastOn) {
                let cursor = new Date(lastOn);
                while (cursor < ts) {
                  const hr = cursor.getHours();
                  const hrEnd = new Date(cursor);
                  hrEnd.setMinutes(59, 59, 999);
                  const segEnd = ts < hrEnd ? ts : hrEnd;
                  hours[hr] += (segEnd - cursor) / 3600000;
                  cursor = new Date(hrEnd.getTime() + 1);
                }
                lastOn = null;
              }
            }
            if (lastOn) {
              let cursor = new Date(lastOn);
              while (cursor < dayEnd) {
                const hr = cursor.getHours();
                const hrEnd = new Date(cursor);
                hrEnd.setMinutes(59, 59, 999);
                const segEnd = dayEnd < hrEnd ? dayEnd : hrEnd;
                hours[hr] += (segEnd - cursor) / 3600000;
                cursor = new Date(hrEnd.getTime() + 1);
              }
            }
          }
          const total = hours.reduce((a, b) => a + b, 0);
          const activeHours = hours.filter((h) => h > 0).length || 1;
          setTotalHours(Math.round(total * 100) / 100);
          setAvgHours(Math.round((total / activeHours) * 100) / 100);
          setChartData(
            hours.map((h, i) => ({
              label: `${String(i).padStart(2, "0")}:00`,
              hours: Math.round(h * 100) / 100,
            }))
          );
          setLoading(false);
        });
    } else if (view === "month") {
      // Daily bars for a single month
      const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const monthEnd =
        offset === 0
          ? now
          : new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59);
      const daysInMonth = new Date(
        target.getFullYear(),
        target.getMonth() + 1,
        0
      ).getDate();
      const lastDay = offset === 0 ? now.getDate() : daysInMonth;

      setPeriodLabel(
        target.toLocaleDateString("en-SG", { month: "short", year: "numeric" })
      );
      setAvgLabel("Daily average(h)");

      supabase
        .from("ac_events")
        .select("state, timestamp")
        .eq("room_id", roomId)
        .gte("timestamp", target.toISOString())
        .lte("timestamp", monthEnd.toISOString())
        .order("timestamp", { ascending: true })
        .then(({ data: events }) => {
          const dayHours = {};
          for (let d = 1; d <= lastDay; d++) dayHours[d] = 0;

          if (events && events.length > 0) {
            let lastOn = null;
            for (const e of events) {
              const ts = new Date(e.timestamp);
              if (e.state === "ON" && !lastOn) lastOn = ts;
              else if (e.state === "OFF" && lastOn) {
                let cursor = new Date(lastOn);
                while (cursor < ts) {
                  const d = cursor.getDate();
                  const eod = new Date(cursor);
                  eod.setHours(23, 59, 59, 999);
                  const segEnd = ts < eod ? ts : eod;
                  if (dayHours[d] !== undefined) dayHours[d] += (segEnd - cursor) / 3600000;
                  cursor = new Date(eod.getTime() + 1);
                }
                lastOn = null;
              }
            }
            if (lastOn) {
              let cursor = new Date(lastOn);
              while (cursor < monthEnd) {
                const d = cursor.getDate();
                const eod = new Date(cursor);
                eod.setHours(23, 59, 59, 999);
                const segEnd = monthEnd < eod ? monthEnd : eod;
                if (dayHours[d] !== undefined) dayHours[d] += (segEnd - cursor) / 3600000;
                cursor = new Date(eod.getTime() + 1);
              }
            }
          }

          const total = Object.values(dayHours).reduce((a, b) => a + b, 0);
          const activeDays = Object.values(dayHours).filter((h) => h > 0).length || 1;
          setTotalHours(Math.round(total * 100) / 100);
          setAvgHours(Math.round((total / activeDays) * 100) / 100);
          setChartData(
            Object.entries(dayHours).map(([d, h]) => ({
              label: d,
              hours: Math.round(h * 10) / 10,
            }))
          );
          setLoading(false);
        });
    } else if (view === "year") {
      // Monthly bars from ac_monthly_usage
      const targetYear = now.getFullYear() + offset;
      setPeriodLabel(String(targetYear));
      setAvgLabel("Monthly average(h)");

      supabase
        .from("ac_monthly_usage")
        .select("month, total_hours")
        .eq("room_id", roomId)
        .gte("month", `${targetYear}-01-01`)
        .lte("month", `${targetYear}-12-31`)
        .order("month", { ascending: true })
        .then(({ data }) => {
          const months = {};
          for (let m = 1; m <= 12; m++) months[m] = 0;

          (data || []).forEach((row) => {
            const m = parseInt(row.month.split("-")[1]);
            months[m] = Math.round((row.total_hours || 0) * 10) / 10;
          });

          const monthNames = [
            "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
          ];

          const total = Object.values(months).reduce((a, b) => a + b, 0);
          const activeMonths = Object.values(months).filter((h) => h > 0).length || 1;
          setTotalHours(Math.round(total * 100) / 100);
          setAvgHours(Math.round((total / activeMonths) * 100) / 100);
          setChartData(
            Object.entries(months).map(([m, h]) => ({
              label: monthNames[parseInt(m)],
              hours: h,
            }))
          );
          setLoading(false);
        });
    }
  }, [roomId, view, offset]);

  // Reset offset when switching views
  useEffect(() => {
    setOffset(0);
  }, [view]);

  return {
    view,
    setView,
    chartData,
    totalHours,
    avgHours,
    periodLabel,
    avgLabel,
    loading,
    goBack,
    goForward,
    canGoForward: offset < 0,
  };
}
