import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useInvestorReports(investorId) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!investorId) {
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);

      // Get investor's property IDs from investments
      const { data: investments } = await supabase
        .from("investments")
        .select("property_id")
        .eq("investor_id", investorId);

      const propertyIds = (investments ?? []).map((i) => i.property_id);

      if (propertyIds.length === 0) {
        setReports([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("investor_reports")
        .select("*, properties(name, code)")
        .in("property_id", propertyIds)
        .order("month", { ascending: false });

      if (error) {
        console.error("Error fetching investor reports:", error);
      }

      setReports(data ?? []);
      setLoading(false);
    }

    load();
  }, [investorId]);

  return { reports, loading };
}
