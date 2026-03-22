import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";

function formatSGD(amount) {
  if (amount == null) return "—";
  return `$${Number(amount).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getMonthStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthStrToFirst(ms) {
  return `${ms}-01`;
}

function parseMonthStr(ms) {
  const [y, m] = ms.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

function addMonths(ms, n) {
  const d = parseMonthStr(ms);
  d.setMonth(d.getMonth() + n);
  return getMonthStr(d);
}

function formatMonthLabel(ms) {
  const d = parseMonthStr(ms);
  return d.toLocaleDateString("en-SG", { month: "long", year: "numeric" });
}

export default function AdminFinancialsPage() {
  const [selectedMonth, setSelectedMonth] = useState(getMonthStr(new Date()));
  const [properties, setProperties] = useState([]);
  const [propertyData, setPropertyData] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchProperties = useCallback(async () => {
    const { data } = await supabase
      .from("properties")
      .select("id, name, code, rooms(id)")
      .order("name");
    setProperties(data ?? []);
  }, []);

  const fetchFinancials = useCallback(async () => {
    if (properties.length === 0) return;
    setLoading(true);

    const monthFirst = monthStrToFirst(selectedMonth);
    const propertyIds = properties.map((p) => p.id);

    const { data: mfData } = await supabase
      .from("monthly_financials")
      .select("*")
      .in("property_id", propertyIds)
      .eq("month", monthFirst);

    const mfMap = {};
    (mfData ?? []).forEach((mf) => {
      mfMap[mf.property_id] = mf;
    });

    const { data: investments } = await supabase
      .from("investments")
      .select("*, investors(id, full_name, email)")
      .in("property_id", propertyIds);

    const invMap = {};
    (investments ?? []).forEach((inv) => {
      if (!invMap[inv.property_id]) invMap[inv.property_id] = [];
      invMap[inv.property_id].push(inv);
    });

    const { data: distributions } = await supabase
      .from("distributions")
      .select("*")
      .in("property_id", propertyIds)
      .eq("month", monthFirst);

    const distMap = {};
    (distributions ?? []).forEach((d) => {
      const key = `${d.property_id}__${d.investor_id}`;
      distMap[key] = d;
    });

    const propDataNew = {};
    for (const prop of properties) {
      const roomIds = (prop.rooms ?? []).map((r) => r.id);
      const totalRooms = roomIds.length;

      let revenue = 0;
      let occupiedRooms = 0;

      if (roomIds.length > 0) {
        const { data: rentData } = await supabase
          .from("rent_payments")
          .select("paid_amount")
          .in("room_id", roomIds)
          .eq("month", monthFirst)
          .eq("status", "PAID");

        revenue = (rentData ?? []).reduce(
          (sum, r) => sum + Number(r.paid_amount ?? 0),
          0
        );

        const { data: acData } = await supabase
          .from("ac_monthly_usage")
          .select("overage_sgd")
          .in("room_id", roomIds)
          .eq("month", monthFirst);

        revenue += (acData ?? []).reduce(
          (sum, a) => sum + Number(a.overage_sgd ?? 0),
          0
        );

        const { data: tenantData } = await supabase
          .from("tenant_profiles")
          .select("id")
          .in("room_id", roomIds)
          .eq("is_active", true);

        occupiedRooms = (tenantData ?? []).length;
      }

      const { data: expData } = await supabase
        .from("property_expenses")
        .select("amount")
        .eq("property_id", prop.id)
        .eq("month", monthFirst);

      const expenses = (expData ?? []).reduce(
        (sum, e) => sum + Number(e.amount ?? 0),
        0
      );

      const netProfit = revenue - expenses;
      const occupancyRate = totalRooms > 0 ? occupiedRooms / totalRooms : 0;

      const existingMf = mfMap[prop.id];
      const propertyInvestors = invMap[prop.id] ?? [];

      propDataNew[prop.id] = {
        revenue,
        expenses,
        netProfit,
        occupiedRooms,
        totalRooms,
        occupancyRate,
        existingMf,
        investors: propertyInvestors.map((inv) => ({
          ...inv,
          distribution: distMap[`${prop.id}__${inv.investor_id}`] ?? null,
          distributionAmount: (netProfit * Number(inv.share_percentage ?? 0)) / 100,
        })),
      };
    }

    setPropertyData(propDataNew);
    setLoading(false);
  }, [properties, selectedMonth]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  useEffect(() => {
    fetchFinancials();
  }, [fetchFinancials]);

  async function handleCalculateSave(propertyId) {
    setActionLoading(`calc-${propertyId}`);
    const d = propertyData[propertyId];
    if (!d) return;

    const monthFirst = monthStrToFirst(selectedMonth);

    const { error } = await supabase.from("monthly_financials").upsert(
      {
        property_id: propertyId,
        month: monthFirst,
        revenue: d.revenue,
        expenses: d.expenses,
        net_profit: d.netProfit,
        occupancy_rate: d.occupancyRate,
        status: "DRAFT",
      },
      { onConflict: "property_id,month" }
    );

    if (error) {
      console.error("Upsert financials error:", error);
    } else {
      fetchFinancials();
    }
    setActionLoading(null);
  }

  async function handleFinalizeMonth(propertyId) {
    setActionLoading(`finalize-${propertyId}`);
    const d = propertyData[propertyId];
    if (!d) return;

    const monthFirst = monthStrToFirst(selectedMonth);

    const { error: mfError } = await supabase
      .from("monthly_financials")
      .update({ status: "FINALIZED" })
      .eq("property_id", propertyId)
      .eq("month", monthFirst);

    if (mfError) {
      console.error("Finalize error:", mfError);
      setActionLoading(null);
      return;
    }

    for (const inv of d.investors) {
      const amount = (d.netProfit * Number(inv.share_percentage ?? 0)) / 100;
      await supabase.from("distributions").upsert(
        {
          investor_id: inv.investor_id,
          property_id: propertyId,
          month: monthFirst,
          gross_profit: d.netProfit,
          share_percentage: inv.share_percentage,
          amount,
          status: "PENDING",
        },
        { onConflict: "investor_id,property_id,month" }
      );
    }

    fetchFinancials();
    setActionLoading(null);
  }

  async function handleMarkAllDistributed(propertyId) {
    setActionLoading(`dist-${propertyId}`);
    const monthFirst = monthStrToFirst(selectedMonth);

    const { error } = await supabase
      .from("distributions")
      .update({ status: "PAID" })
      .eq("property_id", propertyId)
      .eq("month", monthFirst);

    if (error) {
      console.error("Mark distributed error:", error);
    } else {
      fetchFinancials();
    }
    setActionLoading(null);
  }

  const totalRevenue = Object.values(propertyData).reduce((sum, d) => sum + (d?.revenue ?? 0), 0);
  const totalExpenses = Object.values(propertyData).reduce((sum, d) => sum + (d?.expenses ?? 0), 0);
  const totalNet = totalRevenue - totalExpenses;

  return (
    <PortalLayout>
      {/* Page header */}
      <div className="mb-10">
        <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
          Monthly Financials
        </h1>
        <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">
          Calculate P&L and manage investor distributions by month.
        </p>
      </div>

      {/* Month navigator */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => setSelectedMonth((m) => addMonths(m, -1))}
          className="w-10 h-10 bg-white rounded-xl border border-[#bbcac6]/15 shadow-sm flex items-center justify-center text-[#555f6f] hover:bg-[#eff4ff] transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">chevron_left</span>
        </button>
        <span className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#121c2a] min-w-[180px] text-center">
          {formatMonthLabel(selectedMonth)}
        </span>
        <button
          onClick={() => setSelectedMonth((m) => addMonths(m, 1))}
          className="w-10 h-10 bg-white rounded-xl border border-[#bbcac6]/15 shadow-sm flex items-center justify-center text-[#555f6f] hover:bg-[#eff4ff] transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">chevron_right</span>
        </button>
      </div>

      {/* Summary bento */}
      {!loading && Object.keys(propertyData).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">Total Revenue</p>
            <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#006b5f]">
              {formatSGD(totalRevenue)}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">Total Expenses</p>
            <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#ba1a1a]">
              {formatSGD(totalExpenses)}
            </p>
          </div>
          <div className="bg-[#006b5f] rounded-2xl p-6">
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#71f8e4]/80 font-bold mb-3">Net Profit</p>
            <p className={`font-['Plus_Jakarta_Sans'] text-3xl font-extrabold ${totalNet >= 0 ? "text-white" : "text-[#ffdad6]"}`}>
              {formatSGD(totalNet)}
            </p>
          </div>
        </div>
      )}

      {/* Per-property cards */}
      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-[#eff4ff] animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {properties.map((prop) => {
            const d = propertyData[prop.id];
            if (!d) return null;

            const mf = d.existingMf;
            const isFinalized = mf?.status === "FINALIZED";
            const calcLoading = actionLoading === `calc-${prop.id}`;
            const finLoading = actionLoading === `finalize-${prop.id}`;
            const distLoading = actionLoading === `dist-${prop.id}`;

            return (
              <div key={prop.id} className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden">
                {/* Property header */}
                <div className="px-8 py-6 border-b border-[#bbcac6]/15 flex items-center justify-between">
                  <div>
                    <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] text-lg">{prop.name}</h2>
                    <p className="font-['Manrope'] text-[#6c7a77] text-sm">
                      {prop.code} — {d.occupiedRooms}/{d.totalRooms} rooms occupied ({Math.round(d.occupancyRate * 100)}%)
                    </p>
                  </div>
                  {mf && (
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                      isFinalized ? "bg-[#d1fae5] text-[#065f46]" : "bg-amber-100 text-amber-700"
                    }`}>
                      {mf.status}
                    </span>
                  )}
                </div>

                <div className="p-8">
                  {/* Financial summary */}
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-[#eff4ff] rounded-xl p-5 text-center">
                      <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-2">Revenue</p>
                      <p className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-[#006b5f] tabular-nums">
                        {formatSGD(d.revenue)}
                      </p>
                    </div>
                    <div className="bg-[#eff4ff] rounded-xl p-5 text-center">
                      <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-2">Expenses</p>
                      <p className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-[#ba1a1a] tabular-nums">
                        {formatSGD(d.expenses)}
                      </p>
                    </div>
                    <div className={`rounded-xl p-5 text-center ${d.netProfit >= 0 ? "bg-[#006b5f]" : "bg-[#ffdad6]"}`}>
                      <p className={`font-['Inter'] text-[10px] uppercase tracking-widest font-bold mb-2 ${d.netProfit >= 0 ? "text-[#71f8e4]/80" : "text-[#ba1a1a]"}`}>
                        Net Profit
                      </p>
                      <p className={`font-['Plus_Jakarta_Sans'] text-2xl font-extrabold tabular-nums ${d.netProfit >= 0 ? "text-white" : "text-[#ba1a1a]"}`}>
                        {formatSGD(d.netProfit)}
                      </p>
                    </div>
                  </div>

                  {/* Investor distributions table */}
                  {d.investors.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-4">
                        Investor Distributions
                      </h3>
                      <div className="rounded-xl overflow-hidden border border-[#bbcac6]/15">
                        <table className="w-full">
                          <thead className="bg-[#eff4ff]">
                            <tr>
                              <th className="text-left px-4 py-3 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">Investor</th>
                              <th className="text-right px-4 py-3 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">Share %</th>
                              <th className="text-right px-4 py-3 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">Amount</th>
                              <th className="text-left px-4 py-3 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#bbcac6]/10">
                            {d.investors.map((inv) => {
                              const distStatus = inv.distribution?.status;
                              return (
                                <tr key={inv.id} className="hover:bg-[#f8f9ff] transition-colors">
                                  <td className="px-4 py-3 font-['Manrope'] text-sm font-medium text-[#121c2a]">
                                    {inv.investors?.full_name ?? inv.investors?.email ?? "—"}
                                  </td>
                                  <td className="px-4 py-3 text-right font-['Manrope'] text-sm tabular-nums text-[#6c7a77]">
                                    {Number(inv.share_percentage ?? 0).toFixed(1)}%
                                  </td>
                                  <td className="px-4 py-3 text-right font-['Plus_Jakarta_Sans'] font-bold text-sm tabular-nums text-[#121c2a]">
                                    {formatSGD(inv.distributionAmount)}
                                  </td>
                                  <td className="px-4 py-3">
                                    {distStatus ? (
                                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                                        distStatus === "PAID" ? "bg-[#d1fae5] text-[#065f46]" : "bg-amber-100 text-amber-700"
                                      }`}>
                                        {distStatus}
                                      </span>
                                    ) : (
                                      <span className="text-[#bbcac6] text-xs">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-3 pt-4 border-t border-[#bbcac6]/15">
                    <button
                      onClick={() => handleCalculateSave(prop.id)}
                      disabled={calcLoading || isFinalized}
                      className="px-5 py-2.5 rounded-xl border border-[#bbcac6]/30 font-['Manrope'] font-bold text-sm text-[#555f6f] hover:bg-[#eff4ff] disabled:opacity-50 transition-all"
                    >
                      {calcLoading ? "Saving…" : "Calculate & Save"}
                    </button>
                    <button
                      onClick={() => handleFinalizeMonth(prop.id)}
                      disabled={finLoading || isFinalized || !mf}
                      className="px-5 py-2.5 rounded-xl bg-[#006b5f] text-white font-['Manrope'] font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all"
                    >
                      {finLoading ? "Finalizing…" : "Finalize Month"}
                    </button>
                    {isFinalized && (
                      <button
                        onClick={() => handleMarkAllDistributed(prop.id)}
                        disabled={distLoading}
                        className="px-5 py-2.5 rounded-xl bg-[#d6e0f3] text-[#555f6f] font-['Manrope'] font-bold text-sm hover:bg-[#bdc7d9] disabled:opacity-50 transition-all"
                      >
                        {distLoading ? "Updating…" : "Mark All Distributed"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PortalLayout>
  );
}
