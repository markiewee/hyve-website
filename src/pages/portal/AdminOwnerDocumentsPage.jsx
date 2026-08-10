// Admin side of owner property documents.
//
// Mark uploads a bill (the first real case is AC servicing), tags it to a
// property and the month it covers, and the owner of that property sees it in
// their portal. Nothing here reads or writes tenant documents.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import {
  PROPERTY_DOC_TYPES,
  PROPERTY_DOC_TYPE_LABELS,
  propertyDocLabel,
  formatPeriodMonth,
  formatFileSize,
} from "../../lib/propertyDocuments";
import {
  MAX_PROPERTY_DOC_BYTES,
  uploadPropertyDocument,
  deletePropertyDocument,
  adminSignedUrl,
} from "../../lib/propertyDocumentsApi";

function currentMonthInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d)) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminOwnerDocumentsPage() {
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState("");
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null); // { kind: "error" | "ok", text }

  // Upload form
  const [file, setFile] = useState(null);
  const [docType, setDocType] = useState("AC_SERVICING");
  const [title, setTitle] = useState("");
  const [periodMonth, setPeriodMonth] = useState(currentMonthInput());
  const [notes, setNotes] = useState("");
  const [visibleToOwner, setVisibleToOwner] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    supabase
      .from("properties")
      .select("id, name, owner_emails")
      .order("name")
      .then(({ data }) => {
        const list = data ?? [];
        setProperties(list);
        setPropertyId((prev) => prev || list[0]?.id || "");
      });
  }, []);

  const loadDocs = useCallback(async () => {
    if (!propertyId) {
      setDocs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("property_documents")
      .select("*")
      .eq("property_id", propertyId)
      .order("period_month", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) setMessage({ kind: "error", text: `Could not load documents: ${error.message}` });
    setDocs(data ?? []);
    setLoading(false);
  }, [propertyId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  function onFileSelect(e) {
    const picked = e.target.files?.[0] || null;
    setFile(picked);
    // Seed the title from the filename so the common case is one click.
    if (picked && !title.trim()) {
      setTitle(picked.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim());
    }
  }

  async function onUpload(e) {
    e.preventDefault();
    setMessage(null);
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await uploadPropertyDocument({
        propertyId,
        file,
        docType,
        title,
        periodMonth,
        notes,
        visibleToOwner,
        uploadedBy: user?.id ?? null,
      });
      setMessage({ kind: "ok", text: "Uploaded. The owner can see it now." });
      setFile(null);
      setTitle("");
      setNotes("");
      e.target.reset?.();
      await loadDocs();
    } catch (err) {
      setMessage({ kind: "error", text: err.message });
    } finally {
      setUploading(false);
    }
  }

  async function onPreview(doc) {
    setMessage(null);
    setBusyId(doc.id);
    try {
      const url = await adminSignedUrl(doc);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setMessage({ kind: "error", text: err.message });
    } finally {
      setBusyId(null);
    }
  }

  async function onToggleVisible(doc) {
    setMessage(null);
    setBusyId(doc.id);
    const { error } = await supabase
      .from("property_documents")
      .update({ visible_to_owner: !doc.visible_to_owner })
      .eq("id", doc.id);
    if (error) setMessage({ kind: "error", text: error.message });
    setBusyId(null);
    await loadDocs();
  }

  async function onDelete(doc) {
    if (!window.confirm(`Delete "${doc.title}"? The owner will lose access to it.`)) return;
    setMessage(null);
    setBusyId(doc.id);
    try {
      await deletePropertyDocument(doc);
      await loadDocs();
    } catch (err) {
      setMessage({ kind: "error", text: err.message });
    } finally {
      setBusyId(null);
    }
  }

  const selected = properties.find((p) => p.id === propertyId);
  const ownerCount = selected?.owner_emails?.length ?? 0;

  const inputClass =
    "w-full bg-surface border border-border px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none";
  const labelClass =
    "block font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-variant mb-1.5";

  return (
    <PortalLayout>
      <div className="mb-6">
        <h1 className="font-display text-[28px] leading-tight text-foreground">Owner Documents</h1>
        <p className="text-foreground-variant text-sm mt-1 max-w-[70ch]">
          Bills and statements that belong to the property owner: AC servicing, contractor
          invoices, monthly statements. Whatever you upload here shows up in that property
          owner's portal. Tenant documents are separate and are not affected.
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 p-3 border-l-2 text-sm ${
            message.kind === "error"
              ? "bg-red-500/10 border-red-500 text-red-300"
              : "bg-emerald-500/10 border-emerald-500 text-emerald-300"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mb-6 max-w-sm">
        <label className={labelClass} htmlFor="property-select">Property</label>
        <select
          id="property-select"
          className={inputClass}
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <p className="text-[12px] text-foreground-variant mt-1.5">
          {ownerCount > 0
            ? `${ownerCount} owner contact${ownerCount === 1 ? "" : "s"} on file.`
            : "No owner email on file for this property yet."}
        </p>
      </div>

      {/* Upload */}
      <form onSubmit={onUpload} className="mb-10 border border-border bg-surface p-5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-variant mb-4">
          Upload a document
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="doc-file">File</label>
            <input
              id="doc-file"
              type="file"
              onChange={onFileSelect}
              accept=".pdf,.png,.jpg,.jpeg,.webp,.heic"
              className="block w-full text-sm text-foreground-variant file:mr-3 file:border file:border-border file:bg-surface-container file:px-3 file:py-1.5 file:text-sm file:text-foreground"
            />
            <p className="text-[12px] text-foreground-variant mt-1.5">
              PDF or image, up to {formatFileSize(MAX_PROPERTY_DOC_BYTES)}.
              {file ? ` Selected: ${file.name} (${formatFileSize(file.size)})` : ""}
            </p>
          </div>

          <div>
            <label className={labelClass} htmlFor="doc-type">Type</label>
            <select id="doc-type" className={inputClass} value={docType} onChange={(e) => setDocType(e.target.value)}>
              {PROPERTY_DOC_TYPES.map((t) => (
                <option key={t} value={t}>{PROPERTY_DOC_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="doc-month">Month covered</label>
            <input
              id="doc-month"
              type="month"
              className={inputClass}
              value={periodMonth}
              onChange={(e) => setPeriodMonth(e.target.value)}
            />
            <p className="text-[12px] text-foreground-variant mt-1.5">
              Leave blank if it is not tied to a month.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="doc-title">Title the owner sees</label>
            <input
              id="doc-title"
              type="text"
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="AC servicing, August 2026"
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="doc-notes">Note (optional)</label>
            <input
              id="doc-notes"
              type="text"
              className={inputClass}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Quarterly service across all 6 units"
            />
          </div>

          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              id="doc-visible"
              type="checkbox"
              checked={visibleToOwner}
              onChange={(e) => setVisibleToOwner(e.target.checked)}
              className="accent-accent"
            />
            <label htmlFor="doc-visible" className="text-sm text-foreground-variant">
              Visible to the owner straight away
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={uploading || !file || !propertyId}
          className="mt-5 inline-flex items-center gap-2 bg-accent text-background px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[18px]">upload</span>
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </form>

      {/* Existing documents */}
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-variant mb-3">
        On file{selected ? ` for ${selected.name}` : ""}
      </h2>

      {loading ? (
        <div className="text-foreground-variant text-sm py-10 text-center">Loading…</div>
      ) : docs.length === 0 ? (
        <div className="text-foreground-variant text-sm py-10 text-center border border-border bg-surface">
          Nothing uploaded for this property yet.
        </div>
      ) : (
        <div className="overflow-x-auto border border-border bg-surface">
          <table className="w-full min-w-[840px] text-left">
            <thead>
              <tr className="border-b border-border bg-surface-container">
                {["Title", "Type", "Month", "Size", "Uploaded", "Owner sees it", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-variant">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-foreground">
                    {d.title}
                    {d.notes && (
                      <span className="block text-[12px] text-foreground-variant">{d.notes}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-foreground-variant whitespace-nowrap">
                    {propertyDocLabel(d.doc_type)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px] text-foreground-variant whitespace-nowrap">
                    {formatPeriodMonth(d.period_month) || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px] text-foreground-variant whitespace-nowrap">
                    {formatFileSize(d.file_size) || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px] text-foreground-variant whitespace-nowrap">
                    {fmtDate(d.created_at)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => onToggleVisible(d)}
                      disabled={busyId === d.id}
                      className={`font-mono text-[11px] uppercase tracking-[0.14em] rounded-full px-2.5 py-1 border disabled:opacity-50 ${
                        d.visible_to_owner
                          ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
                          : "text-foreground-variant bg-surface-container border-border"
                      }`}
                    >
                      {d.visible_to_owner ? "Visible" : "Hidden"}
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onPreview(d)}
                        disabled={busyId === d.id}
                        className="inline-flex items-center gap-1 text-[12px] text-accent border border-accent/40 rounded-full px-3 py-1 hover:bg-accent/10 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        View
                      </button>
                      <button
                        onClick={() => onDelete(d)}
                        disabled={busyId === d.id}
                        className="inline-flex items-center gap-1 text-[12px] text-red-300 border border-red-500/40 rounded-full px-3 py-1 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PortalLayout>
  );
}
