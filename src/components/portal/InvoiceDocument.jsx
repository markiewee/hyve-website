import React from "react";
import InvoiceLineItems from "./InvoiceLineItems";

function formatSGD(amount) {
  if (amount == null) return "$0.00";
  return `$${Number(amount).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS_STYLES = {
  ISSUED: "bg-yellow-100 text-yellow-800",
  PARTIALLY_PAID: "bg-orange-100 text-orange-800",
  PAID: "bg-green-100 text-green-800",
  VOID: "bg-gray-100 text-gray-500",
};

export default function InvoiceDocument({ invoice }) {
  if (!invoice) return null;

  const tenant = invoice.tenant_profiles;
  const room = tenant?.rooms;
  const property = tenant?.properties ?? room?.properties;
  const lineItems = invoice.invoice_line_items ?? [];
  const outstanding = Number(invoice.total_due) - Number(invoice.total_paid);

  return (
    <div className="max-w-[800px] mx-auto bg-white p-8 print:p-4" id="invoice-print">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#006b5f]">HYVE</h1>
          <p className="font-['Manrope'] text-sm text-[#6c7a77] mt-1">Co-living Singapore</p>
        </div>
        <div className="text-right">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_STYLES[invoice.status] ?? "bg-gray-100"}`}>
            {invoice.status}
          </span>
        </div>
      </div>

      {/* Invoice Info */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <p className="font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-1">Invoice Code</p>
          <p className="font-['Manrope'] text-lg font-bold text-[#121c2a]">{invoice.invoice_code}</p>
        </div>
        <div className="text-right">
          <p className="font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-1">Due Date</p>
          <p className="font-['Manrope'] text-lg font-bold text-[#121c2a]">{formatDate(invoice.due_date)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <p className="font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-1">Billed To</p>
          <p className="font-['Manrope'] text-sm text-[#121c2a]">{tenant?.username ?? "—"}</p>
          <p className="font-['Manrope'] text-sm text-[#6c7a77]">{room?.unit_code ?? "—"}</p>
          <p className="font-['Manrope'] text-sm text-[#6c7a77]">{property?.name ?? "—"}</p>
        </div>
        <div className="text-right">
          <p className="font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-1">Billing Period</p>
          <p className="font-['Manrope'] text-sm text-[#121c2a]">{formatDate(invoice.month)}</p>
          <p className="font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-1 mt-3">Issued</p>
          <p className="font-['Manrope'] text-sm text-[#121c2a]">{formatDate(invoice.issued_at)}</p>
        </div>
      </div>

      {/* Line Items */}
      <div className="mb-8">
        <InvoiceLineItems lineItems={lineItems} />
      </div>

      {/* Payment Summary */}
      {Number(invoice.total_paid) > 0 && (
        <div className="mb-8 p-4 bg-[#f0fdf4] rounded-xl">
          <div className="flex justify-between font-['Manrope'] text-sm">
            <span className="text-[#6c7a77]">Total Due</span>
            <span className="text-[#121c2a]">{formatSGD(invoice.total_due)}</span>
          </div>
          <div className="flex justify-between font-['Manrope'] text-sm mt-1">
            <span className="text-[#6c7a77]">Paid</span>
            <span className="text-green-700">-{formatSGD(invoice.total_paid)}</span>
          </div>
          <div className="flex justify-between font-['Manrope'] text-sm font-bold mt-2 pt-2 border-t border-green-200">
            <span className="text-[#121c2a]">Outstanding</span>
            <span className="text-[#121c2a]">{formatSGD(outstanding)}</span>
          </div>
        </div>
      )}

      {/* Payment Instructions (print-visible) */}
      {invoice.status !== "PAID" && invoice.status !== "VOID" && (
        <div className="p-4 bg-[#eff4ff] rounded-xl">
          <p className="font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">Payment Details</p>
          <div className="font-['Manrope'] text-sm text-[#121c2a] space-y-1">
            <p><strong>DBS Bank</strong> Account No: 885-215114-103</p>
            <p><strong>Reference:</strong> {invoice.invoice_code}</p>
            <p className="text-[#6c7a77] text-xs mt-2">Or pay online with Stripe (+4% processing fee)</p>
          </div>
        </div>
      )}
    </div>
  );
}
