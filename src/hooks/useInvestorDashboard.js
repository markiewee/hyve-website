import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useInvestorDashboard(investorId) {
  const [investments, setInvestments] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [financials, setFinancials] = useState([]);
  const [totalCapital, setTotalCapital] = useState(0);
  const [totalDistributions, setTotalDistributions] = useState(0);
  const [returnRate, setReturnRate] = useState(0);
  const [thisMonthDistribution, setThisMonthDistribution] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!investorId) {
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);

      // Fetch investments with properties
      const { data: invData } = await supabase
        .from("investments")
        .select("*, properties(id, name, code)")
        .eq("investor_id", investorId);

      const invList = invData ?? [];
      setInvestments(invList);

      // Fetch distributions ordered by month desc
      const { data: distData } = await supabase
        .from("distributions")
        .select("*, properties(name, code)")
        .eq("investor_id", investorId)
        .order("month", { ascending: false });

      const distList = distData ?? [];
      setDistributions(distList);

      // Fetch finalized monthly_financials for the investor's properties
      const propertyIds = invList.map((i) => i.property_id).filter(Boolean);
      let finList = [];
      if (propertyIds.length > 0) {
        const { data: finData } = await supabase
          .from("monthly_financials")
          .select("*")
          .in("property_id", propertyIds)
          .eq("status", "FINALIZED")
          .order("month", { ascending: false });
        finList = finData ?? [];
      }
      setFinancials(finList);

      // Derived calculations
      const capital = invList.reduce(
        (sum, i) => sum + Number(i.capital_contributed ?? 0),
        0
      );
      setTotalCapital(capital);

      const paidDist = distList
        .filter((d) => d.status === "PAID")
        .reduce((sum, d) => sum + Number(d.amount ?? 0), 0);
      setTotalDistributions(paidDist);

      setReturnRate(capital > 0 ? (paidDist / capital) * 100 : 0);

      // This month's distributions (any status)
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const thisMonthDist = distList
        .filter((d) => d.month === thisMonth)
        .reduce((sum, d) => sum + Number(d.amount ?? 0), 0);
      setThisMonthDistribution(thisMonthDist);

      setLoading(false);
    }

    load();
  }, [investorId]);

  return {
    investments,
    distributions,
    financials,
    totalCapital,
    totalDistributions,
    returnRate,
    thisMonthDistribution,
    loading,
  };
}
