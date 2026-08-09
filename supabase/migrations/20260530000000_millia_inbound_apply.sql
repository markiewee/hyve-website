-- Reverse-direction apply step (Millia → Lazybee), completes the v1 loop.
--
-- ticket-status-callback verifies the HMAC and logs each inbound webhook into
-- partner_inbound_log (status 'pending' when ticket.id maps to a real local
-- ticket, 'unmapped' otherwise). This trigger applies those pending rows to
-- maintenance_tickets.
--
-- Echo safety: the UPDATE stamps last_sync_source='partner_inbound', and our
-- outbound trigger (trg_enqueue_ticket_to_partner) only fires WHEN
-- last_sync_source='local' — so applying an inbound update never echoes back.
--
-- Status mapping (canonical → local). Our local enum has no CLOSED/CANCELLED,
-- so both fold to RESOLVED for now (lossy but functional; upgrade later by
-- extending the maintenance_tickets.status CHECK).
--
-- Spec: docs/integrations/millia-handshake-v1.md (v1, §5 + §7).

create or replace function public.apply_partner_inbound()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_canonical text;
  v_local     text;
  v_notes     text;
begin
  -- Only mapped, freshly-pending rows.
  if NEW.status <> 'pending' or NEW.ticket_id is null then
    return NEW;
  end if;

  v_canonical := lower(coalesce(NEW.payload->'ticket'->>'status', ''));
  v_notes     := NEW.payload->'ticket'->>'notes';

  v_local := case v_canonical
    when 'open'        then 'OPEN'
    when 'in_progress' then 'IN_PROGRESS'
    when 'on_hold'     then 'ESCALATED'
    when 'resolved'    then 'RESOLVED'
    when 'closed'      then 'RESOLVED'   -- folded (no local CLOSED)
    when 'cancelled'   then 'RESOLVED'   -- folded (no local CANCELLED)
    else null
  end;

  -- Status outside the canonical set → reject (don't touch the ticket).
  if v_local is null then
    update partner_inbound_log
      set status = 'rejected', processed_at = now()
      where delivery_id = NEW.delivery_id;
    return NEW;
  end if;

  update maintenance_tickets
    set status           = v_local,
        resolution_note  = coalesce(v_notes, resolution_note),
        last_sync_source = 'partner_inbound',   -- echo guard
        updated_at       = now()
    where id = NEW.ticket_id;

  update partner_inbound_log
    set status = 'applied', processed_at = now()
    where delivery_id = NEW.delivery_id;

  return NEW;
end;
$$;

drop trigger if exists trg_apply_partner_inbound on public.partner_inbound_log;

create trigger trg_apply_partner_inbound
  after insert on public.partner_inbound_log
  for each row execute function public.apply_partner_inbound();

-- One-time backfill: apply any pending+mapped rows already sitting in the log
-- (e.g. the in_progress callback received before this trigger existed).
do $$
declare r record;
begin
  for r in
    select delivery_id, ticket_id, payload
    from partner_inbound_log
    where status = 'pending' and ticket_id is not null
  loop
    update maintenance_tickets
      set status = case lower(coalesce(r.payload->'ticket'->>'status',''))
                     when 'open' then 'OPEN'
                     when 'in_progress' then 'IN_PROGRESS'
                     when 'on_hold' then 'ESCALATED'
                     when 'resolved' then 'RESOLVED'
                     when 'closed' then 'RESOLVED'
                     when 'cancelled' then 'RESOLVED'
                     else status end,
          resolution_note  = coalesce(r.payload->'ticket'->>'notes', resolution_note),
          last_sync_source = 'partner_inbound',
          updated_at       = now()
      where id = r.ticket_id;
    update partner_inbound_log set status = 'applied', processed_at = now()
      where delivery_id = r.delivery_id;
  end loop;
end $$;
