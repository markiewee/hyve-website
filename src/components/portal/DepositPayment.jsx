import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { toast } from "sonner";

const BANK_DETAILS = {
  bank: "DBS Bank",
  accountName: "Makery Pte Ltd",
  accountNumber: "DBS 072-905765-8",
};

export default function DepositPayment({ onboarding, advanceStep, refetch }) {
  const { profile } = useAuth();
  const location = useLocation();
  const proofInputRef = useRef(null);

  const [proofFile, setProofFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [bankSubmitting, setBankSubmitting] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [error, setError] = useState(null);

  const depositAmount = onboarding?.deposit_amount ?? 0;
  const stripeFee = Math.round(depositAmount * 0.04 * 100) / 100;
  const stripeTotal = Math.round((depositAmount + stripeFee) * 100) / 100;

  // Handle return from Stripe
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("deposit") === "success") {
      refetch && refetch();
    }
  }, [location.search, refetch]);

  // Auto-advance if deposit already verified
  useEffect(() => {
    if (onboarding?.deposit_verified) {
      advanceStep("deposit_paid_at").catch(console.error);
    }
  }, [onboarding?.deposit_verified]);

  async function handleBankSubmit(e) {
    e.preventDefault();
    if (!proofFile) {
      setError("Please upload your payment proof.");
      return;
    }

    setError(null);
    setBankSubmitting(true);

    try {
      // Upload proof to storage
      const timestamp = Date.now();
      const path = `tenants/${profile.id}/deposit-proof-${timestamp}.jpg`;

      setUploading(true);
      const { error: uploadError } = await supabase.storage
        .from("tenant-documents")
        .upload(path, proofFile, { upsert: true });
      setUploading(false);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("tenant-documents")
        .getPublicUrl(path);

      // Update onboarding record
      const { error: updateError } = await supabase
        .from("onboarding_progress")
        .update({
          deposit_proof_url: urlData.publicUrl,
          deposit_method: "BANK_TRANSFER",
          updated_at: new Date().toISOString(),
        })
        .eq("id", onboarding.id);

      if (updateError) throw updateError;

      toast.success("Payment proof submitted — pending admin verification.");
      refetch && refetch();
    } catch (err) {
      console.error("Bank transfer submission failed:", err);
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setBankSubmitting(false);
    }
  }

  async function handleStripeCheckout() {
    setStripeLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/deposit-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboarding_id: onboarding.id }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create checkout session");
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      console.error("Stripe checkout failed:", err);
      setError(err.message ?? "Something went wrong. Please try again.");
      setStripeLoading(false);
    }
  }

  // Verified state
  if (onboarding?.deposit_verified) {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-green-800">Deposit Verified</p>
        <p className="text-xs text-green-700 mt-1">
          Your security deposit has been received and verified.
        </p>
      </div>
    );
  }

  // Pending bank transfer state
  if (
    onboarding?.deposit_method === "BANK_TRANSFER" &&
    onboarding?.deposit_proof_url
  ) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-100 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-amber-800">
          Pending Verification
        </p>
        <p className="text-xs text-amber-700 mt-1">
          Your bank transfer proof has been submitted. Admin will verify within
          24 hours.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Security deposit:{" "}
        <span className="font-semibold text-foreground">
          SGD {depositAmount.toFixed(2)}
        </span>
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Bank Transfer */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              Bank Transfer{" "}
              <span className="text-green-600 font-normal">(Free)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground space-y-1 mb-4 bg-secondary/50 rounded-md p-3">
              <p>
                <span className="font-medium text-foreground">Bank:</span>{" "}
                {BANK_DETAILS.bank}
              </p>
              <p>
                <span className="font-medium text-foreground">
                  Account Name:
                </span>{" "}
                {BANK_DETAILS.accountName}
              </p>
              <p>
                <span className="font-medium text-foreground">Account No:</span>{" "}
                {BANK_DETAILS.accountNumber}
              </p>
              <p>
                <span className="font-medium text-foreground">Reference:</span>{" "}
                Your name + room code
              </p>
            </div>

            <form onSubmit={handleBankSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Upload Payment Proof
                </label>
                <input
                  ref={proofInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-xs text-muted-foreground file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80"
                />
              </div>

              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={bankSubmitting || uploading}
                className="w-full"
              >
                {bankSubmitting || uploading
                  ? "Uploading…"
                  : "Submit Proof"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Stripe */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              Pay via Stripe{" "}
              <span className="text-blue-600 font-normal">(Instant)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground space-y-1 mb-4 bg-secondary/50 rounded-md p-3">
              <p>
                <span className="font-medium text-foreground">Deposit:</span>{" "}
                SGD {depositAmount.toFixed(2)}
              </p>
              <p>
                <span className="font-medium text-foreground">
                  Processing fee (4%):
                </span>{" "}
                SGD {stripeFee.toFixed(2)}
              </p>
              <p className="border-t border-border pt-1 mt-1">
                <span className="font-medium text-foreground">Total:</span>{" "}
                <span className="font-semibold text-foreground">
                  SGD {stripeTotal.toFixed(2)}
                </span>
              </p>
            </div>

            <Button
              type="button"
              size="sm"
              disabled={stripeLoading}
              onClick={handleStripeCheckout}
              className="w-full"
            >
              {stripeLoading ? "Redirecting…" : "Pay Now"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
