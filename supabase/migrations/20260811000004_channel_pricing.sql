-- Channel pricing.
--
-- listing_channels shipped in 20260811000001 with commission_pct, gross_up and
-- enabled already on it, but nothing ever populated them: commission_pct is
-- null on all sixteen rows, and the two channels that carry the most volume,
-- direct and agent, do not exist at all. This makes the columns usable.
--
-- Why a second commission column rather than reusing commission_pct: the
-- Singapore agent convention is a number of MONTHS' rent, and that cannot be
-- expressed as a percentage of monthly rent without knowing the lease length.
-- One month on a twelve month lease is 8.33% of the annual rent; the same one
-- month on a six month lease is 16.67%. A single percentage silently gets this
-- wrong on every lease that is not twelve months.
--
-- The arithmetic lives in supabase/functions/_shared/channelPricing.js, tested
-- with node --test. Nothing here writes a price back to rooms: rooms.price_monthly
-- stays the one base price and every quote is derived from it at read time.

alter table public.listing_channels
  add column if not exists commission_months numeric,
  add column if not exists fee_fixed         numeric,
  add column if not exists notes             text;

comment on column public.listing_channels.commission_months is
  'Agents: months of rent taken once on signing (SG convention is 1 month on a '
  '12 month lease, pro-rata below that). Mutually exclusive with commission_pct.';
comment on column public.listing_channels.commission_pct is
  'Platforms: fraction of rent taken for the life of the booking, 0.15 = 15%. '
  'Mutually exclusive with commission_months.';
comment on column public.listing_channels.fee_fixed is
  'Flat fee per booking, in SGD. Spread across the lease, not charged monthly.';
comment on column public.listing_channels.gross_up is
  'true: the cost is added on top so we net the base price. false: we absorb it.';
comment on column public.listing_channels.notes is
  'Why this number. A rate nobody can explain is a rate nobody can defend.';

-- A channel bills one way or the other. Both set would compound two different
-- uplifts and produce a price nobody could account for, so it is refused at the
-- database rather than resolved by a guess in application code.
alter table public.listing_channels
  drop constraint if exists listing_channels_one_commission_mechanism;
alter table public.listing_channels
  add constraint listing_channels_one_commission_mechanism
  check (
    commission_months is null
    or commission_pct is null
    or commission_months = 0
    or commission_pct = 0
  );

-- Ranges. A percentage at or above 1 makes the gross-up divide by zero or go
-- negative; a negative commission would quote below base.
alter table public.listing_channels
  drop constraint if exists listing_channels_commission_ranges;
alter table public.listing_channels
  add constraint listing_channels_commission_ranges
  check (
    (commission_pct    is null or (commission_pct >= 0 and commission_pct < 1))
    and (commission_months is null or commission_months >= 0)
    and (fee_fixed         is null or fee_fixed >= 0)
  );

-- `mechanism` describes how we PUBLISH a listing to a channel: browser
-- automation, a feed, or an API. Direct and agent are sales routes we never
-- publish to at all, so neither of the three fits. 'none' says that plainly,
-- rather than mislabelling them 'browser' and leaving a worker to wonder why
-- it has nothing to drive.
alter table public.listing_channels
  drop constraint if exists listing_channels_mechanism_check;
alter table public.listing_channels
  add constraint listing_channels_mechanism_check
  check (mechanism = any (array['browser'::text, 'feed'::text, 'api'::text, 'none'::text]));

-- The two channels that were missing. Direct costs nothing to sell through and
-- is the reference price. Agent carries one month, grossed up, per Mark 10 Aug.
insert into public.listing_channels (slug, name, mechanism, commission_months, gross_up, enabled, notes)
values
  ('direct', 'Direct',  'none', 0, false, true,
   'The base price. book.lazybee.sg and WhatsApp. No cost to sell through, so no uplift.'),
  ('agent',  'Agent',   'none', 1, true,  true,
   'Singapore convention: one month of the quoted rent on a 12 month lease, pro-rata '
   'below that. Grossed up so the commission is genuinely external and we still net base.')
on conflict (slug) do update
  set commission_months = excluded.commission_months,
      gross_up          = excluded.gross_up,
      notes             = excluded.notes;

-- The sixteen existing platform rows keep commission_pct null on purpose. A null
-- reads as "we have not confirmed this platform's cut yet" and prices at base,
-- which is the safe direction to be wrong in. Each gets its real number as it
-- goes live, rather than a guess baked in here.
update public.listing_channels
   set notes = coalesce(notes, 'Commission not yet confirmed. Quotes at base until set.')
 where commission_pct is null
   and commission_months is null
   and slug not in ('direct', 'agent');
