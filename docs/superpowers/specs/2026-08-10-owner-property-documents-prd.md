# PRD: Owner Property Documents

**Owner:** Mark Wee
**Date:** 10 Aug 2026
**Surface:** Lazybee landlord/owner portal (lazybee.sg), repo `hyve-website`

## 1. Problem

Some documents belong to the property owner, not to a tenant: AC servicing bills,
contractor invoices, monthly statements. There is nowhere to put them today. The
owner portal shows a resident roster and tenant ID/passport only. Mark currently
has an AC servicing bill with no home, and earlier months to backfill.

## 2. Goal

Mark uploads a document, picks the property and the month it covers, and the owner
of that property sees it next time they sign in and can open or download it.

## 3. Users

- **Admin (Mark).** Uploads, retitles, hides and deletes property documents.
- **Property owner (LANDLORD role).** Sees only their own property's documents,
  read only. Chiltern Park has three live owner logins today.

## 4. Scope

**In:**
- Admin page at `/portal/admin/owner-documents`: choose property, upload a file,
  set type, title, month covered, an optional note, and whether the owner sees it
  yet. List, preview, hide/show and delete existing documents.
- Document types: AC servicing, invoice, statement, receipt, report, other.
- Owner facing "Property documents" section on `/portal/landlord`, newest first,
  showing title, type, month covered and upload date, with a view/download button
  that opens the existing inline viewer.

**Out:** email alerts to the owner on upload, owner side uploading, bulk backfill
import, and any change to which tenant documents an owner can see.

## 5. Hard requirements

1. **No new serverless function.** Vercel is at exactly 12, the Hobby cap. The
   download endpoint is a new action inside the existing
   `api/portal/admin-actions.js` dispatcher. Count is verified 12 before and after.
2. **Tenant document visibility does not widen.** `OWNER_VISIBLE_TYPES` stays
   `["ID_DOCUMENT", "PASSPORT"]` and `get_landlord_documents()` is untouched.
   Property documents live in a separate table and a separate storage bucket.
3. **RLS written explicitly and tested by role.** `tenant_documents` once shipped
   with no tenant INSERT policy and silently broke uploads for everyone. Every
   policy here is proven by running the actual statement as the actual role.
4. **Separate bucket, deliberately.** The `tenant-documents` bucket grants SELECT
   to any authenticated user. Owner bills must not sit in it.

## 6. Data model

`public.property_documents`: id, property_id, doc_type, title, period_month,
file_path, file_name, file_size, mime_type, notes, visible_to_owner, uploaded_by,
created_at. Private bucket `property-documents`, 25MB cap, path
`{property_id}/{uuid}-{filename}`.

Policies: admins full access, landlords SELECT only their own property and only
when `visible_to_owner` is true. No tenant policy, no landlord write policy.
Storage policies are admin only; the owner's download is signed server side by the
service role after re-checking ownership.

## 7. Success criteria

- Mark uploads the current AC servicing bill against Chiltern Park in under a
  minute and it appears in the owner's portal.
- A Chiltern Park owner sees Chiltern Park documents and nothing else.
- An Ivory Heights owner sees zero Chiltern Park documents.
- A tenant sees zero property documents.
- Hidden documents are invisible to owners in both the list and the download.
- `npm run build` clean, function count still 12.
