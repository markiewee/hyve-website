import React, { useState } from "react";
import { useParams } from "react-router-dom";
import PortalLayout from "../../components/portal/PortalLayout";
import InvoiceDocument from "../../components/portal/InvoiceDocument";
import { useInvoiceDetail } from "../../hooks/useInvoices";

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams();
  const { invoice, loading } = useInvoiceDetail(invoiceId);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(null);

  async function handleStripePayment() {
    setPaying(true);
    setPayError(null);
    try {
      const res = await fetch("/api/portal/deposit-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "invoice", invoice_id: invoice.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      window.location.href = data.url;
    } catch (err) {
      setPayError(err.message);
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <PortalLayout>
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      </PortalLayout>
    );
  }

  if (!invoice) {
    return (
      <PortalLayout>
        <p className="text-center py-20 text-foreground-variant font-['Inter']">Invoice not found.</p>
      </PortalLayout>
    );
  }

  const outstanding = Number(invoice.total_due) - Number(invoice.total_paid);
  const canPay = invoice.status !== "PAID" && invoice.status !== "VOID" && outstanding > 0;

  return (
    <PortalLayout>
      <div className="max-w-[900px] mx-auto">
        {/* Action bar */}
        <div className="flex justify-between items-center mb-6 print:hidden">
          <a
            href="/portal/billing"
            className="font-['Inter'] text-sm text-accent hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Billing
          </a>
          <div className="flex gap-3">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 border border-border rounded-xl font-['Inter'] text-sm text-foreground hover:bg-white/5 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              Print
            </button>
            {canPay && (
              <button
                onClick={handleStripePayment}
                disabled={paying}
                className="px-4 py-2 bg-accent text-white rounded-full font-['Inter'] font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">credit_card</span>
                {paying ? "Redirecting..." : `Pay with Stripe (+4%)`}
              </button>
            )}
          </div>
        </div>

        {payError && (
          <div className="mb-4 p-3 bg-red-500/15 rounded-xl print:hidden">
            <p className="font-['Inter'] text-sm text-red-300">{payError}</p>
          </div>
        )}

        {/* Invoice Document */}
        <div className="bg-surface rounded-2xl border border-border p-6">
          <InvoiceDocument invoice={invoice} />
        </div>

        {/* Cardless deposit instructions */}
        {canPay && (
          <details className="mt-6 bg-surface rounded-2xl border border-border p-6 print:hidden">
            <summary className="font-['Inter'] font-bold text-sm text-foreground cursor-pointer">
              Don't have an ATM card? Deposit at any DBS/POSB ATM
            </summary>
            <ol className="mt-3 space-y-1 font-['Inter'] text-sm text-foreground-variant list-decimal list-inside">
              <li>Touch the screen and select <strong>Cash Deposit</strong></li>
              <li>Select the <strong>Account Type</strong></li>
              <li>Enter Account Number <strong>885-215114-103</strong> and select Confirm</li>
              <li>Verify and select <strong>Next</strong></li>
              <li>Enter your <strong>NRIC/Passport Number</strong> and select Confirm</li>
              <li>Enter your <strong>Mobile Number</strong> and select Confirm</li>
              <li>Place cash into the slot and select <strong>Next</strong></li>
              <li>Verify the amount and select <strong>Confirm</strong></li>
              <li>Collect your <strong>Receipt</strong></li>
            </ol>
          </details>
        )}
      </div>
    </PortalLayout>
  );
}
