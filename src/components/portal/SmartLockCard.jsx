import { useState } from "react";
import { callTTLock } from "../../lib/ttlock";

/**
 * Read-only smart-lock card for the Locks page. Collapsed by default; on
 * expand, lazily pulls live status, current passcodes and recent entries
 * from TTLock. Sits in the same grid as the passcode LockCard.
 */
export default function SmartLockCard({ lock, icon = "lock", label, sublabel, accent = "#c47a35" }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [detail, setDetail] = useState(null);
  const [passcodes, setPasscodes] = useState([]);
  const [records, setRecords] = useState([]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [d, pc, rec] = await Promise.all([
        callTTLock("lock_detail", { lockId: lock.lockId }),
        callTTLock("list_passcodes", { lockId: lock.lockId }),
        callTTLock("lock_records", { lockId: lock.lockId }),
      ]);
      setDetail(d);
      setPasscodes(Array.isArray(pc?.list) ? pc.list : []);
      setRecords(Array.isArray(rec?.list) ? rec.list : []);
    } catch (e) {
      setErr(e.message || "Couldn't reach this lock.");
    }
    setLoading(false);
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !detail && !loading && !err) load();
  }

  const battery = detail?.electricQuantity ?? lock.electricQuantity ?? null;
  const fmt = (ms) =>
    ms ? new Date(ms).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className={`bg-surface rounded-xl border border-border overflow-hidden ${open ? "sm:col-span-2" : ""}`}>
      <button onClick={toggle} className="w-full flex items-start justify-between p-4 text-left hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <span className="material-symbols-outlined" style={{ color: accent }}>{icon}</span>
          <div className="min-w-0">
            <p className="font-['Inter'] font-bold text-foreground text-sm truncate">{label}</p>
            <p className="text-xs text-foreground-variant truncate">{sublabel || lock.lockAlias || lock.lockName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent/15 text-accent">Smart</span>
          {battery != null && <span className="text-xs text-foreground-variant">🔋{battery}%</span>}
          <span className="material-symbols-outlined text-foreground-variant text-[20px]">{open ? "expand_less" : "expand_more"}</span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-4">
          {loading ? (
            <p className="text-sm text-foreground-variant">Loading lock…</p>
          ) : err ? (
            <div className="text-sm text-red-400">
              {err}{" "}
              <button onClick={load} className="text-accent underline ml-1">Retry</button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Battery" value={battery != null ? `${battery}%` : "-"} />
                <Field label="Lock ID" value={String(lock.lockId)} />
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-2">
                  Passcodes ({passcodes.length})
                </p>
                {passcodes.length === 0 ? (
                  <p className="text-xs text-foreground-variant">None set on this lock.</p>
                ) : (
                  <div className="space-y-1">
                    {passcodes.map((p) => (
                      <div key={p.keyboardPwdId} className="flex justify-between text-sm">
                        <span className="text-foreground truncate">{p.keyboardPwdName || "-"}</span>
                        <span className="font-mono text-foreground-variant ml-3">{p.keyboardPwd}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-2">Recent entries</p>
                {records.length === 0 ? (
                  <p className="text-xs text-foreground-variant">No recent activity.</p>
                ) : (
                  <div className="space-y-1">
                    {records.slice(0, 10).map((r, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-foreground truncate">{r.username || r.keyboardPwd || "Entry"}</span>
                        <span className="text-foreground-variant ml-3">{fmt(r.lockDate)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={load} className="text-xs text-accent font-semibold hover:underline">Refresh</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-foreground-variant">{label}</p>
      <p className="text-foreground font-medium truncate">{value}</p>
    </div>
  );
}
