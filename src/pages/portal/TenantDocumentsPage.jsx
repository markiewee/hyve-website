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
  UPLOADED: "bg-teal-100 text-teal-700",
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
      const ext = uploadFile.name.split(".").pop() || "pdf";
      const storagePath = `tenants/${profile.id}/uploads/${uploadType.toLowerCase()}-${ts}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("tenant-documents")
        .upload(storagePath, uploadFile, { upsert: false });

      if (uploadError) throw new Error("Upload failed: " + uploadError.message);

      const { data: urlData } = supabase.storage
        .from("tenant-documents")
        .getPublicUrl(storagePath);

      const { error: insertError } = await supabase
        .from("tenant_documents")
        .insert({
          tenant_profile_id: profile.id,
          doc_type: uploadType,
          title: uploadTitle.trim() || DOC_TYPE_LABELS[uploadType] || "Document",
          status: "UPLOADED",
          file_url: urlData.publicUrl,
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
          View your agreements and upload documents like stamping certificates.
        </p>
      </header>

      {/* Upload Section */}
      <section className="bg-white rounded-xl p-6 border border-[#bbcac6]/15 shadow-sm mb-8">
        <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg mb-4 flex items-center gap-2 text-[#121c2a]">
          <span className="material-symbols-outlined text-[#006b5f] text-[20px]">cloud_upload</span>
          Upload Document
        </h2>

        {message && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-['Manrope'] ${
            message.type === "error"
              ? "bg-[#ffdad6]/40 text-[#ba1a1a] border border-[#ba1a1a]/15"
              : "bg-[#d1fae5] text-[#065f46] border border-[#065f46]/15"
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">
                Document Type
              </label>
              <select
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value)}
                className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
              >
                {UPLOAD_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">
                Title <span className="text-[#bbcac6] normal-case tracking-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder={DOC_TYPE_LABELS[uploadType]}
                className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">
              File
            </label>
            <input
              id="doc-upload-input"
              type="file"
              accept="image/*,application/pdf,.doc,.docx"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-[#555f6f] file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:bg-[#006b5f] file:text-white file:text-xs file:font-bold file:cursor-pointer hover:file:opacity-90"
            />
          </div>

          <button
            type="submit"
            disabled={uploading || !uploadFile}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#006a61] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px]">
              {uploading ? "progress_activity" : "upload_file"}
            </span>
            {uploading ? "Uploading..." : "Upload Document"}
          </button>
        </form>
      </section>

      {/* Documents List */}
      <section className="bg-white rounded-xl p-6 border border-[#bbcac6]/15 shadow-sm">
        <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg mb-4 flex items-center gap-2 text-[#121c2a]">
          <span className="material-symbols-outlined text-[#006b5f] text-[20px]">folder_open</span>
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
                    <span className="material-symbols-outlined text-[#006b5f] text-[20px]">
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
                      className="inline-flex items-center gap-1 text-xs font-['Manrope'] font-bold text-[#006b5f] hover:underline"
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
