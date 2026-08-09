-- Listing content becomes two levels: building, then room.
--
-- A building's address, common areas, house rules and nearby MRT are true for
-- every room in it. Storing them 19 times means editing them 19 times, which
-- means they drift. Set them once on the building and every room underneath
-- inherits.
--
-- The rule that makes inheritance usable: NULL means inherit, empty string
-- means deliberately blank. Without that distinction there is no way to turn
-- an inherited value off, which is the usual trap in this pattern.

begin;

alter table public.listing_profiles
  add column if not exists scope       text not null default 'ROOM',
  add column if not exists property_id uuid references public.properties(id) on delete cascade;

alter table public.listing_profiles
  drop constraint if exists listing_profiles_scope_check;
alter table public.listing_profiles
  add constraint listing_profiles_scope_check check (scope in ('PROPERTY','ROOM'));

-- room_id was NOT NULL UNIQUE, which a property-scoped row cannot satisfy.
alter table public.listing_profiles alter column room_id drop not null;
alter table public.listing_profiles drop constraint if exists listing_profiles_room_id_key;

-- Exactly one target, matching the scope. Enforced rather than trusted,
-- because a profile pointing at both or neither has no defined merge result.
alter table public.listing_profiles
  drop constraint if exists listing_profiles_target_matches_scope;
alter table public.listing_profiles
  add constraint listing_profiles_target_matches_scope check (
    (scope = 'ROOM'     and room_id is not null and property_id is null) or
    (scope = 'PROPERTY' and property_id is not null and room_id is null)
  );

create unique index if not exists listing_profiles_room_key
  on public.listing_profiles (room_id) where room_id is not null;
create unique index if not exists listing_profiles_property_key
  on public.listing_profiles (property_id) where property_id is not null;

comment on column public.listing_profiles.scope is
  'PROPERTY rows hold what is true for every room at that address. ROOM rows '
  'hold what is specific. A platform receives the merge, room over property, '
  'where NULL inherits and empty string is a deliberate blank.';

-- ── Backfill one profile per property ───────────────────────────────────────
insert into public.listing_profiles
  (scope, property_id, title, description, hero_photo, photos, needs_review, fields)
select 'PROPERTY',
       p.id,
       p.name,
       p.description,
       case when jsonb_typeof(p.images) = 'array' and jsonb_array_length(p.images) > 0
            then p.images->>0 end,
       coalesce(case when jsonb_typeof(p.images) = 'array' then p.images end, '[]'::jsonb),
       true,
       jsonb_strip_nulls(jsonb_build_object(
         'address',            p.address,
         'common_areas',       p.common_areas,
         'house_rules',        p.house_rules,
         'nearby_mrt',         p.nearby_mrt,
         'nearby_amenities',   p.nearby_amenities,
         'property_amenities', p.amenities,
         'facilities',         p.facilities,
         'num_bathrooms',      p.num_bathrooms,
         'latitude',           p.latitude,
         'longitude',          p.longitude
       ))
  from public.properties p
 where p.status is null or p.status <> 'INACTIVE'
on conflict do nothing;

-- ── Linkage test state on each channel ──────────────────────────────────────
-- What a test can prove changes as the system grows. Today it can only show
-- that we can reach the platform and that a session is alive; it cannot show
-- that a listing landed correctly until a mapper and read-back exist. The
-- column records which of those was actually checked, so a green tick can
-- never imply more than was done.
alter table public.listing_channels
  add column if not exists last_tested_at timestamptz,
  add column if not exists test_status    text,
  add column if not exists test_kind      text,
  add column if not exists test_result    jsonb not null default '{}'::jsonb;

alter table public.listing_channels drop constraint if exists listing_channels_test_status_check;
alter table public.listing_channels
  add constraint listing_channels_test_status_check
  check (test_status is null or test_status in ('PASS','FAIL','UNTESTED'));

alter table public.listing_channels drop constraint if exists listing_channels_test_kind_check;
alter table public.listing_channels
  add constraint listing_channels_test_kind_check
  check (test_kind is null or test_kind in ('REACHABILITY','SESSION','ROUND_TRIP'));

comment on column public.listing_channels.test_kind is
  'What the last test actually proved. REACHABILITY: the platform answered. '
  'SESSION: we are logged in. ROUND_TRIP: a listing was written and read back '
  'correctly. Recorded so a pass can never imply more than was checked.';

commit;
