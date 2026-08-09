-- Fix: tenant portal document uploads were failing for every tenant.
--
-- The upload flow (src/pages/portal/TenantDocumentsPage.jsx) writes the file to
-- the `tenant-documents` storage bucket, then inserts a row into the
-- `tenant_documents` table. RLS is enabled on the table but only had ALL
-- (admin), SELECT (captains), and SELECT (tenants) policies -- there was NO
-- INSERT policy for tenants, so the record insert was rejected with a
-- row-level-security violation and surfaced in the UI as "I can't upload".
--
-- This adds the missing INSERT policy, mirroring the existing tenant read
-- policy: a tenant may insert a document row only for their own profile.

CREATE POLICY "Tenants upload own documents"
ON public.tenant_documents
FOR INSERT TO public
WITH CHECK (
  tenant_profile_id IN (
    SELECT id FROM tenant_profiles WHERE user_id = auth.uid()
  )
);
