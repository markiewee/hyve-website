-- Chase an expired pass every day until it is fixed.
--
-- The portal now shows a tenant with a stale pass an unmissable banner, but a
-- banner only works on someone who opens the portal. Janella's Student Pass
-- expired on 13 Aug 2026 and the first thing that noticed was a query we ran
-- on 18 Aug. Nothing was going to tell her.
--
-- So: one email a day, to the tenant, copied to the ops inbox by the sender
-- itself, for as long as the pass is expired. It stops on its own the moment
-- pass_expiry moves into the future, which happens when the tenant uploads a
-- renewal at /portal/pass. There is no snooze and no "sent already" flag on
-- purpose. The way to make this email stop is to fix the thing it is about.
--
-- Deliberately only fires on genuinely EXPIRED passes. Two active tenants have
-- a pass type on file with no expiry date at all, which is a hole in our
-- records rather than proof their pass is invalid, and mailing them daily on
-- that basis would be wrong. The portal banner already asks them, because
-- asking someone once when they are already looking is proportionate and a
-- daily email is not.

create or replace function public.fn_chase_expired_passes()
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
           td.pass_type,
           td.pass_expiry,
           (current_date - td.pass_expiry) as days_expired
      from public.tenant_details td
      join public.tenant_profiles tp on tp.id = td.tenant_profile_id
     where tp.is_active
       and tp.archived_at is null
       and td.pass_type is not null
       and td.pass_expiry is not null
       and td.pass_expiry < current_date
       -- Someone we cannot email is a job for a human, not a daily no-op.
       and coalesce(td.email, '') <> ''
  loop
    perform net.http_post(
      url     := 'https://diiilqpfmlxjwiaeophb.supabase.co/functions/v1/notify-tenant',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'Authorization', 'Bearer ' || (
                     select decrypted_secret from vault.decrypted_secrets
                      where name = 'SERVICE_ROLE_KEY')),
      body    := jsonb_build_object(
                   'event_type', 'PASS_EXPIRED',
                   'tenant_profile_id', t.tenant_profile_id,
                   'details', jsonb_build_object(
                     'pass_type',    t.pass_type,
                     'pass_expiry',  t.pass_expiry,
                     'days_expired', t.days_expired)));
    n := n + 1;
  end loop;
  return n;
end;
$$;

select cron.unschedule('chase-expired-passes')
 where exists (select 1 from cron.job where jobname = 'chase-expired-passes');

-- 01:30 UTC is 09:30 Singapore. A document chore lands better at the start of
-- a working day than at midnight, and it keeps this off the hour where rent
-- and late fees already run.
select cron.schedule(
  'chase-expired-passes',
  '30 1 * * *',
  $cron$ select public.fn_chase_expired_passes(); $cron$
);
