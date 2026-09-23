import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { supabase } from "../../lib/supabase";
import { signTenantDoc } from "../../lib/idDocuments";
import { toast } from "sonner";

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
  PENDING: "bg-surface-container text-foreground-variant",
  SENT: "bg-amber-500/15 text-amber-300",
  SIGNED: "bg-emerald-500/15 text-emerald-300",
  EXPIRED: "bg-red-500/15 text-red-300",
};

async function openSignedUrl(fileUrl) {
  if (!fileUrl) return;
  // file_url is a bare path on newer rows and an old public url on older
  // ones. Both resolve to the same object in the private bucket.
  const url = await signTenantDoc(supabase, fileUrl, 300); // 5 min expiry
  if (url) window.open(url, "_blank", "noopener,noreferrer");
  else toast.error("Could not open that document. Please contact us.");
}

export default function DocumentsList({ documents }) {
  const [loadingId, setLoadingId] = useState(null);

  if (!documents || documents.length === 0) {
    return (
      <div>
        <h3 className="font-display text-2xl mb-4 flex items-center gap-2 text-foreground">
          <span className="material-symbols-outlined text-accent text-[22px]">folder_open</span>
          Documents
        </h3>
        <p className="text-sm text-foreground-variant">No documents yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-display text-2xl mb-4 flex items-center gap-2 text-foreground">
        <span className="material-symbols-outlined text-accent text-[22px]">folder_open</span>
        Documents
      </h3>
      <div className="space-y-3">
        {documents.map((doc) => {
          const icon = DOC_TYPE_ICONS[doc.doc_type] || DOC_TYPE_ICONS.OTHER;
          return (
            <div
              key={doc.id}
              className="py-3 px-3 rounded-lg border border-border hover:bg-surface-container transition-colors space-y-2"
            >
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-accent text-[16px] mt-0.5 shrink-0">{icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground leading-tight">
                    {doc.title || DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
                  </p>
                  <p className="text-[10px] text-foreground-variant mt-0.5">
                    {DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
                    {doc.created_at && ` · ${new Date(doc.created_at).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}`}
                  </p>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 ${STATUS_STYLE[doc.status] || STATUS_STYLE.PENDING}`}>
                  {doc.status}
                </span>
              </div>
              {doc.file_url && (
                <button
                  onClick={async () => { setLoadingId(doc.id); await openSignedUrl(doc.file_url); setLoadingId(null); }}
                  disabled={loadingId === doc.id}
                  className="w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-bold hover:bg-accent/20 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  {loadingId === doc.id ? "Opening..." : "View Document"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
