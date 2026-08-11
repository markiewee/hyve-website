-- CRM + maintenance write path.
--
-- Why this exists: as of 11 Aug 2026 the reply brain answers a prospect on
-- WhatsApp, records an outcome event on the board feed, and then nothing
-- lands anywhere durable. The `leads` table is untouched by the brain and a
-- maintenance complaint raises no ticket at all. The board can say "moved to
-- CRM" only as narration. This migration gives both a real row to land in.
--
-- Two hard facts from the live data shaped it:
--
--   1. maintenance_tickets.submitted_by is NOT NULL and references a portal
--      account, which is exactly why a WhatsApp report cannot become a
--      ticket today. A tenant reported the CP side door in the house group
--      this week and it died there. Hence reporter_phone + a nullable
--      submitted_by: the reporter is a person, not necessarily a login.
--
--   2. Of 239 leads only 97 carry a phone, and several of those are not
--      phones at all: 3776541599, 90070873755 and friends are WhatsApp LID
--      privacy identifiers. So "the phone number is the person" cannot be a
--      blind unique constraint on `phone`. We normalise real numbers into
--      phone_e164 and keep platform handles in `identifiers`, and the write
--      path does the matching. No unique index yet, deliberately: there is
--      one genuine duplicate pair in production (+6597239695) and merging
--      two real customer records is Mark's call, not a migration's.
--
-- Everything here is additive and idempotent. No column is dropped, no
-- existing value is rewritten except a backfill that only fills NULLs.

-- ── leads: the CRM record ────────────────────────────────────────────

alter table public.leads
  -- The key, once it is knowable. Null until a real number appears.
  add column if not exists phone_e164 text,
  -- Platform handles and LID aliases that resolve to this person. The first
  -- WhatsApp touch merges a platform thread into the row that already exists.
  add column if not exists identifiers text[] not null default '{}',
  -- ACTIVE lives in the pipeline; STORED is parked but not dead, and carries
  -- a typed condition that a nightly sweep can actually evaluate.
  add column if not exists lifecycle text not null default 'ACTIVE',
  add column if not exists activation_condition jsonb,
  add column if not exists activation_checked_at timestamptz,
  -- Qualification facts the brain already asks for and then forgets.
  add column if not exists budget_monthly numeric(10,2),
  add column if not exists move_in date,
  add column if not exists move_out date,
  add column if not exists occupants smallint,
  add column if not exists location_preference text,
  -- prospect | tenant | AGENT. AGENT unlocks the concierge lane: a partner
  -- number that may submit and onboard on someone else's behalf.
  add column if not exists role text not null default 'prospect',
  add column if not exists next_action text,
  add column if not exists next_action_due timestamptz,
  -- Attribution, so commission math stays automatic.
  add column if not exists channel_id uuid references public.listing_channels(id),
  -- Same idempotency contract as /bookings and /booking-requests.
  add column if not exists idempotency_key text;

alter table public.leads drop constraint if exists leads_lifecycle_check;
alter table public.leads add constraint leads_lifecycle_check
  check (lifecycle in ('ACTIVE','STORED'));

alter table public.leads drop constraint if exists leads_role_check;
alter table public.leads add constraint leads_role_check
  check (role in ('prospect','tenant','AGENT'));

-- A stored lead with no condition is just a lead nobody will look at again.
alter table public.leads drop constraint if exists leads_stored_needs_condition;
alter table public.leads add constraint leads_stored_needs_condition
  check (lifecycle <> 'STORED' or activation_condition is not null);

-- Conservative E.164 normaliser. Anything it cannot vouch for returns NULL
-- rather than a guess: a wrong number in the key column silently merges two
-- different people, which is far worse than an unmatched row.
create or replace function public.fn_normalise_phone(raw text)
returns text language plpgsql immutable as $$
declare d text;
begin
  if raw is null then return null; end if;
  d := regexp_replace(raw, '[^0-9+]', '', 'g');
  if d = '' then return null; end if;
  -- Already international.
  if left(d,1) = '+' then
    if length(d) between 8 and 16 then return d; end if;
    return null;
  end if;
  -- Singapore local: 8 digits opening 6, 8 or 9.
  if length(d) = 8 and left(d,1) in ('6','8','9') then return '+65' || d; end if;
  -- Singapore with country code but no plus.
  if length(d) = 10 and left(d,2) = '65' and substr(d,3,1) in ('6','8','9') then return '+' || d; end if;
  -- Malaysia with country code but no plus.
  if length(d) between 11 and 12 and left(d,2) = '60' then return '+' || d; end if;
  -- Everything else (notably WhatsApp LIDs like 90070873755) is not a phone.
  return null;
end $$;

update public.leads
   set phone_e164 = public.fn_normalise_phone(phone)
 where phone_e164 is null and phone is not null;

create index if not exists leads_phone_e164_idx on public.leads (phone_e164) where phone_e164 is not null;
create index if not exists leads_lifecycle_idx on public.leads (lifecycle);
create index if not exists leads_identifiers_idx on public.leads using gin (identifiers);
create index if not exists leads_chat_id_idx on public.leads (chat_id) where chat_id is not null;
create unique index if not exists leads_channel_idempotency_idx
  on public.leads (channel_id, idempotency_key)
  where idempotency_key is not null;

-- ── maintenance_tickets: report to resolved ──────────────────────────

-- The blocker, removed. A report from a house WhatsApp group is a real
-- report; requiring a portal login to record one is why they die in chat.
alter table public.maintenance_tickets alter column submitted_by drop not null;
-- Shared-space faults (a lift, a corridor light, the gate) belong to a
-- property and no single room.
alter table public.maintenance_tickets alter column room_id drop not null;

alter table public.maintenance_tickets
  add column if not exists reporter_phone text,
  add column if not exists reporter_name text,
  -- Severity is the clock. Category says what broke; severity says by when.
  add column if not exists severity text not null default 'ROUTINE',
  add column if not exists due_at timestamptz,
  add column if not exists triaged_at timestamptz,
  add column if not exists scheduled_for timestamptz,
  add column if not exists access_note text,
  -- Tenant-caused damage becomes a line on their invoice.
  add column if not exists charge_to_tenant boolean not null default false,
  add column if not exists charge_amount numeric(10,2),
  -- The 48h auto-chase needs to know when it last nudged and how often, or
  -- it becomes the thing that harasses a contractor every ten minutes.
  add column if not exists last_chased_at timestamptz,
  add column if not exists chase_count smallint not null default 0,
  add column if not exists lead_id uuid references public.leads(id),
  add column if not exists channel_id uuid references public.listing_channels(id),
  add column if not exists idempotency_key text,
  add column if not exists source text;

alter table public.maintenance_tickets drop constraint if exists maintenance_tickets_severity_check;
alter table public.maintenance_tickets add constraint maintenance_tickets_severity_check
  check (severity in ('URGENT','HIGH','ROUTINE','COSMETIC'));

-- Superset of the live enum: every existing row stays valid. TRIAGED,
-- SCHEDULED and AWAITING_PROOF are the states the closing chain needs, and
-- WAITING_PARTS is the honest parking state that stops a blocked ticket
-- from looking abandoned.
alter table public.maintenance_tickets drop constraint if exists maintenance_tickets_status_check;
alter table public.maintenance_tickets add constraint maintenance_tickets_status_check
  check (status in ('OPEN','ACKNOWLEDGED','TRIAGED','SCHEDULED','IN_PROGRESS',
                    'AWAITING_PROOF','WAITING_PARTS','ESCALATED','RESOLVED'));

-- A ticket must be attributable to somebody: a portal account or a phone.
alter table public.maintenance_tickets drop constraint if exists maintenance_tickets_has_reporter;
alter table public.maintenance_tickets add constraint maintenance_tickets_has_reporter
  check (submitted_by is not null or reporter_phone is not null);

create index if not exists maintenance_tickets_open_idx
  on public.maintenance_tickets (status, due_at)
  where status <> 'RESOLVED';
create index if not exists maintenance_tickets_reporter_phone_idx
  on public.maintenance_tickets (reporter_phone) where reporter_phone is not null;
create unique index if not exists maintenance_tickets_channel_idempotency_idx
  on public.maintenance_tickets (channel_id, idempotency_key)
  where idempotency_key is not null;

-- Severity to deadline, in one place so the API, the chaser and the board
-- can never disagree about when a ticket is late.
create or replace function public.fn_ticket_due_at(sev text, from_ts timestamptz)
returns timestamptz language sql immutable as $$
  select case upper(coalesce(sev,'ROUTINE'))
    when 'URGENT'   then from_ts + interval '4 hours'
    when 'HIGH'     then from_ts + interval '48 hours'
    when 'ROUTINE'  then from_ts + interval '7 days'
    when 'COSMETIC' then from_ts + interval '30 days'
    else from_ts + interval '7 days'
  end
$$;

create or replace function public.fn_ticket_set_due() returns trigger
language plpgsql as $$
begin
  -- Only ever fills a gap or follows a severity change; never overwrites a
  -- deadline somebody set by hand.
  if new.due_at is null or (tg_op = 'UPDATE' and new.severity is distinct from old.severity) then
    new.due_at := public.fn_ticket_due_at(new.severity, coalesce(new.created_at, now()));
  end if;
  return new;
end $$;

drop trigger if exists trg_ticket_set_due on public.maintenance_tickets;
create trigger trg_ticket_set_due
  before insert or update of severity on public.maintenance_tickets
  for each row execute function public.fn_ticket_set_due();

update public.maintenance_tickets
   set due_at = public.fn_ticket_due_at(severity, created_at)
 where due_at is null;

-- ── the overdue view the chaser and the board both read ──────────────
create or replace view public.v_tickets_overdue as
  select t.id, t.status, t.severity, t.category, t.description,
         t.due_at, t.created_at, t.last_chased_at, t.chase_count,
         t.reporter_phone, t.reporter_name, t.room_id, t.property_id,
         r.unit_code, p.name as property_name,
         (now() - t.due_at) as overdue_by
    from public.maintenance_tickets t
    left join public.rooms r on r.id = t.room_id
    left join public.properties p on p.id = t.property_id
   where t.status <> 'RESOLVED'
     and t.due_at is not null
     and t.due_at < now();
