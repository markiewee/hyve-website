-- rooms_with_availability RPC
-- Returns each room with a computed available_from date.
-- available_from = next_available (from rooms table if set and >= today),
-- OR the day after the latest active tenant's lease_end,
-- OR current_date if neither applies.
--
-- Column mapping (actual schema):
--   rooms.unit_code        → room_code
--   rooms.price_monthly    → monthly_rent
--   rooms.room_type        → room_type
--   rooms.next_available   → used as a hint, overridden by tenant lease_end if later
--   properties.code        → property_code
--   tenant_profiles.lease_end  → active tenant move-out date
--   tenant_profiles.room_id    → FK to rooms.id
--   tenant_profiles.is_active  → active tenant filter

create or replace function public.rooms_with_availability()
returns table (
  room_code     text,
  property_code text,
  monthly_rent  numeric,
  room_type     text,
  available_from date
) language sql stable as $$
  select
    r.unit_code                              as room_code,
    p.code                                   as property_code,
    r.price_monthly                          as monthly_rent,
    r.room_type                              as room_type,
    coalesce(
      -- If there is an active tenant with a future lease_end, room opens the day after
      (
        select (max(tp.lease_end) + interval '1 day')::date
        from public.tenant_profiles tp
        where tp.room_id = r.id
          and tp.is_active = true
          and tp.lease_end is not null
          and tp.lease_end >= current_date
      ),
      -- Otherwise fall back to the rooms.next_available hint if it's in the future
      case
        when r.next_available is not null and r.next_available >= current_date
          then r.next_available
        else current_date
      end
    ) as available_from
  from public.rooms r
  join public.properties p on p.id = r.property_id;
$$;

grant execute on function public.rooms_with_availability() to anon, authenticated, service_role;
