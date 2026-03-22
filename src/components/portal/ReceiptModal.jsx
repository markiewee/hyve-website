import { useEffect, useRef } from "react";

function generateReceiptId(dateStr) {
  const date = dateStr ? new Date(dateStr) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `HYVE-${year}-${month}-${rand}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatSGD(amount) {
  return `SGD $${Number(amount).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ─── Print-specific stylesheet injected once ──────────────────────────────────
const PRINT_STYLE = `
@media print {
  body > *:not(#hyve-receipt-print-root) { display: none !important; }
  #hyve-receipt-print-root { display: block !important; position: static !important; }
  .no-print { display: none !important; }
  .receipt-card {
    box-shadow: none !important;
    border: 1px solid #ddd !important;
    max-width: 100% !important;
    margin: 0 !important;
  }
}
`;

export default function ReceiptModal({ payment, tenantInfo, onClose }) {
  const receiptId = useRef(generateReceiptId(payment?.paid_at ?? payment?.month));

  // Inject print styles once
  useEffect(() => {
    const id = "hyve-receipt-print-style";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = PRINT_STYLE;
      document.head.appendChild(style);
    }
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!payment) return null;

  const isRent = payment._type === "rent";
  const isAC = payment._type === "ac";

  const lineItems = [];
  if (isRent) {
    lineItems.push({
      description: `Monthly Rent — ${formatDate(payment.month)}`.replace("1 ", "").replace(/^(\w+ \d+),\s/, "$1 "),
      amount: Number(payment.rent_amount || payment.amount_due || 0),
    });
    if (Number(payment.late_fee) > 0) {
      lineItems.push({
        description: "Late Payment Fee",
        amount: Number(payment.late_fee),
      });
    }
  } else if (isAC) {
    lineItems.push({
      description: `AC Usage Overage — ${formatDate(payment.month)}`.replace(/^(\w+ \d+),\s/, "$1 "),
      amount: Number(payment.overage_hours ?? 0) * 0.3,
    });
  }

  const total = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const paymentDate = payment.paid_at ?? payment.month;

  return (
    <>
      {/* Backdrop */}
      <div
        className="no-print fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          id="hyve-receipt-print-root"
          className="relative z-50 w-full max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="no-print absolute -top-3 -right-3 w-7 h-7 rounded-full bg-white shadow border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors z-10"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Receipt card */}
          <div className="receipt-card bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="bg-[#006b5f] px-8 py-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 pointer-events-none" />
              <div className="relative">
                <p className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-white tracking-tight">
                  Hyve Living
                </p>
                <p className="text-white/60 text-xs mt-0.5 font-['Manrope']">
                  Makery Pte. Ltd. · Singapore
                </p>
              </div>
              <div className="mt-4 flex items-end justify-between relative">
                <div>
                  <p className="text-white/50 text-[10px] uppercase tracking-widest font-bold font-['Inter']">
                    Receipt
                  </p>
                  <p className="text-white font-mono text-sm font-semibold mt-0.5">
                    {receiptId.current}
                  </p>
                </div>
                {/* PAID watermark */}
                <div className="border-2 border-white/30 rounded px-3 py-1">
                  <span className="text-white font-['Inter'] font-black text-lg tracking-widest">
                    PAID
                  </span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-8 py-6 space-y-6">
              {/* Tenant & payment info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[#6c7a77] text-[10px] uppercase tracking-widest font-bold font-['Inter'] mb-1">
                    Billed To
                  </p>
                  <p className="font-semibold text-[#121c2a] font-['Plus_Jakarta_Sans']">
                    {tenantInfo?.name ?? "—"}
                  </p>
                  {tenantInfo?.email && (
                    <p className="text-[#6c7a77] text-xs mt-0.5">{tenantInfo.email}</p>
                  )}
                </div>
                <div>
                  <p className="text-[#6c7a77] text-[10px] uppercase tracking-widest font-bold font-['Inter'] mb-1">
                    Property
                  </p>
                  <p className="font-semibold text-[#121c2a] font-['Plus_Jakarta_Sans']">
                    {tenantInfo?.room ?? "—"}
                  </p>
                  {tenantInfo?.property && (
                    <p className="text-[#6c7a77] text-xs mt-0.5">{tenantInfo.property}</p>
                  )}
                </div>
                <div>
                  <p className="text-[#6c7a77] text-[10px] uppercase tracking-widest font-bold font-['Inter'] mb-1">
                    Payment Date
                  </p>
                  <p className="font-medium text-[#121c2a] font-['Manrope']">
                    {formatDate(paymentDate)}
                  </p>
                </div>
                <div>
                  <p className="text-[#6c7a77] text-[10px] uppercase tracking-widest font-bold font-['Inter'] mb-1">
                    Payment Method
                  </p>
                  <p className="font-medium text-[#121c2a] font-['Manrope']">
                    {payment.payment_method ?? "Online Transfer"}
                  </p>
                </div>
              </div>

              {/* Line items */}
              <div>
                <div className="border-t border-dashed border-gray-200 pt-4">
                  {lineItems.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm py-1.5">
                      <span className="text-[#6c7a77] font-['Manrope']">{item.description}</span>
                      <span className="font-semibold text-[#121c2a] font-['Manrope']">
                        {formatSGD(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Total */}
                <div className="border-t-2 border-[#006b5f]/20 mt-2 pt-3 flex justify-between">
                  <span className="text-sm font-bold text-[#121c2a] font-['Plus_Jakarta_Sans']">Total Paid</span>
                  <span className="text-base font-extrabold text-[#006b5f] font-['Plus_Jakarta_Sans']">
                    {formatSGD(total)}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <p className="text-[10px] text-[#6c7a77] text-center font-['Manrope'] pt-2 border-t border-gray-100">
                This is a computer-generated receipt. No signature required.
              </p>
            </div>
          </div>

          {/* Print button */}
          <div className="no-print mt-4 flex justify-center">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#006b5f] text-white text-sm font-semibold rounded-lg hover:bg-[#005a50] transition-colors font-['Inter']"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / Save as PDF
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
