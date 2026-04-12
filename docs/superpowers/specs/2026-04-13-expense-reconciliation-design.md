# Expense Reconciliation & P&L Report — Design Spec

**Date:** 2026-04-13
**Status:** Approved
**Location:** Replace existing `AdminExpenseImportPage.jsx`

## Problem

The current expense import page has a clunky multi-step flow (fetch → review board → categorize). It doesn't match the clean reconciliation UX we built for rent. Expense tagging is disconnected from reporting — tagged expenses don't automatically flow into P&L.

## Solution

Replace the expense import page with a reconciliation-style UI matching the rent panel. Auto-tag suggests categories, admin confirms each one. Once all tagged, generate a per-property P&L report combining rent income + expenses.

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Expense Reconciliation                                      │
│  [Account ▼] [2026-04 ▼] [Fetch Aspire]                    │
├──────────────────────────────────────────────────────────────┤
│  UNTAGGED (5)                    TAGGED (12)                 │
│                                                              │
│  ┌──────────────────────┐       ┌──────────────────────┐    │
│  │ 1 Apr  SINGTEL       │       │ CP  WIFI     $89.00  │    │
│  │ $89.00               │       │ Singtel · Confirmed  │    │
│  │ [Auto: CP | WIFI] ✓ ✗│       └──────────────────────┘    │
│  └──────────────────────┘       ┌──────────────────────┐    │
│  ┌──────────────────────┐       │ TG  MASTER_LEASE     │    │
│  │ 1 Apr  PAYMENT TO    │       │ $4,500 · Confirmed   │    │
│  │ $4,500               │       └──────────────────────┘    │
│  │ [Property ▼] [Cat ▼] │       ...                         │
│  │        [Confirm]      │                                   │
│  └──────────────────────┘                                    │
├──────────────────────────────────────────────────────────────┤
│  SUMMARY BY PROPERTY                    [Generate P&L Report]│
│                                                              │
│  Thomson Grove    $4,500 master lease + $89 wifi = $4,589    │
│  Ivory Heights    $4,800 master lease + $120 maint = $4,920  │
│  Chiltern Park    $4,700 master lease + $89 wifi = $4,789    │
└──────────────────────────────────────────────────────────────┘
```

## User Flow

1. Navigate to `/portal/admin/expenses/import`
2. Select Aspire account from dropdown (with nicknames)
3. Select month
4. Click "Fetch Aspire" — pulls debit transactions for the month
5. Transactions appear as cards in the "Untagged" column
6. Auto-tagged transactions show pre-filled property + category with yellow highlight
7. For auto-tagged: click checkmark to confirm, or X to reject and re-tag manually
8. For untagged: select property → room (optional) → category → click "Confirm"
9. Confirmed transactions move to "Tagged" column on the right
10. Bottom shows running summary grouped by property + category
11. Click "Generate P&L Report" when done

## Tagging UI (per transaction card)

**Auto-tagged card:**
```
┌─────────────────────────────────────────┐
│ 1 Apr  SINGTEL FIBRE                    │
│ $89.00                          DEBIT   │
│ ┌─────────────────────────────────────┐ │
│ │ Auto-tagged: CP | WIFI             │ │
│ │              [✓ Confirm] [✗ Change]│ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Untagged card (expanded on click):**
```
┌─────────────────────────────────────────┐
│ 3 Apr  AIRCON REPAIR PTE LTD           │
│ $180.00                         DEBIT   │
│ [Property ▼] [Room ▼] [Category ▼]     │
│                          [Confirm]      │
└─────────────────────────────────────────┘
```

## Auto-Tagging Rules

Uses existing `tagging_rules` table. When a transaction is confirmed:
1. Upsert a tagging rule matching the description keywords → property + category
2. Next month, same description auto-suggests the same tag
3. Auto-tagged items show yellow highlight and pre-filled dropdowns
4. Admin must still click "Confirm" — no auto-commit

## P&L Report

When "Generate P&L Report" is clicked:

### Data Sources
- **Income:** `rent_payments` WHERE `status = 'PAID'` AND `month = selected_month` — grouped by property
- **Expenses:** Confirmed tagged transactions for the month — grouped by property + category

### Report Layout
```
┌─────────────────────────────────────────────────────────────┐
│  P&L Report — April 2026                                     │
├─────────────────────┬──────────┬──────────┬─────────────────┤
│                     │ Thomson  │ Ivory    │ Chiltern        │
│                     │ Grove    │ Heights  │ Park            │
├─────────────────────┼──────────┼──────────┼─────────────────┤
│ INCOME              │          │          │                 │
│ Rent Collected      │ $3,700   │ $6,350   │ $7,480          │
│ Total Income        │ $3,700   │ $6,350   │ $7,480          │
├─────────────────────┼──────────┼──────────┼─────────────────┤
│ EXPENSES            │          │          │                 │
│ Master Lease        │ $4,500   │ $4,800   │ $4,700          │
│ Utilities           │ $0       │ $0       │ $0              │
│ WiFi                │ $89      │ $89      │ $89             │
│ Maintenance         │ $0       │ $180     │ $0              │
│ Cleaning            │ $235     │ $235     │ $235            │
│ Total Expenses      │ $4,824   │ $5,304   │ $5,024          │
├─────────────────────┼──────────┼──────────┼─────────────────┤
│ NET PROFIT          │ ($1,124) │ $1,046   │ $2,456          │
└─────────────────────┴──────────┴──────────┴─────────────────┘
│ TOTAL NET PROFIT: $2,378                                     │
│                                          [Finalize Month]    │
└──────────────────────────────────────────────────────────────┘
```

### Finalize
"Finalize Month" writes the summary to `monthly_financials` table — locks the numbers for investor distribution calculations. Once finalized, shows a green "Finalized" badge and prevents re-editing.

## Technical Implementation

### No new API routes
All Aspire calls go through existing `/api/portal/admin-actions` proxy. All DB operations use Supabase client. Zero new Vercel functions.

### Files to modify

| File | Change |
|------|--------|
| `src/pages/portal/AdminExpenseImportPage.jsx` | Full rewrite — new reconciliation UI |
| `src/hooks/useTransactionImport.js` | May simplify — Aspire fetch logic moves inline |
| `src/hooks/useTransactionReview.js` | May simplify or remove — review logic moves inline |
| `src/components/portal/TransactionReviewBoard.jsx` | Remove — replaced by inline tagging |
| `src/components/portal/CsvUploader.jsx` | Keep — CSV import still useful as fallback |

### Existing DB tables (no changes needed)

| Table | Purpose |
|-------|---------|
| `bank_transactions` | Store fetched Aspire transactions |
| `tagging_rules` | Auto-tag rules (description → property + category) |
| `property_expenses` | Confirmed tagged expenses |
| `monthly_financials` | Finalized P&L records |
| `rent_payments` | Income data (from rent reconciliation) |

### State management

```
aspireAccounts: []
aspireAccountId: ""
accountNicknames: {}
reconcileMonth: "2026-04"
transactions: [] // fetched from Aspire
taggedTransactions: [] // confirmed + moved right
properties: [] // for dropdown
rooms: [] // for dropdown, filtered by selected property
summary: {} // grouped totals by property + category
```

### Categories (existing constants)

```js
EXPENSE_CATEGORIES = [
  "MASTER_LEASE", "UTILITIES", "MAINTENANCE", "CLEANING",
  "SUPPLIES", "WIFI", "INSURANCE", "STAFF",
  "PLATFORM_FEES", "FURNISHING", "MARKETING", "OTHER_EXPENSE"
]
```

## Edge Cases

| Case | Handling |
|------|----------|
| Transaction spans multiple properties | Tag to one, add note |
| CSV import needed (no Aspire) | Keep CSV tab as fallback |
| Month already finalized | Show "Finalized" badge, block re-editing |
| Transaction not an expense (refund, transfer) | "Ignore" button to skip |
| Aspire API down | Error toast, show CSV fallback |

## Styling

Same design system as rent reconciliation panel:
- Cards: `bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm`
- Auto-tagged highlight: `bg-amber-50 border-amber-200`
- Confirmed: `bg-[#d1fae5]/30 border-[#d1fae5]`
- Category badges: existing `bg-[#eff4ff] text-[#555f6f]` style
- P&L table: clean grid with property columns, category rows
