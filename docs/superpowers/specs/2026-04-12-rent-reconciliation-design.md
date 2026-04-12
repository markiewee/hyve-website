# Rent Reconciliation — Design Spec

**Date:** 2026-04-12
**Status:** Approved
**Location:** `AdminRentPage.jsx` — extend existing page

## Problem

Mark manually checks Aspire bank transactions, cross-references with tenant rent records, then clicks "Mark Paid" one by one. With 16 tenants across 3 properties this is tedious and error-prone.

## Solution

Add a split-view reconciliation panel to the existing Rent Management page. Left side shows unpaid rent records, right side shows incoming Aspire credit transactions. Click-click to match and auto-mark as PAID.

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Rent Management                                             │
│  [Generate This Month]                                       │
├────────────────────────────┬────────────────────────────────┤
│  UNPAID RENT               │  ASPIRE INCOMING               │
│                            │  [Fetch Aspire] [Apr 2026 ▼]   │
│  ┌────────────────────┐   │  ┌────────────────────────┐    │
│  │ CP-MR Liu Dongpu   │   │  │ 12 Apr  LIU DONGPU    │    │
│  │ $2,300    PENDING  │   │  │ $2,300  PayNow  ✓     │    │
│  └────────────────────┘   │  └────────────────────────┘    │
│  ┌────────────────────┐   │  ┌────────────────────────┐    │
│  │ CP-PR1 David H.    │   │  │ 11 Apr  POLINA         │    │
│  │ $1,500    PENDING  │   │  │ $1,600  PayNow         │    │
│  └────────────────────┘   │  └────────────────────────┘    │
│  ...                       │  ...                            │
├────────────────────────────┴────────────────────────────────┤
│  MATCHED THIS MONTH (click to unmatch)                       │
│  CP-PR3 Polina $1,600 ← 11 Apr POLINA $1,600 ref:TXN123   │
│  ...                                                         │
├──────────────────────────────────────────────────────────────┤
│  Ad-hoc Charges (existing section, unchanged)                │
└──────────────────────────────────────────────────────────────┘
```

## User Flow

1. Navigate to `/portal/admin/rent`
2. Click "Generate This Month" if rent records don't exist yet (existing flow)
3. Click "Fetch Aspire" — pulls credit transactions from Aspire for the selected month
4. Aspire transactions appear in right panel, filtered to credits only
5. Click a transaction on the right → highlights green (selected state)
6. Click an unpaid tenant on the left → match is made:
   - `rent_payments.status` → `PAID`
   - `rent_payments.paid_at` → transaction date from Aspire
   - `rent_payments.payment_reference` → Aspire transaction reference
   - `rent_payments.payment_method` → `PAYNOW`
7. Both items move to "Matched This Month" section below
8. Click a matched pair to unmatch (reverts to PENDING, clears reference)
9. Repeat until all tenants reconciled
10. Unmatched Aspire transactions remain visible (may be non-rent income)

## Matching Rules

- **Click-click pairing:** Select transaction → select tenant → instant match
- **Amount mismatch warning:** If transaction amount ≠ rent amount, show yellow warning badge but still allow match (covers partial payments, rounding)
- **Manual override stays:** Existing "Mark Paid" button remains for cash/non-Aspire payments
- **No auto-matching:** All matching is manual. Names may not match between bank and DB.

## Data Model Changes

### `rent_payments` table — add columns:

```sql
ALTER TABLE rent_payments ADD COLUMN IF NOT EXISTS payment_reference TEXT DEFAULT NULL;
ALTER TABLE rent_payments ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT NULL;
```

### Aspire transaction cache (in-memory only)

Aspire transactions are fetched client-side via the existing `aspire.js` client and held in React state. No new DB table needed — transactions are transient for the reconciliation session. The only persistent data is the match written to `rent_payments`.

## Technical Implementation

### No new API routes

All Aspire calls go through the existing `/api/portal/admin-actions` proxy. Rent updates use direct Supabase client-side calls. Zero new Vercel functions needed.

### Files to modify

| File | Change |
|------|--------|
| `src/pages/portal/AdminRentPage.jsx` | Add split-view reconciliation panel, Aspire fetch, click-click matching logic |
| `src/lib/aspire.js` | No changes — already supports `getAccounts()` and `getTransactions()` |

### New components (inline or extracted)

| Component | Purpose |
|-----------|---------|
| `ReconciliationPanel` | Split-view container with left (rent) and right (Aspire) panels |
| `AspireTransactionCard` | Single transaction row — date, counterparty, amount, selected state |
| `MatchedPairRow` | Shows a completed match with unmatch action |

### State management

```
selectedTransaction: null | AspireTransaction
aspireTransactions: AspireTransaction[]
matchedPairs: { rentPaymentId, transactionRef, transactionDate, amount }[]
```

### Aspire fetch flow

1. User clicks "Fetch Aspire"
2. Call `aspire.getAccounts()` → get account ID
3. Call `aspire.getTransactions(accountId, { from_date, to_date })` with month boundaries
4. Filter to `transaction_type === 'INCOME'` (credits only)
5. Store in `aspireTransactions` state
6. Remove any already-matched transactions (compare `payment_reference` in rent_payments)

### Match flow

1. User clicks Aspire transaction → `selectedTransaction = txn`
2. User clicks unpaid rent row → trigger match:
   ```js
   await supabase.from('rent_payments').update({
     status: 'PAID',
     paid_at: selectedTransaction.transaction_date,
     payment_reference: selectedTransaction.reference,
     payment_method: 'PAYNOW',
   }).eq('id', rentPayment.id);
   ```
3. Move both items to matched section
4. Clear `selectedTransaction`

### Unmatch flow

1. User clicks matched pair → trigger unmatch:
   ```js
   await supabase.from('rent_payments').update({
     status: 'PENDING',
     paid_at: null,
     payment_reference: null,
     payment_method: null,
   }).eq('id', rentPayment.id);
   ```
2. Move items back to their respective panels

## Edge Cases

| Case | Handling |
|------|----------|
| Transaction amount ≠ rent amount | Yellow warning badge, still allow match |
| Tenant paid cash (not in Aspire) | Use existing "Mark Paid" button |
| Multiple transactions for one tenant | Match one, remainder stays unmatched |
| Transaction not for rent (e.g. deposit, refund) | Leave unmatched, ignore |
| Aspire API unavailable | Show error toast, reconciliation panel empty |
| Month has no rent records yet | Prompt to "Generate This Month" first |

## Styling

Follow existing portal design system:
- Cards: `bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm`
- Selected state: `ring-2 ring-[#14b8a6] bg-[#006b5f]/5`
- Matched state: `opacity-50 bg-[#d1fae5]`
- Warning badge: `bg-amber-100 text-amber-700`
- Fonts: Plus Jakarta Sans (headings), Manrope (body), Inter (labels)
