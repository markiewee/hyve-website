-- Owner-facing property documents.
--
-- Documents that belong to the PROPERTY and its owner, not to a tenant: AC
-- servicing bills, contractor invoices, monthly statements. Deliberately a
-- separate table and a separate storage bucket from tenant_documents.
--
-- Two reasons for the separation, both load-bearing:
--
--  1. Owners are limited to tenant ID and passport (see
--     20260806000000_landlord_documents.sql). Hanging owner-visible bills off
--     tenant_documents would mean widening that allowlist on the same table that
--     holds passports and licence agreements. We do not touch it.
--
--  2. The `tenant-documents` bucket grants SELECT to any authenticated user
--     ("Tenants read own docs" is bucket-wide, not per-folder). Owner bills must
--     not sit in a bucket every tenant can read.

-- 1. Role helpers, SECURITY DEFINER on purpose.
--    tenant_profiles has RLS enabled, so a policy that sub-selects it directly
--    would itself be filtered by tenant_profiles' policies and could silently
--    evaluate to false. These read it as the definer instead.
create or replace function public.is_portal_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tenant_profiles tp
    where tp.user_id = auth.uid()
      and tp.is_active = true
      and tp.role in ('ADMIN', 'SUPER_ADMIN')
  );
$$;

create or replace function public.current_landlord_property()
returns uuid
language sql stable security definer set search_path = public as $$
  select tp.property_id
  from tenant_profiles tp
  where tp.user_id = auth.uid()
    and tp.is_active = true
    and tp.role = 'LANDLORD'
  limit 1;
$$;

grant execute on function public.is_portal_admin() to authenticated;
grant execute on function public.current_landlord_property() to authenticated;

-- 2. The table.
create table if not exists public.property_documents (
  id               uuid primary key default gen_random_uuid(),
  property_id      uuid not null references public.properties(id) on delete cascade,
  doc_type         text not null default 'OTHER'
                     check (doc_type in ('AC_SERVICING','INVOICE','STATEMENT','RECEIPT','REPORT','OTHER')),
  title            text not null,
  -- First day of the month the document covers. Null when it is not periodic.
  -- This is what makes the AC-servicing backfill legible: one row per month.
  period_month     date,
  -- Object path inside the `property-documents` bucket.
  file_path        text not null,
  file_name        text,
  file_size        bigint,
  mime_type        text,
  notes            text,
  -- Lets an upload be staged before the owner sees it, and doubles as a
  -- kill switch if something goes up by mistake.
  visible_to_owner boolean not null default true,
  uploaded_by      uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists property_documents_property_period_idx
  on public.property_documents (property_id, period_month desc, created_at desc);

alter table public.property_documents enable row level security;

-- 3. Table policies. Admins manage, landlords read their own property only.
--    There is deliberately no tenant policy and no landlord write policy.
drop policy if exists property_documents_admin_all on public.property_documents;
create policy property_documents_admin_all
  on public.property_documents
  for all to authenticated
  using (public.is_portal_admin())
  with check (public.is_portal_admin());

drop policy if exists property_documents_landlord_read on public.property_documents;
create policy property_documents_landlord_read
  on public.property_documents
  for select to authenticated
  using (
    visible_to_owner = true
    and property_id = public.current_landlord_property()
  );

-- 4. Private bucket. 25MB, enough for a scanned multi-page invoice.
insert into storage.buckets (id, name, public, file_size_limit)
values ('property-documents', 'property-documents', false, 26214400)
on conflict (id) do nothing;

-- 5. Storage policies: admin only, all four verbs.
--    Owners never touch the bucket. Their download is signed server-side by the
--    service role in api/portal/admin-actions.js after re-checking ownership,
--    which is the same shape as the existing landlord_doc_url action.
drop policy if exists "Admins read property documents" on storage.objects;
create policy "Admins read property documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'property-documents' and public.is_portal_admin());

drop policy if exists "Admins upload property documents" on storage.objects;
create policy "Admins upload property documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'property-documents' and public.is_portal_admin());

drop policy if exists "Admins update property documents" on storage.objects;
create policy "Admins update property documents"
  on storage.objects for update to authenticated
  using (bucket_id = 'property-documents' and public.is_portal_admin())
  with check (bucket_id = 'property-documents' and public.is_portal_admin());

drop policy if exists "Admins delete property documents" on storage.objects;
create policy "Admins delete property documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'property-documents' and public.is_portal_admin());
