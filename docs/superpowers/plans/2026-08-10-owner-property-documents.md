# Owner Property Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin upload property level documents (starting with AC servicing bills) and have the owner of that property see and download them in the landlord portal.

**Architecture:** A new `property_documents` table and a new private `property-documents` storage bucket, fully separate from `tenant_documents`. Admin uploads direct from the browser under admin RLS. The owner reads the list under a landlord SELECT policy and downloads through a new action inside the existing `api/portal/admin-actions.js` dispatcher, so no serverless function is added.

**Tech Stack:** Postgres and RLS on Supabase (hyve-iot, ref `diiilqpfmlxjwiaeophb`), Supabase Storage, React 19, React Router 7, Vite 6, Tailwind 4, deployed on Vercel.

---

### Task 1: Migration, table, bucket, policies

**Files:**
- Create: `supabase/migrations/20260810100000_property_documents.sql`

- [ ] **Step 1: Write the migration**

Helpers first so no policy nests a select into `tenant_profiles` (that table has RLS on, and a nested select would be filtered by its own policies and could silently evaluate false).

```sql
create or replace function public.is_portal_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tenant_profiles tp
    where tp.user_id = auth.uid() and tp.is_active = true
      and tp.role in ('ADMIN', 'SUPER_ADMIN')
  );
$$;

create or replace function public.current_landlord_property()
returns uuid language sql stable security definer set search_path = public as $$
  select tp.property_id from tenant_profiles tp
  where tp.user_id = auth.uid() and tp.is_active = true and tp.role = 'LANDLORD'
  limit 1;
$$;

create table if not exists public.property_documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  doc_type text not null default 'OTHER'
    check (doc_type in ('AC_SERVICING','INVOICE','STATEMENT','RECEIPT','REPORT','OTHER')),
  title text not null,
  period_month date,
  file_path text not null,
  file_name text,
  file_size bigint,
  mime_type text,
  notes text,
  visible_to_owner boolean not null default true,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.property_documents enable row level security;

create policy property_documents_admin_all on public.property_documents
  for all to authenticated using (public.is_portal_admin()) with check (public.is_portal_admin());

create policy property_documents_landlord_read on public.property_documents
  for select to authenticated
  using (visible_to_owner = true and property_id = public.current_landlord_property());

insert into storage.buckets (id, name, public, file_size_limit)
values ('property-documents', 'property-documents', false, 26214400)
on conflict (id) do nothing;
```

Storage policies, admin only. Owners never read the bucket directly, they get a
service role signed URL.

```sql
create policy "Admins read property documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'property-documents' and public.is_portal_admin());
-- plus matching insert / update / delete policies
```

- [ ] **Step 2: Apply it against hyve-iot and verify the objects exist**

Expected: `property_documents` present, rowsecurity true, both table policies listed, bucket row present.

- [ ] **Step 3: Test RLS as the real target roles**

This is the step that would have caught the `tenant_documents` bug. Inside a transaction, `set local role authenticated` and `set local request.jwt.claims` to each user, then run the real statements.

1. ADMIN insert a Chiltern Park row: expect 1 row written.
2. Landlord `landlord-cp` select: expect that row back.
3. Landlord `landlord-ih` select: expect 0 rows (different property).
4. A TENANT select: expect 0 rows.
5. Landlord insert: expect a row level security violation.
6. Flip `visible_to_owner` false, landlord select: expect 0 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260810100000_property_documents.sql
git commit -m "feat(owners): property_documents table, bucket and RLS"
```

---

### Task 2: Owner download action in the existing dispatcher

**Files:**
- Modify: `api/portal/admin-actions.js` (add `handleLandlordPropertyDocUrl`, register the action)

- [ ] **Step 1: Add the handler**

Reuses the existing `landlordProperty(req)` helper. Separate code path and
separate bucket from `handleLandlordDocUrl`, and it does not touch
`OWNER_VISIBLE_TYPES`.

```js
async function handleLandlordPropertyDocUrl(req, res) {
  const propertyId = await landlordProperty(req);
  if (!propertyId) return res.status(403).json({ error: "Not authorized" });
  const { doc_id } = req.body || {};
  if (!doc_id) return res.status(400).json({ error: "doc_id required" });
  const { data: doc, error } = await supabase
    .from("property_documents")
    .select("id, property_id, file_path, visible_to_owner")
    .eq("id", doc_id)
    .single();
  if (error || !doc) return res.status(404).json({ error: "Document not found" });
  if (doc.property_id !== propertyId || !doc.visible_to_owner)
    return res.status(403).json({ error: "Not authorized" });
  if (!doc.file_path) return res.status(422).json({ error: "Document has no file" });
  const { data: signed, error: signErr } = await supabase.storage
    .from("property-documents").createSignedUrl(doc.file_path, 3600);
  if (signErr || !signed?.signedUrl)
    return res.status(500).json({ error: "Could not generate download link" });
  return res.status(200).json({ url: signed.signedUrl });
}
```

- [ ] **Step 2: Register it beside the other landlord actions, above the admin gate**

```js
if (action === "landlord_property_doc_url") return handleLandlordPropertyDocUrl(req, res);
```

- [ ] **Step 3: Verify the function count is still 12**

Run: `find api -name "*.js" | wc -l`
Expected: `12`

- [ ] **Step 4: Commit**

---

### Task 3: Shared document metadata module

**Files:**
- Create: `src/lib/propertyDocuments.js`

Keeps the type list, labels, month formatting and the upload routine in one
place so the admin page and the owner page cannot drift apart.

- [ ] **Step 1: Write the module**

Exports `PROPERTY_DOC_TYPES`, `PROPERTY_DOC_TYPE_LABELS`, `propertyDocLabel(d)`,
`formatPeriodMonth(v)`, `monthInputToDate(v)`, `storagePathFor(propertyId, name)`
and `uploadPropertyDocument(...)`. Upload writes the object, then inserts the row,
and removes the object if the insert fails so no orphan is left in the bucket.

- [ ] **Step 2: Commit**

---

### Task 4: Admin upload page

**Files:**
- Create: `src/pages/portal/AdminOwnerDocumentsPage.jsx`
- Modify: `src/App.jsx` (import plus route `/portal/admin/owner-documents`)
- Modify: `src/components/portal/PortalLayout.jsx` (nav entry under Ops)

- [ ] **Step 1: Build the page**

Property selector, upload form (file, type, title, month, note, visible toggle),
and a list of existing documents per property with view, hide/show and delete.
Admin previews via a client side signed URL, which works because the admin has a
storage SELECT policy.

- [ ] **Step 2: Wire the route and the nav entry**

- [ ] **Step 3: Commit**

---

### Task 5: Owner facing section on the landlord portal

**Files:**
- Modify: `src/pages/portal/LandlordPage.jsx`

- [ ] **Step 1: Load the documents in the existing effect**

Add `supabase.from("property_documents").select(...).order(...)` to the existing
`Promise.all`. The landlord read policy scopes it.

- [ ] **Step 2: Render the section outside the roster conditional**

The roster block early returns "No residents on record", so the documents section
must sit after it, not inside it, or a property with no residents would show no
documents.

- [ ] **Step 3: Reuse the viewer modal**

Route property documents through `landlord_property_doc_url` and reuse the same
modal, which already branches on PDF versus image.

- [ ] **Step 4: Commit**

---

### Task 6: Verification

- [ ] **Step 1: Clean build**

```bash
rm -rf dist dist-ssr && npm run build
```

Expected: client, SSR and prerender all succeed.

- [ ] **Step 2: Re-run the RLS role tests from Task 1 against the final schema**

- [ ] **Step 3: Confirm tenant document visibility did not widen**

`OWNER_VISIBLE_TYPES` still exactly `["ID_DOCUMENT", "PASSPORT"]`, and
`get_landlord_documents()` unchanged.

- [ ] **Step 4: Confirm the function count is 12**

- [ ] **Step 5: Push the branch and open the PR**
