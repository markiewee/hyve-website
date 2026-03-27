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

const INVITE_BASE_URL =
  typeof window !== "undefined"
    ? `${window.location.origin}/portal/investor/signup`
    : "https://hyve.sg/portal/investor/signup";

export default function AdminInvestorsPage() {
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteUrl, setInviteUrl] = useState(null);

  const [addInvForm, setAddInvForm] = useState({});

  // Distribution state
  const [distMonth, setDistMonth] = useState(getMonthStr(new Date()));
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState(null);
  const [distributions, setDistributions] = useState([]);
  const [distLoading, setDistLoading] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [approvingId, setApprovingId] = useState(null);

  const fetchInvestors = useCallback(async () => {
    const { data, error } = await supabase
      .from("investors")
      .select("*, investments(id, property_id, capital_contributed, share_percentage, properties(name, code))")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching investors:", error);
      return;
    }
    setInvestors(data ?? []);
    setLoading(false);
  }, []);

  const fetchProperties = useCallback(async () => {
    const { data } = await supabase
      .from("properties")
      .select("id, name, code")
      .order("name");
    setProperties(data ?? []);
  }, []);

  const fetchDistributions = useCallback(async () => {
    setDistLoading(true);
    const { data, error } = await supabase
      .from("distributions")
      .select("*, investors(full_name, email), properties(name, code)")
      .eq("month", `${distMonth}-01`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching distributions:", error);
    }
    setDistributions(data ?? []);
    setDistLoading(false);
  }, [distMonth]);

  useEffect(() => {
    fetchInvestors();
    fetchProperties();
  }, [fetchInvestors, fetchProperties]);

  useEffect(() => {
    fetchDistributions();
  }, [fetchDistributions]);

  async function handleInvite(e) {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);
    setInviteUrl(null);

    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { error } = await supabase.from("investors").insert({
      full_name: inviteName,
      email: inviteEmail,
      invite_token: token,
      invite_expires_at: expiresAt.toISOString(),
      is_active: false,
    });

    if (error) {
      setInviteError(error.message);
      setInviting(false);
      return;
    }

    setInviteUrl(`${INVITE_BASE_URL}?token=${token}`);
    setInviteName("");
    setInviteEmail("");
    setInviting(false);
    fetchInvestors();
  }

  async function handleToggleExpand(investorId) {
    if (expandedId === investorId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(investorId);
  }

  async function handleAddInvestment(investorId) {
    const form = addInvForm[investorId] ?? {};
    const { propertyId, capital } = form;
    if (!propertyId || !capital) return;

    const capitalNum = Number(capital);

    const { data: existing } = await supabase
      .from("investments")
      .select("id, investor_id, capital_contributed")
      .eq("property_id", propertyId);

    const existingList = existing ?? [];
    const totalCapital = existingList.reduce(
      (sum, i) => sum + Number(i.capital_contributed ?? 0),
      0
    ) + capitalNum;

    const { error: insertError } = await supabase.from("investments").insert({
      investor_id: investorId,
      property_id: propertyId,
      capital_contributed: capitalNum,
      share_percentage: totalCapital > 0 ? (capitalNum / totalCapital) * 100 : 0,
    });

    if (insertError) {
      console.error("Insert investment error:", insertError);
      return;
    }

    const updatedList = [
      ...existingList,
      { investor_id: investorId, capital_contributed: capitalNum },
    ];

    for (const inv of updatedList) {
      const share = totalCapital > 0 ? (Number(inv.capital_contributed) / totalCapital) * 100 : 0;
      if (inv.id) {
        await supabase.from("investments").update({ share_percentage: share }).eq("id", inv.id);
      }
    }

    setAddInvForm((prev) => ({ ...prev, [investorId]: {} }));
    fetchInvestors();
  }

  // ─── Distribution Calculation ─────────────────────────────────────────────────

  async function handleCalculateDistributions() {
    setCalculating(true);
    setCalcError(null);

    try {
      const monthStart = `${distMonth}-01`;
      const [y, m] = distMonth.split("-").map(Number);
      const nextDate = new Date(y, m, 1);
      const monthEnd = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-01`;

      // 1. Fetch confirmed bank_transactions for the selected month
      const { data: txns, error: txnError } = await supabase
        .from("bank_transactions")
        .select("id, property_id, amount, transaction_type, transaction_date")
        .eq("status", "CONFIRMED")
        .gte("transaction_date", monthStart)
        .lt("transaction_date", monthEnd);

      if (txnError) throw new Error(`Failed to fetch transactions: ${txnError.message}`);
      if (!txns || txns.length === 0) throw new Error("No confirmed transactions found for this month.");

      // 2. Group by property_id and calculate net profit
      const pnlByProperty = {};
      for (const txn of txns) {
        if (!txn.property_id) continue; // skip ops transactions
        const key = txn.property_id;
        if (!pnlByProperty[key]) pnlByProperty[key] = { income: 0, expenses: 0 };
        const amount = Math.abs(Number(txn.amount ?? 0));
        if (txn.transaction_type === "INCOME") {
          pnlByProperty[key].income += amount;
        } else {
          pnlByProperty[key].expenses += amount;
        }
      }

      // 3. Fetch all investments
      const { data: allInvestments, error: invError } = await supabase
        .from("investments")
        .select("id, investor_id, property_id, share_percentage");

      if (invError) throw new Error(`Failed to fetch investments: ${invError.message}`);

      const newDistributions = [];

      for (const [propertyId, pnl] of Object.entries(pnlByProperty)) {
        const netProfit = pnl.income - pnl.expenses;

        // 4. Upsert monthly_financials
        const { error: finError } = await supabase
          .from("monthly_financials")
          .upsert(
            {
              property_id: propertyId,
              month: monthStart,
              revenue: pnl.income,
              expenses: pnl.expenses,
              net_profit: netProfit,
              status: "FINALIZED",
            },
            { onConflict: "property_id,month" }
          );

        if (finError) {
          console.error("monthly_financials upsert error:", finError);
        }

        // 5. Calculate distribution per investor for this property
        const propertyInvestments = (allInvestments ?? []).filter(
          (inv) => inv.property_id === propertyId
        );

        for (const inv of propertyInvestments) {
          const sharePercent = Number(inv.share_percentage ?? 0);
          const distAmount = (netProfit * sharePercent) / 100;

          newDistributions.push({
            investor_id: inv.investor_id,
            property_id: propertyId,
            month: monthStart,
            gross_profit: netProfit,
            share_percentage: sharePercent,
            amount: Math.round(distAmount * 100) / 100,
            status: "PENDING",
          });
        }
      }

      if (newDistributions.length === 0) {
        throw new Error("No investor investments found for properties with transactions this month.");
      }

      // Delete existing pending distributions for this month before inserting new ones
      await supabase
        .from("distributions")
        .delete()
        .eq("month", monthStart)
        .eq("status", "PENDING");

      // 6. Insert distributions
      const { error: distError } = await supabase
        .from("distributions")
        .insert(newDistributions);

      if (distError) throw new Error(`Failed to insert distributions: ${distError.message}`);

      // Refresh
      await fetchDistributions();
    } catch (err) {
      setCalcError(err.message);
    } finally {
      setCalculating(false);
    }
  }

  // ─── Distribution Approval ────────────────────────────────────────────────────

  async function handleMarkPaid(distId) {
    setApprovingId(distId);
    const { error } = await supabase
      .from("distributions")
      .update({ status: "PAID", paid_at: new Date().toISOString() })
      .eq("id", distId);

    if (error) {
      console.error("Error marking distribution paid:", error);
    }
    setApprovingId(null);
    fetchDistributions();
  }

  async function handleApproveAll() {
    setApprovingAll(true);
    const pendingIds = distributions.filter((d) => d.status === "PENDING").map((d) => d.id);

    if (pendingIds.length > 0) {
      const { error } = await supabase
        .from("distributions")
        .update({ status: "PAID", paid_at: new Date().toISOString() })
        .in("id", pendingIds);

      if (error) {
        console.error("Error approving all distributions:", error);
      }
    }
    setApprovingAll(false);
    fetchDistributions();
  }

  const totalCapitalAll = investors.reduce(
    (sum, inv) => sum + (inv.investments ?? []).reduce((s, i) => s + Number(i.capital_contributed ?? 0), 0),
    0
  );
  const activeCount = investors.filter((i) => i.is_active).length;
  const pendingDistributions = distributions.filter((d) => d.status === "PENDING");
  const paidDistributions = distributions.filter((d) => d.status === "PAID");

  return (
    <PortalLayout>
      {/* Page header */}
      <div className="mb-10">
        <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
          Investor Management
        </h1>
        <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">
          Manage investor profiles, track capital, and send invitations.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">Total Investors</p>
          <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a]">{investors.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">Active</p>
          <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#006b5f]">{activeCount}</p>
        </div>
        <div className="bg-[#006b5f] rounded-2xl p-6">
          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#71f8e4]/80 font-bold mb-3">Total Capital</p>
          <p className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-white">
            {formatSGD(totalCapitalAll)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: invite form */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
            <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] mb-5 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#006b5f] text-[20px]">person_add</span>
              Invite Investor
            </h2>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Jane Tan"
                  required
                  className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                />
              </div>
              <div>
                <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="jane@example.com"
                  required
                  className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                />
              </div>

              {inviteError && (
                <div className="p-3 bg-[#ffdad6] rounded-xl flex items-start gap-2">
                  <span className="material-symbols-outlined text-[#ba1a1a] text-[18px] shrink-0">error</span>
                  <p className="font-['Manrope'] text-sm text-[#ba1a1a]">{inviteError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={inviting}
                className="w-full py-4 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                {inviting ? "Sending..." : "Send Invite"}
              </button>
            </form>

            {inviteUrl && (
              <div className="mt-4 p-4 bg-[#d1fae5] rounded-xl">
                <p className="font-['Manrope'] text-sm font-bold text-[#065f46] mb-2">
                  Invite link created (expires in 30 days):
                </p>
                <p className="font-['Inter'] text-xs text-[#065f46] break-all mb-3">{inviteUrl}</p>
                <button
                  onClick={() => navigator.clipboard.writeText(inviteUrl)}
                  className="px-4 py-2 border border-[#065f46]/30 rounded-lg font-['Manrope'] font-bold text-xs text-[#065f46] hover:bg-[#065f46]/10 transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  Copy Link
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: investor directory table */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-[#bbcac6]/15 flex items-center justify-between">
              <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a]">
                Investor Directory
              </h2>
              <span className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                {investors.length} total
              </span>
            </div>

            {loading ? (
              <div className="divide-y divide-[#bbcac6]/10">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#eff4ff] animate-pulse rounded-full" />
                      <div className="space-y-2">
                        <div className="h-4 w-28 bg-[#eff4ff] animate-pulse rounded" />
                        <div className="h-3 w-36 bg-[#eff4ff] animate-pulse rounded" />
                      </div>
                    </div>
                    <div className="h-4 w-20 bg-[#eff4ff] animate-pulse rounded" />
                  </div>
                ))}
              </div>
            ) : investors.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-[#6c7a77] font-['Manrope'] text-sm">No investors yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#bbcac6]/10">
                {investors.map((inv) => {
                  const totalCapital = (inv.investments ?? []).reduce(
                    (sum, i) => sum + Number(i.capital_contributed ?? 0),
                    0
                  );
                  const propCodes = (inv.investments ?? [])
                    .map((i) => i.properties?.code)
                    .filter(Boolean);
                  const isExpanded = expandedId === inv.id;
                  const form = addInvForm[inv.id] ?? {};
                  const initials = (inv.full_name ?? inv.email ?? "??")
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <div key={inv.id}>
                      <button
                        onClick={() => handleToggleExpand(inv.id)}
                        className="w-full text-left px-6 py-5 hover:bg-[#f8f9ff] transition-colors"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-[#d9e3f6] flex items-center justify-center text-[#006b5f] font-bold text-xs shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-['Manrope'] font-bold text-[#121c2a] text-sm truncate">
                                {inv.full_name ?? "—"}
                              </p>
                              <p className="font-['Manrope'] text-[#6c7a77] text-xs truncate">{inv.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {propCodes.map((code) => (
                              <span
                                key={code}
                                className="font-['Inter'] text-xs font-bold bg-[#eff4ff] text-[#006b5f] px-2 py-1 rounded"
                              >
                                {code}
                              </span>
                            ))}
                            <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#121c2a] tabular-nums">
                              {formatSGD(totalCapital)}
                            </span>
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                              inv.is_active ? "bg-[#d1fae5] text-[#065f46]" : "bg-[#e6eeff] text-[#555f6f]"
                            }`}>
                              {inv.is_active ? "Active" : "Pending"}
                            </span>
                            <span className={`material-symbols-outlined text-[16px] text-[#6c7a77] transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                              expand_more
                            </span>
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="bg-[#f8f9ff] border-t border-[#bbcac6]/10 px-6 py-6">
                          {/* Investments table */}
                          <h4 className="font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-3">
                            Investments
                          </h4>

                          {(inv.investments ?? []).length === 0 ? (
                            <p className="font-['Manrope'] text-sm text-[#6c7a77] mb-4">No investments yet.</p>
                          ) : (
                            <div className="rounded-xl overflow-hidden border border-[#bbcac6]/15 mb-5">
                              <table className="w-full">
                                <thead className="bg-[#eff4ff]">
                                  <tr>
                                    <th className="text-left px-4 py-3 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">Property</th>
                                    <th className="text-right px-4 py-3 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">Capital</th>
                                    <th className="text-right px-4 py-3 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">Share</th>
                                    <th className="text-left px-4 py-3 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold hidden sm:table-cell">Equity</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#bbcac6]/10 bg-white">
                                  {(inv.investments ?? []).map((i) => {
                                    const sharePercent = Number(i.share_percentage ?? 0);
                                    return (
                                      <tr key={i.id}>
                                        <td className="px-4 py-3 font-['Manrope'] text-sm font-medium text-[#121c2a]">
                                          {i.properties?.name ?? "—"}
                                        </td>
                                        <td className="px-4 py-3 text-right font-['Manrope'] text-sm tabular-nums font-medium">
                                          {formatSGD(i.capital_contributed)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#006b5f]">
                                          {sharePercent.toFixed(1)}%
                                        </td>
                                        <td className="px-4 py-3 hidden sm:table-cell">
                                          <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 bg-[#eff4ff] rounded-full overflow-hidden max-w-[80px]">
                                              <div
                                                className="h-full bg-[#006b5f] rounded-full"
                                                style={{ width: `${Math.min(sharePercent, 100)}%` }}
                                              />
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Add Investment form */}
                          <h4 className="font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-3">
                            Add Investment
                          </h4>
                          <div className="flex flex-col sm:flex-row gap-3">
                            <select
                              className="flex-1 bg-white border border-[#bbcac6]/30 rounded-xl px-4 py-3 font-['Manrope'] text-sm text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                              value={form.propertyId ?? ""}
                              onChange={(e) =>
                                setAddInvForm((prev) => ({
                                  ...prev,
                                  [inv.id]: { ...form, propertyId: e.target.value },
                                }))
                              }
                            >
                              <option value="">Select property...</option>
                              {properties.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.code})
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Capital (SGD)"
                              value={form.capital ?? ""}
                              onChange={(e) =>
                                setAddInvForm((prev) => ({
                                  ...prev,
                                  [inv.id]: { ...form, capital: e.target.value },
                                }))
                              }
                              className="flex-1 bg-white border border-[#bbcac6]/30 rounded-xl px-4 py-3 font-['Manrope'] text-sm text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                            />
                            <button
                              onClick={() => handleAddInvestment(inv.id)}
                              disabled={!form.propertyId || !form.capital}
                              className="px-5 py-3 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all shrink-0"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Monthly Distributions Section ─────────────────────────────────────── */}
      <div className="mt-12 mb-10">
        <h2 className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-[#121c2a] tracking-tight mb-1">
          Monthly Distributions
        </h2>
        <p className="text-[#6c7a77] font-['Manrope'] font-medium">
          Calculate and approve investor distributions from confirmed P&L data.
        </p>
      </div>

      {/* Calculation controls */}
      <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm mb-8">
        <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] mb-5 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#006b5f] text-[20px]">calculate</span>
          Calculate Distributions
        </h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <div>
            <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
              Month
            </label>
            <input
              type="month"
              value={distMonth}
              onChange={(e) => setDistMonth(e.target.value)}
              className="bg-[#eff4ff] border-0 rounded-xl px-4 py-3 font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
            />
          </div>
          <button
            onClick={handleCalculateDistributions}
            disabled={calculating}
            className="px-6 py-3 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">sync</span>
            {calculating ? "Calculating..." : "Calculate Distributions"}
          </button>
        </div>

        {calcError && (
          <div className="mt-4 p-3 bg-[#ffdad6] rounded-xl flex items-start gap-2">
            <span className="material-symbols-outlined text-[#ba1a1a] text-[18px] shrink-0">error</span>
            <p className="font-['Manrope'] text-sm text-[#ba1a1a]">{calcError}</p>
          </div>
        )}
      </div>

      {/* Pending Distributions */}
      {distLoading ? (
        <div className="h-32 bg-[#eff4ff] animate-pulse rounded-2xl mb-8" />
      ) : pendingDistributions.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-5 border-b border-[#bbcac6]/15 flex items-center justify-between">
            <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#e6a817] text-[20px]">pending</span>
              Pending Distributions
            </h3>
            <button
              onClick={handleApproveAll}
              disabled={approvingAll}
              className="px-4 py-2 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">done_all</span>
              {approvingAll ? "Approving..." : "Approve All"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#eff4ff]">
                <tr>
                  <th className="text-left px-4 py-3 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">Investor</th>
                  <th className="text-left px-4 py-3 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">Property</th>
                  <th className="text-right px-4 py-3 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">Gross Profit</th>
                  <th className="text-right px-4 py-3 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">Share %</th>
                  <th className="text-right px-4 py-3 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">Distribution</th>
                  <th className="text-center px-4 py-3 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#bbcac6]/10">
                {pendingDistributions.map((dist) => (
                  <tr key={dist.id} className="hover:bg-[#f8f9ff] transition-colors">
                    <td className="px-4 py-3 font-['Manrope'] text-sm font-medium text-[#121c2a]">
                      {dist.investors?.full_name ?? dist.investors?.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-['Manrope'] text-sm text-[#6c7a77]">
                      {dist.properties?.name ?? "—"}
                      {dist.properties?.code && (
                        <span className="ml-1.5 font-['Inter'] text-xs font-bold bg-[#eff4ff] text-[#006b5f] px-1.5 py-0.5 rounded">
                          {dist.properties.code}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-['Manrope'] text-sm tabular-nums">
                      {formatSGD(dist.gross_profit)}
                    </td>
                    <td className="px-4 py-3 text-right font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#006b5f]">
                      {Number(dist.share_percentage ?? 0).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#121c2a] tabular-nums">
                      {formatSGD(dist.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleMarkPaid(dist.id)}
                        disabled={approvingId === dist.id}
                        className="px-3 py-1.5 bg-[#d1fae5] text-[#065f46] rounded-lg font-['Manrope'] font-bold text-xs hover:bg-[#065f46] hover:text-white disabled:opacity-50 transition-all"
                      >
                        {approvingId === dist.id ? "..." : "Mark Paid"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Paid Distributions */}
      {!distLoading && paidDistributions.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-5 border-b border-[#bbcac6]/15">
            <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#16a34a] text-[20px]">check_circle</span>
              Paid Distributions
              <span className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold ml-2">
                {paidDistributions.length} paid
              </span>
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#f0fdf4]">
                <tr>
                  <th className="text-left px-4 py-3 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">Investor</th>
                  <th className="text-left px-4 py-3 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">Property</th>
                  <th className="text-right px-4 py-3 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">Amount</th>
                  <th className="text-right px-4 py-3 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">Paid At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#bbcac6]/10">
                {paidDistributions.map((dist) => (
                  <tr key={dist.id} className="hover:bg-[#f8f9ff] transition-colors">
                    <td className="px-4 py-3 font-['Manrope'] text-sm font-medium text-[#121c2a]">
                      {dist.investors?.full_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-['Manrope'] text-sm text-[#6c7a77]">
                      {dist.properties?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#16a34a] tabular-nums">
                      {formatSGD(dist.amount)}
                    </td>
                    <td className="px-4 py-3 text-right font-['Manrope'] text-xs text-[#6c7a77]">
                      {dist.paid_at ? new Date(dist.paid_at).toLocaleDateString("en-SG", {
                        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                      }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state for distributions */}
      {!distLoading && distributions.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm">
          <span className="material-symbols-outlined text-5xl text-[#bbcac6]">payments</span>
          <p className="font-['Plus_Jakarta_Sans'] text-base font-semibold text-[#1a2e2b]">
            No distributions for this month
          </p>
          <p className="font-['Manrope'] text-sm text-[#6c7a77]">
            Select a month and calculate distributions from confirmed bank transactions.
          </p>
        </div>
      )}
    </PortalLayout>
  );
}
