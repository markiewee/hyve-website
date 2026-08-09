import { useState } from "react";
import { Link } from "react-router-dom";
import PortalLayout from "../../components/portal/PortalLayout";
import ClaimCard from "../../components/portal/ClaimCard";
import { useClaims } from "../../hooks/useClaims";

const FILTERS = [
  { key: "ALL", label: "All", status: null },
  { key: "SUBMITTED", label: "Pending", status: "SUBMITTED" },
  { key: "APPROVED", label: "Approved", status: "APPROVED" },
  { key: "PAID", label: "Paid", status: "PAID" },
  { key: "REJECTED", label: "Rejected", status: "REJECTED" },
];

export default function CaptainClaimsPage() {
  const [filterKey, setFilterKey] = useState("ALL");
  const status = FILTERS.find((f) => f.key === filterKey)?.status;
  const { claims, loading } = useClaims({
    scope: "own",
    filter: status ? { status } : undefined,
  });

  return (
    <PortalLayout>
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-extrabold text-foreground tracking-tight">My Claims</h1>
          <Link
            to="/portal/captain/claims/new"
            className="rounded bg-accent text-white px-4 py-2 text-sm font-medium"
          >
            + Submit new claim
          </Link>
        </div>

        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilterKey(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                filterKey === f.key
                  ? "bg-accent text-white"
                  : "bg-surface-container text-foreground-variant"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-sm text-foreground-variant">Loading…</div>
        ) : claims.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-foreground-variant">
            No claims yet. Submit your first one.
          </div>
        ) : (
          <div className="space-y-3">
            {claims.map((claim) => (
              <ClaimCard
                key={claim.id}
                claim={claim}
                mode="captain"
                actions={
                  claim.status === "REJECTED" && (
                    <Link
                      to="/portal/captain/claims/new"
                      state={{ prefill: claim }}
                      className="rounded border border-border px-3 py-1 text-xs font-medium"
                    >
                      Re-submit
                    </Link>
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
