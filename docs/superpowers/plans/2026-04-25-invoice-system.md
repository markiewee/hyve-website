# Invoice System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a consolidated monthly invoice system where each tenant receives one invoice per month covering rent, AC overage, and member charges — viewable, printable, and payable via DBS transfer or Stripe in the tenant portal.

**Architecture:** New `invoices` + `invoice_line_items` tables reference existing billing tables via source_id/source_table. Supabase edge functions handle auto-generation (pre/post consumption phases) and late fee checks. Tenant portal gets an invoice detail page with Stripe checkout. Admin portal gets invoice management with bank transfer matching.

**Tech Stack:** React (Vite), Supabase (PostgreSQL + Edge Functions + RLS), Stripe Checkout, Vercel serverless API routes.

**Spec:** `docs/superpowers/specs/2026-04-25-invoice-system-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260425000000_invoices.sql` | invoices + invoice_line_items tables, RLS policies |
| `supabase/functions/generate-invoices/index.ts` | Monthly invoice generation (pre + post phases) |
| `supabase/functions/check-late-fees/index.ts` | Daily late fee check and application |
| `api/portal/invoice-checkout.js` | Stripe checkout session for invoice payment |
| `src/hooks/useInvoices.js` | Tenant invoice queries |
| `src/hooks/useAdminInvoices.js` | Admin invoice + matching queries |
| `src/components/portal/InvoiceDocument.jsx` | Branded HTML invoice layout (print-ready) |
| `src/components/portal/InvoiceLineItems.jsx` | Line items table component |
| `src/components/portal/BankMatchSuggestion.jsx` | Admin transfer matching UI |
| `src/pages/portal/InvoiceDetailPage.jsx` | Tenant invoice view + print + pay |
| `src/pages/portal/AdminInvoicesPage.jsx` | Admin invoice management |

### Modified Files
| File | Change |
|------|--------|
| `api/webhooks/stripe.js` | Add `checkout.session.completed` handler for invoice payments |
| `src/App.jsx` | Add invoice routes |
| `src/pages/portal/BillingPage.jsx` | Add invoices section linking to detail pages |
| `supabase/functions/notify-tenant/index.ts` | Add invoice notification event types |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260425000000_invoices.sql`

- [ ] **Step 1: Write the migration SQL**

Create file `supabase/migrations/20260425000000_invoices.sql`:

```sql
-- Invoices table
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

-- Invoice line items
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

-- Updated_at trigger
CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_invoices_tenant ON invoices(tenant_profile_id);
CREATE INDEX idx_invoices_month ON invoices(month);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_code ON invoices(invoice_code);
CREATE INDEX idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);

-- RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Tenants read own invoices (non-DRAFT only)
CREATE POLICY "Tenants read own invoices" ON invoices FOR SELECT
  USING (
    tenant_profile_id IN (
      SELECT id FROM tenant_profiles WHERE user_id = auth.uid()
    ) AND status != 'DRAFT'
  );

-- Admin full access invoices
CREATE POLICY "Admin full access invoices" ON invoices FOR ALL
  USING (get_user_role(auth.uid()) = 'ADMIN');

-- Tenants read own line items (via parent invoice)
CREATE POLICY "Tenants read own line items" ON invoice_line_items FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE tenant_profile_id IN (
        SELECT id FROM tenant_profiles WHERE user_id = auth.uid()
      ) AND status != 'DRAFT'
    )
  );

-- Admin full access line items
CREATE POLICY "Admin full access line items" ON invoice_line_items FOR ALL
  USING (get_user_role(auth.uid()) = 'ADMIN');
```

- [ ] **Step 2: Apply the migration**

Run:
```bash
cd /Users/mark/Desktop/lazybee-website
npx supabase db push
```

Or apply via Supabase MCP:
```
mcp__supabase__apply_migration with the SQL above
```

- [ ] **Step 3: Verify tables exist**

Run SQL query:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('invoices', 'invoice_line_items')
ORDER BY table_name;
```

Expected: both tables listed.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260425000000_invoices.sql
git commit -m "feat: add invoices and invoice_line_items tables with RLS"
```

---

## Task 2: Invoice Code Generator Utility

**Files:**
- Create: `src/lib/invoiceCode.js`

- [ ] **Step 1: Create the utility**

Create file `src/lib/invoiceCode.js`:

```javascript
/**
 * Generate a unique invoice code.
 * Format: HV-{PROPERTY_CODE}-{ROOM_CODE}-{YYYYMM}-{SUFFIX}
 *
 * @param {string} propertyCode - e.g. "TG", "CP", "IH"
 * @param {string} roomUnitCode - e.g. "TG-PR1" -> extracts "PR1"
 * @param {string} month - "YYYY-MM-DD" format (first of month)
 * @param {string} type - "MONTHLY", "MOVE_IN", or "MOVE_OUT"
 * @param {number} seq - sequence number for monthly invoices (default 1)
 * @returns {string} invoice code
 */
export function generateInvoiceCode(propertyCode, roomUnitCode, month, type, seq = 1) {
  // Extract room suffix from unit_code (e.g. "TG-PR1" -> "PR1")
  const roomSuffix = roomUnitCode.includes("-")
    ? roomUnitCode.split("-").slice(1).join("-")
    : roomUnitCode;

  // Format month as YYYYMM
  const yyyymm = month.substring(0, 7).replace("-", "");

  // Suffix based on type
  let suffix;
  if (type === "MOVE_IN") {
    suffix = "MI";
  } else if (type === "MOVE_OUT") {
    suffix = "MO";
  } else {
    suffix = String(seq).padStart(3, "0");
  }

  return `HV-${propertyCode}-${roomSuffix}-${yyyymm}-${suffix}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/invoiceCode.js
git commit -m "feat: add invoice code generator utility"
```

---

## Task 3: useInvoices Hook (Tenant)

**Files:**
- Create: `src/hooks/useInvoices.js`

- [ ] **Step 1: Create the hook**

Create file `src/hooks/useInvoices.js`:

```javascript
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export function useInvoices(tenantProfileId) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = useCallback(async () => {
    if (!tenantProfileId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("invoices")
      .select("*, invoice_line_items(*)")
      .eq("tenant_profile_id", tenantProfileId)
      .neq("status", "DRAFT")
      .order("month", { ascending: false });

    if (error) console.error("Error fetching invoices:", error);
    setInvoices(data ?? []);
    setLoading(false);
  }, [tenantProfileId]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  return { invoices, loading, refetch: fetchInvoices };
}

export function useInvoiceDetail(invoiceId) {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!invoiceId) {
      setLoading(false);
      return;
    }
    supabase
      .from("invoices")
      .select("*, invoice_line_items(*), tenant_profiles(username, rooms(unit_code, room_type), properties(name, code))")
      .eq("id", invoiceId)
      .single()
      .then(({ data, error }) => {
        if (error) console.error("Error fetching invoice:", error);
        setInvoice(data);
        setLoading(false);
      });
  }, [invoiceId]);

  return { invoice, loading };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useInvoices.js
git commit -m "feat: add useInvoices and useInvoiceDetail hooks"
```

---

## Task 4: InvoiceLineItems Component

**Files:**
- Create: `src/components/portal/InvoiceLineItems.jsx`

- [ ] **Step 1: Create the component**

Create file `src/components/portal/InvoiceLineItems.jsx`:

```jsx
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
          <h4 className="font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
            Monthly Charges
          </h4>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#bbcac6]/20">
                <th className="text-left py-2 font-['Manrope'] text-sm text-[#6c7a77] font-semibold">Item</th>
                <th className="text-left py-2 font-['Manrope'] text-sm text-[#6c7a77] font-semibold">Description</th>
                <th className="text-right py-2 font-['Manrope'] text-sm text-[#6c7a77] font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {preItems.map((li) => (
                <tr key={li.id} className="border-b border-[#bbcac6]/10">
                  <td className="py-2 font-['Manrope'] text-sm text-[#121c2a]">
                    {CATEGORY_LABELS[li.category] ?? li.category}
                  </td>
                  <td className="py-2 font-['Manrope'] text-sm text-[#6c7a77]">{li.description}</td>
                  <td className="py-2 font-['Manrope'] text-sm text-[#121c2a] text-right">{formatSGD(li.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {postItems.length > 0 && (
        <div>
          <h4 className="font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
            Usage Charges
          </h4>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#bbcac6]/20">
                <th className="text-left py-2 font-['Manrope'] text-sm text-[#6c7a77] font-semibold">Item</th>
                <th className="text-left py-2 font-['Manrope'] text-sm text-[#6c7a77] font-semibold">Description</th>
                <th className="text-right py-2 font-['Manrope'] text-sm text-[#6c7a77] font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {postItems.map((li) => (
                <tr key={li.id} className="border-b border-[#bbcac6]/10">
                  <td className="py-2 font-['Manrope'] text-sm text-[#121c2a]">
                    {CATEGORY_LABELS[li.category] ?? li.category}
                  </td>
                  <td className="py-2 font-['Manrope'] text-sm text-[#6c7a77]">{li.description}</td>
                  <td className="py-2 font-['Manrope'] text-sm text-[#121c2a] text-right">{formatSGD(li.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-[#121c2a]">
        <span className="font-['Plus_Jakarta_Sans'] font-extrabold text-lg text-[#121c2a]">
          Total: {formatSGD(total)}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/portal/InvoiceLineItems.jsx
git commit -m "feat: add InvoiceLineItems component"
```

---

## Task 5: InvoiceDocument Component (Print-Ready)

**Files:**
- Create: `src/components/portal/InvoiceDocument.jsx`

- [ ] **Step 1: Create the branded invoice layout**

Create file `src/components/portal/InvoiceDocument.jsx`:

```jsx
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
          <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#006b5f]">LAZYBEE</h1>
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/portal/InvoiceDocument.jsx
git commit -m "feat: add InvoiceDocument printable component"
```

---

## Task 6: InvoiceDetailPage (Tenant)

**Files:**
- Create: `src/pages/portal/InvoiceDetailPage.jsx`

- [ ] **Step 1: Create the page**

Create file `src/pages/portal/InvoiceDetailPage.jsx`:

```jsx
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
      const res = await fetch("/api/portal/invoice-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoice.id }),
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#006b5f]" />
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
            className="font-['Manrope'] text-sm text-[#006b5f] hover:underline flex items-center gap-1"
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
                className="px-4 py-2 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
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
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/portal/InvoiceDetailPage.jsx
git commit -m "feat: add InvoiceDetailPage for tenant invoice view"
```

---

## Task 7: Invoice Checkout API Route

**Files:**
- Create: `api/portal/invoice-checkout.js`

- [ ] **Step 1: Create the API route**

Create file `api/portal/invoice-checkout.js`:

```javascript
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { invoice_id } = req.body;
  if (!invoice_id) {
    return res.status(400).json({ error: "invoice_id is required" });
  }

  // Fetch invoice
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, tenant_profiles(username, stripe_customer_id)")
    .eq("id", invoice_id)
    .single();

  if (error || !invoice) {
    return res.status(404).json({ error: "Invoice not found" });
  }

  if (invoice.status === "PAID" || invoice.status === "VOID") {
    return res.status(400).json({ error: "Invoice is already paid or voided" });
  }

  const outstanding = Number(invoice.total_due) - Number(invoice.total_paid);
  if (outstanding <= 0) {
    return res.status(400).json({ error: "No outstanding amount" });
  }

  // Add 4% processing fee
  const totalCents = Math.round(outstanding * 1.04 * 100);

  const sessionParams = {
    mode: "payment",
    currency: "sgd",
    line_items: [
      {
        price_data: {
          currency: "sgd",
          product_data: {
            name: `Invoice ${invoice.invoice_code} + 4% processing fee`,
          },
          unit_amount: totalCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoice_id: invoice.id,
      invoice_code: invoice.invoice_code,
      type: "invoice",
    },
    success_url: `https://lazybee.sg/portal/billing/${invoice.id}?paid=true`,
    cancel_url: `https://lazybee.sg/portal/billing/${invoice.id}`,
  };

  // Attach Stripe customer if exists
  if (invoice.tenant_profiles?.stripe_customer_id) {
    sessionParams.customer = invoice.tenant_profiles.stripe_customer_id;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  // Store session URL on invoice
  await supabase
    .from("invoices")
    .update({ stripe_checkout_url: session.url, updated_at: new Date().toISOString() })
    .eq("id", invoice.id);

  return res.status(200).json({ url: session.url });
}
```

- [ ] **Step 2: Commit**

```bash
git add api/portal/invoice-checkout.js
git commit -m "feat: add invoice Stripe checkout API route"
```

---

## Task 8: Update Stripe Webhook for Invoice Payments

**Files:**
- Modify: `api/webhooks/stripe.js`

- [ ] **Step 1: Add invoice payment handler**

In `api/webhooks/stripe.js`, add the following case inside the event handler, after the existing `checkout.session.completed` block:

```javascript
  // After existing checkout.session.completed handler for onboarding deposits:

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // Handle invoice payments
    if (session.metadata?.type === "invoice") {
      const invoiceId = session.metadata.invoice_id;
      const amountPaid = session.amount_total / 100 / 1.04; // Remove 4% fee to get base amount

      const { data: inv } = await supabase
        .from("invoices")
        .select("total_due, total_paid")
        .eq("id", invoiceId)
        .single();

      if (inv) {
        const newTotalPaid = Number(inv.total_paid) + amountPaid;
        const fullyPaid = newTotalPaid >= Number(inv.total_due);

        await supabase
          .from("invoices")
          .update({
            total_paid: Math.round(newTotalPaid * 100) / 100,
            status: fullyPaid ? "PAID" : "PARTIALLY_PAID",
            paid_at: fullyPaid ? new Date().toISOString() : null,
            stripe_checkout_url: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoiceId);
      }
    }

    // Existing onboarding deposit handler...
    if (session.metadata?.type !== "invoice") {
      await supabase
        .from("onboarding_progress")
        .update({
          deposit_completed_at: new Date().toISOString(),
          deposit_verified: true,
          deposit_method: "STRIPE",
          current_step: "HOUSE_RULES",
        })
        .eq("deposit_stripe_session_id", session.id);
    }
  }
```

Note: The existing `checkout.session.completed` handler must be refactored to check `session.metadata.type` so invoice payments and deposit payments don't conflict. Wrap the existing onboarding update in a `type !== "invoice"` check.

- [ ] **Step 2: Commit**

```bash
git add api/webhooks/stripe.js
git commit -m "feat: handle invoice payments in Stripe webhook"
```

---

## Task 9: Add Invoice Routes to App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add import**

At the top of `src/App.jsx`, add with the other lazy imports or direct imports:

```javascript
import InvoiceDetailPage from "./pages/portal/InvoiceDetailPage";
import AdminInvoicesPage from "./pages/portal/AdminInvoicesPage";
```

- [ ] **Step 2: Add routes**

Inside the portal routes section, add:

```jsx
<Route path="/portal/billing/:invoiceId" element={<AuthGuard><InvoiceDetailPage /></AuthGuard>} />
<Route path="/portal/admin/invoices" element={<AuthGuard><AdminInvoicesPage /></AuthGuard>} />
```

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add invoice portal routes"
```

---

## Task 10: Update BillingPage to Show Invoices

**Files:**
- Modify: `src/pages/portal/BillingPage.jsx`

- [ ] **Step 1: Add invoice section**

At the top of `BillingPage.jsx`, add the import:

```javascript
import { useInvoices } from "../../hooks/useInvoices";
import { useNavigate } from "react-router-dom";
```

Inside the component, add:

```javascript
const navigate = useNavigate();
const { invoices: invoiceList, loading: invoicesLoading } = useInvoices(profileId);
```

Add a new section at the top of the return JSX, before the rent payments section:

```jsx
{/* Invoices Section */}
<div className="mb-8">
  <h2 className="font-['Plus_Jakarta_Sans'] text-xl font-extrabold text-[#121c2a] mb-4 flex items-center gap-2">
    <span className="material-symbols-outlined text-[#006b5f]">receipt_long</span>
    Invoices
  </h2>
  {invoicesLoading ? (
    <div className="flex justify-center py-8">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#006b5f]" />
    </div>
  ) : invoiceList.length === 0 ? (
    <p className="text-[#6c7a77] font-['Manrope'] text-sm">No invoices yet.</p>
  ) : (
    <div className="space-y-3">
      {invoiceList.map((inv) => {
        const statusColor = {
          ISSUED: "bg-yellow-100 text-yellow-800",
          PARTIALLY_PAID: "bg-orange-100 text-orange-800",
          PAID: "bg-green-100 text-green-800",
          VOID: "bg-gray-100 text-gray-500",
        }[inv.status] ?? "bg-gray-100";

        return (
          <div
            key={inv.id}
            onClick={() => navigate(`/portal/billing/${inv.id}`)}
            className="bg-white rounded-xl border border-[#bbcac6]/15 p-4 flex justify-between items-center cursor-pointer hover:shadow-md transition-all"
          >
            <div>
              <p className="font-['Manrope'] font-bold text-sm text-[#121c2a]">{inv.invoice_code}</p>
              <p className="font-['Manrope'] text-xs text-[#6c7a77]">
                Due {new Date(inv.due_date).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-['Manrope'] font-bold text-sm text-[#121c2a]">
                ${Number(inv.total_due).toFixed(2)}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColor}`}>
                {inv.status}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  )}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/portal/BillingPage.jsx
git commit -m "feat: add invoices section to tenant BillingPage"
```

---

## Task 11: useAdminInvoices Hook

**Files:**
- Create: `src/hooks/useAdminInvoices.js`

- [ ] **Step 1: Create the hook**

Create file `src/hooks/useAdminInvoices.js`:

```javascript
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export function useAdminInvoices({ propertyId, month, status } = {}) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("invoices")
      .select("*, invoice_line_items(*), tenant_profiles(username, rooms(unit_code), properties(name, code))")
      .order("created_at", { ascending: false });

    if (propertyId) query = query.eq("property_id", propertyId);
    if (month) query = query.eq("month", `${month}-01`);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) console.error("Error fetching admin invoices:", error);
    setInvoices(data ?? []);
    setLoading(false);
  }, [propertyId, month, status]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  async function markAsPaid(invoiceId, paymentAmount, paymentRef) {
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (!invoice) return;

    const newTotalPaid = Number(invoice.total_paid) + Number(paymentAmount);
    const fullyPaid = newTotalPaid >= Number(invoice.total_due);

    const { error } = await supabase
      .from("invoices")
      .update({
        total_paid: Math.round(newTotalPaid * 100) / 100,
        status: fullyPaid ? "PAID" : "PARTIALLY_PAID",
        paid_at: fullyPaid ? new Date().toISOString() : null,
        notes: paymentRef ? `Bank ref: ${paymentRef}` : invoice.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    if (error) console.error("Error marking paid:", error);
    await fetchInvoices();
    return !error;
  }

  async function voidInvoice(invoiceId) {
    const { error } = await supabase
      .from("invoices")
      .update({ status: "VOID", updated_at: new Date().toISOString() })
      .eq("id", invoiceId);

    if (error) console.error("Error voiding invoice:", error);
    await fetchInvoices();
    return !error;
  }

  return { invoices, loading, refetch: fetchInvoices, markAsPaid, voidInvoice };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useAdminInvoices.js
git commit -m "feat: add useAdminInvoices hook with markAsPaid and voidInvoice"
```

---

## Task 12: AdminInvoicesPage

**Files:**
- Create: `src/pages/portal/AdminInvoicesPage.jsx`

- [ ] **Step 1: Create the admin page**

Create file `src/pages/portal/AdminInvoicesPage.jsx`:

```jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import { useAdminInvoices } from "../../hooks/useAdminInvoices";

function formatSGD(amount) {
  if (amount == null) return "$0.00";
  return `$${Number(amount).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getMonthStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const STATUS_STYLES = {
  DRAFT: "bg-gray-100 text-gray-600",
  ISSUED: "bg-yellow-100 text-yellow-800",
  PARTIALLY_PAID: "bg-orange-100 text-orange-800",
  PAID: "bg-green-100 text-green-800",
  VOID: "bg-gray-100 text-gray-500",
};

export default function AdminInvoicesPage() {
  const [properties, setProperties] = useState([]);
  const [filterProperty, setFilterProperty] = useState("");
  const [filterMonth, setFilterMonth] = useState(getMonthStr(new Date()));
  const [filterStatus, setFilterStatus] = useState("");
  const [searchCode, setSearchCode] = useState("");

  // Mark as paid modal
  const [payModal, setPayModal] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payProcessing, setPayProcessing] = useState(false);

  const { invoices, loading, refetch, markAsPaid, voidInvoice } = useAdminInvoices({
    propertyId: filterProperty || undefined,
    month: filterMonth || undefined,
    status: filterStatus || undefined,
  });

  useEffect(() => {
    supabase
      .from("properties")
      .select("id, name, code")
      .order("name")
      .then(({ data }) => setProperties(data ?? []));
  }, []);

  const filtered = searchCode
    ? invoices.filter((inv) => inv.invoice_code.toLowerCase().includes(searchCode.toLowerCase()))
    : invoices;

  async function handleMarkPaid() {
    if (!payModal || !payAmount) return;
    setPayProcessing(true);
    await markAsPaid(payModal.id, Number(payAmount), payRef);
    setPayModal(null);
    setPayAmount("");
    setPayRef("");
    setPayProcessing(false);
  }

  async function handleVoid(inv) {
    if (!window.confirm(`Void invoice ${inv.invoice_code}?`)) return;
    await voidInvoice(inv.id);
  }

  return (
    <PortalLayout>
      <div className="mb-6">
        <h2 className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-[#121c2a] tracking-tight mb-1">
          Invoice Management
        </h2>
        <p className="text-[#6c7a77] font-['Manrope'] font-medium">
          View, manage, and reconcile tenant invoices.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-1">Property</label>
            <select
              value={filterProperty}
              onChange={(e) => setFilterProperty(e.target.value)}
              className="bg-[#eff4ff] border-0 rounded-xl px-3 py-2 font-['Manrope'] text-sm text-[#121c2a]"
            >
              <option value="">All</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-1">Month</label>
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="bg-[#eff4ff] border-0 rounded-xl px-3 py-2 font-['Manrope'] text-sm text-[#121c2a]"
            />
          </div>
          <div>
            <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[#eff4ff] border-0 rounded-xl px-3 py-2 font-['Manrope'] text-sm text-[#121c2a]"
            >
              <option value="">All</option>
              <option value="ISSUED">Issued</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid</option>
              <option value="VOID">Void</option>
            </select>
          </div>
          <div>
            <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-1">Search Code</label>
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              placeholder="HV-TG-..."
              className="bg-[#eff4ff] border-0 rounded-xl px-3 py-2 font-['Manrope'] text-sm text-[#121c2a]"
            />
          </div>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#006b5f]" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-12 text-[#6c7a77] font-['Manrope']">No invoices found.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#bbcac6]/20 bg-[#f8f9ff]">
                <th className="text-left px-4 py-3 font-['Manrope'] text-xs text-[#6c7a77] font-semibold">Code</th>
                <th className="text-left px-4 py-3 font-['Manrope'] text-xs text-[#6c7a77] font-semibold">Tenant</th>
                <th className="text-left px-4 py-3 font-['Manrope'] text-xs text-[#6c7a77] font-semibold">Room</th>
                <th className="text-right px-4 py-3 font-['Manrope'] text-xs text-[#6c7a77] font-semibold">Due</th>
                <th className="text-right px-4 py-3 font-['Manrope'] text-xs text-[#6c7a77] font-semibold">Paid</th>
                <th className="text-center px-4 py-3 font-['Manrope'] text-xs text-[#6c7a77] font-semibold">Status</th>
                <th className="text-center px-4 py-3 font-['Manrope'] text-xs text-[#6c7a77] font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#bbcac6]/10">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-[#f8f9ff] transition-colors">
                  <td className="px-4 py-3 font-['Manrope'] text-sm font-bold text-[#121c2a]">{inv.invoice_code}</td>
                  <td className="px-4 py-3 font-['Manrope'] text-sm text-[#6c7a77]">{inv.tenant_profiles?.username ?? "—"}</td>
                  <td className="px-4 py-3 font-['Manrope'] text-sm text-[#6c7a77]">{inv.tenant_profiles?.rooms?.unit_code ?? "—"}</td>
                  <td className="px-4 py-3 font-['Manrope'] text-sm text-[#121c2a] text-right">{formatSGD(inv.total_due)}</td>
                  <td className="px-4 py-3 font-['Manrope'] text-sm text-green-700 text-right">{formatSGD(inv.total_paid)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLES[inv.status]}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      {inv.status !== "PAID" && inv.status !== "VOID" && (
                        <button
                          onClick={() => {
                            setPayModal(inv);
                            setPayAmount(String(Number(inv.total_due) - Number(inv.total_paid)));
                          }}
                          className="text-[#006b5f] hover:underline font-['Manrope'] text-xs font-bold"
                        >
                          Mark Paid
                        </button>
                      )}
                      {inv.status !== "PAID" && inv.status !== "VOID" && (
                        <button
                          onClick={() => handleVoid(inv)}
                          className="text-[#ba1a1a] hover:underline font-['Manrope'] text-xs font-bold"
                        >
                          Void
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Mark as Paid Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#121c2a] mb-4">
              Mark as Paid — {payModal.invoice_code}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-[#eff4ff] border-0 rounded-xl px-3 py-2 font-['Manrope'] text-sm"
                />
              </div>
              <div>
                <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-1">Bank Reference</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="Transfer reference..."
                  className="w-full bg-[#eff4ff] border-0 rounded-xl px-3 py-2 font-['Manrope'] text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setPayModal(null)}
                className="px-4 py-2 font-['Manrope'] text-sm text-[#6c7a77] hover:text-[#121c2a]"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkPaid}
                disabled={payProcessing || !payAmount}
                className="px-4 py-2 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:opacity-90 disabled:opacity-50"
              >
                {payProcessing ? "Processing..." : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/portal/AdminInvoicesPage.jsx
git commit -m "feat: add AdminInvoicesPage with filters and mark-as-paid"
```

---

## Task 13: Generate Invoices Edge Function

**Files:**
- Create: `supabase/functions/generate-invoices/index.ts`

- [ ] **Step 1: Create the edge function**

Create file `supabase/functions/generate-invoices/index.ts`:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function generateInvoiceCode(
  propertyCode: string,
  roomUnitCode: string,
  month: string,
  type: string,
  seq = 1
): string {
  const roomSuffix = roomUnitCode.includes("-")
    ? roomUnitCode.split("-").slice(1).join("-")
    : roomUnitCode;
  const yyyymm = month.substring(0, 7).replace("-", "");
  let suffix: string;
  if (type === "MOVE_IN") suffix = "MI";
  else if (type === "MOVE_OUT") suffix = "MO";
  else suffix = String(seq).padStart(3, "0");
  return `HV-${propertyCode}-${roomSuffix}-${yyyymm}-${suffix}`;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const phase = body.phase ?? "pre"; // "pre" or "post"

    const now = new Date();
    let targetMonth: string;

    if (phase === "pre") {
      // Pre-consumption: generate for NEXT month, run on last day of current month
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      targetMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
    } else {
      // Post-consumption: update CURRENT month invoices, run on 5th
      targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    }

    const results: string[] = [];

    if (phase === "pre") {
      // Fetch active tenants with rent
      const { data: tenants } = await supabase
        .from("tenant_profiles")
        .select("id, monthly_rent, room_id, rooms(unit_code, property_id, properties(name, code))")
        .eq("is_active", true)
        .not("monthly_rent", "is", null)
        .gt("monthly_rent", 0);

      if (!tenants || tenants.length === 0) {
        return new Response(JSON.stringify({ phase, results: ["No active tenants found"] }), { status: 200 });
      }

      for (const tenant of tenants) {
        const room = tenant.rooms;
        if (!room) continue;
        const property = room.properties;
        if (!property) continue;

        // Check if invoice already exists
        const { data: existing } = await supabase
          .from("invoices")
          .select("id")
          .eq("tenant_profile_id", tenant.id)
          .eq("month", targetMonth)
          .eq("type", "MONTHLY")
          .limit(1);

        if (existing && existing.length > 0) {
          results.push(`${room.unit_code}: skipped (exists)`);
          continue;
        }

        const invoiceCode = generateInvoiceCode(property.code, room.unit_code, targetMonth, "MONTHLY");

        // Create invoice
        const { data: invoice, error: invError } = await supabase
          .from("invoices")
          .insert({
            invoice_code: invoiceCode,
            tenant_profile_id: tenant.id,
            room_id: tenant.room_id,
            property_id: room.property_id,
            month: targetMonth,
            type: "MONTHLY",
            status: "ISSUED",
            subtotal: Number(tenant.monthly_rent),
            total_due: Number(tenant.monthly_rent),
            total_paid: 0,
            issued_at: new Date().toISOString(),
            due_date: targetMonth,
          })
          .select("id")
          .single();

        if (invError) {
          results.push(`${room.unit_code}: ERROR - ${invError.message}`);
          continue;
        }

        // Add rent line item
        await supabase.from("invoice_line_items").insert({
          invoice_id: invoice.id,
          category: "RENT",
          description: `Rent — ${new Date(targetMonth).toLocaleDateString("en-SG", { month: "long", year: "numeric" })}`,
          amount: Number(tenant.monthly_rent),
          billing_type: "PRE",
        });

        results.push(`${room.unit_code}: ${invoiceCode} created ($${tenant.monthly_rent})`);
      }
    } else {
      // POST phase: append AC overage + pending member charges
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, tenant_profile_id, room_id, subtotal, total_due, invoice_code")
        .eq("month", targetMonth)
        .in("status", ["ISSUED", "PARTIALLY_PAID"]);

      if (!invoices || invoices.length === 0) {
        return new Response(JSON.stringify({ phase, results: ["No open invoices for this month"] }), { status: 200 });
      }

      for (const inv of invoices) {
        let addedAmount = 0;

        // Check AC overage
        const { data: acUsage } = await supabase
          .from("ac_monthly_usage")
          .select("overage_hours, id")
          .eq("room_id", inv.room_id)
          .eq("month", targetMonth)
          .single();

        if (acUsage && Number(acUsage.overage_hours) > 0) {
          // Check if already added
          const { data: existingAC } = await supabase
            .from("invoice_line_items")
            .select("id")
            .eq("invoice_id", inv.id)
            .eq("category", "AC_OVERAGE")
            .limit(1);

          if (!existingAC || existingAC.length === 0) {
            const acAmount = Number(acUsage.overage_hours) * 0.30;
            await supabase.from("invoice_line_items").insert({
              invoice_id: inv.id,
              category: "AC_OVERAGE",
              description: `AC overage — ${acUsage.overage_hours} hours @ $0.30/hr`,
              amount: Math.round(acAmount * 100) / 100,
              billing_type: "POST",
              source_id: acUsage.id,
              source_table: "ac_monthly_usage",
            });
            addedAmount += acAmount;
          }
        }

        // Check pending member charges not yet on any invoice
        const { data: charges } = await supabase
          .from("member_charges")
          .select("id, description, amount, category")
          .eq("tenant_profile_id", inv.tenant_profile_id)
          .eq("status", "PENDING");

        if (charges) {
          for (const charge of charges) {
            // Check if already added
            const { data: existingCharge } = await supabase
              .from("invoice_line_items")
              .select("id")
              .eq("source_id", charge.id)
              .eq("source_table", "member_charges")
              .limit(1);

            if (!existingCharge || existingCharge.length === 0) {
              const cat = charge.category ?? "OTHER";
              await supabase.from("invoice_line_items").insert({
                invoice_id: inv.id,
                category: cat,
                description: charge.description,
                amount: Number(charge.amount),
                billing_type: "POST",
                source_id: charge.id,
                source_table: "member_charges",
              });
              addedAmount += Number(charge.amount);
            }
          }
        }

        if (addedAmount > 0) {
          const newSubtotal = Number(inv.subtotal) + addedAmount;
          await supabase
            .from("invoices")
            .update({
              subtotal: Math.round(newSubtotal * 100) / 100,
              total_due: Math.round(newSubtotal * 100) / 100,
              updated_at: new Date().toISOString(),
            })
            .eq("id", inv.id);
          results.push(`${inv.invoice_code}: added $${addedAmount.toFixed(2)} in post-consumption charges`);
        } else {
          results.push(`${inv.invoice_code}: no post-consumption charges`);
        }
      }
    }

    return new Response(JSON.stringify({ phase, month: targetMonth, results }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/generate-invoices/index.ts
git commit -m "feat: add generate-invoices edge function (pre + post phases)"
```

---

## Task 14: Check Late Fees Edge Function

**Files:**
- Create: `supabase/functions/check-late-fees/index.ts`

- [ ] **Step 1: Create the edge function**

Create file `supabase/functions/check-late-fees/index.ts`:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (_req) => {
  try {
    const now = new Date();
    const results: string[] = [];

    // Fetch unpaid invoices past due date
    const { data: overdue } = await supabase
      .from("invoices")
      .select("id, invoice_code, total_due, total_paid, due_date, invoice_line_items(category)")
      .in("status", ["ISSUED", "PARTIALLY_PAID"])
      .lt("due_date", now.toISOString().substring(0, 10));

    if (!overdue || overdue.length === 0) {
      return new Response(JSON.stringify({ results: ["No overdue invoices"] }), { status: 200 });
    }

    for (const inv of overdue) {
      const dueDate = new Date(inv.due_date);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const existingLateFees = (inv.invoice_line_items ?? []).filter(
        (li: { category: string }) => li.category === "LATE_FEE"
      ).length;

      const outstanding = Number(inv.total_due) - Number(inv.total_paid);
      let feeToAdd = 0;
      let feeDescription = "";

      if (daysOverdue > 30 && existingLateFees < 2) {
        // Add second 5% late fee
        feeToAdd = Math.round(outstanding * 0.05 * 100) / 100;
        feeDescription = `Late fee (30+ days overdue) — 5% of $${outstanding.toFixed(2)}`;
      } else if (daysOverdue > 5 && existingLateFees < 1) {
        // Add first 5% late fee
        feeToAdd = Math.round(outstanding * 0.05 * 100) / 100;
        feeDescription = `Late fee (5+ days overdue) — 5% of $${outstanding.toFixed(2)}`;
      }

      if (feeToAdd > 0) {
        await supabase.from("invoice_line_items").insert({
          invoice_id: inv.id,
          category: "LATE_FEE",
          description: feeDescription,
          amount: feeToAdd,
          billing_type: "POST",
        });

        const newTotal = Number(inv.total_due) + feeToAdd;
        await supabase
          .from("invoices")
          .update({
            subtotal: newTotal,
            total_due: newTotal,
            updated_at: new Date().toISOString(),
          })
          .eq("id", inv.id);

        results.push(`${inv.invoice_code}: added $${feeToAdd} late fee (${daysOverdue} days overdue)`);
      }
    }

    return new Response(JSON.stringify({ results }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/check-late-fees/index.ts
git commit -m "feat: add check-late-fees edge function"
```

---

## Task 15: Update notify-tenant for Invoice Events

**Files:**
- Modify: `supabase/functions/notify-tenant/index.ts`

- [ ] **Step 1: Add invoice event types**

In the `notify-tenant` edge function, add these event type mappings to the existing switch/map:

```typescript
// Add to the event type handling section:

case "INVOICE_ISSUED":
  subject = `Your Lazybee invoice ${details.invoice_code} for $${details.amount} is ready`;
  html = `<p>Hi ${tenantName},</p>
    <p>Your invoice <strong>${details.invoice_code}</strong> for <strong>$${details.amount}</strong> is ready.</p>
    <p>Due date: ${details.due_date}</p>
    <p><a href="https://lazybee.sg/portal/billing/${details.invoice_id}">View and pay in the portal</a></p>`;
  break;

case "INVOICE_UPDATED":
  subject = `Your invoice ${details.invoice_code} has been updated — new total: $${details.amount}`;
  html = `<p>Hi ${tenantName},</p>
    <p>Your invoice <strong>${details.invoice_code}</strong> has been updated with usage charges.</p>
    <p>New total: <strong>$${details.amount}</strong></p>
    <p><a href="https://lazybee.sg/portal/billing/${details.invoice_id}">View details in the portal</a></p>`;
  break;

case "INVOICE_PAID":
  subject = `Payment received — invoice ${details.invoice_code} is now PAID`;
  html = `<p>Hi ${tenantName},</p>
    <p>We've received your payment of <strong>$${details.amount}</strong>.</p>
    <p>Invoice <strong>${details.invoice_code}</strong> is now fully paid. Thank you!</p>`;
  break;

case "INVOICE_OVERDUE":
  subject = `Invoice ${details.invoice_code} is overdue — late fee applied`;
  html = `<p>Hi ${tenantName},</p>
    <p>Your invoice <strong>${details.invoice_code}</strong> is <strong>${details.days_overdue} days overdue</strong>.</p>
    <p>A late fee of <strong>$${details.late_fee}</strong> has been applied.</p>
    <p>Please settle the outstanding amount as soon as possible.</p>
    <p><a href="https://lazybee.sg/portal/billing/${details.invoice_id}">Pay now in the portal</a></p>`;
  break;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/notify-tenant/index.ts
git commit -m "feat: add invoice email notification event types"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Database migration | `supabase/migrations/20260425000000_invoices.sql` |
| 2 | Invoice code utility | `src/lib/invoiceCode.js` |
| 3 | useInvoices hook (tenant) | `src/hooks/useInvoices.js` |
| 4 | InvoiceLineItems component | `src/components/portal/InvoiceLineItems.jsx` |
| 5 | InvoiceDocument component | `src/components/portal/InvoiceDocument.jsx` |
| 6 | InvoiceDetailPage (tenant) | `src/pages/portal/InvoiceDetailPage.jsx` |
| 7 | Invoice checkout API | `api/portal/invoice-checkout.js` |
| 8 | Stripe webhook update | `api/webhooks/stripe.js` |
| 9 | App.jsx routes | `src/App.jsx` |
| 10 | BillingPage update | `src/pages/portal/BillingPage.jsx` |
| 11 | useAdminInvoices hook | `src/hooks/useAdminInvoices.js` |
| 12 | AdminInvoicesPage | `src/pages/portal/AdminInvoicesPage.jsx` |
| 13 | Generate invoices edge function | `supabase/functions/generate-invoices/index.ts` |
| 14 | Check late fees edge function | `supabase/functions/check-late-fees/index.ts` |
| 15 | Notify-tenant update | `supabase/functions/notify-tenant/index.ts` |
