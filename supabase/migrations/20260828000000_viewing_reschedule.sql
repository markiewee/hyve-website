-- Let a prospect move a viewing instead of losing it.
--
-- Today the only self-serve action on a viewing is cancel, and the link that
-- offers it has been returning 404 since it was written: every confirmation and
-- every day-before reminder we have sent points at /book/cancel, which resolves
-- to book.lazybee.sg/cancel, which does not exist. So a prospect whose Saturday
-- stops working has no way to say so except messaging us, and the common
-- outcome is a no-show we find out about by standing in a lobby.
--
-- Cancelling is also the wrong default. Someone who cannot make Saturday has
-- not stopped wanting the room. Offering "move it" first keeps the lead;
-- offering "cancel" first throws it away.
--
-- reschedule_count exists to stop churn without a human watching. Three moves
-- is generous for a real diary clash and past the point where a captain should
-- keep holding Saturdays open on faith.

alter table public.property_viewings
  add column if not exists reschedule_count integer not null default 0,
  add column if not exists rescheduled_at   timestamptz;

comment on column public.property_viewings.reschedule_count is
  'How many times the prospect has moved this viewing themselves. Capped in the API.';
comment on column public.property_viewings.rescheduled_at is
  'When it was last moved. Null for a viewing still on the slot it was booked into.';
