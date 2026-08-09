-- Expose passport + immigration pass details to landlords for their own property.
-- The roster function is SECURITY DEFINER and already scopes to the caller's
-- property (LANDLORD role only), so no new RLS is required. We DROP + recreate
-- because the RETURNS TABLE signature changes.

drop function if exists public.get_landlord_roster();

create or replace function public.get_landlord_roster()
returns table (
  unit_code   text,
  full_name   text,
  nationality text,
  id_type     text,
  id_number   text,
  id_expiry   date,
  pass_type   text,
  pass_number text,
  pass_expiry date,
  move_in     date,
  move_out    date,
  status      text
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
  select r.unit_code,
         td.full_name,
         td.nationality,
         td.id_type,
         td.id_number,
         td.id_expiry::date,
         td.pass_type,
         td.pass_number,
         td.pass_expiry::date,
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
