-- The staff desk quotes the channel's price, not ours.
--
-- listing_channels, channel_pins, channel_uplift and rooms_for_pin have all
-- existed since 11 Aug and none of them has ever been read by a page. Every
-- channel_pins row still says use_count 0. Meanwhile /staff renders
-- rooms.price_monthly straight off the table, so the two agency partners who
-- actually hold desk PINs, Lili at Awehome and Fiona at Good Life Overseas,
-- have been reading OUR NET PRICE since the day they were let in, with the
-- one-month commission they each negotiated sitting in the database doing
-- nothing. Whatever they quoted their students, we were never going to net
-- what we thought we were netting.
--
-- The missing piece is small and it is here: nothing said which channel a desk
-- PIN belongs to. staff_pins and channel_pins are separate tables with no edge
-- between them, and the PIN values do not match (Lili's desk PIN is 879533 and
-- her channel PIN is 840973), so the link cannot be inferred from the digits.
--
-- Null is the safe default and it means internal. Mark and the captains keep
-- seeing base, because a null channel yields an uplift of exactly 1 and the
-- desk renders the identical number it renders today.

alter table public.staff_pins
  add column if not exists channel_id uuid
    references public.listing_channels(id) on delete set null;

comment on column public.staff_pins.channel_id is
  'Which channel this desk PIN sells on, and therefore which price it is shown. '
  'NULL means internal (Mark, captains): no uplift, quoted at base. ON DELETE '
  'SET NULL rather than CASCADE: deleting a channel must not silently delete '
  'somebody''s access to the desk, it must fall back to base prices.';

create index if not exists staff_pins_channel_idx on public.staff_pins (channel_id);

-- Backfill the three partner desks that already exist. Written as an update
-- guarded on channel_id being null so re-running this migration cannot stamp
-- over a reassignment made later in the admin.
update public.staff_pins p
   set channel_id = c.id
  from public.listing_channels c
 where p.channel_id is null
   and c.slug = case p.pin
                  when '879533' then 'awehome'      -- Lili
                  when '608437' then 'goodlife'     -- Fiona
                  when '745897' then 'welcomestay'  -- Eden Ong, 18 Aug 2026
                end;

-- Mark's own PIN 413172 is deliberately left null. He is not a channel and the
-- desk must keep showing him what a room actually costs us to let.

-- ── the read ────────────────────────────────────────────────────────────────
--
-- RLS is on for listing_channels, so the anon key the booking site ships with
-- cannot select from it. The desk needs six billing fields and nothing else,
-- so it gets exactly those through a definer function rather than a policy
-- opening the whole table to everyone holding the public key.
--
-- An unknown PIN, a disabled PIN, a PIN with no channel, and a PIN whose
-- channel has been disabled all return the empty set rather than raising. Same
-- posture as redeem_staff_pin, housemates_for_staff_pin and rooms_for_pin: the
-- call must never be usable to discover which codes are live, and the caller
-- treats "no row" as "quote at base", which is the safe direction to fail in.
-- Quoting base to a partner costs us their commission on one deal. Quoting an
-- invented uplift to a captain puts a wrong price in front of a real prospect.

create or replace function public.channel_for_staff_pin(p_pin text)
returns table (
  slug              text,
  name              text,
  commission_months numeric,
  commission_pct    numeric,
  fee_fixed         numeric,
  gross_up          boolean
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select c.slug::text,
         c.name::text,
         c.commission_months,
         c.commission_pct,
         c.fee_fixed,
         c.gross_up
    from public.staff_pins p
    join public.listing_channels c on c.id = p.channel_id
   where p.pin = p_pin
     and p.enabled = true
     and c.enabled = true;
$$;

comment on function public.channel_for_staff_pin(text) is
  'The billing terms behind a desk PIN, for pricing the room list. Empty set '
  'for an unknown, disabled or internal PIN, which the desk reads as "quote at '
  'base". Deliberately returns no id and no notes: the desk needs the '
  'arithmetic, not the commercial file.';

revoke all on function public.channel_for_staff_pin(text) from public;
grant execute on function public.channel_for_staff_pin(text) to anon, authenticated;
