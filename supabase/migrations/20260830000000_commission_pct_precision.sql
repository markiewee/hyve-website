-- commission_pct could not hold the rate an agent actually asked for.
--
-- The column is numeric(5,2), so it stores two decimal places and nothing
-- finer. That is enough for a round platform rate like 0.15, and it silently
-- destroys anything expressed as a fraction of a year.
--
-- Fiona at Good Life Overseas quoted her terms on 11 Aug as one month's rent on
-- a twelve month contract, half a month on six, and a quarter on three. Those
-- are not three rates, they are one: 1/12, 0.5/6 and 0.25/3 are all exactly
-- 8.3333%. Storing that in numeric(5,2) rounds it to 0.08, which is 8%, and
-- quietly pays her four percent less than the number she gave us. A rounding
-- rule that shaves somebody's commission is the kind of error that is found
-- months later by the person losing the money.
--
-- Six decimal places, so a fraction of a year survives being written down.
-- The existing check constraint (0 <= pct < 1) is unaffected and stays.

alter table public.listing_channels
  alter column commission_pct type numeric(8,6);

comment on column public.listing_channels.commission_pct is
  'Fraction of rent taken for the life of the booking, 0.15 = 15%. Six decimal '
  'places because rates are often a fraction of a year: one month per twelve is '
  '0.083333, and rounding that to two places underpays the agent. Mutually '
  'exclusive with commission_months.';
