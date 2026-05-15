import React from "react";

function formatSGD(amount) {
  if (amount == null) return "$0.00";
  return `$${Number(amount).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const CATEGORY_LABELS = {
  RENT: "Rent",
  WIFI: "WiFi",
  AC_OVERAGE: "AC Overage",
  UTILITIES: "Utilities",
  CLEANING: "Cleaning",
  KEY_REPLACEMENT: "Key Replacement",
  DAMAGE: "Damage",
  LATE_FEE: "Late Fee",
  DEPOSIT: "Deposit",
  DEPOSIT_REFUND: "Deposit Refund",
  OTHER: "Other",
};

export default function InvoiceLineItems({ lineItems = [] }) {
  const preItems = lineItems.filter((li) => li.billing_type === "PRE");
  const postItems = lineItems.filter((li) => li.billing_type === "POST");
  const total = lineItems.reduce((sum, li) => sum + Number(li.amount), 0);

  return (
    <div className="space-y-4">
      {preItems.length > 0 && (
        <div>
          <h4 className="font-['Inter'] text-xs uppercase tracking-widest text-[#6B7280] font-bold mb-2">
            Monthly Charges
          </h4>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E8E0CE]/20">
                <th className="text-left py-2 font-['Manrope'] text-sm text-[#6B7280] font-semibold">Item</th>
                <th className="text-left py-2 font-['Manrope'] text-sm text-[#6B7280] font-semibold">Description</th>
                <th className="text-right py-2 font-['Manrope'] text-sm text-[#6B7280] font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {preItems.map((li) => (
                <tr key={li.id} className="border-b border-[#E8E0CE]/10">
                  <td className="py-2 font-['Manrope'] text-sm text-[#1F2937]">
                    {CATEGORY_LABELS[li.category] ?? li.category}
                  </td>
                  <td className="py-2 font-['Manrope'] text-sm text-[#6B7280]">{li.description}</td>
                  <td className="py-2 font-['Manrope'] text-sm text-[#1F2937] text-right">{formatSGD(li.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {postItems.length > 0 && (
        <div>
          <h4 className="font-['Inter'] text-xs uppercase tracking-widest text-[#6B7280] font-bold mb-2">
            Usage Charges
          </h4>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E8E0CE]/20">
                <th className="text-left py-2 font-['Manrope'] text-sm text-[#6B7280] font-semibold">Item</th>
                <th className="text-left py-2 font-['Manrope'] text-sm text-[#6B7280] font-semibold">Description</th>
                <th className="text-right py-2 font-['Manrope'] text-sm text-[#6B7280] font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {postItems.map((li) => (
                <tr key={li.id} className="border-b border-[#E8E0CE]/10">
                  <td className="py-2 font-['Manrope'] text-sm text-[#1F2937]">
                    {CATEGORY_LABELS[li.category] ?? li.category}
                  </td>
                  <td className="py-2 font-['Manrope'] text-sm text-[#6B7280]">{li.description}</td>
                  <td className="py-2 font-['Manrope'] text-sm text-[#1F2937] text-right">{formatSGD(li.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-[#1F2937]">
        <span className="font-['Plus_Jakarta_Sans'] font-extrabold text-lg text-[#1F2937]">
          Total: {formatSGD(total)}
        </span>
      </div>
    </div>
  );
}
