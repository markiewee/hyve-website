import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * Bank credits the matcher would not settle on its own.
 *
 * verify-rent closes a credit automatically only on unambiguous evidence: the
 * tenant quoted their payment reference, or their name and the exact amount
 * owed both agree with nothing else competing. Everything weaker arrives here,
 * because auto-closing the wrong row credits one tenant's money to another and
 * then chases the tenant who actually paid.
 *
 * This queue exists because a table nobody looks at is how 43 viewings went a
 * month without an outcome. Unattributed money deserves a screen, not a log.
 */
export default function RentMatchQueue({ onResolved }) {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("rent_match_proposals")
      .select(
        "id, aspire_id, credit_date, credit_amount, counterparty, credit_reference, confidence, reason, alternatives, proposed_rent_payment_id, rent_payments(id, payment_ref, rent_amount, late_fee, paid_amount, month, tenant_profile_id)"
      )
      .eq("status", "PENDING")
      .order("credit_date", { ascending: false });

    if (err) setError(err.message);
    else setProposals(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Accept the proposal: apply the credit to the row the matcher suggested. */
  async function accept(p) {
    const row = Array.isArray(p.rent_payments) ? p.rent_payments[0] : p.rent_payments;
    if (!row) return;

    setBusyId(p.id);
    setError(null);
    try {
      const due = Number(row.rent_amount) + Number(row.late_fee ?? 0);
      const nowPaid =
        Math.round((Number(row.paid_amount ?? 0) + Number(p.credit_amount)) * 100) / 100;
      const settled = nowPaid + 0.01 >= due;

      // The database guard refuses PAID without proof, so the Aspire id goes in
      // as the payment reference. This is a human confirming an automated
      // match, not a manual override, so the source stays ASPIRE.
      const { error: upErr } = await supabase
        .from("rent_payments")
        .update({
          paid_amount: nowPaid,
          paid_at: `${p.credit_date}T00:00:00+08:00`,
          payment_method: "PAYNOW",
          payment_reference: p.aspire_id,
          verification_source: "ASPIRE",
          verified_at: new Date().toISOString(),
          verified_by: "admin-review",
          status: settled ? "PAID" : "PARTIAL",
        })
        .eq("id", row.id);
      if (upErr) throw upErr;

      await decide(p.id, "ACCEPTED");
      onResolved?.();
    } catch (e) {
      setError(e.message || "Could not apply that payment.");
    } finally {
      setBusyId(null);
    }
  }

  /** Reject: this credit is not rent. It leaves the queue and touches nothing. */
  async function reject(p) {
    setBusyId(p.id);
    setError(null);
    try {
      await decide(p.id, "REJECTED");
    } catch (e) {
      setError(e.message || "Could not dismiss that.");
    } finally {
      setBusyId(null);
    }
  }

  async function decide(id, status) {
    const { error: err } = await supabase
      .from("rent_match_proposals")
      .update({ status, decided_at: new Date().toISOString(), decided_by: "admin" })
      .eq("id", id);
    if (err) throw err;
    setProposals((ps) => ps.filter((p) => p.id !== id));
  }

  if (loading) {
    return <div className="h-24 bg-white/5 animate-pulse rounded-2xl" />;
  }

  if (!proposals.length) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-8 text-center">
        <span className="material-symbols-outlined text-emerald-300 text-3xl">task_alt</span>
        <p className="mt-2 font-bold text-foreground">Every bank credit is accounted for.</p>
        <p className="text-sm text-foreground-variant mt-1">
          No money has arrived that we cannot attribute to a tenant.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/15 px-5 py-4">
        <p className="text-sm text-amber-300">
          <strong>{proposals.length}</strong>{" "}
          {proposals.length === 1 ? "bank credit" : "bank credits"} arrived that the system would
          not attribute on its own. Real money, sitting unallocated. Confirming one marks the rent
          paid; dismissing one leaves every record untouched.
        </p>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      {proposals.map((p) => {
        const row = Array.isArray(p.rent_payments) ? p.rent_payments[0] : p.rent_payments;
        const busy = busyId === p.id;
        const alts = Array.isArray(p.alternatives) ? p.alternatives.length : 0;

        return (
          <div key={p.id} className="bg-surface rounded-2xl border border-border p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-display text-xl font-extrabold text-foreground tabular-nums">
                  SGD {Number(p.credit_amount).toFixed(2)}
                </p>
                <p className="text-sm text-foreground-variant mt-0.5 truncate">
                  {p.counterparty || "Unnamed counterparty"}
                  {p.credit_reference ? ` · ref "${p.credit_reference}"` : ""}
                  {p.credit_date ? ` · ${p.credit_date}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-surface-container text-foreground-variant">
                {Math.round(Number(p.confidence) * 100)}% sure
              </span>
            </div>

            <p className="text-sm text-foreground-variant mt-3">
              {p.reason}
              {alts > 0 ? ` (${alts} other row${alts === 1 ? "" : "s"} fit nearly as well)` : ""}
            </p>

            {row ? (
              <p className="text-sm text-foreground mt-2">
                Suggested: <strong>{row.payment_ref}</strong>, owing SGD{" "}
                {(
                  Number(row.rent_amount) +
                  Number(row.late_fee ?? 0) -
                  Number(row.paid_amount ?? 0)
                ).toFixed(2)}
              </p>
            ) : (
              <p className="text-sm text-foreground-variant mt-2 italic">
                No rent row resembles this. It may not be rent at all.
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {row && (
                <button
                  disabled={busy}
                  onClick={() => accept(p)}
                  className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-bold hover:bg-accent/90 disabled:opacity-50"
                >
                  Confirm, mark it paid
                </button>
              )}
              <button
                disabled={busy}
                onClick={() => reject(p)}
                className="px-4 py-2 rounded-lg bg-surface-container text-foreground text-sm font-bold border border-border hover:bg-white/5 disabled:opacity-50"
              >
                Not rent, dismiss
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
