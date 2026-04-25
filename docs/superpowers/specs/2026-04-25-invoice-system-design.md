# Hyve Portal Invoice System — Design Spec

**Date:** 2026-04-25
**Status:** Approved
**Author:** Mark Wee + Claudine

## Overview

A consolidated monthly invoice system for the Hyve co-living portal. Each tenant receives one invoice per month covering all charges: rent, wifi, AC overage, utilities, member charges, and late fees. Invoices are auto-generated, viewable and printable in the tenant portal, and payable via DBS bank transfer or Stripe (+4% fee).

## Goals

1. One invoice per tenant per month consolidating all charge types
2. Unique invoice codes for payment tracking and bank transfer matching
3. Two-phase billing: pre-consumption items (rent, wifi) issued on last day of month; post-consumption items (AC, utilities) appended ~5th of next month
4. Tenant self-service: view, print, and pay invoices in the portal
5. Admin payment matching: suggest matches from bank transfers using invoice codes, never auto-confirm
6. Email notifications at key lifecycle events
7. Special handling for move-in (prorated) and move-out (final settlement) invoices
8. No more cash payments accepted

## Non-Goals

- Auto-matching bank transfers (suggest only, admin confirms)
- Consolidated invoices across multiple rooms (one tenant = one room = one invoice)
- PDF generation (HTML print stylesheet is sufficient)
- Multi-currency support

---

## 1. Invoice Lifecycle

```
DRAFT -> ISSUED -> PARTIALLY_PAID -> PAID -> VOID
```

- **DRAFT** — created internally, not yet visible to tenant
- **ISSUED** — visible to tenant, payable. Pre-consumption items on last day of month, updated ~5th when post-consumption items added
- **PARTIALLY_PAID** — tenant paid pre-consumption portion, post-consumption items still outstanding
- **PAID** — fully settled
- **VOID** — cancelled (duplicate, tenant moved out early, etc.)

### Triggers

| Event | Invoice Type | Timing |
|-------|-------------|--------|
| Monthly billing | MONTHLY | Last day of month (pre items), 5th of next month (post items) |
| Tenant move-in | MOVE_IN | At onboarding, prorated rent for remaining days |
| Tenant move-out | MOVE_OUT | At move-out, final settlement with deposit deduction |

---

## 2. Database Schema

### `invoices` table

```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_code TEXT UNIQUE NOT NULL,
  tenant_profile_id UUID NOT NULL REFERENCES tenant_profiles(id),
  room_id UUID NOT NULL REFERENCES rooms(id),
  property_id UUID NOT NULL REFERENCES properties(id),
  month DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('MONTHLY', 'MOVE_IN', 'MOVE_OUT')),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID')),
  subtotal DECIMAL NOT NULL DEFAULT 0,
  total_due DECIMAL NOT NULL DEFAULT 0,
  total_paid DECIMAL NOT NULL DEFAULT 0,
  issued_at TIMESTAMPTZ,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  stripe_checkout_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_profile_id, month, type)
);
```

### `invoice_line_items` table

```sql
CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'RENT', 'WIFI', 'AC_OVERAGE', 'UTILITIES', 'CLEANING',
    'KEY_REPLACEMENT', 'DAMAGE', 'LATE_FEE', 'DEPOSIT', 'DEPOSIT_REFUND', 'OTHER'
  )),
  description TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  billing_type TEXT NOT NULL CHECK (billing_type IN ('PRE', 'POST')),
  source_id UUID,
  source_table TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### RLS Policies

```sql
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Tenants read own invoices (ISSUED and beyond only)
CREATE POLICY "Tenants read own invoices" ON invoices FOR SELECT
  USING (tenant_profile_id IN (
    SELECT id FROM tenant_profiles WHERE user_id = auth.uid()
  ) AND status != 'DRAFT');

-- Admin full access
CREATE POLICY "Admin full access invoices" ON invoices FOR ALL
  USING (get_user_role(auth.uid()) = 'ADMIN');

-- Line items inherit from parent invoice
CREATE POLICY "Tenants read own line items" ON invoice_line_items FOR SELECT
  USING (invoice_id IN (
    SELECT id FROM invoices WHERE tenant_profile_id IN (
      SELECT id FROM tenant_profiles WHERE user_id = auth.uid()
    ) AND status != 'DRAFT'
  ));

CREATE POLICY "Admin full access line items" ON invoice_line_items FOR ALL
  USING (get_user_role(auth.uid()) = 'ADMIN');
```

### Triggers

```sql
CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 3. Invoice Code Format

`HV-{PROPERTY}-{ROOM}-{YYYYMM}-{SUFFIX}`

| Type | Suffix | Example |
|------|--------|---------|
| Monthly | Sequential (001, 002) | `HV-TG-PR1-202606-001` |
| Move-in | MI | `HV-CP-MR-202606-MI` |
| Move-out | MO | `HV-IH-STD2-202606-MO` |

Tenants use the invoice code as their bank transfer reference for payment matching.

---

## 4. Line Item Categories

| Category | Billing Type | Source Table | Description |
|----------|-------------|--------------|-------------|
| RENT | PRE | rent_payments | Monthly rent charge |
| WIFI | PRE | — | Fixed monthly wifi charge |
| AC_OVERAGE | POST | ac_monthly_usage | AC hours over 300hr free allowance at $0.30/hr |
| UTILITIES | POST | — | Utility true-ups |
| CLEANING | POST | member_charges | Cleaning charges |
| KEY_REPLACEMENT | POST | member_charges | Key replacement fee |
| DAMAGE | POST | member_charges | Damage charges |
| LATE_FEE | POST | — | 5% if >5 days late, additional 5% if >30 days |
| DEPOSIT | PRE | — | Move-in deposit |
| DEPOSIT_REFUND | POST | — | Move-out deposit return (negative amount) |
| OTHER | PRE or POST | member_charges | Catch-all |

---

## 5. Auto-Generation Flow

### Monthly Invoices — Supabase Edge Function

**Phase 1: Pre-consumption (cron — last day of month)**

1. Query all active tenants with rooms
2. For each tenant without a MONTHLY invoice for next month:
   - Generate invoice_code from property code + room code + month
   - Create invoice with status = ISSUED, due_date = 1st of billing month
   - Add RENT line item (amount from tenant_profiles.monthly_rent, source_id = rent_payments.id)
   - Add WIFI line item if applicable
   - Add any pending member_charges as line items
   - Calculate subtotal and total_due
   - Set issued_at = now()
3. Send email notification to each tenant

**Phase 2: Post-consumption (cron — 5th of month)**

1. Query all ISSUED or PARTIALLY_PAID invoices for current month
2. For each invoice:
   - Check ac_monthly_usage for overage hours
   - If overage > 0, add AC_OVERAGE line item
   - Check for any new member_charges since invoice was issued
   - Update subtotal and total_due
3. If new line items added, send email notification

### Move-In Invoice

Triggered when admin assigns tenant to room (onboarding flow):

1. Calculate prorated rent: (monthly_rent / days_in_month) * remaining_days
2. Create MOVE_IN invoice with ISSUED status
3. Add prorated RENT line item
4. Add DEPOSIT line item if applicable
5. Due immediately

### Move-Out Invoice

Triggered when admin initiates move-out:

1. Create MOVE_OUT invoice
2. Add final rent (prorated if mid-month) as PRE
3. POST items (AC overage, damage, cleaning) added once assessed
4. DEPOSIT_REFUND line item with negative amount
5. Net amount shown as total_due

---

## 6. Payment Flow

### DBS Bank Transfer

1. Tenant views invoice in portal, sees:
   - **DBS Bank** Account No: 885-215114-103
   - **Reference:** HV-TG-PR1-202606-001
2. Tenant transfers funds with invoice code as reference
3. Admin views incoming bank transfers in reconciliation page
4. System scans transfer references and suggests invoice matches
5. Admin reviews and confirms match
6. Invoice status updates: total_paid incremented, status set to PAID or PARTIALLY_PAID

### Stripe (+4% fee)

1. Tenant clicks "Pay with Stripe" on invoice page
2. System creates Stripe checkout session:
   - Amount = (total_due - total_paid) * 1.04
   - 4% processing fee shown as separate line on Stripe checkout
   - Success URL returns to invoice page
3. Stripe webhook fires on payment success
4. Invoice updated: total_paid incremented, status set to PAID
5. stripe_checkout_url cleared

### Late Fees — Daily Cron

1. Daily edge function checks all ISSUED invoices past due_date
2. If >5 days overdue and no LATE_FEE line item: add 5% late fee
3. If >30 days overdue and only one LATE_FEE: add additional 5% late fee
4. Update total_due, send overdue email notification

---

## 7. Tenant Portal

### Enhanced Billing Page (`/portal/billing`)

**Invoice list view:**
- All invoices sorted newest first
- Each row: invoice code, billing period, total due, status badge, due date
- Status badges: ISSUED (yellow), PARTIALLY_PAID (orange), PAID (green), VOID (grey)
- Click row to expand or navigate to detail

**Invoice detail view (`/portal/billing/:invoiceId`):**
- Hyve branded header with logo
- Invoice code (prominent)
- Tenant name, room, property
- Billing period
- Line items table:
  - Category | Description | Amount
  - Grouped by PRE and POST sections
  - Subtotal row
- Payment information box:
  - DBS Bank Account: 885-215114-103
  - Reference: {invoice_code}
  - "Or pay online with Stripe (+4% processing fee)"
- "Pay with Stripe" button (if unpaid/partially paid)
- "Print Invoice" button (HTML print stylesheet, clean layout)
- Payment history section (if any payments received)
- Status badge

### Cardless DBS Deposit Instructions

Shown on invoice detail page as expandable section "Don't have an ATM card?":

1. Touch screen, select Cash Deposit
2. Select Account Type
3. Enter Account Number 885-215114-103 and Confirm
4. Verify and select Next
5. Enter NRIC/Passport Number and Confirm
6. Enter Mobile Number and Confirm
7. Place cash into slot, select Next
8. Verify amount, select Confirm
9. Collect Receipt

---

## 8. Admin Portal

### Invoice Management (new section in admin)

**Invoice list:**
- Filters: property, month, status
- Search by invoice code or tenant name
- Bulk actions: void selected, regenerate selected

**Invoice detail (admin view):**
- All tenant-facing info plus:
- "Mark as Paid" button with payment date, amount, reference fields
- "Add Line Item" button for manual charges
- "Void Invoice" button
- "Regenerate" button (recalculates from source data)
- Payment history with admin who confirmed each payment

**Bank Transfer Matching:**
- List of incoming bank transfers (from Aspire API)
- Each transfer shows: date, amount, reference text
- System parses reference for invoice code patterns
- Suggested match shown with confidence indicator
- Admin clicks to confirm or manually assign to different invoice
- Never auto-confirms

---

## 9. Email Notifications

Using existing `notify-tenant` edge function pattern:

| Event | Subject | Timing |
|-------|---------|--------|
| Invoice issued | "Your Hyve invoice {code} for ${amount} is ready" | Last day of month |
| Post items added | "Your invoice {code} has been updated — new total: ${amount}" | 5th of month |
| Payment received | "Payment received — invoice {code} is now PAID" | On payment confirmation |
| Overdue reminder | "Invoice {code} is overdue — late fee applied" | Daily check, >5 days |
| Move-in invoice | "Welcome to Hyve — your move-in invoice {code}" | At onboarding |
| Move-out invoice | "Your final invoice {code} from Hyve" | At move-out |

---

## 10. No More Cash

- Cash payments are no longer accepted
- All invoices display DBS transfer and Stripe as the only payment options
- Cardless ATM deposit instructions provided for tenants without bank cards
- This change improves tracking and eliminates manual cash reconciliation

---

## 11. New Files

```
src/
├── pages/portal/
│   ├── InvoiceDetailPage.jsx          # Tenant invoice view + print + pay
│   └── AdminInvoicesPage.jsx          # Admin invoice management + matching
├── components/portal/
│   ├── InvoiceDocument.jsx            # Branded HTML invoice layout (print-ready)
│   ├── InvoiceLineItems.jsx           # Line items table component
│   └── BankMatchSuggestion.jsx        # Admin transfer matching UI
├── hooks/
│   ├── useInvoices.js                 # Tenant invoice queries
│   └── useAdminInvoices.js            # Admin invoice + matching queries
supabase/functions/
├── generate-invoices/index.ts         # Monthly invoice generation (pre + post phases)
├── check-late-fees/index.ts           # Daily late fee check
api/portal/
├── invoice-checkout.js                # Stripe checkout session for invoice payment
```

No changes to existing tables. Invoices reference rent_payments, ac_monthly_usage, and member_charges via source_id + source_table on line items.

---

## 12. Cost

| Item | Cost |
|------|------|
| Supabase tables + edge functions | Free (same project) |
| Stripe fees | 4% passed to tenant |
| Email sending | Via existing notify-tenant function |
| **Total** | **$0/month** |
