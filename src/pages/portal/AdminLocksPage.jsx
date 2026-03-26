import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";

async function ttlockApi(action, params = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch("/api/portal/admin-actions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ action: "ttlock", ttlock_action: action, ...params }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "TTLock API failed");
  return data;
}

export default function AdminLocksPage() {
  const [locks, setLocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  // Selected lock
  const [selectedLock, setSelectedLock] = useState(null);
  const [passcodes, setPasscodes] = useState([]);
  const [records, setRecords] = useState([]);
  const [passcodesLoading, setPasscodesLoading] = useState(false);

  // Generate form
  const [genName, setGenName] = useState("");
  const [genType, setGenType] = useState("2");
  const [genCustomCode, setGenCustomCode] = useState("");
  const [genTenantId, setGenTenantId] = useState("");
  const [generating, setGenerating] = useState(false);

  // Tenants for dropdown
  const [tenants, setTenants] = useState([]);

  useEffect(() => {
    fetchLocks();
    supabase.from("tenant_profiles").select("id, username, rooms(unit_code), tenant_details(full_name)")
      .eq("role", "TENANT").eq("is_active", true)
      .then(({ data }) => setTenants(data ?? []));
  }, []);

  async function fetchLocks() {
    setLoading(true);
    setError(null);
    try {
      const data = await ttlockApi("list_locks");
      setLocks(data.list || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  async function selectLock(lock) {
    setSelectedLock(lock);
    setPasscodesLoading(true);
    try {
      const [codes, recs] = await Promise.all([
        ttlockApi("list_passcodes", { lockId: lock.lockId }),
        ttlockApi("lock_records", { lockId: lock.lockId }),
      ]);
      setPasscodes(codes.list || []);
      setRecords(recs.list || []);
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
    setPasscodesLoading(false);
  }

  async function handleGenerate(e) {
    e.preventDefault();
    if (!selectedLock) return;
    setGenerating(true);
    setMessage(null);
    try {
      const params = {
        lockId: selectedLock.lockId,
        name: genName || `Code for ${genTenantId ? "member" : "general"}`,
        type: genType,
        tenantProfileId: genTenantId || null,
      };

      let result;
      if (genCustomCode) {
        result = await ttlockApi("add_passcode", { ...params, passcode: genCustomCode });
      } else {
        result = await ttlockApi("generate_passcode", params);
      }

      setMessage({ type: "success", text: `Code generated: ${result.keyboardPwd || genCustomCode}` });
      setGenName("");
      setGenCustomCode("");
      setGenTenantId("");

      // Refresh passcodes
      const codes = await ttlockApi("list_passcodes", { lockId: selectedLock.lockId });
      setPasscodes(codes.list || []);
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
    setGenerating(false);
  }

  async function handleDeletePasscode(passcodeId) {
    if (!confirm("Delete this passcode?")) return;
    try {
      await ttlockApi("delete_passcode", { lockId: selectedLock.lockId, passcodeId });
      setPasscodes(prev => prev.filter(p => p.keyboardPwdId !== passcodeId));
      setMessage({ type: "success", text: "Passcode deleted." });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
  }

  const PASSCODE_TYPES = { "1": "Timed", "2": "Permanent", "3": "One-time", "4": "Erase" };

  return (
    <PortalLayout>
      <div className="mb-10">
        <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
          Smart Locks
        </h1>
        <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">
          Manage TTLock smart locks, generate passcodes, and view access history.
        </p>
      </div>

      {message && (
        <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-['Manrope'] ${message.type === "error" ? "bg-[#ffdad6]/40 text-[#ba1a1a]" : "bg-[#d1fae5] text-[#065f46]"}`}>
          {message.text}
        </div>
      )}

      {error && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-800 font-semibold">TTLock not configured</p>
          <p className="text-xs text-amber-700 mt-1">{error}</p>
          <p className="text-xs text-amber-600 mt-2">Add these environment variables in Vercel:</p>
          <ul className="text-xs text-amber-700 mt-1 space-y-0.5 font-mono">
            <li>TTLOCK_CLIENT_ID</li>
            <li>TTLOCK_CLIENT_SECRET</li>
            <li>TTLOCK_USERNAME</li>
            <li>TTLOCK_PASSWORD_MD5</li>
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lock List */}
        <div className="lg:col-span-1">
          <section className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm">
            <div className="px-6 py-4 border-b border-[#bbcac6]/15">
              <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#006b5f] text-[20px]">lock</span>
                Locks
              </h2>
            </div>
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-[#eff4ff] animate-pulse rounded-lg" />)}
              </div>
            ) : locks.length === 0 ? (
              <div className="p-6 text-center text-sm text-[#6c7a77]">
                {error ? "Connect TTLock to see your locks." : "No locks found."}
              </div>
            ) : (
              <div className="divide-y divide-[#bbcac6]/10">
                {locks.map(lock => (
                  <button
                    key={lock.lockId}
                    onClick={() => selectLock(lock)}
                    className={`w-full text-left px-6 py-4 hover:bg-[#f8f9ff] transition-colors ${selectedLock?.lockId === lock.lockId ? "bg-[#006b5f]/5 border-l-2 border-[#006b5f]" : ""}`}
                  >
                    <p className="font-['Manrope'] font-bold text-sm text-[#121c2a]">{lock.lockAlias || lock.lockName || `Lock ${lock.lockId}`}</p>
                    <p className="font-['Inter'] text-xs text-[#6c7a77]">
                      {lock.electricQuantity != null ? `Battery: ${lock.electricQuantity}%` : ""} · ID: {lock.lockId}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Lock Detail */}
        <div className="lg:col-span-2 space-y-6">
          {selectedLock ? (
            <>
              {/* Generate Passcode */}
              <section className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm p-6">
                <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006b5f] text-[20px]">password</span>
                  Generate Passcode — {selectedLock.lockAlias || selectedLock.lockId}
                </h3>
                <form onSubmit={handleGenerate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Code Type</label>
                      <select value={genType} onChange={e => setGenType(e.target.value)}
                        className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none">
                        <option value="2">Permanent</option>
                        <option value="3">One-time</option>
                        <option value="1">Timed</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Assign to Member</label>
                      <select value={genTenantId} onChange={e => setGenTenantId(e.target.value)}
                        className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none">
                        <option value="">General / unassigned</option>
                        {tenants.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.tenant_details?.full_name || t.username || "Unnamed"} — {t.rooms?.unit_code}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Label</label>
                      <input type="text" value={genName} onChange={e => setGenName(e.target.value)}
                        placeholder="e.g. Edward's code"
                        className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">
                        Custom Code <span className="normal-case tracking-normal text-[#bbcac6]">(leave blank for random)</span>
                      </label>
                      <input type="text" value={genCustomCode} onChange={e => setGenCustomCode(e.target.value)}
                        placeholder="e.g. 123456"
                        className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none" />
                    </div>
                  </div>
                  <button type="submit" disabled={generating}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#006a61] disabled:opacity-40">
                    <span className="material-symbols-outlined text-[18px]">{generating ? "progress_activity" : "vpn_key"}</span>
                    {generating ? "Generating..." : "Generate Code"}
                  </button>
                </form>
              </section>

              {/* Active Passcodes */}
              <section className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm">
                <div className="px-6 py-4 border-b border-[#bbcac6]/15">
                  <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#006b5f] text-[20px]">dialpad</span>
                    Active Passcodes
                  </h3>
                </div>
                {passcodesLoading ? (
                  <div className="p-6"><div className="h-20 bg-[#eff4ff] animate-pulse rounded-lg" /></div>
                ) : passcodes.length === 0 ? (
                  <div className="p-6 text-center text-sm text-[#6c7a77]">No passcodes for this lock.</div>
                ) : (
                  <div className="divide-y divide-[#bbcac6]/10">
                    {passcodes.map(p => (
                      <div key={p.keyboardPwdId} className="px-6 py-4 flex items-center justify-between">
                        <div>
                          <p className="font-mono font-bold text-[#121c2a]">{p.keyboardPwd}</p>
                          <p className="text-xs text-[#6c7a77]">
                            {p.keyboardPwdName || "Unnamed"} · {PASSCODE_TYPES[p.keyboardPwdType] || "Unknown"}
                          </p>
                        </div>
                        <button onClick={() => handleDeletePasscode(p.keyboardPwdId)}
                          className="p-2 rounded-lg hover:bg-red-50 text-[#6c7a77] hover:text-red-600 transition-colors">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Access History */}
              <section className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm">
                <div className="px-6 py-4 border-b border-[#bbcac6]/15">
                  <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#006b5f] text-[20px]">history</span>
                    Recent Access (7 days)
                  </h3>
                </div>
                {records.length === 0 ? (
                  <div className="p-6 text-center text-sm text-[#6c7a77]">No recent access records.</div>
                ) : (
                  <div className="divide-y divide-[#bbcac6]/10 max-h-[300px] overflow-y-auto">
                    {records.map((r, i) => (
                      <div key={i} className="px-6 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-[#121c2a] font-['Manrope']">{r.username || r.keyboardPwd || "Unknown"}</p>
                          <p className="text-xs text-[#6c7a77]">{r.recordTypeStr || `Type ${r.recordType}`}</p>
                        </div>
                        <span className="text-xs text-[#6c7a77] font-['Inter']">
                          {r.lockDate ? new Date(r.lockDate).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-[#bbcac6] mb-3 block">lock</span>
              <p className="text-sm text-[#6c7a77]">Select a lock from the list to manage passcodes and view access history.</p>
            </div>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
