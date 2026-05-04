# House Captain Claims + Admin Members Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the captain expense reimbursement flow + a new admin Members Dashboard with Roster/Alerts/Captains/Claims modes, plus a reusable House Captain badge surfaced across the portal.

**Architecture:** Single new Supabase table `claims` with TEXT-CHECK enums (matching existing schema convention) and RLS policies that mirror the existing `maintenance_tickets` patterns. New Supabase storage bucket `claims` for receipt + item photos, with per-user folder paths. New React pages and a few reusable components; existing `PortalLayout` + `AuthGuard` infrastructure handles routing and role gates.

**Tech Stack:** React 19, Vite, Tailwind CSS, Radix UI primitives, `@supabase/supabase-js`, React Router 6, `date-fns`, existing `src/components/ui/` library.

**Spec:** `docs/superpowers/specs/2026-05-04-captain-claims-and-members-dashboard-design.md`

**Implementation note:** Spec referred to `captain_id`/`reviewed_by` as FKs to `tenant_profiles(id)`. To match the existing `maintenance_tickets` convention and simplify RLS (`auth.uid() = submitted_by`), the implementation uses `submitted_by`/`reviewed_by` columns referencing `auth.users(id)`. Captain's property_id is denormalised onto the `claims` row at insert time so we don't need to JOIN `tenant_profiles` to filter.

**Supabase MCP tools used:** `mcp__supabase__apply_migration` (for migrations), `mcp__supabase__execute_sql` (for verification). Project ID: `diiilqpfmlxjwiaeophb`.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/20260504000000_claims.sql` | Create | `claims` table, indexes, triggers |
| `supabase/migrations/20260504000001_claims_rls.sql` | Create | RLS policies on `claims` |
| `supabase/migrations/20260504000002_claims_storage.sql` | Create | Storage bucket + bucket policies |
| `src/components/portal/CaptainBadge.jsx` | Create | Reusable captain badge pill |
| `src/hooks/useClaims.js` | Create | Claim CRUD + photo upload |
| `src/hooks/useMembersData.js` | Create | Composite query: tenants × rooms × rent × tickets per property |
| `src/components/portal/ClaimCard.jsx` | Create | Card UI shared by captain list and admin queue |
| `src/components/portal/ClaimForm.jsx` | Create | Form controls + photo upload UI |
| `src/components/portal/MembersRoster.jsx` | Create | Roster mode: 3-column grid |
| `src/components/portal/MembersAlerts.jsx` | Create | Alerts mode: severity-grouped list |
| `src/components/portal/MembersCaptains.jsx` | Create | Captains mode: per-captain summary |
| `src/components/portal/MembersClaimsQueue.jsx` | Create | Claims mode: admin approval queue |
| `src/pages/portal/CaptainClaimsPage.jsx` | Create | Captain's own claims list |
| `src/pages/portal/CaptainClaimFormPage.jsx` | Create | New claim form page |
| `src/pages/portal/AdminMembersPage.jsx` | Create | Members Dashboard shell + mode/property routing |
| `src/pages/portal/PropertyTenantsPage.jsx` | Modify | Refresh layout + captain card |
| `src/components/portal/TicketCard.jsx` | Modify | Show CaptainBadge next to creator if captain |
| `src/components/portal/PortalLayout.jsx` | Modify (lines 21-33, 35-52) | Add Claims nav (captain), Members Dashboard nav (admin) |
| `src/App.jsx` | Modify | Register 3 new routes |
| `src/i18n/en.json` | Modify | Copy strings for new screens |

---

## Task 1: Migration — `claims` table

**Files:**
- Create: `supabase/migrations/20260504000000_claims.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Claims: house captain expense reimbursement requests
CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  property_id UUID NOT NULL REFERENCES properties(id),
  category TEXT NOT NULL CHECK (category IN (
    'PLUMBING', 'ELECTRICAL', 'CLEANING_SUPPLIES',
    'FURNITURE', 'TRANSPORT', 'OTHER'
  )),
  amount_sgd NUMERIC(10,2) NOT NULL CHECK (amount_sgd > 0),
  description TEXT NOT NULL,
  receipt_url TEXT NOT NULL,
  item_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN (
    'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID'
  )),
  admin_comment TEXT,
  payment_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  paid_at TIMESTAMPTZ
);

CREATE INDEX idx_claims_submitted_by ON claims (submitted_by, created_at DESC);
CREATE INDEX idx_claims_property_status ON claims (property_id, status);
CREATE INDEX idx_claims_status_created ON claims (status, created_at DESC);

CREATE TRIGGER trg_claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Apply the migration**

Use `mcp__supabase__apply_migration` with:
- `project_id`: `diiilqpfmlxjwiaeophb`
- `name`: `claims_table`
- `query`: contents of the SQL above

- [ ] **Step 3: Verify the table was created**

Run via `mcp__supabase__execute_sql`:
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'claims' AND table_schema = 'public'
ORDER BY ordinal_position;
```

Expected: 14 columns including `id`, `submitted_by`, `property_id`, `category`, `amount_sgd`, `description`, `receipt_url`, `item_url`, `status`, `admin_comment`, `payment_reference`, `created_at`, `updated_at`, `reviewed_at`, `reviewed_by`, `paid_at`.

- [ ] **Step 4: Verify check constraints**

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.claims'::regclass AND contype = 'c';
```

Expected: 3 CHECK constraints (category enum, amount > 0, status enum).

- [ ] **Step 5: Save the migration to disk and commit**

Save the SQL from Step 1 verbatim to `supabase/migrations/20260504000000_claims.sql`.

```bash
git add supabase/migrations/20260504000000_claims.sql
git commit -m "feat(db): add claims table for captain expense reimbursement"
```

---

## Task 2: Migration — RLS policies on `claims`

**Files:**
- Create: `supabase/migrations/20260504000001_claims_rls.sql`

- [ ] **Step 1: Write the RLS SQL**

```sql
-- Captain can read their own claims
CREATE POLICY "Captains read own claims"
  ON claims FOR SELECT
  USING (
    submitted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tenant_profiles tp
      WHERE tp.user_id = auth.uid()
        AND tp.role = 'HOUSE_CAPTAIN'
        AND tp.is_active = true
    )
  );

-- Captain can insert their own claims (status forced to SUBMITTED)
CREATE POLICY "Captains insert own claims"
  ON claims FOR INSERT
  WITH CHECK (
    submitted_by = auth.uid()
    AND status = 'SUBMITTED'
    AND EXISTS (
      SELECT 1 FROM tenant_profiles tp
      WHERE tp.user_id = auth.uid()
        AND tp.role = 'HOUSE_CAPTAIN'
        AND tp.is_active = true
        AND tp.property_id = claims.property_id
    )
  );

-- Admin can read all claims
CREATE POLICY "Admins read all claims"
  ON claims FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenant_profiles tp
      WHERE tp.user_id = auth.uid()
        AND tp.role IN ('ADMIN', 'SUPER_ADMIN')
        AND tp.is_active = true
    )
  );

-- Admin can update claims (status, comment, payment ref, reviewed/paid timestamps)
CREATE POLICY "Admins update claims"
  ON claims FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tenant_profiles tp
      WHERE tp.user_id = auth.uid()
        AND tp.role IN ('ADMIN', 'SUPER_ADMIN')
        AND tp.is_active = true
    )
  );
```

- [ ] **Step 2: Apply the migration**

Use `mcp__supabase__apply_migration` with:
- `project_id`: `diiilqpfmlxjwiaeophb`
- `name`: `claims_rls_policies`
- `query`: contents of the SQL above

- [ ] **Step 3: Verify policies exist**

Run via `mcp__supabase__execute_sql`:
```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'claims'
ORDER BY policyname;
```

Expected: 4 policies (`Admins read all claims`, `Admins update claims`, `Captains insert own claims`, `Captains read own claims`).

- [ ] **Step 4: Smoke test — captain cannot read another captain's claims**

Setup: Pick two test users with `HOUSE_CAPTAIN` role on different properties. Insert a fake claim as captain A (use service role key). Then via `mcp__supabase__execute_sql` run as captain B's session:
```sql
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "<captain-b-uuid>", "role": "authenticated"}';
SELECT COUNT(*) FROM claims;
```

Expected: 0 rows (cannot see captain A's claim).

If the project does not have two captain test accounts, skip the live smoke test but note in commit message that policy was visually inspected.

- [ ] **Step 5: Save the migration and commit**

Save SQL to `supabase/migrations/20260504000001_claims_rls.sql`.

```bash
git add supabase/migrations/20260504000001_claims_rls.sql
git commit -m "feat(db): add RLS policies for claims table"
```

---

## Task 3: Migration — Storage bucket for claim photos

**Files:**
- Create: `supabase/migrations/20260504000002_claims_storage.sql`

- [ ] **Step 1: Write the storage migration SQL**

```sql
-- Create the claims bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'claims',
  'claims',
  false,
  10 * 1024 * 1024,  -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Captain can upload to {auth.uid()}/* in claims bucket (must be a captain)
CREATE POLICY "Captains upload to own claims folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'claims'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM tenant_profiles tp
      WHERE tp.user_id = auth.uid()
        AND tp.role = 'HOUSE_CAPTAIN'
        AND tp.is_active = true
    )
  );

-- Captain can read their own files
CREATE POLICY "Captains read own claim files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'claims'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admin can read all files in claims bucket
CREATE POLICY "Admins read all claim files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'claims'
    AND EXISTS (
      SELECT 1 FROM tenant_profiles tp
      WHERE tp.user_id = auth.uid()
        AND tp.role IN ('ADMIN', 'SUPER_ADMIN')
        AND tp.is_active = true
    )
  );
```

- [ ] **Step 2: Apply the migration**

Use `mcp__supabase__apply_migration` with:
- `project_id`: `diiilqpfmlxjwiaeophb`
- `name`: `claims_storage_bucket`
- `query`: contents of the SQL above

- [ ] **Step 3: Verify bucket exists**

Run via `mcp__supabase__execute_sql`:
```sql
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id = 'claims';
```

Expected: 1 row, `public = false`, file_size_limit = 10485760, allowed_mime_types contains the four image types.

- [ ] **Step 4: Verify storage policies**

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE '%claim%';
```

Expected: 3 policies.

- [ ] **Step 5: Save the migration and commit**

Save SQL to `supabase/migrations/20260504000002_claims_storage.sql`.

```bash
git add supabase/migrations/20260504000002_claims_storage.sql
git commit -m "feat(db): add claims storage bucket with RLS"
```

---

## Task 4: `CaptainBadge` component

**Files:**
- Create: `src/components/portal/CaptainBadge.jsx`

- [ ] **Step 1: Write the component**

```jsx
import { cn } from "../../lib/utils";

const SIZE_STYLES = {
  sm: "text-[10px] px-1.5 py-0.5 gap-0.5",
  md: "text-xs px-2 py-1 gap-1",
};

export default function CaptainBadge({ size = "md", className }) {
  const label = size === "sm" ? "Captain" : "House Captain";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium bg-blue-100 text-blue-700",
        SIZE_STYLES[size],
        className,
      )}
      aria-label="House Captain"
    >
      <span aria-hidden>🏠</span>
      <span>{label}</span>
    </span>
  );
}
```

- [ ] **Step 2: Manual smoke test**

Start dev server: `cd /Users/mark/Desktop/hyve-website && npm run dev`. Temporarily render `<CaptainBadge />` in `DashboardPage.jsx` or a test page. Confirm the pill renders with `🏠 House Captain` text. Remove the temporary import.

- [ ] **Step 3: Commit**

```bash
git add src/components/portal/CaptainBadge.jsx
git commit -m "feat(portal): add reusable CaptainBadge component"
```

---

## Task 5: `useClaims` hook

**Files:**
- Create: `src/hooks/useClaims.js`

- [ ] **Step 1: Write the hook**

```js
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const CLAIM_COLUMNS = `
  id, submitted_by, property_id, category, amount_sgd, description,
  receipt_url, item_url, status, admin_comment, payment_reference,
  created_at, reviewed_at, reviewed_by, paid_at,
  properties(name)
`;

async function uploadClaimPhoto(file, userId, kind) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const safeExt = ["jpg", "jpeg", "png", "heic", "webp"].includes(ext) ? ext : "jpg";
  const path = `${userId}/${Date.now()}_${kind}.${safeExt}`;

  const { error } = await supabase.storage.from("claims").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

export function useClaims({ scope = "own", filter } = {}) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("claims")
      .select(CLAIM_COLUMNS)
      .order("created_at", { ascending: false });

    if (scope === "own") {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setClaims([]);
        setLoading(false);
        return;
      }
      query = query.eq("submitted_by", user.id);
    }
    if (filter?.status) query = query.eq("status", filter.status);
    if (filter?.propertyId) query = query.eq("property_id", filter.propertyId);
    if (filter?.captainId) query = query.eq("submitted_by", filter.captainId);

    const { data, error: err } = await query;
    if (err) {
      setError(err);
      setLoading(false);
      return;
    }
    setClaims(data ?? []);
    setError(null);
    setLoading(false);
  }, [scope, filter?.status, filter?.propertyId, filter?.captainId]);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  const submitClaim = useCallback(async ({
    propertyId, category, amount, description, receiptFile, itemFile,
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in");

    const receiptPath = await uploadClaimPhoto(receiptFile, user.id, "receipt");
    const itemPath = await uploadClaimPhoto(itemFile, user.id, "item");

    const { data, error: err } = await supabase
      .from("claims")
      .insert({
        submitted_by: user.id,
        property_id: propertyId,
        category,
        amount_sgd: amount,
        description,
        receipt_url: receiptPath,
        item_url: itemPath,
      })
      .select(CLAIM_COLUMNS)
      .single();

    if (err) throw err;
    await fetchClaims();
    return data;
  }, [fetchClaims]);

  const reviewClaim = useCallback(async (claimId, { status, comment }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase
      .from("claims")
      .update({
        status,
        admin_comment: comment ?? null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq("id", claimId);
    if (err) throw err;
    await fetchClaims();
  }, [fetchClaims]);

  const markPaid = useCallback(async (claimId, paymentReference) => {
    const { error: err } = await supabase
      .from("claims")
      .update({
        status: "PAID",
        payment_reference: paymentReference,
        paid_at: new Date().toISOString(),
      })
      .eq("id", claimId);
    if (err) throw err;
    await fetchClaims();
  }, [fetchClaims]);

  const getSignedUrl = useCallback(async (path) => {
    const { data, error: err } = await supabase.storage
      .from("claims")
      .createSignedUrl(path, 60 * 60); // 1 hour
    if (err) throw err;
    return data.signedUrl;
  }, []);

  return { claims, loading, error, submitClaim, reviewClaim, markPaid, getSignedUrl, refetch: fetchClaims };
}
```

- [ ] **Step 2: Manual smoke test**

In a browser console after signing in as a captain, run:
```js
const { data, error } = await supabase.from("claims").select("*").limit(1);
console.log(data, error);
```
Expected: empty array, no error (RLS allows the query but no rows yet).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useClaims.js
git commit -m "feat(portal): add useClaims hook with submit/review/markPaid"
```

---

## Task 6: `ClaimForm` component

**Files:**
- Create: `src/components/portal/ClaimForm.jsx`

- [ ] **Step 1: Write the form**

```jsx
import { useState } from "react";
import { useClaims } from "../../hooks/useClaims";

const CATEGORIES = [
  { value: "PLUMBING", label: "Plumbing" },
  { value: "ELECTRICAL", label: "Electrical" },
  { value: "CLEANING_SUPPLIES", label: "Cleaning supplies" },
  { value: "FURNITURE", label: "Furniture" },
  { value: "TRANSPORT", label: "Transport" },
  { value: "OTHER", label: "Other" },
];

export default function ClaimForm({ propertyId, propertyName, prefill, onSuccess }) {
  const { submitClaim } = useClaims({ scope: "own" });
  const [category, setCategory] = useState(prefill?.category ?? "PLUMBING");
  const [amount, setAmount] = useState(prefill?.amount ?? "");
  const [description, setDescription] = useState(prefill?.description ?? "");
  const [receiptFile, setReceiptFile] = useState(null);
  const [itemFile, setItemFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!receiptFile || !itemFile) {
      setError("Both receipt and item photos are required.");
      return;
    }
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setError("Amount must be a positive number.");
      return;
    }

    setSubmitting(true);
    try {
      const claim = await submitClaim({
        propertyId, category, amount: numAmount, description,
        receiptFile, itemFile,
      });
      onSuccess?.(claim);
    } catch (err) {
      setError(err.message ?? "Failed to submit claim.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Property</label>
        <input
          type="text"
          value={propertyName ?? ""}
          readOnly
          className="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Amount (SGD)</label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">What was this for?</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={500}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="e.g. Replaced kitchen sink trap, was leaking"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Receipt photo</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/heic,image/webp"
          onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Item photo</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/heic,image/webp"
          onChange={(e) => setItemFile(e.target.files?.[0] ?? null)}
          required
        />
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-blue-600 text-white py-2 font-medium disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit claim"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/portal/ClaimForm.jsx
git commit -m "feat(portal): add ClaimForm component"
```

---

## Task 7: `ClaimCard` component (shared)

**Files:**
- Create: `src/components/portal/ClaimCard.jsx`

- [ ] **Step 1: Write the card**

```jsx
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useClaims } from "../../hooks/useClaims";

const STATUS_PILL = {
  SUBMITTED: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-blue-100 text-blue-800",
  PAID: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

const CATEGORY_LABEL = {
  PLUMBING: "Plumbing",
  ELECTRICAL: "Electrical",
  CLEANING_SUPPLIES: "Cleaning supplies",
  FURNITURE: "Furniture",
  TRANSPORT: "Transport",
  OTHER: "Other",
};

function StatusPill({ status }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PILL[status]}`}>
      {status}
    </span>
  );
}

export default function ClaimCard({ claim, mode = "captain", actions }) {
  const { getSignedUrl } = useClaims({ scope: "none" });
  const [thumbUrl, setThumbUrl] = useState(null);
  const [receiptUrl, setReceiptUrl] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getSignedUrl(claim.item_url),
      getSignedUrl(claim.receipt_url),
    ]).then(([item, receipt]) => {
      if (!cancelled) {
        setThumbUrl(item);
        setReceiptUrl(receipt);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [claim.item_url, claim.receipt_url, getSignedUrl]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex gap-3">
        {thumbUrl && (
          <button
            type="button"
            onClick={() => setLightbox(thumbUrl)}
            className="shrink-0"
            aria-label="View item photo"
          >
            <img src={thumbUrl} alt="Item" className="h-20 w-20 rounded object-cover" />
          </button>
        )}
        {mode === "admin" && receiptUrl && (
          <button
            type="button"
            onClick={() => setLightbox(receiptUrl)}
            className="shrink-0"
            aria-label="View receipt photo"
          >
            <img src={receiptUrl} alt="Receipt" className="h-20 w-20 rounded object-cover" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{claim.properties?.name ?? "—"}</span>
            <span className="text-gray-400">·</span>
            <span>{CATEGORY_LABEL[claim.category]}</span>
            <span className="text-gray-400">·</span>
            <span className="font-semibold">S${Number(claim.amount_sgd).toFixed(2)}</span>
            <StatusPill status={claim.status} />
          </div>
          <p className="text-sm text-gray-700 mt-1">{claim.description}</p>
          <div className="text-xs text-gray-500 mt-1">
            Submitted {format(new Date(claim.created_at), "d MMM yyyy")}
          </div>
          {claim.admin_comment && (
            <div className="mt-2 rounded bg-gray-50 p-2 text-xs text-gray-700">
              <span className="font-medium">Admin: </span>{claim.admin_comment}
            </div>
          )}
          {claim.payment_reference && (
            <div className="mt-1 text-xs text-gray-500">
              Paid · {claim.payment_reference}
            </div>
          )}
        </div>
      </div>

      {actions && <div className="mt-3 flex justify-end gap-2">{actions}</div>}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="" className="max-h-full max-w-full" />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/portal/ClaimCard.jsx
git commit -m "feat(portal): add ClaimCard with lightbox photo viewer"
```

---

## Task 8: `CaptainClaimsPage` (captain's own list)

**Files:**
- Create: `src/pages/portal/CaptainClaimsPage.jsx`

- [ ] **Step 1: Write the page**

```jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import PortalLayout from "../../components/portal/PortalLayout";
import ClaimCard from "../../components/portal/ClaimCard";
import { useClaims } from "../../hooks/useClaims";

const FILTERS = [
  { key: "ALL", label: "All", status: null },
  { key: "SUBMITTED", label: "Pending", status: "SUBMITTED" },
  { key: "APPROVED", label: "Approved", status: "APPROVED" },
  { key: "PAID", label: "Paid", status: "PAID" },
  { key: "REJECTED", label: "Rejected", status: "REJECTED" },
];

export default function CaptainClaimsPage() {
  const [filterKey, setFilterKey] = useState("ALL");
  const status = FILTERS.find((f) => f.key === filterKey)?.status;
  const { claims, loading } = useClaims({
    scope: "own",
    filter: status ? { status } : undefined,
  });

  return (
    <PortalLayout>
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">My Claims</h1>
          <Link
            to="/portal/captain/claims/new"
            className="rounded bg-blue-600 text-white px-4 py-2 text-sm font-medium"
          >
            + Submit new claim
          </Link>
        </div>

        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilterKey(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                filterKey === f.key
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : claims.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
            No claims yet. Submit your first one.
          </div>
        ) : (
          <div className="space-y-3">
            {claims.map((claim) => (
              <ClaimCard
                key={claim.id}
                claim={claim}
                mode="captain"
                actions={
                  claim.status === "REJECTED" && (
                    <Link
                      to="/portal/captain/claims/new"
                      state={{ prefill: claim }}
                      className="rounded border border-gray-300 px-3 py-1 text-xs font-medium"
                    >
                      Re-submit
                    </Link>
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/portal/CaptainClaimsPage.jsx
git commit -m "feat(portal): add CaptainClaimsPage"
```

---

## Task 9: `CaptainClaimFormPage`

**Files:**
- Create: `src/pages/portal/CaptainClaimFormPage.jsx`

- [ ] **Step 1: Write the page**

```jsx
import { useNavigate, useLocation } from "react-router-dom";
import PortalLayout from "../../components/portal/PortalLayout";
import ClaimForm from "../../components/portal/ClaimForm";
import { useAuth } from "../../hooks/useAuth";

export default function CaptainClaimFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const propertyId = profile?.property_id ?? profile?.rooms?.property_id;
  const propertyName = profile?.properties?.name ?? "";

  const prefillRaw = location.state?.prefill;
  const prefill = prefillRaw
    ? {
        category: prefillRaw.category,
        amount: prefillRaw.amount_sgd,
        description: prefillRaw.description,
      }
    : undefined;

  if (!propertyId) {
    return (
      <PortalLayout>
        <div className="p-4 text-sm text-red-600">
          No property assigned. Contact admin.
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="max-w-xl mx-auto p-4">
        <h1 className="text-2xl font-semibold mb-4">Submit a claim</h1>
        <ClaimForm
          propertyId={propertyId}
          propertyName={propertyName}
          prefill={prefill}
          onSuccess={() => navigate("/portal/captain/claims")}
        />
      </div>
    </PortalLayout>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/portal/CaptainClaimFormPage.jsx
git commit -m "feat(portal): add CaptainClaimFormPage"
```

---

## Task 10: Wire captain routes + sidebar nav

**Files:**
- Modify: `src/App.jsx` (route imports + Routes block)
- Modify: `src/components/portal/PortalLayout.jsx` (HOUSE_CAPTAIN_NAV)
- Modify: `src/i18n/en.json`

- [ ] **Step 1: Add the routes to `App.jsx`**

Add imports near other portal page imports (around line 56):
```jsx
import CaptainClaimsPage from './pages/portal/CaptainClaimsPage';
import CaptainClaimFormPage from './pages/portal/CaptainClaimFormPage';
```

Inside the existing `<Routes>` block, near the other `/portal/*` routes (before the catch-all), add:
```jsx
<Route
  path="/portal/captain/claims"
  element={
    <AuthGuard requiredRole="HOUSE_CAPTAIN">
      <CaptainClaimsPage />
    </AuthGuard>
  }
/>
<Route
  path="/portal/captain/claims/new"
  element={
    <AuthGuard requiredRole="HOUSE_CAPTAIN">
      <CaptainClaimFormPage />
    </AuthGuard>
  }
/>
```

- [ ] **Step 2: Add nav item in `PortalLayout.jsx`**

In the `HOUSE_CAPTAIN_NAV` array (around line 21–33), insert before the `Settings` entry:
```jsx
{ label: t("nav.claims"), to: "/portal/captain/claims", icon: "request_quote" },
```

Also add the same line to `ADMIN_RESIDENT_NAV` derivation if captains-with-admin should see it (it already inherits from `HOUSE_CAPTAIN_NAV` via the spread, so no extra change needed — verify by reading line 62).

- [ ] **Step 3: Add i18n strings**

In `src/i18n/en.json`, find the `nav` object and add:
```json
"claims": "Claims"
```
(Place it alphabetically or next to `members`.)

- [ ] **Step 4: Smoke test**

Run `npm run dev`. Sign in as a captain (or temporarily flip a tenant's role to `HOUSE_CAPTAIN` via Supabase). Confirm:
- Sidebar shows "Claims" item
- `/portal/captain/claims` loads with empty state
- "Submit new claim" button routes to form
- Form rejects when files missing; submits successfully when filled
- After submit, redirects to list with the new claim visible

Sign in as a regular tenant; confirm `/portal/captain/claims` redirects to `/portal/dashboard`.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/portal/PortalLayout.jsx src/i18n/en.json
git commit -m "feat(portal): wire captain claims routes + sidebar nav"
```

---

## Task 11: `useMembersData` hook

**Files:**
- Create: `src/hooks/useMembersData.js`

- [ ] **Step 1: Write the hook**

This is the composite query that powers Roster, Alerts, and Captains modes. It returns a structure grouped by property.

```js
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useMembersData(propertyFilter = "ALL") {
  const [data, setData] = useState({ properties: [], loading: true });

  const fetchData = useCallback(async () => {
    setData((d) => ({ ...d, loading: true }));

    let propsQuery = supabase
      .from("properties")
      .select(`
        id, name,
        rooms(
          id, name, unit_code,
          tenant_profiles(
            id, user_id, role, moved_in_at, moved_out_at, is_active,
            lease_end_date
          )
        ),
        maintenance_tickets(id, status, created_at)
      `)
      .order("name");

    if (propertyFilter !== "ALL") {
      propsQuery = propsQuery.eq("id", propertyFilter);
    }

    const { data: properties, error } = await propsQuery;
    if (error) {
      console.error("useMembersData error:", error);
      setData({ properties: [], loading: false });
      return;
    }

    const enriched = (properties ?? []).map((p) => {
      const rooms = (p.rooms ?? []).map((r) => {
        const activeTenant = (r.tenant_profiles ?? []).find((tp) => tp.is_active);
        return {
          id: r.id,
          name: r.name,
          unit_code: r.unit_code,
          tenant: activeTenant ?? null,
        };
      }).sort((a, b) => (a.unit_code ?? "").localeCompare(b.unit_code ?? ""));

      const captains = (p.rooms ?? [])
        .flatMap((r) => r.tenant_profiles ?? [])
        .filter((tp) => tp.is_active && tp.role === "HOUSE_CAPTAIN");

      const openTickets = (p.maintenance_tickets ?? [])
        .filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS");

      const occupancy = {
        filled: rooms.filter((r) => r.tenant).length,
        total: rooms.length,
      };

      return {
        id: p.id,
        name: p.name,
        rooms,
        captain: captains[0] ?? null,
        openTickets,
        occupancy,
      };
    });

    setData({ properties: enriched, loading: false });
  }, [propertyFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { ...data, refetch: fetchData };
}
```

**Note:** This assumes `tenant_profiles.lease_end_date` exists. If it does not, the alert "lease ending soon" cannot be computed and that section in `MembersAlerts` should render an empty state. Verify with `mcp__supabase__execute_sql`:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'tenant_profiles' AND column_name = 'lease_end_date';
```
If absent, drop `lease_end_date` from the SELECT and skip lease-ending alerts in Task 13.

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useMembersData.js
git commit -m "feat(portal): add useMembersData composite hook"
```

---

## Task 12: `MembersRoster` component

**Files:**
- Create: `src/components/portal/MembersRoster.jsx`

- [ ] **Step 1: Write the component**

```jsx
import { format } from "date-fns";
import CaptainBadge from "./CaptainBadge";

function RoomRow({ room }) {
  const t = room.tenant;
  return (
    <div className="rounded border border-gray-200 p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">{room.unit_code}</div>
          <div className="font-medium">{room.name}</div>
        </div>
        {!t && <span className="text-xs text-gray-400">Vacant</span>}
      </div>
      {t && (
        <div className="mt-2 text-sm">
          <div className="font-medium">{t.user_id ? "Tenant" : "—"}</div>
          {t.lease_end_date && (
            <div className="text-xs text-gray-500">
              Lease ends {format(new Date(t.lease_end_date), "d MMM yyyy")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MembersRoster({ properties, loading }) {
  if (loading) return <div className="text-sm text-gray-500">Loading…</div>;
  if (properties.length === 0) {
    return <div className="text-sm text-gray-500">No properties match.</div>;
  }

  return (
    <div className={`grid gap-4 ${properties.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-3"}`}>
      {properties.map((p) => (
        <div key={p.id} className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-semibold">{p.name}</h2>
            <span className="text-xs text-gray-500">
              {p.occupancy.filled}/{p.occupancy.total} filled
            </span>
          </div>

          {p.captain && (
            <div className="mb-3 rounded border-2 border-blue-200 bg-blue-50 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Captain</div>
                <CaptainBadge size="sm" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            {p.rooms.map((r) => <RoomRow key={r.id} room={r} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/portal/MembersRoster.jsx
git commit -m "feat(portal): add MembersRoster grid component"
```

---

## Task 13: `MembersAlerts` component

**Files:**
- Create: `src/components/portal/MembersAlerts.jsx`

- [ ] **Step 1: Write the component**

```jsx
import { differenceInDays, format } from "date-fns";

function classifyProperties(properties) {
  const overdueTickets = [];
  const leaseEnding30 = [];
  const leaseEnding60 = [];
  const oldOpenTickets = [];
  const vacant = [];

  const now = new Date();
  for (const p of properties) {
    for (const t of p.openTickets) {
      const age = differenceInDays(now, new Date(t.created_at));
      if (age > 7) oldOpenTickets.push({ propertyName: p.name, age, ticketId: t.id });
    }
    for (const r of p.rooms) {
      if (!r.tenant) {
        vacant.push({ propertyName: p.name, roomName: r.name, unit: r.unit_code });
        continue;
      }
      const end = r.tenant.lease_end_date ? new Date(r.tenant.lease_end_date) : null;
      if (end) {
        const days = differenceInDays(end, now);
        if (days <= 30 && days >= 0) {
          leaseEnding30.push({ propertyName: p.name, roomName: r.name, days, end });
        } else if (days <= 60 && days > 30) {
          leaseEnding60.push({ propertyName: p.name, roomName: r.name, days, end });
        }
      }
    }
  }
  return { overdueTickets, leaseEnding30, leaseEnding60, oldOpenTickets, vacant };
}

function Section({ icon, title, items, render, empty }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="font-medium mb-2">{icon} {title} <span className="text-xs text-gray-500">({items.length})</span></h3>
      <div className="space-y-2">{items.map(render)}</div>
    </div>
  );
}

export default function MembersAlerts({ properties, loading }) {
  if (loading) return <div className="text-sm text-gray-500">Loading…</div>;
  const groups = classifyProperties(properties);
  const total = groups.leaseEnding30.length + groups.leaseEnding60.length
    + groups.oldOpenTickets.length + groups.vacant.length;
  if (total === 0) {
    return <div className="text-center text-sm text-gray-500 py-12">All quiet 🐝</div>;
  }
  return (
    <div className="space-y-6">
      <Section
        icon="🟠" title="Lease ending in 30 days"
        items={groups.leaseEnding30}
        render={(it, i) => (
          <div key={i} className="rounded border p-3 text-sm">
            <span className="font-medium">{it.propertyName}</span> · {it.roomName} ·
            ends {format(it.end, "d MMM")} ({it.days} days)
          </div>
        )}
      />
      <Section
        icon="🟡" title="Lease ending 30–60 days"
        items={groups.leaseEnding60}
        render={(it, i) => (
          <div key={i} className="rounded border p-3 text-sm">
            <span className="font-medium">{it.propertyName}</span> · {it.roomName} ·
            ends {format(it.end, "d MMM")} ({it.days} days)
          </div>
        )}
      />
      <Section
        icon="🟡" title="Open tickets >7 days"
        items={groups.oldOpenTickets}
        render={(it, i) => (
          <div key={i} className="rounded border p-3 text-sm">
            <span className="font-medium">{it.propertyName}</span> · ticket open {it.age} days
          </div>
        )}
      />
      <Section
        icon="⚪" title="Vacant rooms"
        items={groups.vacant}
        render={(it, i) => (
          <div key={i} className="rounded border p-3 text-sm">
            <span className="font-medium">{it.propertyName}</span> · {it.roomName} ({it.unit})
          </div>
        )}
      />
    </div>
  );
}
```

**Note on overdue rent:** The spec lists "overdue rent" as a 🔴 alert, but rent status lives in a separate table (likely `rent_payments` or similar — see `AdminRentPage.jsx`). Including it here would expand `useMembersData`. For v1, omit overdue rent from this view — the existing `AdminRentPage` is the canonical place. Add a "View rent" link at the top of MembersAlerts pointing to `/portal/admin/rent` if you want a fast escape hatch.

- [ ] **Step 2: Commit**

```bash
git add src/components/portal/MembersAlerts.jsx
git commit -m "feat(portal): add MembersAlerts component"
```

---

## Task 14: `MembersCaptains` component

**Files:**
- Create: `src/components/portal/MembersCaptains.jsx`

- [ ] **Step 1: Write the component**

```jsx
import { useEffect, useState } from "react";
import CaptainBadge from "./CaptainBadge";
import { supabase } from "../../lib/supabase";

async function fetchCaptainSummary(propertyId) {
  const start = new Date();
  start.setDate(1); // first of this month
  const { data } = await supabase
    .from("claims")
    .select("amount_sgd, status")
    .eq("property_id", propertyId)
    .gte("created_at", start.toISOString());
  const list = data ?? [];
  return {
    count: list.length,
    totalSgd: list.reduce((s, c) => s + Number(c.amount_sgd), 0),
  };
}

export default function MembersCaptains({ properties, loading, onViewClaims }) {
  const [summaries, setSummaries] = useState({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        properties.filter((p) => p.captain).map(async (p) => [
          p.id,
          await fetchCaptainSummary(p.id),
        ]),
      );
      if (!cancelled) setSummaries(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [properties]);

  if (loading) return <div className="text-sm text-gray-500">Loading…</div>;

  const captains = properties.filter((p) => p.captain);
  if (captains.length === 0) {
    return <div className="text-sm text-gray-500">No captains assigned yet.</div>;
  }

  return (
    <div className="space-y-3">
      {captains.map((p) => {
        const sum = summaries[p.id] ?? { count: 0, totalSgd: 0 };
        return (
          <div key={p.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.name} captain</span>
                  <CaptainBadge size="sm" />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  This month: {sum.count} claim{sum.count === 1 ? "" : "s"}
                  {sum.count > 0 && <> · S${sum.totalSgd.toFixed(2)}</>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onViewClaims(p.captain.user_id)}
                className="rounded border border-gray-300 px-3 py-1 text-sm"
              >
                View claims
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/portal/MembersCaptains.jsx
git commit -m "feat(portal): add MembersCaptains component"
```

---

## Task 15: `MembersClaimsQueue` component (admin approval queue)

**Files:**
- Create: `src/components/portal/MembersClaimsQueue.jsx`

- [ ] **Step 1: Write the component**

```jsx
import { useState } from "react";
import ClaimCard from "./ClaimCard";
import { useClaims } from "../../hooks/useClaims";

const FILTERS = [
  { key: "SUBMITTED", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "PAID", label: "Paid" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ALL", label: "All" },
];

function ReviewActions({ claim, onReview, onMarkPaid }) {
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [paymentRef, setPaymentRef] = useState("");

  if (claim.status === "SUBMITTED") {
    return (
      <div className="flex flex-col w-full gap-2">
        <button
          type="button"
          onClick={() => setShowComment((s) => !s)}
          className="text-xs text-gray-600 underline self-start"
        >
          {showComment ? "Hide comment" : "Add comment"}
        </button>
        {showComment && (
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Optional comment to captain"
            className="w-full rounded border border-gray-300 p-2 text-sm"
          />
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onReview(claim.id, { status: "REJECTED", comment })}
            className="rounded border border-red-300 text-red-700 px-3 py-1 text-sm"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => onReview(claim.id, { status: "APPROVED", comment })}
            className="rounded bg-blue-600 text-white px-3 py-1 text-sm"
          >
            Approve
          </button>
        </div>
      </div>
    );
  }
  if (claim.status === "APPROVED") {
    return (
      <div className="flex w-full gap-2 items-center">
        <input
          type="text"
          value={paymentRef}
          onChange={(e) => setPaymentRef(e.target.value)}
          placeholder="PayNow ref / note"
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          disabled={!paymentRef.trim()}
          onClick={() => onMarkPaid(claim.id, paymentRef.trim())}
          className="rounded bg-green-600 text-white px-3 py-1 text-sm disabled:opacity-50"
        >
          Mark paid
        </button>
      </div>
    );
  }
  return null;
}

export default function MembersClaimsQueue({ propertyFilter, captainFilter }) {
  const [statusKey, setStatusKey] = useState("SUBMITTED");
  const filter = {};
  if (statusKey !== "ALL") filter.status = statusKey;
  if (propertyFilter && propertyFilter !== "ALL") filter.propertyId = propertyFilter;
  if (captainFilter) filter.captainId = captainFilter;

  const { claims, loading, reviewClaim, markPaid } = useClaims({
    scope: "all",
    filter,
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatusKey(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              statusKey === f.key
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : claims.length === 0 ? (
        <div className="text-sm text-gray-500">No claims match.</div>
      ) : (
        <div className="space-y-3">
          {claims.map((claim) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              mode="admin"
              actions={
                <ReviewActions
                  claim={claim}
                  onReview={reviewClaim}
                  onMarkPaid={markPaid}
                />
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Note:** `useClaims({ scope: "all" })` should bypass the "filter by submitted_by" branch in the hook. Add this case to the hook in Task 5 if not already present — re-read Step 1 of Task 5: the `if (scope === "own")` block already gates that filter, so `scope: "all"` skips it. RLS allows admins to read all rows, so no extra filter needed.

- [ ] **Step 2: Commit**

```bash
git add src/components/portal/MembersClaimsQueue.jsx
git commit -m "feat(portal): add MembersClaimsQueue with approve/reject/mark-paid"
```

---

## Task 16: `AdminMembersPage` shell + property filter + mode tabs

**Files:**
- Create: `src/pages/portal/AdminMembersPage.jsx`

- [ ] **Step 1: Write the page**

```jsx
import { useEffect, useState } from "react";
import PortalLayout from "../../components/portal/PortalLayout";
import MembersRoster from "../../components/portal/MembersRoster";
import MembersAlerts from "../../components/portal/MembersAlerts";
import MembersCaptains from "../../components/portal/MembersCaptains";
import MembersClaimsQueue from "../../components/portal/MembersClaimsQueue";
import { useMembersData } from "../../hooks/useMembersData";
import { supabase } from "../../lib/supabase";

const MODES = [
  { key: "ROSTER", label: "Roster" },
  { key: "ALERTS", label: "Alerts" },
  { key: "CAPTAINS", label: "Captains" },
  { key: "CLAIMS", label: "Claims" },
];

export default function AdminMembersPage() {
  const [mode, setMode] = useState("ROSTER");
  const [propertyFilter, setPropertyFilter] = useState("ALL");
  const [captainFilter, setCaptainFilter] = useState(null);
  const [allProperties, setAllProperties] = useState([]);
  const [pendingClaimCount, setPendingClaimCount] = useState(0);

  const { properties, loading } = useMembersData(propertyFilter);

  useEffect(() => {
    supabase.from("properties").select("id, name").order("name")
      .then(({ data }) => setAllProperties(data ?? []));
    supabase.from("claims").select("id", { count: "exact", head: true })
      .eq("status", "SUBMITTED")
      .then(({ count }) => setPendingClaimCount(count ?? 0));
  }, []);

  return (
    <PortalLayout>
      <div className="max-w-6xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-semibold">Members</h1>
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1 text-sm"
          >
            <option value="ALL">All Properties</option>
            {allProperties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 border-b border-gray-200">
          {MODES.map((m) => {
            const dot = m.key === "CLAIMS" && pendingClaimCount > 0;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => { setMode(m.key); setCaptainFilter(null); }}
                className={`relative px-4 py-2 text-sm font-medium ${
                  mode === m.key
                    ? "border-b-2 border-blue-600 text-blue-700"
                    : "text-gray-600"
                }`}
              >
                {m.label}
                {dot && (
                  <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] px-1.5 py-0.5">
                    {pendingClaimCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {mode === "ROSTER" && <MembersRoster properties={properties} loading={loading} />}
        {mode === "ALERTS" && <MembersAlerts properties={properties} loading={loading} />}
        {mode === "CAPTAINS" && (
          <MembersCaptains
            properties={properties}
            loading={loading}
            onViewClaims={(captainUserId) => {
              setCaptainFilter(captainUserId);
              setMode("CLAIMS");
            }}
          />
        )}
        {mode === "CLAIMS" && (
          <MembersClaimsQueue
            propertyFilter={propertyFilter}
            captainFilter={captainFilter}
          />
        )}
      </div>
    </PortalLayout>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/portal/AdminMembersPage.jsx
git commit -m "feat(portal): add AdminMembersPage with mode tabs + property filter"
```

---

## Task 17: Wire admin Members route + sidebar nav

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/portal/PortalLayout.jsx`
- Modify: `src/i18n/en.json`

- [ ] **Step 1: Add the route to `App.jsx`**

Add the import (near other admin pages):
```jsx
import AdminMembersPage from './pages/portal/AdminMembersPage';
```

Add the route inside the `<Routes>` block:
```jsx
<Route
  path="/portal/admin/members"
  element={
    <AuthGuard requiredRole="ADMIN">
      <AdminMembersPage />
    </AuthGuard>
  }
/>
```

- [ ] **Step 2: Update sidebar nav**

The existing nav has `t("nav.members")` pointing to `/portal/admin/onboarding` (line 40). That label was acting as "onboarding" — repurpose:

In `ADMIN_MANAGE_SECTION.children` (lines 38–51), change the existing onboarding entry's label key and add a new Members entry:
```jsx
{ label: t("nav.onboarding"), to: "/portal/admin/onboarding", icon: "how_to_reg" },
{ label: t("nav.members"), to: "/portal/admin/members", icon: "group" },
```

- [ ] **Step 3: Add i18n strings**

In `src/i18n/en.json`, in the `nav` object, add:
```json
"onboarding": "Onboarding"
```
The existing `"members": "Members"` key is already present; reuse it.

If `zh.json` exists in the same directory, mirror the addition (`"onboarding": "入住"` or similar — confirm preferred translation).

- [ ] **Step 4: Smoke test the full admin flow**

Run `npm run dev`. Sign in as an admin.
- Sidebar shows both `Members` and `Onboarding` under Manage.
- `/portal/admin/members` loads.
- Default mode = Roster, default filter = All Properties → shows 3-column grid.
- Switch to single property → grid collapses to 1 column.
- Alerts tab shows "All quiet 🐝" if no leases ending / no old tickets / no vacancies; otherwise grouped sections appear.
- Captains tab shows up to 3 cards; "View claims" jumps to Claims tab pre-filtered.
- Claims tab shows the "Pending" filter by default. Submit a test claim from another browser session as captain; refresh; the claim appears with Approve/Reject/Comment controls.
- Approve a claim → buttons swap to "Mark paid" + payment reference input. Enter a value, click Mark paid → claim moves under "Paid" filter.
- Reject a claim → captain sees REJECTED status with admin comment in their list.
- Captain hits "Re-submit" on rejected claim → form is pre-filled with the rejected category/amount/description.

Sign in as a regular tenant; confirm `/portal/admin/members` redirects to `/portal/dashboard`.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/portal/PortalLayout.jsx src/i18n/en.json
git commit -m "feat(portal): wire AdminMembersPage route + nav"
```

---

## Task 18: Refresh `PropertyTenantsPage` (tenant-side)

**Files:**
- Modify: `src/pages/portal/PropertyTenantsPage.jsx`

- [ ] **Step 1: Read the current file to confirm fetch shape**

The file currently selects `id, role, moved_in_at, rooms(name, unit_code)` from `tenant_profiles`. To add captain phone for the WhatsApp deep link, extend the SELECT.

- [ ] **Step 2: Replace the file**

```jsx
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import CaptainBadge from "../../components/portal/CaptainBadge";

function waLink(phone) {
  if (!phone) return null;
  const e164 = phone.replace(/[^\d+]/g, "");
  return `https://wa.me/${e164.replace(/^\+/, "")}`;
}

export default function PropertyTenantsPage() {
  const { profile } = useAuth();
  const propertyId = profile?.property_id ?? profile?.rooms?.property_id;
  const propertyName = profile?.properties?.name ?? "";

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!propertyId) { setLoading(false); return; }
    (async () => {
      const { data, error } = await supabase
        .from("tenant_profiles")
        .select(`
          id, role, moved_in_at, phone,
          rooms(name, unit_code)
        `)
        .eq("property_id", propertyId)
        .eq("is_active", true);

      if (error) {
        console.error("Error fetching members:", error);
        setLoading(false);
        return;
      }
      const sorted = (data ?? []).sort((a, b) => {
        const codeA = a.rooms?.unit_code ?? "";
        const codeB = b.rooms?.unit_code ?? "";
        return codeA.localeCompare(codeB);
      });
      setMembers(sorted);
      setLoading(false);
    })();
  }, [propertyId]);

  const captain = members.find((m) => m.role === "HOUSE_CAPTAIN");
  const others = members.filter((m) => m.role !== "HOUSE_CAPTAIN");

  return (
    <PortalLayout>
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">{propertyName}</h1>
          <span className="text-sm text-gray-500">
            {members.length} housemate{members.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : (
          <>
            {captain && (
              <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span aria-hidden>🏠</span>
                  <CaptainBadge size="md" />
                </div>
                <div className="font-medium">
                  {captain.rooms?.name ?? "Captain"}
                  {captain.rooms?.unit_code && (
                    <span className="text-xs text-gray-500 ml-1">{captain.rooms.unit_code}</span>
                  )}
                </div>
                <p className="text-xs text-gray-700 mt-1">
                  Your house captain handles maintenance + house issues.
                </p>
                {waLink(captain.phone) && (
                  <a
                    href={waLink(captain.phone)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-3 rounded bg-green-600 text-white px-3 py-1 text-sm"
                  >
                    Message captain on WhatsApp
                  </a>
                )}
              </div>
            )}

            <div className="space-y-2">
              {others.map((m) => (
                <div key={m.id} className="rounded border border-gray-200 bg-white p-3">
                  <div className="font-medium">
                    {m.rooms?.name ?? "—"}
                    {m.rooms?.unit_code && (
                      <span className="text-xs text-gray-500 ml-1">{m.rooms.unit_code}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    Moved in {format(new Date(m.moved_in_at), "d MMM yyyy")}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </PortalLayout>
  );
}
```

**Note:** This SELECT references `tenant_profiles.phone`. If that column does not exist, drop it from the SELECT and remove the WhatsApp button (the rest of the layout still works). Verify with:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'tenant_profiles' AND column_name = 'phone';
```

- [ ] **Step 3: Smoke test**

Run `npm run dev`. Sign in as a captain → see "House Captain" badge prominently on their own row's card (the page lists all members including the captain themselves). Sign in as a regular tenant → see captain card pinned at top with WhatsApp button (if captain's phone is set).

- [ ] **Step 4: Commit**

```bash
git add src/pages/portal/PropertyTenantsPage.jsx
git commit -m "feat(portal): refresh PropertyTenantsPage with captain card"
```

---

## Task 19: Show CaptainBadge in `TicketCard`

**Files:**
- Modify: `src/components/portal/TicketCard.jsx`

- [ ] **Step 1: Read the existing file**

Use the Read tool to read `src/components/portal/TicketCard.jsx`. Identify where the ticket creator/submitter name renders.

- [ ] **Step 2: Add the badge**

The component receives ticket data; check whether the submitter's role is included in the JOIN. If `submitted_by_profile.role` (or similar) is present, render `<CaptainBadge size="sm" />` next to the name when `role === "HOUSE_CAPTAIN"`. Example diff:

```jsx
import CaptainBadge from "./CaptainBadge";
// …
<div className="flex items-center gap-2">
  <span>{submitterName}</span>
  {submitterRole === "HOUSE_CAPTAIN" && <CaptainBadge size="sm" />}
</div>
```

If the existing query does not return the submitter's role, extend the SELECT in the parent that fetches tickets (e.g. `IssuesPage.jsx`, `PropertyTicketsPage.jsx`) to include `submitter:tenant_profiles!submitted_by(role)` and pass it down.

- [ ] **Step 3: Smoke test**

Sign in as a captain, file a ticket. Sign in as another tenant and view the ticket list — captain's ticket shows the badge.

- [ ] **Step 4: Commit**

```bash
git add src/components/portal/TicketCard.jsx
# also any modified parent pages
git commit -m "feat(portal): show CaptainBadge on captain-filed tickets"
```

---

## Task 20: Final smoke test + verification

- [ ] **Step 1: Run lint**

```bash
cd /Users/mark/Desktop/hyve-website && npm run lint
```
Expected: no errors. Fix any introduced.

- [ ] **Step 2: Run build**

```bash
npm run build
```
Expected: clean build, no errors.

- [ ] **Step 3: End-to-end manual verification (record results)**

| Scenario | Expected | Pass/Fail |
|---|---|---|
| Captain submits claim with both photos | Row in `claims` with status SUBMITTED, files in storage | |
| Captain submits without item photo | Form blocks submit, shows error | |
| Captain views own claims | Sees only their own | |
| Tenant tries `/portal/captain/claims` | Redirected to `/portal/dashboard` | |
| Admin sees pending count badge on Members tab | Count = number of SUBMITTED claims | |
| Admin approves a claim | Status → APPROVED, captain sees update | |
| Admin marks paid with reference | Status → PAID, payment_reference saved | |
| Admin rejects with comment | Status → REJECTED, comment shown to captain | |
| Captain hits Re-submit on rejected | Form pre-fills, new SUBMITTED row created | |
| Roster mode shows 3 columns when filter = All | 3 properties side by side | |
| Roster mode shows 1 column when single property selected | Single property | |
| Alerts mode shows "All quiet" when no issues | Empty state | |
| Captains mode "View claims" → Claims tab pre-filtered | Captain filter applied | |
| Tenant `/portal/property/tenants` shows captain card pinned | Distinct styling, badge visible | |
| TicketCard shows CaptainBadge next to captain submitter | Badge renders | |

- [ ] **Step 4: Commit anything outstanding**

```bash
git status
# resolve any uncommitted artefacts
```

---

## Self-Review (already performed)

**Spec coverage:** All sections of the spec map to tasks (Tasks 1–3 cover §3 data model; Tasks 4–10 cover §4 captain UI; Tasks 11–17 cover §5 admin dashboard; Tasks 18–19 cover §6 tenant page + global badge).

**Placeholders:** None — all code blocks are complete.

**Type/name consistency:** `submitted_by` (not `captain_id`) used consistently after the implementation note in the header. `useClaims({ scope: "all" | "own" | "none" })` consistent across Tasks 5, 7, 8, 15. `claim.properties.name` from the JOIN `properties(name)` consistent with Task 5's CLAIM_COLUMNS.

**Known assumptions to verify at runtime:**
1. `tenant_profiles.lease_end_date` column exists (Task 11 has a verification SQL snippet — drop column from SELECT if absent).
2. `tenant_profiles.phone` column exists for the captain WhatsApp link (Task 18 has a verification snippet — drop the link if absent).
3. `update_updated_at()` function is defined (it is, per `20260321000000_initial_schema.sql:106-112`).
