-- Chase an unsigned licence agreement every day until it is signed.
--
-- The portal no longer lets a tenant walk past their own agreement: the
-- "Skip for now" link is gone from the screen that has a signable PDF on it,
-- and the Continue button only appears once ta_signed_at is set. But that
-- only catches someone who opens the portal, and the people who most need to
-- sign are exactly the people who stopped opening it. Edward has been in
-- IH-PR2 since October 2025 on an unsigned agreement. Nothing was going to
-- tell him.
--
-- So: one email a day, to the tenant, copied to the ops inbox by the sender
-- itself, for as long as the agreement sits unsigned. There is no snooze and
-- no "sent already" flag on purpose. It stops the moment ta_signed_at is set,
-- which is exactly what signing does, so the way to make this email stop is
-- to sign the thing it is about.
--
-- Three exclusions, each of them the whole point:
--
--   1. No document, no chase. Nine active tenants have no ta_document_url at
--      all. That is our gap, not theirs, and mailing someone daily to sign a
--      document we never uploaded would blame them for our own backlog.
--
--   2. TENANT_SIGNED is not chased. That tenant has done their part and we
--      owe the counter-signature. TG-PR1 is in exactly that state today.
--      Chasing them daily for our own outstanding work is indefensible.
--
--   3. Someone we cannot email is a job for a human, not a daily no-op.
--
-- And a timing rule: we start seven days out from move-in, not the moment the
-- document lands. Someone whose move-in is three weeks away has time, and a
-- daily email over that stretch teaches them to filter us out before the
-- week that actually matters.

create or replace function public.fn_chase_unsigned_ta()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  n integer := 0;
begin
  for t in
    select tp.id  as tenant_profile_id,
           tp.moved_in_at::date as moved_in_at,
           r.unit_code,
           p.name as property_name,
           (current_date - tp.moved_in_at::date) as days_outstanding,
           ((current_date - tp.moved_in_at::date) >= 0) as has_moved_in
      from public.onboarding_progress op
      join public.tenant_profiles tp on tp.id = op.tenant_profile_id
      join public.tenant_details  td on td.tenant_profile_id = tp.id
      left join public.rooms      r  on r.id = tp.room_id
      left join public.properties p  on p.id = r.property_id
     where tp.is_active
       and tp.archived_at is null
       -- Only where a document actually exists to be signed.
       and op.ta_document_url is not null
       -- The TENANT has not signed. Excludes TENANT_SIGNED, where the ball is
       -- on our side of the net.
       and op.ta_signed_at is null
       and coalesce(op.signing_status, 'UNSIGNED') = 'UNSIGNED'
       -- Someone we cannot email is a job for a human, not a daily no-op.
       and coalesce(td.email, '') <> ''
       -- From a week before move-in, and every day after it.
       and tp.moved_in_at is not null
       and tp.moved_in_at::date <= current_date + interval '7 days'
  loop
    perform net.http_post(
      url     := 'https://diiilqpfmlxjwiaeophb.supabase.co/functions/v1/notify-tenant',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'Authorization', 'Bearer ' || (
                     select decrypted_secret from vault.decrypted_secrets
                      where name = 'SERVICE_ROLE_KEY')),
      body    := jsonb_build_object(
                   'event_type', 'TA_UNSIGNED',
                   'tenant_profile_id', t.tenant_profile_id,
                   'details', jsonb_build_object(
                     'days_outstanding', t.days_outstanding,
                     'moved_in_at',      t.moved_in_at,
                     'unit_code',        t.unit_code,
                     'property_name',    t.property_name,
                     'has_moved_in',     t.has_moved_in)));
    n := n + 1;
  end loop;
  return n;
end;
$$;

select cron.unschedule('chase-unsigned-ta')
 where exists (select 1 from cron.job where jobname = 'chase-unsigned-ta');

-- 02:00 UTC is 10:00 Singapore. Half an hour clear of the expired-pass chaser
-- at 01:30 UTC, so a tenant who owes us both documents gets two separate
-- emails rather than two at the same instant.
select cron.schedule(
  'chase-unsigned-ta',
  '0 2 * * *',
  $cron$ select public.fn_chase_unsigned_ta(); $cron$
);
