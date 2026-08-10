import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import Wordmark from "../../components/Wordmark";
import {
  propertyDocLabel,
  formatPeriodMonth,
  formatFileSize,
} from "../../lib/propertyDocuments";
import { ownerSignedUrl } from "../../lib/propertyDocumentsApi";

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
  // { doc, url, isPdf } while a document is open in the viewer modal.
  const [viewer, setViewer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Property-level documents (AC servicing bills, invoices, statements). These
  // belong to the property, not to a tenant, and come from their own table.
  const [propertyDocs, setPropertyDocs] = useState([]);
  const [propertyDocsError, setPropertyDocsError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [roster, docs, propDocs] = await Promise.all([
        supabase.rpc("get_landlord_roster"),
        supabase.rpc("get_landlord_documents"),
        // RLS scopes this to the caller's own property and to rows flagged
        // visible, so no property filter is needed (or trustworthy) here.
        supabase
          .from("property_documents")
          .select("id, doc_type, title, period_month, file_name, file_size, notes, created_at")
          .order("period_month", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false }),
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
      // A failed document load must not blank the roster, so it gets its own
      // error slot rather than the page-level one.
      if (propDocs.error) setPropertyDocsError(propDocs.error.message);
      else setPropertyDocs(propDocs.data || []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function signedDocUrl(doc) {
    const { data: { session } } = await supabase.auth.getSession();
    const resp = await fetch("/api/portal/admin-actions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || ""}`,
      },
      body: JSON.stringify({ action: "landlord_doc_url", doc_id: doc.doc_id }),
    });
    const j = await resp.json();
    if (!resp.ok || !j.url) throw new Error(j.error || "Could not open document");
    return j.url;
  }

  // Opens the document in-page. The signed URL's path (before the query
  // string) tells us whether it's a PDF or an image.
  async function viewDoc(doc) {
    setDocError(null);
    setBusyDoc(doc.doc_id);
    try {
      const url = await signedDocUrl(doc);
      const isPdf = url.split("?")[0].toLowerCase().endsWith(".pdf");
      setViewer({ url, isPdf, label: `${docLabel(doc)} · ${doc.full_name}` });
    } catch (e) {
      setDocError(e.message || "Could not open document");
    } finally {
      setBusyDoc(null);
    }
  }

  // Same modal, different source. Property documents live in their own table
  // and their own bucket, and the owner has no storage access at all, so the
  // URL is minted server-side after re-checking ownership.
  async function viewPropertyDoc(doc) {
    setDocError(null);
    setBusyDoc(doc.id);
    try {
      const url = await ownerSignedUrl(doc.id);
      const isPdf =
        url.split("?")[0].toLowerCase().endsWith(".pdf") ||
        (doc.file_name || "").toLowerCase().endsWith(".pdf");
      setViewer({ url, isPdf, label: doc.title });
    } catch (e) {
      setDocError(e.message || "Could not open document");
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
  const current = rows.filter((r) => r.status !== "Upcoming").length;
  const upcoming = occupied - current;
  const nextMoveOut = rows
    .map((r) => r.move_out)
    .filter((d) => d && new Date(d) >= new Date())
    .sort((a, b) => new Date(a) - new Date(b))[0];

  // Shared renderer for the per-resident document chips (table + mobile cards).
  function docChips(r) {
    const docs = docsByKey[`${r.unit_code}|${r.full_name}`] || [];
    if (docs.length === 0) {
      return <span className="text-[12px] text-foreground-variant italic">Pending</span>;
    }
    return (
      <div className="flex flex-wrap gap-2">
        {docs.map((d) => (
          <button
            key={d.doc_id}
            onClick={() => viewDoc(d)}
            disabled={busyDoc === d.doc_id}
            className="inline-flex items-center gap-1.5 font-mono text-[12px] text-accent border border-accent/40 rounded-full px-3 py-1 hover:bg-accent/10 transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">visibility</span>
            {busyDoc === d.doc_id ? "…" : docLabel(d)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Wordmark size="md" variant="lazybee" />
            <span className="hidden sm:inline font-mono text-[11px] uppercase tracking-[0.2em] text-accent border border-accent/40 rounded-full px-3 py-1">
              Landlord View
            </span>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-sm text-foreground-variant hover:text-accent transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="font-display text-[34px] leading-[1.05] text-foreground">{propertyName}</h1>
          <p className="text-foreground-variant mt-2 max-w-[62ch]">
            Who's in each unit, with passport and immigration pass details. View or download each resident's ID and passport.
          </p>
        </div>

        {docError && (
          <div className="mb-6 p-4 bg-red-500/10 border-l-2 border-red-500 text-red-300 text-sm">
            {docError}
          </div>
        )}

        {loading ? (
          <div className="text-foreground-variant text-sm py-16 text-center">Loading residents…</div>
        ) : error ? (
          <div className="p-4 bg-red-500/10 border-l-2 border-red-500 text-red-300 text-sm">
            Couldn't load residents: {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-foreground-variant text-sm py-16 text-center">No residents on record.</div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="border border-border bg-surface px-4 py-3">
                <div className="text-2xl font-mono font-bold tabular-nums tracking-tight text-foreground">{current}</div>
                <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-variant mt-1">
                  Current residents
                </div>
              </div>
              <div className="border border-border bg-surface px-4 py-3">
                <div className="text-2xl font-mono font-bold tabular-nums tracking-tight text-foreground">{upcoming}</div>
                <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-variant mt-1">
                  Upcoming move-ins
                </div>
              </div>
              <div className="border border-border bg-surface px-4 py-3 col-span-2 sm:col-span-1">
                <div className="text-2xl font-mono font-bold tabular-nums tracking-tight text-foreground">{fmtDate(nextMoveOut)}</div>
                <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-variant mt-1">
                  Next move-out
                </div>
              </div>
            </div>

            {/* Mobile: stacked resident cards */}
            <div className="md:hidden space-y-4">
              {rows.map((r, i) => (
                <div key={i} className="border border-border bg-surface p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="text-foreground font-medium">{r.full_name}</div>
                      <div className="font-mono text-[12px] text-foreground-variant mt-1">
                        {r.unit_code}
                        {r.nationality ? ` · ${r.nationality}` : ""}
                      </div>
                    </div>
                    {r.status === "Upcoming" && (
                      <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-full px-2.5 py-1">
                        Upcoming
                      </span>
                    )}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
                    <div>
                      <dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-variant">Passport / ID</dt>
                      <dd className="text-foreground mt-0.5">
                        {r.id_number || "—"}
                        {r.id_number && (
                          <span className="block text-[11px] text-foreground-variant">
                            {prettyLabel(r.id_type)}
                            {r.id_expiry ? ` · exp ${fmtDate(r.id_expiry)}` : ""}
                          </span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-variant">Immigration Pass</dt>
                      <dd className="text-foreground mt-0.5">
                        {r.pass_number || "—"}
                        {r.pass_number && (
                          <span className="block text-[11px] text-foreground-variant">
                            {prettyLabel(r.pass_type)}
                            {r.pass_expiry ? ` · exp ${fmtDate(r.pass_expiry)}` : ""}
                          </span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-variant">Move-in</dt>
                      <dd className="text-foreground mt-0.5">{fmtDate(r.move_in)}</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-variant">Move-out</dt>
                      <dd className="text-foreground mt-0.5">{fmtDate(r.move_out)}</dd>
                    </div>
                  </dl>
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-variant mb-2">
                      Documents
                    </div>
                    {docChips(r)}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto border border-border bg-surface">
              <table className="w-full min-w-[1040px] text-left">
                <thead>
                  <tr className="border-b border-border bg-surface-container">
                    {["Unit", "Resident", "Nationality", "Passport / ID", "Immigration Pass", "Move-in", "Move-out", "Documents", ""].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-variant"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-5 py-4 font-mono text-[13px] text-foreground whitespace-nowrap">
                        {r.unit_code}
                      </td>
                      <td className="px-5 py-4 text-foreground">{r.full_name}</td>
                      <td className="px-5 py-4 font-mono text-[13px] text-foreground-variant whitespace-nowrap">
                        {r.nationality || "—"}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {r.id_number ? (
                          <div>
                            <div className="font-mono text-foreground tabular-nums">{r.id_number}</div>
                            <div className="text-[11px] text-foreground-variant">
                              {prettyLabel(r.id_type)}
                              {r.id_expiry ? ` · exp ${fmtDate(r.id_expiry)}` : ""}
                            </div>
                          </div>
                        ) : (
                          <span className="text-foreground-variant">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {r.pass_number ? (
                          <div>
                            <div className="font-mono text-foreground tabular-nums">{r.pass_number}</div>
                            <div className="text-[11px] text-foreground-variant">
                              {prettyLabel(r.pass_type)}
                              {r.pass_expiry ? ` · exp ${fmtDate(r.pass_expiry)}` : ""}
                            </div>
                          </div>
                        ) : (
                          <span className="text-foreground-variant">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-[13px] text-foreground-variant whitespace-nowrap">
                        {fmtDate(r.move_in)}
                      </td>
                      <td className="px-5 py-4 font-mono text-[13px] text-foreground-variant whitespace-nowrap">
                        {fmtDate(r.move_out)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">{docChips(r)}</td>
                      <td className="px-5 py-4">
                        {r.status === "Upcoming" && (
                          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-full px-2.5 py-1">
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

        {/* Property documents. Deliberately outside the roster block above: the
            roster early-returns "No residents on record", and a property with an
            empty roster must still show its bills. */}
        <section className="mt-12">
          <h2 className="font-display text-[24px] leading-tight text-foreground">Property documents</h2>
          <p className="text-foreground-variant text-sm mt-1.5 max-w-[62ch]">
            Servicing bills, invoices and statements for {propertyName}.
          </p>

          {propertyDocsError ? (
            <div className="mt-5 p-4 bg-red-500/10 border-l-2 border-red-500 text-red-300 text-sm">
              Couldn't load documents: {propertyDocsError}
            </div>
          ) : loading ? (
            <div className="text-foreground-variant text-sm py-10">Loading documents…</div>
          ) : propertyDocs.length === 0 ? (
            <div className="mt-5 border border-border bg-surface px-5 py-8 text-center text-sm text-foreground-variant">
              Nothing here yet. Bills and statements will appear as they are filed.
            </div>
          ) : (
            <ul className="mt-5 border border-border bg-surface divide-y divide-border">
              {propertyDocs.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                  <div className="min-w-[200px] flex-1">
                    <div className="text-foreground">{d.title}</div>
                    <div className="font-mono text-[12px] text-foreground-variant mt-1">
                      {propertyDocLabel(d.doc_type)}
                      {formatPeriodMonth(d.period_month) ? ` · ${formatPeriodMonth(d.period_month)}` : ""}
                      {formatFileSize(d.file_size) ? ` · ${formatFileSize(d.file_size)}` : ""}
                    </div>
                    {d.notes && (
                      <div className="text-[12px] text-foreground-variant mt-1">{d.notes}</div>
                    )}
                  </div>
                  <button
                    onClick={() => viewPropertyDoc(d)}
                    disabled={busyDoc === d.id}
                    className="inline-flex items-center gap-1.5 font-mono text-[12px] text-accent border border-accent/40 rounded-full px-3 py-1 hover:bg-accent/10 transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                    {busyDoc === d.id ? "…" : "View"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* Document viewer */}
      {viewer && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 sm:p-8"
          onClick={() => setViewer(null)}
        >
          <div
            className="bg-surface rounded-2xl border border-border w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="font-['Inter'] text-sm font-semibold text-foreground">
                {viewer.label}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={viewer.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] font-['Inter'] font-semibold text-accent border border-accent/30 rounded-full px-3 py-1 hover:bg-accent/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Download
                </a>
                <button
                  onClick={() => setViewer(null)}
                  className="material-symbols-outlined text-foreground-variant hover:text-foreground transition-colors"
                >
                  close
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-[60vh] bg-black/20">
              {viewer.isPdf ? (
                <iframe
                  title="Document"
                  src={viewer.url}
                  className="w-full h-full min-h-[60vh]"
                />
              ) : (
                <div className="w-full h-full min-h-[60vh] flex items-center justify-center p-4">
                  <img
                    src={viewer.url}
                    alt="Document"
                    className="max-w-full max-h-[75vh] object-contain rounded-lg"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
