-- 1. allow LANDLORD role
alter table public.tenant_profiles drop constraint tenant_profiles_role_check;
alter table public.tenant_profiles add constraint tenant_profiles_role_check
  check (role = any (array['TENANT','HOUSE_CAPTAIN','ADMIN','SUPER_ADMIN','LANDLORD']));

-- 2. one landlord profile per property
insert into public.tenant_profiles (user_id, property_id, role, username, is_active, is_primary)
values
 ('fd485731-0116-4d4a-9752-f268a25b792f','d3e7e40f-a32c-4c8e-a54f-59e8f9cbc4a6','LANDLORD','landlord-tg',true,true),
 ('0354244d-7c0d-4998-9dd2-b1842e693c7b','358c5333-00fd-4efb-b330-3d6e131e9b10','LANDLORD','landlord-ih',true,true),
 ('e5c1eb22-5dfe-4e7a-992c-79169f3351ee','1d1cff29-0542-4520-bcf7-dfe0f7e8cb48','LANDLORD','landlord-cp',true,true);

-- 3. roster function — scoped to caller's property, LANDLORD only
create or replace function public.get_landlord_roster()
returns table (unit_code text, full_name text, move_in date, move_out date, status text)
language plpgsql security definer set search_path = public as $$
declare v_property uuid;
begin
  select tp.property_id into v_property
  from tenant_profiles tp
  where tp.user_id = auth.uid() and tp.is_active = true and tp.role = 'LANDLORD'
  limit 1;
  if v_property is null then raise exception 'not a landlord'; end if;
  return query
  select r.unit_code,
         td.full_name,
         op.tenancy_start_date::date,
         coalesce(op.tenancy_end_date, tp.lease_end)::date,
         (case when op.tenancy_start_date is not null and op.tenancy_start_date > current_date
               then 'Upcoming' else 'Current' end)::text
  from tenant_profiles tp
  join rooms r on r.id = tp.room_id
  left join tenant_details td on td.tenant_profile_id = tp.id
  left join onboarding_progress op on op.tenant_profile_id = tp.id
  where tp.is_active = true
    and tp.role in ('TENANT','HOUSE_CAPTAIN')
    and r.property_id = v_property
    and td.full_name is not null
    and coalesce(op.tenancy_end_date, tp.lease_end, current_date) >= current_date
  order by r.unit_code, op.tenancy_start_date nulls first;
end; $$;

grant execute on function public.get_landlord_roster() to authenticated, anon;
