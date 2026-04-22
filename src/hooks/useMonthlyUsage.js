import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export function useMonthlyUsage(roomId) {
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;

    supabase
      .from("ac_monthly_usage")
      .select("month, total_hours, free_hours, overage_hours, status")
      .eq("room_id", roomId)
      .order("month", { ascending: true })
      .then(({ data }) => {
        const formatted = (data || []).map((row) => {
          const [year, month] = row.month.split("-");
          const label = new Date(Number(year), Number(month) - 1).toLocaleDateString("en-SG", {
            month: "short",
            year: "2-digit",
          });
          return {
            label,
            hours: Math.round((row.total_hours || 0) * 10) / 10,
            free: row.free_hours || (new Date(row.month + '-01').getDate() ? 10 * new Date(new Date(row.month).getFullYear(), new Date(row.month).getMonth() + 1, 0).getDate() : 300),
            overage: Math.round((row.overage_hours || 0) * 10) / 10,
          };
        });
        setMonthlyData(formatted);
        setLoading(false);
      });
  }, [roomId]);

  return { monthlyData, loading };
}
