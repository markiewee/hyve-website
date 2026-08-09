-- Landlord document self-service.
--
-- Lets a property owner (LANDLORD role) download their current tenants' identity
-- documents from the existing landlord portal. Per Mark: owners see ONLY tenant
-- ID and passport, nothing else. We deliberately never expose licence agreements
-- or stamp certificates (they reveal our sub-let rent, i.e. Makery's margin over
-- what we pay the owner) or payslips (tenant's private finances).
--
-- Companion to get_landlord_roster(); same SECURITY DEFINER, same per-property
-- scoping to the caller. No RLS change to tenant_documents is needed because the
-- owner never reads the table directly: this RPC returns the rows, and a
-- service-role endpoint (api/portal/landlord-doc-url.js) mints the signed URL.

-- 1. Owner contact emails, for the manual "notify owner" action.
alter table public.properties
  add column if not exists owner_emails text[] default '{}'::text[];

update public.properties
set owner_emails = array['laurencetan@live.com.sg', 'Josephinelim@live.com.sg']
where id = '1d1cff29-0542-4520-bcf7-dfe0f7e8cb48';  -- Chiltern Park 135 (#04-03)

-- 2. Normalise passports to a proper doc_type so they are captured by the
--    identity-only filter (today they are mis-filed as OTHER with "Passport" in
--    the title). Scoped to passports only; TAs/receipts are untouched.
update public.tenant_documents
set doc_type = 'PASSPORT'
where doc_type = 'OTHER'
  and title ilike '%passport%';

-- 3. Owner-facing document list. Identity documents only.
create or replace function public.get_landlord_documents()
returns table (
  tenant_profile_id uuid,
  unit_code   text,
  full_name   text,
  doc_id      uuid,
  doc_type    text,
  title       text,
  status      text,
  file_url    text,
  created_at  timestamptz
)
language plpgsql security definer set search_path = public as $$
declare v_property uuid;
begin
  select tp.property_id into v_property
  from tenant_profiles tp
  where tp.user_id = auth.uid() and tp.is_active = true and tp.role = 'LANDLORD'
  limit 1;
  if v_property is null then raise exception 'not a landlord'; end if;
  return query
  select tp.id,
         r.unit_code,
         coalesce(td.full_name, tp.username),
         d.id,
         d.doc_type,
         d.title,
         d.status,
         d.file_url,
         d.created_at
  from tenant_profiles tp
  join rooms r on r.id = tp.room_id
  left join tenant_details td on td.tenant_profile_id = tp.id
  left join onboarding_progress op on op.tenant_profile_id = tp.id
  join tenant_documents d on d.tenant_profile_id = tp.id
  where tp.is_active = true
    and tp.role in ('TENANT', 'HOUSE_CAPTAIN')
    and r.property_id = v_property
    and coalesce(op.tenancy_end_date, tp.lease_end, current_date) >= current_date
    and d.doc_type in ('ID_DOCUMENT', 'PASSPORT')  -- ID + passport ONLY
  order by r.unit_code, d.created_at;
end; $$;

grant execute on function public.get_landlord_documents() to authenticated, anon;
