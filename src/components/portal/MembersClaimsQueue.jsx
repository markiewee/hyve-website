import { useState } from "react";
import ClaimCard from "./ClaimCard";
import { useClaims } from "../../hooks/useClaims";

const FILTERS = [
  { key: "SUBMITTED", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "PAID", label: "Paid" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ALL", label: "All" },
];

function ReviewActions({ claim, onReview, onMarkPaid }) {
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [paymentRef, setPaymentRef] = useState("");

  if (claim.status === "SUBMITTED") {
    return (
      <div className="flex flex-col w-full gap-2">
        <button
          type="button"
          onClick={() => setShowComment((s) => !s)}
          className="text-xs text-gray-600 underline self-start"
        >
          {showComment ? "Hide comment" : "Add comment"}
        </button>
        {showComment && (
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Optional comment to captain"
            className="w-full rounded border border-gray-300 p-2 text-sm"
          />
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onReview(claim.id, { status: "REJECTED", comment })}
            className="rounded border border-red-300 text-red-700 px-3 py-1 text-sm"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => onReview(claim.id, { status: "APPROVED", comment })}
            className="rounded bg-blue-600 text-white px-3 py-1 text-sm"
          >
            Approve
          </button>
        </div>
      </div>
    );
  }
  if (claim.status === "APPROVED") {
    return (
      <div className="flex w-full gap-2 items-center">
        <input
          type="text"
          value={paymentRef}
          onChange={(e) => setPaymentRef(e.target.value)}
          placeholder="PayNow ref / note"
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          disabled={!paymentRef.trim()}
          onClick={() => onMarkPaid(claim.id, paymentRef.trim())}
          className="rounded bg-green-600 text-white px-3 py-1 text-sm disabled:opacity-50"
        >
          Mark paid
        </button>
      </div>
    );
  }
  return null;
}

export default function MembersClaimsQueue({ propertyFilter, captainFilter }) {
  const [statusKey, setStatusKey] = useState("SUBMITTED");
  const filter = {};
  if (statusKey !== "ALL") filter.status = statusKey;
  if (propertyFilter && propertyFilter !== "ALL") filter.propertyId = propertyFilter;
  if (captainFilter) filter.captainId = captainFilter;

  const { claims, loading, reviewClaim, markPaid } = useClaims({
    scope: "all",
    filter,
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatusKey(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              statusKey === f.key
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : claims.length === 0 ? (
        <div className="text-sm text-gray-500">No claims match.</div>
      ) : (
        <div className="space-y-3">
          {claims.map((claim) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              mode="admin"
              actions={
                <ReviewActions
                  claim={claim}
                  onReview={reviewClaim}
                  onMarkPaid={markPaid}
                />
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
