import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useClaims } from "../../hooks/useClaims";

const STATUS_PILL = {
  SUBMITTED: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-blue-100 text-blue-800",
  PAID: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

const CATEGORY_LABEL = {
  PLUMBING: "Plumbing",
  ELECTRICAL: "Electrical",
  CLEANING_SUPPLIES: "Cleaning supplies",
  FURNITURE: "Furniture",
  TRANSPORT: "Transport",
  OTHER: "Other",
};

function StatusPill({ status }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PILL[status]}`}>
      {status}
    </span>
  );
}

export default function ClaimCard({ claim, mode = "captain", actions }) {
  const { getSignedUrl } = useClaims({ scope: "none" });
  const [thumbUrl, setThumbUrl] = useState(null);
  const [receiptUrl, setReceiptUrl] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getSignedUrl(claim.item_url),
      getSignedUrl(claim.receipt_url),
    ]).then(([item, receipt]) => {
      if (!cancelled) {
        setThumbUrl(item);
        setReceiptUrl(receipt);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [claim.item_url, claim.receipt_url, getSignedUrl]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex gap-3">
        {thumbUrl && (
          <button
            type="button"
            onClick={() => setLightbox(thumbUrl)}
            className="shrink-0"
            aria-label="View item photo"
          >
            <img src={thumbUrl} alt="Item" className="h-20 w-20 rounded object-cover" />
          </button>
        )}
        {mode === "admin" && receiptUrl && (
          <button
            type="button"
            onClick={() => setLightbox(receiptUrl)}
            className="shrink-0"
            aria-label="View receipt photo"
          >
            <img src={receiptUrl} alt="Receipt" className="h-20 w-20 rounded object-cover" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{claim.properties?.name ?? "—"}</span>
            <span className="text-gray-400">·</span>
            <span>{CATEGORY_LABEL[claim.category]}</span>
            <span className="text-gray-400">·</span>
            <span className="font-semibold">S${Number(claim.amount_sgd).toFixed(2)}</span>
            <StatusPill status={claim.status} />
          </div>
          <p className="text-sm text-gray-700 mt-1">{claim.description}</p>
          <div className="text-xs text-gray-500 mt-1">
            Submitted {format(new Date(claim.created_at), "d MMM yyyy")}
          </div>
          {claim.admin_comment && (
            <div className="mt-2 rounded bg-gray-50 p-2 text-xs text-gray-700">
              <span className="font-medium">Admin: </span>{claim.admin_comment}
            </div>
          )}
          {claim.payment_reference && (
            <div className="mt-1 text-xs text-gray-500">
              Paid · {claim.payment_reference}
            </div>
          )}
        </div>
      </div>

      {actions && <div className="mt-3 flex justify-end gap-2">{actions}</div>}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="" className="max-h-full max-w-full" />
        </div>
      )}
    </div>
  );
}
