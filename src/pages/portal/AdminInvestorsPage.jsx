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

  useEffect(() => {
    fetchInvestors();
    fetchProperties();
  }, [fetchInvestors, fetchProperties]);

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

  const totalCapitalAll = investors.reduce(
    (sum, inv) => sum + (inv.investments ?? []).reduce((s, i) => s + Number(i.capital_contributed ?? 0), 0),
    0
  );
  const activeCount = investors.filter((i) => i.is_active).length;

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
                {inviting ? "Sending…" : "Send Invite"}
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
                              <option value="">Select property…</option>
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
    </PortalLayout>
  );
}
