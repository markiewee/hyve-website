import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import Wordmark from "../../components/Wordmark";

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return "—";
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// "EMPLOYMENT_PASS" -> "Employment Pass", "NRIC" -> "NRIC"
function prettyLabel(s) {
  if (!s) return "";
  if (s === "NRIC") return "NRIC";
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Short label for the download button, e.g. "PASSPORT" -> "Passport".
function docLabel(d) {
  if (d.doc_type === "PASSPORT") return "Passport";
  if (d.doc_type === "ID_DOCUMENT") return "ID";
  return prettyLabel(d.doc_type);
}

export default function LandlordPage() {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const [rows, setRows] = useState([]);
  const [docsByKey, setDocsByKey] = useState({});
  const [busyDoc, setBusyDoc] = useState(null);
  const [docError, setDocError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [roster, docs] = await Promise.all([
        supabase.rpc("get_landlord_roster"),
        supabase.rpc("get_landlord_documents"),
      ]);
      if (!active) return;
      if (roster.error) setError(roster.error.message);
      else setRows(roster.data || []);
      // Group identity docs by unit + resident so each roster row can find its own.
      const byKey = {};
      for (const d of docs.data || []) {
        const key = `${d.unit_code}|${d.full_name}`;
        (byKey[key] = byKey[key] || []).push(d);
      }
      setDocsByKey(byKey);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function downloadDoc(doc) {
    setDocError(null);
    setBusyDoc(doc.doc_id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch("/api/portal/landlord-doc-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ doc_id: doc.doc_id }),
      });
      const j = await resp.json();
      if (resp.ok && j.url) window.open(j.url, "_blank", "noopener,noreferrer");
      else setDocError(j.error || "Could not open document");
    } catch {
      setDocError("Could not open document");
    } finally {
      setBusyDoc(null);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }
  if (!user || !profile) return <Navigate to="/portal/login" replace />;
  if (profile.role !== "LANDLORD") return <Navigate to="/portal/dashboard" replace />;

  const propertyName = profile.properties?.name || "Your Property";
  const occupied = rows.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Wordmark size="md" />
            <span className="hidden sm:inline text-xs font-['Inter'] font-bold uppercase tracking-widest text-accent border border-accent/30 rounded-full px-3 py-1">
              Landlord View
            </span>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-sm font-['Inter'] font-medium text-foreground-variant hover:text-accent transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">{propertyName}</h1>
          <p className="text-foreground-variant font-['Inter'] mt-1">
            Who's in each unit, with passport and immigration pass details. Download each resident's ID and passport.
          </p>
        </div>

        {docError && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/25 rounded-xl text-red-300 text-sm font-['Inter']">
            {docError}
          </div>
        )}

        {loading ? (
          <div className="text-foreground-variant text-sm py-16 text-center">Loading residents…</div>
        ) : error ? (
          <div className="p-4 bg-red-500/10 border border-red-500/25 rounded-xl text-red-300 text-sm font-['Inter']">
            Couldn't load residents: {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-foreground-variant text-sm py-16 text-center">No residents on record.</div>
        ) : (
          <>
            <div className="mb-4 text-sm font-['Inter'] text-foreground-variant">
              {occupied} {occupied === 1 ? "resident" : "residents"}
            </div>
            <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
              <table className="w-full min-w-[1040px] text-left">
                <thead>
                  <tr className="border-b border-border bg-surface-container">
                    {["Unit", "Resident", "Nationality", "Passport / ID", "Immigration Pass", "Move-in", "Move-out", "Documents", ""].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-[11px] font-['Inter'] font-bold uppercase tracking-widest text-foreground-variant"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-5 py-4 font-['Inter'] font-semibold text-foreground whitespace-nowrap">
                        {r.unit_code}
                      </td>
                      <td className="px-5 py-4 font-['Inter'] text-foreground">{r.full_name}</td>
                      <td className="px-5 py-4 font-['Inter'] text-foreground-variant whitespace-nowrap">
                        {r.nationality || "—"}
                      </td>
                      <td className="px-5 py-4 font-['Inter'] whitespace-nowrap">
                        {r.id_number ? (
                          <div>
                            <div className="font-semibold text-foreground">{r.id_number}</div>
                            <div className="text-[11px] text-foreground-variant">
                              {prettyLabel(r.id_type)}
                              {r.id_expiry ? ` · exp ${fmtDate(r.id_expiry)}` : ""}
                            </div>
                          </div>
                        ) : (
                          <span className="text-foreground-variant">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-['Inter'] whitespace-nowrap">
                        {r.pass_number ? (
                          <div>
                            <div className="font-semibold text-foreground">{r.pass_number}</div>
                            <div className="text-[11px] text-foreground-variant">
                              {prettyLabel(r.pass_type)}
                              {r.pass_expiry ? ` · exp ${fmtDate(r.pass_expiry)}` : ""}
                            </div>
                          </div>
                        ) : (
                          <span className="text-foreground-variant">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-['Inter'] text-foreground-variant whitespace-nowrap">
                        {fmtDate(r.move_in)}
                      </td>
                      <td className="px-5 py-4 font-['Inter'] text-foreground-variant whitespace-nowrap">
                        {fmtDate(r.move_out)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {(() => {
                          const docs = docsByKey[`${r.unit_code}|${r.full_name}`] || [];
                          if (docs.length === 0) {
                            return <span className="text-[12px] text-foreground-variant italic">Pending</span>;
                          }
                          return (
                            <div className="flex flex-wrap gap-2">
                              {docs.map((d) => (
                                <button
                                  key={d.doc_id}
                                  onClick={() => downloadDoc(d)}
                                  disabled={busyDoc === d.doc_id}
                                  className="inline-flex items-center gap-1.5 text-[12px] font-['Inter'] font-semibold text-accent border border-accent/30 rounded-full px-3 py-1 hover:bg-accent/10 transition-colors disabled:opacity-50"
                                >
                                  <span className="material-symbols-outlined text-[16px]">download</span>
                                  {busyDoc === d.doc_id ? "…" : docLabel(d)}
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-4">
                        {r.status === "Upcoming" && (
                          <span className="text-[11px] font-['Inter'] font-bold uppercase tracking-wider text-amber-600 bg-amber-500/10 rounded-full px-2.5 py-1">
                            Upcoming
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
