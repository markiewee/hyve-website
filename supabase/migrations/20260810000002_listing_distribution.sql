-- Listing distribution: publish Lazybee rooms to external platforms and keep
-- them correct afterwards.
--
-- The problem is not getting listed. Mark signs the agreements. The problem is
-- that once eleven platforms hold a copy of our inventory, every price change,
-- every let room and every new photo set has to be applied in eleven places by
-- hand, so it is not applied, so we quote one price on lazybee.sg and another
-- on Roomz and show a room as available three weeks after it was taken.
--
-- Deliberately generic. Marketing fields live in a jsonb `fields` column rather
-- than as typed columns, because we do not yet know the full field set: the
-- authoritative lists sit behind each platform's landlord signup. Adding a
-- field later must not require a migration.

begin;

-- ── Channels ────────────────────────────────────────────────────────────────
create table if not exists public.listing_channels (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,

  -- How we talk to it. Aggregators like Nestpick ingest feeds; most classifieds
  -- need a browser. Knowing this per channel stops us writing a Playwright
  -- adapter for something that accepts a feed.
  mechanism      text not null default 'browser'
                 check (mechanism in ('browser', 'feed', 'api')),

  -- Gross-up, per Mark 9 Aug: one net price on the room, and a channel taking
  -- commission is listed higher so the net is unchanged. Stored as a rule, not
  -- a price, so a commission change is one row and never a 19-row rewrite.
  commission_pct numeric(5,2),
  gross_up       boolean not null default true,

  -- OFF until a human turns it on. Nothing can post to a channel that has not
  -- had its mapper verified by reading the listing back.
  enabled        boolean not null default false,

  -- Rate limits, photo counts, field length caps. Shape differs per platform
  -- and is discovered as we go, so it is not columns.
  config         jsonb not null default '{}'::jsonb,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on column public.listing_channels.enabled is
  'Kill switch. Defaults false so a newly added channel can never be pushed to '
  'before someone has verified its mapper by reading a listing back.';

-- ── Marketing profile, one per lettable room ────────────────────────────────
-- Separate from `rooms` on purpose: rooms is operational truth, edited daily by
-- ops. This is what the world sees. An ops edit must not silently change our
-- public copy, and a marketing edit must not touch availability.
create table if not exists public.listing_profiles (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null unique references public.rooms(id) on delete cascade,

  title        text,
  description  text,
  hero_photo   text,
  photos       jsonb not null default '[]'::jsonb,

  -- Everything else. bills_included, tenant_preference, amenity vocabulary,
  -- description variants, whatever the next platform turns out to want.
  fields       jsonb not null default '{}'::jsonb,

  -- Backfilled titles are generated, not written. Flagged rather than shipped.
  needs_review boolean not null default false,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on column public.listing_profiles.fields is
  'Open bag for marketing fields. Generic on purpose: the authoritative field '
  'list for most platforms sits behind their landlord signup, so adding one '
  'must not need a migration.';

-- ── Placements: one room on one channel ─────────────────────────────────────
-- This is the table that makes failure visible. The recurring defect in this
-- codebase is a job that runs, does nothing and reports success.
create table if not exists public.listing_placements (
  id                uuid primary key default gen_random_uuid(),
  room_id           uuid not null references public.rooms(id) on delete cascade,
  channel_id        uuid not null references public.listing_channels(id) on delete cascade,

  external_id       text,
  url               text,

  status            text not null default 'NOT_LISTED'
                    check (status in ('NOT_LISTED','PENDING','LIVE','PAUSED','ERROR')),

  last_pushed_at    timestamptz,
  last_verified_at  timestamptz,
  -- What the channel showed that disagreed with us at the last read-back.
  -- Empty object means verified and in agreement.
  last_drift        jsonb not null default '{}'::jsonb,
  last_error        text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (room_id, channel_id)
);

comment on column public.listing_placements.last_drift is
  'Difference between our truth and what the channel actually displays, from '
  'the last read-back. Non-empty means the listing is wrong right now.';

create index if not exists listing_placements_drift_idx
  on public.listing_placements (channel_id)
  where last_drift <> '{}'::jsonb;

-- ── Timestamps ──────────────────────────────────────────────────────────────
drop trigger if exists trg_listing_channels_updated_at on public.listing_channels;
create trigger trg_listing_channels_updated_at
  before update on public.listing_channels
  for each row execute function public.update_updated_at();

drop trigger if exists trg_listing_profiles_updated_at on public.listing_profiles;
create trigger trg_listing_profiles_updated_at
  before update on public.listing_profiles
  for each row execute function public.update_updated_at();

drop trigger if exists trg_listing_placements_updated_at on public.listing_placements;
create trigger trg_listing_placements_updated_at
  before update on public.listing_placements
  for each row execute function public.update_updated_at();

-- ── RLS: admin only ─────────────────────────────────────────────────────────
alter table public.listing_channels   enable row level security;
alter table public.listing_profiles   enable row level security;
alter table public.listing_placements enable row level security;

do $$
declare t text;
begin
  foreach t in array array['listing_channels','listing_profiles','listing_placements'] loop
    execute format('drop policy if exists "Admin manage %1$s" on public.%1$I', t);
    execute format($p$
      create policy "Admin manage %1$s" on public.%1$I for all
      using (exists (
        select 1 from public.tenant_profiles tp
         where tp.user_id = auth.uid()
           and tp.role = any (array['ADMIN','SUPER_ADMIN'])
           and tp.is_active = true))
    $p$, t);
  end loop;
end $$;

-- ── Seed the 11 channels, every one disabled ────────────────────────────────
-- commission_pct stays null until Mark signs and knows the real number. Null
-- means "unknown", which the gross-up treats as "do not publish", not as zero.
insert into public.listing_channels (slug, name, mechanism, config) values
  ('hozuko',           'Hozuko',           'browser', '{"region":"SG","note":"co-living aggregator, open to all operators"}'),
  ('rentinsingapore',  'RentInSingapore',  'browser', '{"region":"SG"}'),
  ('roomz',            'Roomz.asia',       'browser', '{"region":"SG/Asia"}'),
  ('housinganywhere',  'HousingAnywhere',  'browser', '{"region":"global","note":"has a channel-manager integration, check before automating"}'),
  ('spotahome',        'Spotahome',        'browser', '{"region":"EU","note":"confirm Singapore coverage before building an adapter"}'),
  ('uniplaces',        'Uniplaces',        'browser', '{"region":"EU/AU/ZA"}'),
  ('nestpick',         'Nestpick',         'feed',    '{"region":"global","note":"aggregator, ingests partner feeds; likely not a browser problem"}'),
  ('flatio',           'Flatio',           'browser', '{"region":"global","note":"already has a Singapore section"}'),
  ('homelike',         'Homelike',         'browser', '{"region":"EU/NYC","note":"corporate lets"}'),
  ('wunderflats',      'Wunderflats',      'browser', '{"region":"DE"}'),
  ('anyplace',         'Anyplace',         'browser', '{"region":"US/nomad"}')
on conflict (slug) do nothing;

-- ── Backfill a marketing profile for every lettable room ────────────────────
-- Non-lettable rows (CP-COMMON, kitchens, toilets, yards) carry a null
-- room_type and are excluded: they are not listings.
insert into public.listing_profiles (room_id, title, description, hero_photo, photos, needs_review, fields)
select
  r.id,
  -- A generated placeholder, not a decision. rooms.name is internal
  -- ("CP Premium Room 2") and must never reach a platform, so the title is
  -- flagged for review rather than silently published.
  concat_ws(' ', initcap(replace(coalesce(r.room_type,'room'),'_',' ')),
                 'in', p.name),
  r.description,
  case when jsonb_typeof(r.photos) = 'array' and jsonb_array_length(r.photos) > 0
       then r.photos->>0 end,
  coalesce(case when jsonb_typeof(r.photos) = 'array' then r.photos end, '[]'::jsonb),
  true,
  jsonb_strip_nulls(jsonb_build_object(
    'bed_size',             r.bed_size,
    'size_sqm',             r.size_sqm,
    'max_occupancy',        r.max_occupancy,
    'private_bathroom',     r.has_private_bathroom,
    'aircon',               r.has_aircon,
    'furnishing_level',     r.furnishing_level,
    'min_stay_months',      r.min_stay_months,
    'deposit_months',       r.deposit_months,
    'room_amenities',       r.amenities,
    'property_amenities',   p.amenities,
    'nearby_mrt',           p.nearby_mrt,
    'house_rules',          p.house_rules,
    'address',              p.address,
    -- Both implicit everywhere in the codebase today. Explicit before anything
    -- is pushed, because a platform that assumes weekly would be a disaster.
    'currency',             'SGD',
    'price_period',         'monthly',
    'bills_included',       true
  ))
from public.rooms r
join public.properties p on p.id = r.property_id
where r.room_type is not null
  and r.price_monthly > 0
on conflict (room_id) do nothing;

commit;
