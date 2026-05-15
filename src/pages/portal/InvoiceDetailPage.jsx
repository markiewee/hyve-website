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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#A87813]" />
        </div>
      </PortalLayout>
    );
  }

  if (!invoice) {
    return (
      <PortalLayout>
        <p className="text-center py-20 text-[#6c7a77] font-['Manrope']">Invoice not found.</p>
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
            className="font-['Manrope'] text-sm text-[#A87813] hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Billing
          </a>
          <div className="flex gap-3">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 border border-[#bbcac6]/30 rounded-xl font-['Manrope'] text-sm text-[#121c2a] hover:bg-[#f8f9ff] transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              Print
            </button>
            {canPay && (
              <button
                onClick={handleStripePayment}
                disabled={paying}
                className="px-4 py-2 bg-[#A87813] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">credit_card</span>
                {paying ? "Redirecting..." : `Pay with Stripe (+4%)`}
              </button>
            )}
          </div>
        </div>

        {payError && (
          <div className="mb-4 p-3 bg-[#ffdad6] rounded-xl print:hidden">
            <p className="font-['Manrope'] text-sm text-[#ba1a1a]">{payError}</p>
          </div>
        )}

        {/* Invoice Document */}
        <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm p-6">
          <InvoiceDocument invoice={invoice} />
        </div>

        {/* Cardless deposit instructions */}
        {canPay && (
          <details className="mt-6 bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm p-6 print:hidden">
            <summary className="font-['Manrope'] font-bold text-sm text-[#121c2a] cursor-pointer">
              Don't have an ATM card? Deposit at any DBS/POSB ATM
            </summary>
            <ol className="mt-3 space-y-1 font-['Manrope'] text-sm text-[#6c7a77] list-decimal list-inside">
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
