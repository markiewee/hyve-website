import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";

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
  const [propertyData, setPropertyData] = useState({}); // keyed by property_id
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

    // Fetch existing monthly_financials
    const { data: mfData } = await supabase
      .from("monthly_financials")
      .select("*")
      .in("property_id", propertyIds)
      .eq("month", monthFirst);

    const mfMap = {};
    (mfData ?? []).forEach((mf) => {
      mfMap[mf.property_id] = mf;
    });

    // Fetch investments with investor info for each property
    const { data: investments } = await supabase
      .from("investments")
      .select("*, investors(id, full_name, email)")
      .in("property_id", propertyIds);

    const invMap = {};
    (investments ?? []).forEach((inv) => {
      if (!invMap[inv.property_id]) invMap[inv.property_id] = [];
      invMap[inv.property_id].push(inv);
    });

    // Fetch distributions for this month
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

    // For each property: fetch revenue and occupancy dynamically
    const propDataNew = {};
    for (const prop of properties) {
      const roomIds = (prop.rooms ?? []).map((r) => r.id);
      const totalRooms = roomIds.length;

      let revenue = 0;
      let occupiedRooms = 0;

      if (roomIds.length > 0) {
        // Revenue from rent_payments (PAID) for this month
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

        // AC overage revenue
        const { data: acData } = await supabase
          .from("ac_monthly_usage")
          .select("overage_sgd")
          .in("room_id", roomIds)
          .eq("month", monthFirst);

        revenue += (acData ?? []).reduce(
          (sum, a) => sum + Number(a.overage_sgd ?? 0),
          0
        );

        // Active tenant count (occupancy)
        const { data: tenantData } = await supabase
          .from("tenant_profiles")
          .select("id")
          .in("room_id", roomIds)
          .eq("is_active", true);

        occupiedRooms = (tenantData ?? []).length;
      }

      // Expenses
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

    // Update monthly_financials to FINALIZED
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

    // Create distribution records for each investor
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

  return (
    <PortalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Financials</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Calculate monthly financials and manage investor distributions.
        </p>
      </div>

      {/* Month selector */}
      <Card className="mb-6">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedMonth((m) => addMonths(m, -1))}
            >
              &lt;
            </Button>
            <span className="text-base font-semibold min-w-[160px] text-center">
              {formatMonthLabel(selectedMonth)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedMonth((m) => addMonths(m, 1))}
            >
              &gt;
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Per-property cards */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-gray-100 animate-pulse rounded-lg" />
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
              <Card key={prop.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <CardTitle className="text-base">{prop.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {prop.code} &mdash; {d.occupiedRooms}/{d.totalRooms} rooms occupied
                      </p>
                    </div>
                    {mf && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          isFinalized
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {mf.status}
                      </span>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  {/* Financial summary */}
                  <div className="grid grid-cols-3 gap-3 mb-4 py-3 bg-muted/30 rounded-md text-center">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Revenue</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatSGD(d.revenue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Expenses</p>
                      <p className="text-sm font-semibold text-red-600 tabular-nums">
                        {formatSGD(d.expenses)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Net Profit</p>
                      <p
                        className={`text-sm font-bold tabular-nums ${
                          d.netProfit >= 0 ? "text-green-700" : "text-red-600"
                        }`}
                      >
                        {formatSGD(d.netProfit)}
                      </p>
                    </div>
                  </div>

                  {/* Investor distributions */}
                  {d.investors.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                        Investor Distributions
                      </p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground">
                            <th className="py-1 pr-4 font-medium">Investor</th>
                            <th className="py-1 pr-4 font-medium text-right">Share %</th>
                            <th className="py-1 pr-4 font-medium text-right">Amount</th>
                            <th className="py-1 font-medium text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {d.investors.map((inv) => {
                            const distStatus = inv.distribution?.status;
                            return (
                              <tr key={inv.id}>
                                <td className="py-2 pr-4">
                                  {inv.investors?.full_name ?? inv.investors?.email ?? "—"}
                                </td>
                                <td className="py-2 pr-4 text-right tabular-nums">
                                  {Number(inv.share_percentage ?? 0).toFixed(1)}%
                                </td>
                                <td className="py-2 pr-4 text-right tabular-nums font-medium">
                                  {formatSGD(inv.distributionAmount)}
                                </td>
                                <td className="py-2">
                                  {distStatus ? (
                                    <span
                                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                                        distStatus === "PAID"
                                          ? "bg-green-100 text-green-700"
                                          : "bg-yellow-100 text-yellow-700"
                                      }`}
                                    >
                                      {distStatus}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCalculateSave(prop.id)}
                      disabled={calcLoading || isFinalized}
                    >
                      {calcLoading ? "Saving…" : "Calculate & Save"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleFinalizeMonth(prop.id)}
                      disabled={finLoading || isFinalized || !mf}
                    >
                      {finLoading ? "Finalizing…" : "Finalize Month"}
                    </Button>
                    {isFinalized && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleMarkAllDistributed(prop.id)}
                        disabled={distLoading}
                      >
                        {distLoading ? "Updating…" : "Mark All Distributed"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PortalLayout>
  );
}
