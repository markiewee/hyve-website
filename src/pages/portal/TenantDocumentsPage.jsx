import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";

const DOC_TYPE_LABELS = {
  LICENCE_AGREEMENT: "Licence Agreement",
  NOTICE_OF_TERMINATION: "Notice of Termination",
  MOVE_IN_CHECKLIST: "Move-in Checklist",
  MOVE_OUT_CHECKLIST: "Move-out Checklist",
  HOUSE_RULES: "House Rules",
  STAMPING: "Stamping Certificate",
  RECEIPT: "Receipt",
  ID_DOCUMENT: "ID Document",
  OTHER: "Other",
};

const STATUS_STYLE = {
  PENDING: "bg-amber-100 text-amber-700",
  SENT: "bg-blue-100 text-blue-700",
  SIGNED: "bg-green-100 text-green-700",
  UPLOADED: "bg-honey-100 text-honey-800",
  EXPIRED: "bg-red-100 text-red-600",
};

const UPLOAD_TYPES = [
  { value: "STAMPING", label: "Stamping Certificate" },
  { value: "RECEIPT", label: "Receipt / Proof of Payment" },
  { value: "ID_DOCUMENT", label: "ID / Passport Copy" },
  { value: "OTHER", label: "Other Document" },
];

export default function TenantDocumentsPage() {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadType, setUploadType] = useState("STAMPING");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchDocuments = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("tenant_documents")
      .select("*")
      .eq("tenant_profile_id", profile.id)
      .order("created_at", { ascending: false });
    setDocuments(data ?? []);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  async function handleViewDocument(doc) {
    let path = doc.file_url;
    if (path.includes("/tenant-documents/")) {
      path = path.split("/tenant-documents/")[1].split("?")[0];
    }
    const { data } = await supabase.storage
      .from("tenant-documents")
      .createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!uploadFile) {
      setMessage({ type: "error", text: "Please select a file." });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const ts = Date.now();
      // Safely extract extension — fallback to mime type or "bin"
      const nameParts = uploadFile.name.split(".");
      const ext = nameParts.length > 1 ? nameParts.pop().toLowerCase() : (uploadFile.type?.split("/")[1] || "bin");
      const mimeType = uploadFile.type || "application/octet-stream";
      const storagePath = `tenants/${profile.id}/uploads/${uploadType.toLowerCase()}-${ts}.${ext}`;

      // Convert to ArrayBuffer for mobile browser compatibility
      const arrayBuffer = await uploadFile.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from("tenant-documents")
        .upload(storagePath, arrayBuffer, { upsert: false, contentType: mimeType });

      if (uploadError) throw new Error("Upload failed: " + uploadError.message);

      // Store the path — use signed URLs for private bucket
      const fileUrl = `tenant-documents/${storagePath}`;

      const { error: insertError } = await supabase
        .from("tenant_documents")
        .insert({
          tenant_profile_id: profile.id,
          doc_type: uploadType,
          title: uploadTitle.trim() || DOC_TYPE_LABELS[uploadType] || "Document",
          status: "UPLOADED",
          file_url: fileUrl,
        });

      if (insertError) throw new Error("Failed to save record: " + insertError.message);

      setMessage({ type: "success", text: "Document uploaded successfully." });
      setUploadFile(null);
      setUploadTitle("");
      // Reset file input
      const fileInput = document.getElementById("doc-upload-input");
      if (fileInput) fileInput.value = "";
      await fetchDocuments();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setUploading(false);
    }
  }

  return (
    <PortalLayout>
      <header className="mb-8">
        <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
          My Documents
        </h1>
        <p className="text-[#555f6f] font-['Manrope'] mt-1">
          View your agreements and documents.
        </p>
      </header>

      {/* Documents List */}
      <section className="bg-white rounded-xl p-6 border border-[#bbcac6]/15 shadow-sm">
        <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg mb-4 flex items-center gap-2 text-[#121c2a]">
          <span className="material-symbols-outlined text-[#A87813] text-[20px]">folder_open</span>
          All Documents
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 bg-[#eff4ff] animate-pulse rounded-xl" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-4xl text-[#bbcac6] mb-3 block">description</span>
            <p className="text-sm text-[#555f6f] font-['Manrope']">No documents yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#bbcac6]/10">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#eff4ff] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[#A87813] text-[20px]">
                      {doc.doc_type === "LICENCE_AGREEMENT" ? "gavel"
                        : doc.doc_type === "STAMPING" ? "verified"
                        : doc.doc_type === "RECEIPT" ? "receipt"
                        : doc.doc_type === "ID_DOCUMENT" ? "badge"
                        : "description"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-['Manrope'] font-semibold text-[#121c2a] truncate">
                      {doc.title || DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
                    </p>
                    <p className="text-xs text-[#6c7a77] font-['Inter']">
                      {DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
                      {doc.created_at && ` — ${new Date(doc.created_at).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-['Inter'] font-bold uppercase tracking-wider ${STATUS_STYLE[doc.status] || STATUS_STYLE.PENDING}`}>
                    {doc.status}
                  </span>
                  {doc.file_url && (
                    <button
                      onClick={() => handleViewDocument(doc)}
                      className="inline-flex items-center gap-1 text-xs font-['Manrope'] font-bold text-[#A87813] hover:underline"
                    >
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      View
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PortalLayout>
  );
}
