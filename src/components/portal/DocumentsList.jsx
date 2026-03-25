import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

const DOC_TYPE_LABELS = {
  LICENCE_AGREEMENT: "Licence Agreement",
  NOTICE_OF_TERMINATION: "Notice of Termination",
  MOVE_IN_CHECKLIST: "Move-in Checklist",
  MOVE_OUT_CHECKLIST: "Move-out Checklist",
  HOUSE_RULES: "House Rules",
  OTHER: "Document",
};

const STATUS_STYLE = {
  PENDING: "bg-gray-100 text-gray-600",
  SENT: "bg-yellow-100 text-yellow-700",
  SIGNED: "bg-green-100 text-green-700",
  EXPIRED: "bg-red-100 text-red-600",
};

export default function DocumentsList({ documents }) {
  if (!documents || documents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No documents yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between py-2 border-b last:border-b-0"
          >
            <div>
              <p className="text-sm font-medium">
                {doc.title || DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
              </p>
              <p className="text-xs text-muted-foreground">
                {DOC_TYPE_LABELS[doc.doc_type]}
                {doc.signed_at &&
                  ` — Signed ${new Date(doc.signed_at).toLocaleDateString("en-SG")}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  STATUS_STYLE[doc.status] || STATUS_STYLE.PENDING
                }`}
              >
                {doc.status}
              </span>
              {doc.file_url && (
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  View
                </a>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
