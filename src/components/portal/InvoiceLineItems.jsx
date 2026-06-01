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
          <h4 className="font-['Inter'] text-xs uppercase tracking-widest text-[#57534E] font-bold mb-2">
            Monthly Charges
          </h4>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#DDD0AD]">
                <th className="text-left py-2 font-['Inter'] text-sm text-[#57534E] font-semibold">Item</th>
                <th className="text-left py-2 font-['Inter'] text-sm text-[#57534E] font-semibold">Description</th>
                <th className="text-right py-2 font-['Inter'] text-sm text-[#57534E] font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {preItems.map((li) => (
                <tr key={li.id} className="border-b border-[#DDD0AD]">
                  <td className="py-2 font-['Inter'] text-sm text-[#181511]">
                    {CATEGORY_LABELS[li.category] ?? li.category}
                  </td>
                  <td className="py-2 font-['Inter'] text-sm text-[#57534E]">{li.description}</td>
                  <td className="py-2 font-['Inter'] text-sm text-[#181511] text-right">{formatSGD(li.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {postItems.length > 0 && (
        <div>
          <h4 className="font-['Inter'] text-xs uppercase tracking-widest text-[#57534E] font-bold mb-2">
            Usage Charges
          </h4>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#DDD0AD]">
                <th className="text-left py-2 font-['Inter'] text-sm text-[#57534E] font-semibold">Item</th>
                <th className="text-left py-2 font-['Inter'] text-sm text-[#57534E] font-semibold">Description</th>
                <th className="text-right py-2 font-['Inter'] text-sm text-[#57534E] font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {postItems.map((li) => (
                <tr key={li.id} className="border-b border-[#DDD0AD]">
                  <td className="py-2 font-['Inter'] text-sm text-[#181511]">
                    {CATEGORY_LABELS[li.category] ?? li.category}
                  </td>
                  <td className="py-2 font-['Inter'] text-sm text-[#57534E]">{li.description}</td>
                  <td className="py-2 font-['Inter'] text-sm text-[#181511] text-right">{formatSGD(li.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-[#181511]">
        <span className="font-['Hanken_Grotesk'] font-extrabold text-lg text-[#181511]">
          Total: {formatSGD(total)}
        </span>
      </div>
    </div>
  );
}
