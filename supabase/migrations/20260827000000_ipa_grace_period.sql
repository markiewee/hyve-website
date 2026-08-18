-- An IPA is a promise of a pass, not a pass.
--
-- In-Principle Approval is the letter MOM or ICA issues before the real card
-- exists. It is a fine thing to move in on and a bad thing to still be holding
-- three months later, because the card is what proves someone may be in
-- Singapore, and the IPA's own expiry date says nothing about whether the
-- holder ever collected it.
--
-- Mark's rule: two weeks from arrival to produce the real pass, then the same
-- daily chase an expired pass gets. The clock runs from moved_in_at, not from
-- when the row was created, because someone who signs in July for a September
-- move-in has not arrived yet and has nothing to collect.
--
-- Two people are on an IPA today. Ilse moved in on 5 Aug and is 13 days in, so
-- she is chased from tomorrow. Julia does not move in until 8 Sep, so her clock
-- has not started and this correctly leaves her alone until 22 Sep.
--
-- It stops when pass_type stops being an IPA, which is what uploading the real
-- card at /portal/pass does. Matching is on ilike '%IPA%' rather than equality
-- because the pass type is free text on the admin form and one of the two rows
-- on file reads "Student Pass (IPA granted, not yet issued)".

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
    select tp.id as tenant_profile_id,
           td.pass_type,
           td.pass_expiry,
           case
             when td.pass_type ilike '%IPA%' then 'IPA_GRACE_ELAPSED'
             else 'EXPIRED'
           end as reason,
           case
             when td.pass_type ilike '%IPA%'
               then (current_date - tp.moved_in_at::date)
             else (current_date - td.pass_expiry)
           end as days_over
      from public.tenant_details td
      join public.tenant_profiles tp on tp.id = td.tenant_profile_id
     where tp.is_active
       and tp.archived_at is null
       and td.pass_type is not null
       -- Someone we cannot email is a job for a human, not a daily no-op.
       and coalesce(td.email, '') <> ''
       and (
         -- A real pass whose date has passed.
         (td.pass_type not ilike '%IPA%'
          and td.pass_expiry is not null
          and td.pass_expiry < current_date)
         or
         -- An IPA still on file more than two weeks after the tenant arrived.
         -- Deliberately ignores pass_expiry: an IPA valid until December is
         -- still not the document we are required to hold.
         (td.pass_type ilike '%IPA%'
          and tp.moved_in_at is not null
          and tp.moved_in_at::date <= current_date - interval '14 days')
       )
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
                     'reason',       t.reason,
                     'days_expired', t.days_over)));
    n := n + 1;
  end loop;
  return n;
end;
$$;

comment on function public.fn_chase_expired_passes() is
  'Daily chase for a pass we should have and do not: an expired card, or an IPA still on file more than 14 days after the tenant moved in.';
