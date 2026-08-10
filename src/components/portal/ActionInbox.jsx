// Action Inbox, single render of "what needs admin attention now."
// Uses useAdminInbox hook. Pass `limit` to cap the list (dashboard widget),
// or omit for the full inbox page.

import { Link } from "react-router-dom";
import { useAdminInbox } from "../../hooks/useAdminInbox";

const SEVERITY_STYLES = {
  red:   { dot: "bg-red-400", text: "text-red-300", label: "URGENT" },
  amber: { dot: "bg-amber-400", text: "text-amber-300", label: "THIS WEEK" },
  info:  { dot: "bg-blue-400", text: "text-blue-300", label: "INFO" },
};

function formatTimeAgo(iso) {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  const diffSec = Math.round((ts - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 3600) return diffSec < 0 ? `${Math.round(abs / 60)}m ago` : `in ${Math.round(abs / 60)}m`;
  if (abs < 86400) return diffSec < 0 ? `${Math.round(abs / 3600)}h ago` : `in ${Math.round(abs / 3600)}h`;
  if (abs < 86400 * 30) return diffSec < 0 ? `${Math.round(abs / 86400)}d ago` : `in ${Math.round(abs / 86400)}d`;
  return new Date(iso).toLocaleDateString("en-SG", { day: "numeric", month: "short" });
}

export default function ActionInbox({ limit, showHeader = true, compact = false }) {
  const { items, counts, loading } = useAdminInbox();
  const display = typeof limit === "number" ? items.slice(0, limit) : items;
  const overflow = typeof limit === "number" && items.length > limit ? items.length - limit : 0;

  // Group by severity for visual separators
  const groups = [
    { severity: "red", items: display.filter((i) => i.severity === "red") },
    { severity: "amber", items: display.filter((i) => i.severity === "amber") },
    { severity: "info", items: display.filter((i) => i.severity === "info") },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="bg-surface rounded-2xl border border-border overflow-hidden">
      {showHeader && (
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-foreground">
              Needs your attention
            </h3>
            {!loading && (
              <p className="text-xs text-foreground-variant mt-0.5">
                {counts.total} item{counts.total === 1 ? "" : "s"}
                {counts.red > 0 && (
                  <>
                    {" · "}
                    <span className="text-red-300 font-bold">{counts.red} urgent</span>
                  </>
                )}
              </p>
            )}
          </div>
          {!compact && (
            <Link
              to="/portal/admin/inbox"
              className="text-xs font-bold text-accent hover:underline"
            >
              View all →
            </Link>
          )}
        </div>
      )}

      {loading ? (
        <div className="p-6 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 bg-surface-container rounded-lg animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <span className="material-symbols-outlined text-3xl text-emerald-400 mb-2 block">
            check_circle
          </span>
          <p className="text-sm text-foreground-variant font-medium">All clear. Nothing needs attention.</p>
        </div>
      ) : (
        <div>
          {groups.map((g) => {
            const style = SEVERITY_STYLES[g.severity];
            return (
              <div key={g.severity}>
                <div className="px-6 py-2 bg-surface-container border-b border-border">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest ${style.text}`}
                  >
                    {style.label} · {g.items.length}
                  </span>
                </div>
                <ul className="divide-y divide-white/10">
                  {g.items.map((it) => (
                    <li key={it.key}>
                      <Link
                        to={it.to}
                        className="flex items-center gap-3 px-6 py-3 hover:bg-white/5 transition-colors"
                      >
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`}
                        />
                        <span className="material-symbols-outlined text-[20px] text-foreground-variant shrink-0">
                          {it.icon}
                        </span>
                        <span className="flex-1 text-sm font-medium text-foreground truncate">
                          {it.label}
                        </span>
                        {it.meta && (
                          <span className="text-xs text-foreground-variant font-medium shrink-0">
                            {it.meta}
                          </span>
                        )}
                        <span className="text-xs text-foreground-variant shrink-0 w-16 text-right">
                          {formatTimeAgo(it.time)}
                        </span>
                        <span className="material-symbols-outlined text-[18px] text-foreground-variant shrink-0">
                          chevron_right
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {overflow > 0 && (
            <Link
              to="/portal/admin/inbox"
              className="block text-center px-6 py-3 text-xs font-bold text-accent hover:bg-white/5 transition-colors border-t border-border"
            >
              + {overflow} more →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
