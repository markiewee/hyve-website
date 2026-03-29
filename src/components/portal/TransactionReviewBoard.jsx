import { useState } from "react";

const INCOME_CATEGORIES = [
  { key: "RENT", label: "Rent", icon: "payments" },
  { key: "DEPOSIT_IN", label: "Deposit In", icon: "account_balance" },
  { key: "AC_SURCHARGE", label: "AC Surcharge", icon: "ac_unit" },
  { key: "ADHOC_FEE", label: "Ad-hoc Fee", icon: "receipt" },
  { key: "STRIPE_PAYOUT", label: "Stripe Payout", icon: "credit_card" },
  { key: "OTHER_INCOME", label: "Other Income", icon: "add_circle" },
];

const EXPENSE_CATEGORIES = [
  { key: "MASTER_LEASE", label: "Master Lease", icon: "home" },
  { key: "UTILITIES", label: "Utilities", icon: "bolt" },
  { key: "MAINTENANCE", label: "Maintenance", icon: "build" },
  { key: "CLEANING", label: "Cleaning", icon: "cleaning_services" },
  { key: "SUPPLIES", label: "Supplies", icon: "inventory_2" },
  { key: "WIFI", label: "WiFi", icon: "wifi" },
  { key: "INSURANCE", label: "Insurance", icon: "shield" },
  { key: "STAFF", label: "Staff", icon: "badge" },
  { key: "PLATFORM_FEES", label: "Platform Fees", icon: "devices" },
  { key: "FURNISHING", label: "Furnishing", icon: "chair" },
  { key: "MARKETING", label: "Marketing", icon: "campaign" },
  { key: "OTHER_EXPENSE", label: "Other Expense", icon: "more_horiz" },
];

const fmtSGD = (amt) => `SGD ${Math.abs(Number(amt || 0)).toLocaleString("en-SG", { minimumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" }) : "";

export default function TransactionReviewBoard({
  transactions,
  properties,
  onConfirm,
  onIgnore,
  onBulkConfirm,
  stats,
  typeFilter,
  onTypeFilterChange,
}) {
  const [step, setStep] = useState(null); // null | { txId, category, transactionType }
  const [saving, setSaving] = useState(null);
  const [message, setMessage] = useState(null);

  const pending = (transactions || []).filter(t => t.status === "PENDING" || t.status === "AUTO_TAGGED");
  const tab = typeFilter || "ALL";
  const filtered = tab === "ALL" ? pending
    : tab === "INCOME" ? pending.filter(t => t.transaction_type === "INCOME")
    : pending.filter(t => t.transaction_type === "EXPENSE");

  async function handlePropertySelect(propertyId) {
    if (!step || !onConfirm) return;
    setSaving(step.txId);
    setMessage(null);
    try {
      await onConfirm(step.txId, propertyId, step.category, null, {
        transaction_type: step.transactionType,
      });
      setMessage({ type: "success", text: "Transaction categorized successfully." });
      setStep(null);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to save: " + (err.message || "Unknown error") });
    }
    setSaving(null);
  }

  async function handleIgnore(txId) {
    if (!onIgnore) return;
    setMessage(null);
    try {
      await onIgnore(txId);
      setMessage({ type: "success", text: "Transaction ignored." });
    } catch (err) {
      setMessage({ type: "error", text: "Failed to ignore: " + (err.message || "Unknown error") });
    }
  }

  async function handleConfirmAutoTag(txId) {
    const tx = pending.find(t => t.id === txId);
    if (!tx || !onConfirm) return;
    setMessage(null);
    try {
      await onConfirm(txId, tx.property_id, tx.category, null, {
        transaction_type: tx.transaction_type,
      });
      setMessage({ type: "success", text: "Auto-tag confirmed." });
    } catch (err) {
      setMessage({ type: "error", text: "Failed to confirm: " + (err.message || "Unknown error") });
    }
  }

  async function handleBulkConfirm() {
    if (!onBulkConfirm) return;
    setMessage(null);
    try {
      await onBulkConfirm();
      setMessage({ type: "success", text: "All auto-tagged transactions confirmed." });
    } catch (err) {
      setMessage({ type: "error", text: "Bulk confirm failed: " + (err.message || "Unknown error") });
    }
  }

  const activeTx = step ? pending.find(t => t.id === step.txId) : null;
  const autoTaggedCount = stats?.autoTagged || pending.filter(t => t.status === "AUTO_TAGGED").length;

  return (
    <div className="space-y-4">
      {/* Feedback message */}
      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm font-['Manrope'] font-medium ${message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 bg-[#eff4ff] rounded-lg p-1 w-fit">
          {[
            { key: "ALL", label: "All", count: pending.length },
            { key: "INCOME", label: "Income", count: pending.filter(t => t.transaction_type === "INCOME").length },
            { key: "EXPENSE", label: "Expense", count: pending.filter(t => t.transaction_type === "EXPENSE").length },
          ].map(({ key, label, count }) => (
            <button key={key} onClick={() => { onTypeFilterChange?.(key) || null; setStep(null); }}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${tab === key ? "bg-white text-[#006b5f] shadow-sm" : "text-[#6c7a77]"}`}>
              {label} ({count})
            </button>
          ))}
        </div>
        {autoTaggedCount > 0 && (
          <button onClick={handleBulkConfirm}
            className="px-4 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700">
            Confirm All Auto-tagged ({autoTaggedCount})
          </button>
        )}
      </div>

      {/* Transaction list or step-by-step classifier */}
      {!step ? (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-[#6c7a77] py-8 text-center">No transactions to review.</p>
          ) : filtered.map(tx => (
            <div key={tx.id} className={`bg-white rounded-xl border p-4 ${tx.status === "AUTO_TAGGED" ? "border-green-200" : "border-[#bbcac6]/15"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-['Manrope'] font-bold text-sm text-[#121c2a]">{tx.description}</p>
                  <p className="font-['Inter'] text-xs text-[#6c7a77] mt-0.5">
                    {fmtDate(tx.transaction_date)}
                    {tx.reference && <span className="ml-2 text-[#bbcac6]">Ref: {tx.reference}</span>}
                  </p>
                </div>
                <p className={`font-['Plus_Jakarta_Sans'] font-bold text-sm shrink-0 ${tx.transaction_type === "INCOME" ? "text-green-600" : "text-red-600"}`}>
                  {tx.transaction_type === "INCOME" ? "+" : "-"}{fmtSGD(tx.amount)}
                </p>
              </div>

              {tx.status === "AUTO_TAGGED" && tx.category && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold">
                    Auto: {tx.category.replace(/_/g, " ")}
                  </span>
                  {tx.confidence != null && (
                    <span className="text-[10px] text-[#6c7a77]">{Math.round(tx.confidence * 100)}% match</span>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                {tx.status === "AUTO_TAGGED" && (
                  <button onClick={() => handleConfirmAutoTag(tx.id)}
                    className="px-3 py-1.5 bg-[#006b5f] text-white text-xs font-bold rounded-lg hover:opacity-90">
                    Confirm
                  </button>
                )}
                <button onClick={() => setStep({ txId: tx.id, category: null, transactionType: tx.transaction_type || (Number(tx.amount) >= 0 ? "INCOME" : "EXPENSE") })}
                  className="px-3 py-1.5 bg-[#eff4ff] text-[#006b5f] text-xs font-bold rounded-lg hover:bg-[#e6eeff]">
                  {tx.status === "AUTO_TAGGED" ? "Re-tag" : "Categorize"}
                </button>
                <button onClick={() => handleIgnore(tx.id)}
                  className="px-3 py-1.5 text-[#6c7a77] text-xs font-bold rounded-lg hover:bg-gray-100">
                  Ignore
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : !step.category ? (
        /* Step 1: Pick category */
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep(null)} className="text-sm text-[#006b5f] font-bold hover:underline flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">arrow_back</span> Back
            </button>
            <p className="text-sm"><strong>{activeTx?.description}</strong> — <span className={step.transactionType === "INCOME" ? "text-green-600" : "text-red-600"}>{fmtSGD(activeTx?.amount)}</span></p>
          </div>

          <div className="flex gap-2">
            {["INCOME", "EXPENSE"].map(type => (
              <button key={type} onClick={() => setStep(s => ({ ...s, transactionType: type }))}
                className={`px-4 py-2 rounded-lg text-xs font-bold ${step.transactionType === type ? (type === "INCOME" ? "bg-green-500 text-white" : "bg-red-500 text-white") : "bg-gray-100 text-[#6c7a77]"}`}>
                {type}
              </button>
            ))}
          </div>

          <p className="text-xs text-[#6c7a77] font-bold uppercase tracking-widest">Step 1: Pick Category</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {(step.transactionType === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => (
              <button key={cat.key} onClick={() => setStep(s => ({ ...s, category: cat.key }))}
                className="flex flex-col items-center gap-1.5 p-4 rounded-xl border border-[#bbcac6]/15 hover:border-[#006b5f] hover:bg-[#006b5f]/5 transition-all">
                <span className="material-symbols-outlined text-[#006b5f] text-[24px]">{cat.icon}</span>
                <span className="text-xs font-bold text-[#121c2a]">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Step 2: Pick property */
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep(s => ({ ...s, category: null }))} className="text-sm text-[#006b5f] font-bold hover:underline flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">arrow_back</span> Back
            </button>
            <p className="text-sm">
              <strong>{activeTx?.description}</strong> → <span className="text-[#006b5f] font-bold">{step.category.replace(/_/g, " ")}</span>
            </p>
          </div>

          <p className="text-xs text-[#6c7a77] font-bold uppercase tracking-widest">Step 2: Assign Property</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button onClick={() => handlePropertySelect(null)} disabled={!!saving}
              className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-[#bbcac6]/30 hover:border-[#006b5f] hover:bg-[#006b5f]/5 transition-all disabled:opacity-50">
              <span className="material-symbols-outlined text-[#6c7a77] text-[28px]">business</span>
              <span className="text-xs font-bold">Company / Ops</span>
            </button>
            {(properties || []).map(p => (
              <button key={p.id} onClick={() => handlePropertySelect(p.id)} disabled={!!saving}
                className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-[#bbcac6]/15 hover:border-[#006b5f] hover:bg-[#006b5f]/5 transition-all disabled:opacity-50">
                <span className="material-symbols-outlined text-[#006b5f] text-[28px]">apartment</span>
                <span className="text-xs font-bold">{p.name}</span>
              </button>
            ))}
          </div>
          {saving && <p className="text-xs text-[#006b5f] animate-pulse">Saving...</p>}
        </div>
      )}
    </div>
  );
}
