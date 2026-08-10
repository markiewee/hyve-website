// Owner-facing property documents: AC servicing bills, contractor invoices,
// statements. These belong to the PROPERTY and its owner, not to a tenant.
//
// Deliberately separate from tenant documents in every respect: its own table
// (property_documents), its own private storage bucket (property-documents),
// its own download action. Owners see tenant ID and passport only, and that is
// not widened by anything in here.
//
// This module is deliberately dependency-free so it can be unit tested with
// `node --test`. Everything that touches Supabase lives in
// propertyDocumentsApi.js.

export const PROPERTY_DOCS_BUCKET = "property-documents";

// Must stay in sync with the doc_type CHECK constraint in
// supabase/migrations/20260810100000_property_documents.sql
export const PROPERTY_DOC_TYPES = [
  "AC_SERVICING",
  "INVOICE",
  "STATEMENT",
  "RECEIPT",
  "REPORT",
  "OTHER",
];

export const PROPERTY_DOC_TYPE_LABELS = {
  AC_SERVICING: "AC Servicing",
  INVOICE: "Invoice",
  STATEMENT: "Statement",
  RECEIPT: "Receipt",
  REPORT: "Report",
  OTHER: "Other",
};

export function propertyDocLabel(docType) {
  return PROPERTY_DOC_TYPE_LABELS[docType] || "Document";
}

// "2026-08-01" (or a Date) -> "Aug 2026". Dates are parsed off the ISO string
// rather than through Date() so a plain date never shifts a month backwards in
// a negative-offset timezone.
export function formatPeriodMonth(value) {
  if (!value) return null;
  const iso = typeof value === "string" ? value : value.toISOString();
  const m = iso.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthIndex = parseInt(m[2], 10) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;
  return `${MONTHS[monthIndex]} ${m[1]}`;
}

// <input type="month"> gives "2026-08". The column is a date, so store the
// first of that month.
export function monthInputToDate(value) {
  if (!value) return null;
  return /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : null;
}

// "2026-08-01" -> "2026-08", for populating <input type="month"> on edit.
export function dateToMonthInput(value) {
  if (!value) return "";
  const iso = typeof value === "string" ? value : value.toISOString();
  return iso.slice(0, 7);
}

export function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Files are namespaced by property so the bucket stays legible and a stray
// filename can never collide across properties.
export function storagePathFor(propertyId, fileName) {
  const safe = (fileName || "document")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
  const unique =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${propertyId}/${unique}-${safe}`;
}
