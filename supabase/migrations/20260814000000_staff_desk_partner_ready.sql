-- The staff room desk now has a channel partner sitting in it.
--
-- A dedicated staff PIN was issued to a Chinese rental aggregator so they can
-- evaluate our inventory. Two consequences, both handled here.
--
-- First, free text. Property and room descriptions are English columns, so a
-- reader on the Chinese toggle still met an English paragraph in the middle of
-- an otherwise translated page. roomVocab.js cannot help: it maps a small closed
-- vocabulary, and a description is prose. The translation is stored rather than
-- machine-made at read time, because a translation API means a paid key and a
-- thirteenth serverless function, and this repo is at the Hobby-plan cap of 12.
--
-- Second, the roster. The desk reads tenant_profiles straight from the browser
-- and that table's only policy is admin-only, so a PIN holder saw an empty box.
-- Mark wants nationality visible, and names not. Hence the function below,
-- written to the standard rooms_for_pin sets for itself: a leaked PIN is a
-- commercial annoyance and must never be able to become anything worse.

alter table public.properties add column if not exists description_zh text;
alter table public.rooms      add column if not exists description_zh text;
alter table public.properties add column if not exists house_rules_zh jsonb;

comment on column public.properties.description_zh is
  'Simplified Chinese description. Null falls back to description at read time, '
  'so an untranslated row degrades to English rather than to a blank.';
comment on column public.rooms.description_zh is
  'Simplified Chinese description. Null falls back to description at read time.';
comment on column public.properties.house_rules_zh is
  'Simplified Chinese house rules, same array order as house_rules.';

-- ── the roster a PIN holder may see ─────────────────────────────────────────
--
-- Nationality, gender and when the room next changes hands. That is what a
-- prospective housemate actually asks about, and it is the most that can be
-- shown to someone holding a six digit code.
--
-- What is deliberately absent: full_name, username, any ID or passport field,
-- monthly_rent, user_id, email, phone. housematesForPin.test.js pins this
-- column list, so widening it is a build failure rather than a quiet leak.

create or replace function public.housemates_for_staff_pin(p_pin text)
returns table (
  property_id uuid,
  unit_code   text,
  nationality text,
  gender      text,
  lease_end   date
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- An unknown or disabled PIN returns an empty set rather than raising, so the
  -- call cannot be used to discover which codes are live. Same posture as
  -- redeem_staff_pin and rooms_for_pin.
  if not exists (
    select 1 from public.staff_pins where pin = p_pin and enabled = true
  ) then
    return;
  end if;

  return query
  select r.property_id,
         r.unit_code::text,
         td.nationality::text,
         tp.gender::text,
         tp.lease_end::date
    from public.tenant_profiles tp
    join public.rooms r on r.id = tp.room_id
    -- left join: a tenant with no details row is still a housemate, and the
    -- front end renders the missing nationality as "not provided".
    left join public.tenant_details td on td.tenant_profile_id = tp.id
   where tp.is_active
     and tp.archived_at is null
   order by r.unit_code;
end;
$$;

comment on function public.housemates_for_staff_pin(text) is
  'Anonymised housemate roster for a valid staff PIN: nationality, gender and '
  'lease end only. Never names or identity documents.';

grant execute on function public.housemates_for_staff_pin(text) to anon, authenticated;
