import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { supabase } from "../../lib/supabase";

const DOC_TYPE_LABELS = {
  LICENCE_AGREEMENT: "Licence Agreement",
  NOTICE_OF_TERMINATION: "Notice of Termination",
  MOVE_IN_CHECKLIST: "Move-in Checklist",
  MOVE_OUT_CHECKLIST: "Move-out Checklist",
  HOUSE_RULES: "House Rules",
  OTHER: "Document",
};

const DOC_TYPE_ICONS = {
  LICENCE_AGREEMENT: "description",
  NOTICE_OF_TERMINATION: "cancel",
  MOVE_IN_CHECKLIST: "checklist",
  MOVE_OUT_CHECKLIST: "checklist",
  HOUSE_RULES: "gavel",
  OTHER: "article",
};

const STATUS_STYLE = {
  PENDING: "bg-gray-100 text-gray-600",
  SENT: "bg-yellow-100 text-yellow-700",
  SIGNED: "bg-green-100 text-green-700",
  EXPIRED: "bg-red-100 text-red-600",
};

async function openSignedUrl(fileUrl) {
  if (!fileUrl) return;
  // Extract bucket and path from the Supabase storage URL
  const match = fileUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
  if (match) {
    const [, bucket, path] = match;
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 300); // 5 min expiry
    if (!error && data?.signedUrl) {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      return;
    }
  }
  // Fallback: open raw URL
  window.open(fileUrl, "_blank", "noopener,noreferrer");
}

export default function DocumentsList({ documents }) {
  const [loadingId, setLoadingId] = useState(null);

  if (!documents || documents.length === 0) {
    return (
      <div>
        <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-xl mb-4 flex items-center gap-2 text-[#121c2a]">
          <span className="material-symbols-outlined text-[#006b5f] text-[22px]">folder_open</span>
          Documents
        </h3>
        <p className="text-sm font-['Manrope'] text-[#555f6f]">No documents yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-xl mb-4 flex items-center gap-2 text-[#121c2a]">
        <span className="material-symbols-outlined text-[#006b5f] text-[22px]">folder_open</span>
        Documents
      </h3>
      <div className="space-y-3">
        {documents.map((doc) => {
          const icon = DOC_TYPE_ICONS[doc.doc_type] || DOC_TYPE_ICONS.OTHER;
          return (
            <div
              key={doc.id}
              className="flex items-center gap-3 py-3 px-3 rounded-lg border border-[#bbcac6]/15 hover:bg-[#f8faf9] transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-[#006b5f]/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[#006b5f] text-[18px]">{icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-['Manrope'] font-bold text-[#121c2a] truncate">
                  {doc.title || DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
                </p>
                <p className="text-xs font-['Manrope'] text-[#6c7a77] mt-0.5">
                  {DOC_TYPE_LABELS[doc.doc_type]}
                  {doc.signed_at &&
                    ` — Signed ${new Date(doc.signed_at).toLocaleDateString("en-SG")}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    STATUS_STYLE[doc.status] || STATUS_STYLE.PENDING
                  }`}
                >
                  {doc.status}
                </span>
                {doc.file_url && (
                  <button
                    onClick={async () => {
                      setLoadingId(doc.id);
                      await openSignedUrl(doc.file_url);
                      setLoadingId(null);
                    }}
                    disabled={loadingId === doc.id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#006b5f] text-white text-xs font-['Manrope'] font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                    {loadingId === doc.id ? "..." : "View"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
