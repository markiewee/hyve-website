# Rent Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Aspire bank transaction matching to AdminRentPage so Mark can click-click reconcile incoming PayNow transfers against expected rent.

**Architecture:** Add a reconciliation panel section to AdminRentPage between the rent table and the charges section. Uses existing aspire.js client (no new API routes). Split-view: unpaid rent left, Aspire credits right. Click-click to match.

**Tech Stack:** React, Supabase client, existing aspire.js proxy

---

### Task 1: Add Aspire fetch and reconciliation state to AdminRentPage

**Files:**
- Modify: `src/pages/portal/AdminRentPage.jsx`

- [ ] **Step 1: Add imports and state**

At the top of AdminRentPage.jsx, add the aspire import after the existing supabase import:

```jsx
import { aspire } from "../../lib/aspire";
```

Inside the component function, after the existing charges state declarations (~line 61), add:

```jsx
// Reconciliation state
const [aspireTransactions, setAspireTransactions] = useState([]);
const [aspireLoading, setAspireLoading] = useState(false);
const [aspireError, setAspireError] = useState(null);
const [selectedTxn, setSelectedTxn] = useState(null);
const [matchedPairs, setMatchedPairs] = useState([]);
const [reconcileMonth, setReconcileMonth] = useState(() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
});
```

- [ ] **Step 2: Add Aspire fetch function**

After the existing `fetchCharges` function, add:

```jsx
async function handleFetchAspire() {
  setAspireLoading(true);
  setAspireError(null);
  try {
    const accounts = await aspire.getAccounts();
    if (!accounts.length) throw new Error("No Aspire accounts found");
    const accountId = accounts[0].id ?? accounts[0].account_id ?? accounts[0].accountId;
    const [year, month] = reconcileMonth.split("-");
    const from_date = `${year}-${month}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const to_date = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
    const txns = await aspire.getTransactions(accountId, { from_date, to_date });
    // Filter to credits (incoming payments) only
    const credits = txns.filter(t => t.transaction_type === "INCOME" && t.amount > 0);
    setAspireTransactions(credits);
  } catch (err) {
    console.error("Aspire fetch error:", err);
    setAspireError(err.message);
  }
  setAspireLoading(false);
}
```

- [ ] **Step 3: Add match and unmatch functions**

```jsx
async function handleMatch(rentPayment) {
  if (!selectedTxn) return;
  const { error } = await supabase
    .from("rent_payments")
    .update({
      status: "PAID",
      paid_at: selectedTxn.transaction_date,
      paid_amount: rentPayment.rent_amount,
      payment_reference: selectedTxn.reference,
      payment_method: "PAYNOW",
    })
    .eq("id", rentPayment.id);

  if (error) {
    console.error("Match error:", error);
    return;
  }

  setMatchedPairs(prev => [...prev, {
    rentPaymentId: rentPayment.id,
    transactionRef: selectedTxn.reference,
    tenantName: rentPayment.tenant_profiles?.tenant_details?.full_name || rentPayment.tenant_profiles?.username || "—",
    unitCode: rentPayment.tenant_profiles?.rooms?.unit_code || "—",
    rentAmount: rentPayment.rent_amount,
    txnAmount: selectedTxn.amount,
    txnDate: selectedTxn.transaction_date,
    txnDescription: selectedTxn.description,
  }]);

  // Remove matched transaction from list
  setAspireTransactions(prev => prev.filter(t => t.reference !== selectedTxn.reference));
  // Update rent payment in local state
  setRentPayments(prev => prev.map(p =>
    p.id === rentPayment.id
      ? { ...p, status: "PAID", paid_at: selectedTxn.transaction_date, paid_amount: p.rent_amount, payment_method: "PAYNOW", payment_reference: selectedTxn.reference }
      : p
  ));
  setSelectedTxn(null);
}

async function handleUnmatch(pair) {
  const { error } = await supabase
    .from("rent_payments")
    .update({
      status: "PENDING",
      paid_at: null,
      paid_amount: null,
      payment_reference: null,
      payment_method: null,
    })
    .eq("id", pair.rentPaymentId);

  if (error) {
    console.error("Unmatch error:", error);
    return;
  }

  // Restore transaction to list
  setAspireTransactions(prev => [...prev, {
    transaction_date: pair.txnDate,
    description: pair.txnDescription,
    amount: pair.txnAmount,
    reference: pair.transactionRef,
    transaction_type: "INCOME",
  }]);
  // Revert rent payment status
  setRentPayments(prev => prev.map(p =>
    p.id === pair.rentPaymentId
      ? { ...p, status: "PENDING", paid_at: null, paid_amount: null, payment_method: null, payment_reference: null }
      : p
  ));
  setMatchedPairs(prev => prev.filter(mp => mp.rentPaymentId !== pair.rentPaymentId));
}
```

- [ ] **Step 4: Commit state and logic**

```bash
git add src/pages/portal/AdminRentPage.jsx
git commit -m "feat: add Aspire reconciliation state and logic to AdminRentPage"
```

### Task 2: Add reconciliation UI panel

**Files:**
- Modify: `src/pages/portal/AdminRentPage.jsx`

- [ ] **Step 1: Add reconciliation panel JSX**

Insert the following JSX between the rent table closing `</div>` (after the `All Rent Payments` section, ~line 607) and the `Add One-Off Charge` section:

```jsx
{/* ── Reconciliation Panel ── */}
<div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden mt-8">
  <div className="px-8 py-6 border-b border-[#bbcac6]/15 flex flex-col sm:flex-row sm:items-center gap-4">
    <div className="flex-1">
      <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#121c2a]">
        Reconcile with Aspire
      </h2>
      <p className="font-['Manrope'] text-[#6c7a77] text-xs mt-0.5">
        Match incoming bank transfers to tenant rent records.
      </p>
    </div>
    <div className="flex items-center gap-3">
      <input
        type="month"
        value={reconcileMonth}
        onChange={(e) => setReconcileMonth(e.target.value)}
        className="px-3 py-2 rounded-lg border border-[#bbcac6]/30 text-sm font-['Manrope'] focus:outline-none focus:ring-2 focus:ring-[#006b5f]"
      />
      <button
        onClick={handleFetchAspire}
        disabled={aspireLoading}
        className="px-5 py-2.5 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 shrink-0"
      >
        <span className="material-symbols-outlined text-[18px]">account_balance</span>
        {aspireLoading ? "Fetching…" : "Fetch Aspire"}
      </button>
    </div>
  </div>

  {aspireError && (
    <div className="px-8 py-3 bg-[#ffdad6]/30 text-[#ba1a1a] font-['Manrope'] text-sm">
      {aspireError}
    </div>
  )}

  {selectedTxn && (
    <div className="px-8 py-3 bg-[#d1fae5] font-['Manrope'] text-sm text-[#065f46] flex items-center gap-2">
      <span className="material-symbols-outlined text-[16px]">check_circle</span>
      Selected: {selectedTxn.description} — {formatSGD(selectedTxn.amount)} ({selectedTxn.transaction_date})
      <button onClick={() => setSelectedTxn(null)} className="ml-auto text-xs underline">Cancel</button>
    </div>
  )}

  <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#bbcac6]/15">
    {/* LEFT: Unpaid Rent */}
    <div className="p-6">
      <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-4">
        Unpaid Rent ({rentPayments.filter(p => p.status === "PENDING" || p.status === "OVERDUE").length})
      </p>
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {rentPayments
          .filter(p => p.status === "PENDING" || p.status === "OVERDUE")
          .map(p => {
            const tp = p.tenant_profiles;
            const unitCode = tp?.rooms?.unit_code ?? "—";
            const name = tp?.tenant_details?.full_name || tp?.username || "—";
            return (
              <button
                key={p.id}
                onClick={() => selectedTxn ? handleMatch(p) : null}
                disabled={!selectedTxn}
                className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3 ${
                  selectedTxn
                    ? "border-[#14b8a6] hover:bg-[#006b5f]/5 cursor-pointer"
                    : "border-[#bbcac6]/15 opacity-60 cursor-default"
                }`}
              >
                <span className="font-['Inter'] text-xs font-bold text-[#006b5f] bg-[#eff4ff] px-2 py-1 rounded shrink-0">
                  {unitCode}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-['Manrope'] text-sm font-semibold text-[#121c2a] truncate">{name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-['Plus_Jakarta_Sans'] font-bold text-sm tabular-nums">{formatSGD(p.rent_amount)}</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${STATUS_BADGE[p.status]}`}>
                    {p.status}
                  </span>
                </div>
              </button>
            );
          })}
        {rentPayments.filter(p => p.status === "PENDING" || p.status === "OVERDUE").length === 0 && (
          <p className="text-center text-[#6c7a77] font-['Manrope'] text-sm py-8">All rent paid!</p>
        )}
      </div>
    </div>

    {/* RIGHT: Aspire Transactions */}
    <div className="p-6">
      <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-4">
        Aspire Incoming ({aspireTransactions.length})
      </p>
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {aspireTransactions.map((txn, idx) => {
          const isSelected = selectedTxn?.reference === txn.reference;
          return (
            <button
              key={txn.reference || idx}
              onClick={() => setSelectedTxn(isSelected ? null : txn)}
              className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3 ${
                isSelected
                  ? "border-[#14b8a6] ring-2 ring-[#14b8a6] bg-[#006b5f]/5"
                  : "border-[#bbcac6]/15 hover:border-[#14b8a6] hover:bg-[#f8f9ff]"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-['Manrope'] text-sm font-semibold text-[#121c2a] truncate">{txn.description || "Unknown"}</p>
                <p className="font-['Manrope'] text-xs text-[#6c7a77]">{txn.transaction_date}</p>
              </div>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-sm tabular-nums text-[#006b5f] shrink-0">
                {formatSGD(txn.amount)}
              </p>
            </button>
          );
        })}
        {aspireTransactions.length === 0 && !aspireLoading && (
          <p className="text-center text-[#6c7a77] font-['Manrope'] text-sm py-8">
            {aspireError ? "Failed to load" : "Click \"Fetch Aspire\" to load transactions"}
          </p>
        )}
        {aspireLoading && (
          <div className="py-8 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#006b5f] border-r-transparent" />
          </div>
        )}
      </div>
    </div>
  </div>

  {/* Matched pairs */}
  {matchedPairs.length > 0 && (
    <div className="border-t border-[#bbcac6]/15 p-6">
      <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-4">
        Matched This Session ({matchedPairs.length})
      </p>
      <div className="space-y-2">
        {matchedPairs.map(pair => (
          <div key={pair.rentPaymentId} className="flex items-center gap-3 p-3 rounded-xl bg-[#d1fae5]/30 border border-[#d1fae5]">
            <span className="font-['Inter'] text-xs font-bold text-[#006b5f] bg-[#eff4ff] px-2 py-1 rounded">{pair.unitCode}</span>
            <p className="font-['Manrope'] text-sm text-[#121c2a] flex-1">{pair.tenantName} — {formatSGD(pair.rentAmount)}</p>
            <span className="text-[#6c7a77] font-['Manrope'] text-xs">←</span>
            <p className="font-['Manrope'] text-sm text-[#121c2a]">{pair.txnDescription} — {formatSGD(pair.txnAmount)}</p>
            {Number(pair.txnAmount) !== Number(pair.rentAmount) && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-amber-100 text-amber-700">
                Amount mismatch
              </span>
            )}
            <button
              onClick={() => handleUnmatch(pair)}
              className="text-xs px-3 py-1.5 rounded-lg border border-[#bbcac6]/30 text-[#6c7a77] hover:bg-white font-['Manrope'] font-bold shrink-0"
            >
              Unmatch
            </button>
          </div>
        ))}
      </div>
    </div>
  )}
</div>
```

- [ ] **Step 2: Commit UI**

```bash
git add src/pages/portal/AdminRentPage.jsx
git commit -m "feat: add reconciliation split-view panel with click-click matching"
```

- [ ] **Step 3: Push to Vercel**

```bash
git push origin master
```
