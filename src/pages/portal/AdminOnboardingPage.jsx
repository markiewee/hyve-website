import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import PortalLayout from "../../components/portal/PortalLayout";
import { STEP_LABELS } from "../../hooks/useOnboarding";

const STEP_BADGE_COLORS = {
  PERSONAL_DETAILS: "bg-[#e6eeff] text-[#555f6f]",
  ID_VERIFICATION: "bg-blue-100 text-blue-700",
  SIGN_TA: "bg-purple-100 text-purple-700",
  DEPOSIT: "bg-amber-100 text-amber-700",
  HOUSE_RULES: "bg-orange-100 text-orange-700",
  MOVE_IN_CHECKLIST: "bg-indigo-100 text-indigo-700",
  ACTIVE: "bg-[#d1fae5] text-[#065f46]",
  END_OF_TENANCY: "bg-[#ffdad6] text-[#ba1a1a]",
};

const STATUS_BADGE_COLORS = {
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  ACTIVE: "bg-[#d1fae5] text-[#065f46]",
  COMPLETE: "bg-[#d1fae5] text-[#065f46]",
  BLOCKED: "bg-[#ffdad6] text-[#ba1a1a]",
};

const STEP_ORDER = [
  "PERSONAL_DETAILS",
  "ID_VERIFICATION",
  "SIGN_TA",
  "DEPOSIT",
  "HOUSE_RULES",
  "MOVE_IN_CHECKLIST",
  "ACTIVE",
];

function getStepProgress(currentStep) {
  const idx = STEP_ORDER.indexOf(currentStep);
  if (idx === -1) return 0;
  return Math.round(((idx + 1) / STEP_ORDER.length) * 100);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminOnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Invite modal state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteRoomId, setInviteRoomId] = useState("");
  const [inviteDeposit, setInviteDeposit] = useState("2400");
  const [rooms, setRooms] = useState([]);
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);

  useEffect(() => {
    supabase.from("rooms").select("id, unit_code, name, property_id, properties(name)")
      .order("unit_code").then(({ data }) => setRooms(data ?? []));
  }, []);

  async function handleInvite(e) {
    e.preventDefault();
    if (!inviteUsername.trim() || !inviteRoomId) return;
    setInviting(true);
    setInviteResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const jwt = sessionData?.session?.access_token;
      const room = rooms.find(r => r.id === inviteRoomId);
      const res = await fetch("/api/portal/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          username: inviteUsername.trim(),
          room_id: inviteRoomId,
          property_id: room?.property_id,
          deposit_amount: inviteDeposit ? Number(inviteDeposit) : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Invite failed");
      setInviteResult({ type: "success", ...body });
      // Refresh list
      fetchOnboarding();
    } catch (err) {
      setInviteResult({ type: "error", message: err.message });
    } finally {
      setInviting(false);
    }
  }

  async function fetchOnboarding() {
    const { data, error } = await supabase
      .from("onboarding_progress")
      .select(
        "id, current_step, status, created_at, tenant_profile_id, tenant_profiles(id, role, username, rooms(unit_code, name), tenant_details(full_name))"
      )
      .order("created_at", { ascending: false });

    if (error) console.error("Error fetching onboarding progress:", error);
    setRows(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    async function fetchOnboardingInit() {
      const { data, error } = await supabase
        .from("onboarding_progress")
        .select(
          "id, current_step, status, created_at, tenant_profile_id, tenant_profiles(id, role, username, rooms(unit_code, name), tenant_details(full_name))"
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching onboarding progress:", error);
      }
      setRows(data ?? []);
      setLoading(false);
    }

    fetchOnboardingInit();
  }, []);

  const activeCount = rows.filter((r) => r.status === "ACTIVE").length;
  const inProgressCount = rows.filter((r) => r.status === "IN_PROGRESS").length;
  const blockedCount = rows.filter((r) => r.status === "BLOCKED").length;

  return (
    <PortalLayout>
      {/* Page header */}
      <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
            Tenant Onboarding
          </h1>
          <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">
            Track and manage tenant onboarding progress across all rooms.
          </p>
        </div>
        <button
          onClick={() => { setShowInvite(true); setInviteResult(null); setInviteUsername(""); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#006a61] transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Invite Tenant
        </button>
      </div>

      {/* Invite Tenant Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowInvite(false)}>
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#121c2a]">Invite New Tenant</h2>
              <button onClick={() => setShowInvite(false)} className="text-[#6c7a77] hover:text-[#121c2a]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {inviteResult?.type === "success" ? (
              <div className="space-y-4">
                <div className="bg-[#d1fae5] border border-[#065f46]/15 rounded-xl p-4">
                  <p className="text-sm font-bold text-[#065f46] mb-2">Tenant Created!</p>
                  <div className="text-xs text-[#065f46] space-y-1 font-mono">
                    <p>Username: <strong>{inviteResult.username}</strong></p>
                    <p>Password: <strong>{inviteResult.default_password}</strong></p>
                    <p>Login: hyve.sg/portal/login</p>
                  </div>
                </div>
                <p className="text-xs text-[#555f6f]">{inviteResult.message}</p>
                <button onClick={() => setShowInvite(false)} className="w-full py-3 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Username *</label>
                  <input
                    type="text"
                    value={inviteUsername}
                    onChange={(e) => setInviteUsername(e.target.value)}
                    placeholder="e.g. john-doe"
                    required
                    className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                  />
                  <p className="text-[10px] text-[#6c7a77]">Letters, numbers, hyphens, underscores. Min 3 chars.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Room *</label>
                  <select
                    value={inviteRoomId}
                    onChange={(e) => setInviteRoomId(e.target.value)}
                    required
                    className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                  >
                    <option value="">Select room</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>{r.unit_code} — {r.name} ({r.properties?.name})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Deposit Amount (SGD)</label>
                  <input
                    type="number"
                    value={inviteDeposit}
                    onChange={(e) => setInviteDeposit(e.target.value)}
                    placeholder="2400"
                    className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                  />
                </div>
                {inviteResult?.type === "error" && (
                  <p className="text-sm text-[#ba1a1a]">{inviteResult.message}</p>
                )}
                <button
                  type="submit"
                  disabled={inviting}
                  className="w-full py-3 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#006a61] disabled:opacity-50"
                >
                  {inviting ? "Creating..." : "Create Tenant Account"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-10">
        <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">Total</p>
          {loading ? (
            <div className="h-8 w-10 bg-[#eff4ff] animate-pulse rounded" />
          ) : (
            <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a]">{rows.length}</p>
          )}
        </div>
        <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">Active</p>
          {loading ? (
            <div className="h-8 w-10 bg-[#eff4ff] animate-pulse rounded" />
          ) : (
            <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#006b5f]">{activeCount}</p>
          )}
        </div>
        <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">In Progress</p>
          {loading ? (
            <div className="h-8 w-10 bg-[#eff4ff] animate-pulse rounded" />
          ) : (
            <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-blue-600">{inProgressCount}</p>
          )}
        </div>
        <div className="bg-[#006b5f] rounded-2xl p-6">
          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#71f8e4]/80 font-bold mb-3">Blocked</p>
          {loading ? (
            <div className="h-8 w-10 bg-white/10 animate-pulse rounded" />
          ) : (
            <p className={`font-['Plus_Jakarta_Sans'] text-3xl font-extrabold ${blockedCount > 0 ? "text-[#ffdad6]" : "text-white"}`}>
              {blockedCount}
            </p>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden">
          <div className="divide-y divide-[#bbcac6]/10">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-8 py-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#eff4ff] animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-[#eff4ff] animate-pulse rounded" />
                    <div className="h-3 w-32 bg-[#eff4ff] animate-pulse rounded" />
                  </div>
                </div>
                <div className="h-5 w-20 bg-[#eff4ff] animate-pulse rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-[#bbcac6]/15 shadow-sm text-center">
          <p className="text-[#6c7a77] font-['Manrope'] text-sm">No onboarding records found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#eff4ff]">
              <tr>
                <th className="text-left px-8 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                  Tenant
                </th>
                <th className="text-left px-6 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                  Status
                </th>
                <th className="text-left px-6 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                  Current Step
                </th>
                <th className="text-left px-6 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold hidden sm:table-cell">
                  Progress
                </th>
                <th className="text-left px-6 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold hidden md:table-cell">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#bbcac6]/10">
              {rows.map((row) => {
                const unitCode = row.tenant_profiles?.rooms?.unit_code ?? "—";
                const roomName = row.tenant_profiles?.rooms?.name ?? "";
                const tenantName = row.tenant_profiles?.tenant_details?.full_name ?? row.tenant_profiles?.username ?? "";
                const stepLabel = STEP_LABELS[row.current_step] ?? row.current_step;
                const stepColor = STEP_BADGE_COLORS[row.current_step] ?? "bg-[#e6eeff] text-[#555f6f]";
                const statusColor = STATUS_BADGE_COLORS[row.status] ?? "bg-[#e6eeff] text-[#555f6f]";
                const progress = getStepProgress(row.current_step);
                const initials = tenantName ? tenantName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : unitCode.slice(0, 2).toUpperCase();

                return (
                  <tr
                    key={row.id}
                    className="hover:bg-[#f8f9ff] cursor-pointer transition-colors"
                    onClick={() => navigate(`/portal/admin/onboarding/${row.id}`)}
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#d9e3f6] flex items-center justify-center text-[#006b5f] font-bold text-xs shrink-0">
                          {initials}
                        </div>
                        <div>
                          <p className="font-['Manrope'] font-bold text-[#121c2a] text-sm">
                            {tenantName || unitCode}
                          </p>
                          <p className="font-['Manrope'] text-[#6c7a77] text-xs">
                            {unitCode}{roomName ? ` — ${roomName}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${statusColor}`}>
                        {row.status ?? "—"}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${stepColor}`}>
                        {stepLabel}
                      </span>
                    </td>
                    <td className="px-6 py-5 hidden sm:table-cell">
                      <div className="flex items-center gap-3 min-w-[120px]">
                        <div className="flex-1 h-1.5 bg-[#eff4ff] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#006b5f] rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="font-['Inter'] text-xs font-bold text-[#6c7a77] shrink-0">
                          {progress}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 hidden md:table-cell font-['Manrope'] text-sm text-[#6c7a77]">
                      {formatDate(row.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PortalLayout>
  );
}
