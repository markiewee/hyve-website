// Supabase-facing operations for owner property documents.
//
// Split from propertyDocuments.js so the pure metadata helpers there stay
// dependency-free and unit testable; this half is the part that needs a live
// client and is exercised by the end-to-end checks instead.

import { supabase } from "./supabase";
import {
  PROPERTY_DOCS_BUCKET,
  storagePathFor,
  monthInputToDate,
  formatFileSize,
} from "./propertyDocuments";

export const MAX_PROPERTY_DOC_BYTES = 25 * 1024 * 1024; // matches the bucket limit

// Upload the file, then write the metadata row. If the row insert fails we
// delete the object we just uploaded, otherwise the bucket silently collects
// files no page can see.
export async function uploadPropertyDocument({
  propertyId,
  file,
  docType,
  title,
  periodMonth,
  notes,
  visibleToOwner = true,
  uploadedBy = null,
}) {
  if (!propertyId) throw new Error("Pick a property first");
  if (!file) throw new Error("Pick a file first");
  if (!title || !title.trim()) throw new Error("Give the document a title");
  if (file.size > MAX_PROPERTY_DOC_BYTES) {
    throw new Error(`File is too big (max ${formatFileSize(MAX_PROPERTY_DOC_BYTES)})`);
  }

  const path = storagePathFor(propertyId, file.name);

  const { error: uploadErr } = await supabase.storage
    .from(PROPERTY_DOCS_BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

  const { data, error: insertErr } = await supabase
    .from("property_documents")
    .insert({
      property_id: propertyId,
      doc_type: docType || "OTHER",
      title: title.trim(),
      period_month: monthInputToDate(periodMonth),
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || null,
      notes: notes?.trim() || null,
      visible_to_owner: visibleToOwner,
      uploaded_by: uploadedBy,
    })
    .select()
    .single();

  if (insertErr) {
    await supabase.storage.from(PROPERTY_DOCS_BUCKET).remove([path]);
    throw new Error(`Could not save the document: ${insertErr.message}`);
  }
  return data;
}

// Admin-side delete: row first, then the object. If the object delete fails we
// do not resurrect the row; a stray file in a private admin-only bucket is a
// smaller problem than a row pointing at nothing.
export async function deletePropertyDocument(doc) {
  const { error } = await supabase.from("property_documents").delete().eq("id", doc.id);
  if (error) throw new Error(`Could not delete: ${error.message}`);
  if (doc.file_path) {
    await supabase.storage.from(PROPERTY_DOCS_BUCKET).remove([doc.file_path]);
  }
}

// Admin preview. Admins have a storage SELECT policy, so they can sign client
// side. Owners cannot, which is why they go through the server action instead.
export async function adminSignedUrl(doc) {
  const { data, error } = await supabase.storage
    .from(PROPERTY_DOCS_BUCKET)
    .createSignedUrl(doc.file_path, 3600);
  if (error || !data?.signedUrl) throw new Error(error?.message || "Could not open document");
  return data.signedUrl;
}

// Owner-side download. The owner has no storage access at all, so the URL is
// minted server side after re-checking ownership and visible_to_owner.
export async function ownerSignedUrl(docId) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const resp = await fetch("/api/portal/admin-actions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
    },
    body: JSON.stringify({ action: "landlord_property_doc_url", doc_id: docId }),
  });
  const json = await resp.json();
  if (!resp.ok || !json.url) throw new Error(json.error || "Could not open document");
  return json.url;
}
