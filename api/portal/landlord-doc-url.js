import { createClient } from "@supabase/supabase-js";

// Mints a short-lived signed download URL for ONE tenant document, but only if
// the caller is the LANDLORD of the property that document belongs to, and only
// for identity documents (ID / passport). The owner never has direct RLS access
// to tenant_documents or the storage bucket; this endpoint is the only path, so
// it double-checks ownership and doc type before signing.

const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);

const OWNER_VISIBLE_TYPES = ["ID_DOCUMENT", "PASSPORT"];

async function landlordProperty(req) {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const { data: authData, error } = await supabase.auth.getUser(token);
  if (error || !authData?.user) return null;
  const { data: profile } = await supabase
    .from("tenant_profiles")
    .select("property_id, role")
    .eq("user_id", authData.user.id)
    .eq("is_active", true)
    .eq("role", "LANDLORD")
    .single();
  if (!profile) return null;
  return profile.property_id;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const propertyId = await landlordProperty(req);
  if (!propertyId) return res.status(403).json({ error: "Not authorized" });

  const { doc_id } = req.body || {};
  if (!doc_id) return res.status(400).json({ error: "doc_id required" });

  // Fetch the doc and prove it belongs to a tenant in the landlord's property.
  const { data: doc, error: docErr } = await supabase
    .from("tenant_documents")
    .select("id, doc_type, file_url, tenant_profiles!inner(property_id)")
    .eq("id", doc_id)
    .single();

  if (docErr || !doc) return res.status(404).json({ error: "Document not found" });
  if (doc.tenant_profiles?.property_id !== propertyId) return res.status(403).json({ error: "Not authorized" });
  if (!OWNER_VISIBLE_TYPES.includes(doc.doc_type)) return res.status(403).json({ error: "Not a shareable document" });

  // Normalise file_url to a storage path inside the tenant-documents bucket.
  let path = doc.file_url || "";
  if (path.includes("/tenant-documents/")) path = path.split("/tenant-documents/")[1].split("?")[0];
  else if (path.startsWith("tenant-documents/")) path = path.slice("tenant-documents/".length);
  if (!path) return res.status(422).json({ error: "Document has no file" });

  const { data: signed, error: signErr } = await supabase.storage
    .from("tenant-documents")
    .createSignedUrl(path, 3600);

  if (signErr || !signed?.signedUrl) return res.status(500).json({ error: "Could not generate download link" });
  return res.status(200).json({ url: signed.signedUrl });
}
