# Owner Property Documents

Date: 2026-08-10
Status: approved (Mark pre-approved the build)

## Problem

Mark has documents that belong to a property owner, not to a tenant: AC servicing
bills, contractor invoices, statements. Today there is nowhere to put them. The
owner portal at `/portal/landlord` shows a resident roster and identity documents
only. Mark wants to upload the current AC servicing bill and, later, backfill
earlier months, and have the owner of that property see them when they sign in.

## Constraints

1. Vercel is at exactly 12 serverless functions, the Hobby cap. No new file under
   `api/`. Everything server side goes into the existing action dispatcher at
   `api/portal/admin-actions.js`.
2. Owner visibility of tenant personal documents must not widen. The existing
   allowlist `OWNER_VISIBLE_TYPES = ["ID_DOCUMENT", "PASSPORT"]` stays exactly as
   it is, and `get_landlord_documents()` is not touched.
3. RLS must be written explicitly and tested by actually inserting and reading as
   the target role. Prior art: `tenant_documents` shipped with no tenant INSERT
   policy and silently broke uploads for every tenant (migration
   `20260711000001_tenant_documents_insert_policy.sql`).

## Key finding that shapes the design

The `tenant-documents` storage bucket has this policy:

```
"Tenants read own docs": SELECT, bucket_id = 'tenant-documents' AND auth.role() = 'authenticated'
```

Any signed in user can read any object in that bucket. Owner facing bills must
therefore not be stored there. They get their own private bucket with no tenant
or landlord policy at all.

## Approaches considered

**A. Reuse `tenant_documents` with a nullable `property_id` and new owner visible
doc types.** No new table. Rejected: it forces the owner visibility allowlist to
widen on the very table that holds passports and licence agreements, which is the
thing constraint 2 exists to prevent. It also puts the files in the leaky bucket.

**B. Separate `property_documents` table and `property-documents` bucket, admin
uploads straight to storage from the browser, owner reads through RLS, downloads
are signed by the service role in the existing dispatcher.** Recommended and
chosen. Tenant documents and property documents never touch each other. Adds zero
serverless functions. The download path copies the already proven
`landlord_doc_url` action.

**C. Push the file bytes through `admin-actions.js` as base64 and write with the
service role.** No storage RLS to get wrong. Rejected: the Vercel request body cap
is 4.5MB and base64 inflates by a third, so a scanned bill would fail at around
3.4MB, which is a normal size for a phone photo of an invoice.

## Design

### Data

New table `public.property_documents`:

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| property_id | uuid not null | references `properties(id)` on delete cascade |
| doc_type | text not null | check: AC_SERVICING, INVOICE, STATEMENT, RECEIPT, REPORT, OTHER |
| title | text not null | what the owner sees |
| period_month | date | first of the month the document covers, null if not periodic |
| file_path | text not null | object path inside the `property-documents` bucket |
| file_name | text | original filename |
| file_size | bigint | bytes |
| mime_type | text | |
| notes | text | optional line shown to the owner |
| visible_to_owner | boolean not null default true | staging and kill switch |
| uploaded_by | uuid | `auth.users(id)`, set null on delete |
| created_at | timestamptz default now() | |

Index on `(property_id, period_month desc, created_at desc)`.

New private storage bucket `property-documents`, 25MB limit. Object path is
`{property_id}/{uuid}-{safe_filename}`.

### Access control

Two SECURITY DEFINER helpers so the policies never nest a select into
`tenant_profiles`, which has its own RLS and would otherwise be able to make a
policy silently return false:

- `public.is_portal_admin()` returns boolean, true for an active ADMIN or
  SUPER_ADMIN.
- `public.current_landlord_property()` returns the property uuid of the caller's
  active LANDLORD profile, else null.

Policies on `property_documents`:

- `property_documents_admin_all` FOR ALL using and with check `is_portal_admin()`.
- `property_documents_landlord_read` FOR SELECT using
  `visible_to_owner AND property_id = current_landlord_property()`.

There is deliberately no tenant policy and no landlord write policy.

Policies on `storage.objects` for `bucket_id = 'property-documents'`: admin only,
for SELECT, INSERT, UPDATE and DELETE. Owners never read the bucket directly.

### Flows

**Upload (admin).** New page `/portal/admin/owner-documents`. Pick property, file,
type, title, month, optional note. The browser uploads to the bucket with the
admin's own session, then inserts the metadata row. Both steps are authorised by
the admin policies above. If the row insert fails the uploaded object is removed
so no orphan is left behind.

**List (owner).** `LandlordPage` selects from `property_documents` with the
owner's session. The landlord read policy scopes it to their property. Grouped
newest first, month shown when present.

**Download (owner).** New action `landlord_property_doc_url` in
`api/portal/admin-actions.js`. It reuses the existing `landlordProperty(req)`
helper, re-checks that the document's `property_id` matches the caller and that
`visible_to_owner` is true, then mints a one hour signed URL with the service
role. Same shape as `landlord_doc_url`, separate code path, separate bucket.
Reuses the existing viewer modal on the page.

### Error handling

- Upload: file size and empty title validated client side, storage and insert
  errors surfaced inline, orphan cleanup on partial failure.
- Owner list: a failed select renders an inline error and leaves the roster
  intact, it does not blank the page.
- Download: 403 for wrong property, not visible, or non landlord caller. 404 for
  a missing row. 422 when the row has no file.

### Testing

Not "the migration ran". The checks that would fail if this were broken:

1. As the real landlord `landlord-cp` (role switched, JWT claims set), select from
   `property_documents` and get the seeded Chiltern Park row back.
2. As the same landlord, select a document belonging to a different property and
   get zero rows.
3. As a TENANT, select from `property_documents` and get zero rows.
4. As the landlord, attempt an insert and confirm it is rejected.
5. As an ADMIN, insert a row and confirm it succeeds.
6. `npm run build` clean.

## Out of scope

Email notification to the owner on upload, owner side upload, bulk backfill
import, and any change to what tenant documents the owner can see.
