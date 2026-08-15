# P2 Bridge Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task inline (no subagents, Mark's rule). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Lazybee-to-MOPS bridge truthful again: honest terminal statuses, no ghost backlog, misdelivered work recovered into the database humans actually use, and a canary that pages when the bridge delivers into the void.

**Architecture:** All fixes are data plus SQL-function changes on hyve-iot (`diiilqpfmlxjwiaeophb`), data mirrors into millia-prod (`nlioknjwkerxtdbeijxh`), one Python constant change on the mini, and small JS changes in hyve-website. Jason's backend deployment (millia-dev.fly.dev) is NOT touched; its env flip is a decision card for Mark.

**Tech Stack:** Supabase Management API SQL, plpgsql, Python (mini agent-link, unittest), React/JS (hyve-website).

## Live findings this plan is built on (all verified 15 Aug)

1. `MILLIA_OUTBOUND_WEBHOOK_URL` = `https://millia-dev.fly.dev/api/v1/partners/lazybee/webhooks/tickets` (hash-verified) and never changed. The backend at that URL flipped its own `SUPABASE_URL` from millia-prod to millia-dev around Jason's 11 Aug sunmoon migration. Everything we delivered after 3 Aug (1 update 3 Aug landed prod; then 12 Aug created, 5 closed 14 Aug, 1 created 15 Aug landed DEV) is invisible to staff. Humans work in prod: 204 manual task updates in 3 days vs 10 in dev.
2. `MILLIA_SUPABASE_URL` (used by sync-rooms) also points at millia-dev (hash-verified).
3. The "19 never-crossed tickets" from the audit are already crossed (54/54 queue rows delivered, backfill happened 1 Jun). But 29 of the 33 `ticket.created` events MOPS processed on/before 1 Jun created no task (`task_id` null, no error): the early handler logged without creating. Those are the ~21 unlinked local tickets; all RESOLVED locally, no operational value in re-sending, documented as historical.
4. Our 16 unmapped inbound events = 15 synthetic probes (probe-A/B, tk-truthtable, smoke ids) + 1 ghost `ticket.closed` for `6c7393f0-...` which exists in neither Millia DB. Nothing to replay.
5. MOPS-to-us callbacks: neither Millia DB has enqueued an outbound event since 18 Jul (both queues frozen at the same row, dev being a clone). Flag to Jason; cannot be fixed from our side.
6. 47 open MOPS-only maintenance tasks on Lazybee units in prod: 35 are the 28 Jul "Power Cards" per-room campaign (skip, log), 12 are real (incl. 2 URGENT CP-MR since 11 Jul, TG-COMMON toilet flood since 23 Jun).
7. Our rooms table covers ALL unit codes including COMMON/KITCHEN/TOILET/YARD, so every import maps to a room_id.
8. `partner_inbound_log.status` check allows pending/applied/unmapped/rejected only.

---

### Task 1: Terminal statuses CANCELLED and CLOSED

**Files/objects:**
- hyve-iot: `maintenance_tickets_status_check` constraint, `apply_partner_inbound()` function
- Modify: `mini:~/agent-link/maintenance_runner.py:54` (`CLOSED_STATUSES`), test in `test_maintenance_runner.py`
- Modify: `hyve-website/src/lib/partnerTickets.js` (allowed list line ~24, `shouldChase` ~252, `shouldEscalate` ~267), `src/components/portal/TicketCard.jsx` (~150, ~192), tests in `src/lib/partnerTickets.test.js`
- Check only: `supabase/functions/ticket-escalation` status filter

- [ ] **Step 1: SQL — widen the constraint, fix the mapping**

```sql
ALTER TABLE maintenance_tickets DROP CONSTRAINT maintenance_tickets_status_check;
ALTER TABLE maintenance_tickets ADD CONSTRAINT maintenance_tickets_status_check
  CHECK (status = ANY (ARRAY['OPEN','ACKNOWLEDGED','TRIAGED','SCHEDULED','IN_PROGRESS',
    'AWAITING_PROOF','WAITING_PARTS','ESCALATED','RESOLVED','CANCELLED','CLOSED']));
```

Then CREATE OR REPLACE `apply_partner_inbound()` with mapping: `ticket.closed` event -> `CLOSED`; canonical `cancelled` -> `CANCELLED`, `closed` -> `CLOSED`, rest unchanged. `resolved_at` stamps for all three terminal states.

- [ ] **Step 2: mini — failing test for terminal statuses** (`CLOSED_STATUSES` includes CANCELLED and CLOSED; a CANCELLED ticket is not actionable). Run `python3 -m unittest test_maintenance_runner -v`, expect fail; then change line 54 to `CLOSED_STATUSES = {"RESOLVED", "CANCELLED", "CLOSED"}`, expect pass. Commit.

- [ ] **Step 3: hyve-website — failing tests** (`shouldChase`/`shouldEscalate` false for CANCELLED/CLOSED, allowed list contains both). Run `node --test src/lib/partnerTickets.test.js`, then implement: add both to `TICKET_STATUSES`, introduce `const TERMINAL = new Set(["RESOLVED","CANCELLED","CLOSED"])`, use in shouldChase/shouldEscalate and TicketCard button guards. validateClose stays RESOLVED-only strict. Run tests green. Commit, push (auto-deploy).

- [ ] **Step 4: verify deployed ticket-escalation function filter** cannot chase CANCELLED/CLOSED (reads open-ish statuses explicitly, or fix similarly).

### Task 2: Re-apply the June cancels

- [ ] One UPDATE per ticket, no outbound echo (trigger fires only on `last_sync_source='local'`):

```sql
UPDATE maintenance_tickets SET status='CANCELLED',
  resolution_note = coalesce(resolution_note,'') || ' | MOPS cancelled Jun 2026; status corrected from lossy RESOLVED fold (P2).',
  last_sync_source='partner_inbound', updated_at=now()
WHERE id IN ('6ec9f1e9-57a2-4f50-a83b-71a0f0927c71','c5e353e1-31d2-461f-b778-e6507d9232d1')
  AND status='RESOLVED';
```

Verify 2 rows, statuses CANCELLED, no new partner_outbound_queue rows.

### Task 3: Inbound log hygiene

- [ ] Widen `partner_inbound_log` status check to include `ignored_test`; then:

```sql
UPDATE partner_inbound_log SET status='ignored_test', processed_at=now()
WHERE status='unmapped';  -- all 16 verified probes/ghost, see finding 4
```

Verify 0 unmapped remain.

### Task 4: Mirror misdelivered bridge output into millia-prod

- [ ] **Step 1:** Export dev rows `a8dcf8d6` and `02c95f6b` as JSON; compute prod/dev tasks column intersection; INSERT into prod via `jsonb_populate_record` keeping ids (idempotent against future replays). Verify FKs (client_id `388117a4`, property_id) exist in prod first.
- [ ] **Step 2:** For prod tasks `81e2af07`, `704aebc1`, `cffe22d1`, `72c9eff7` (their dev counterparts were closed by the 14 Aug batch): copy status/completed_at/completion_note from dev only where prod row is not already terminal. `388ec4d5` already cancelled in prod, untouched.
- [ ] **Step 3:** Verify prod linked-task count and statuses; record before/after.

### Task 5: Import the 12 real orphan prod tasks as local tickets

- [ ] **Step 1:** Pull the 12 prod rows (47 minus 35 `Power Cards`, skip logged). Map: status pending->OPEN wait, use ACKNOWLEDGED (MOPS already owns them; prevents ack spam), scheduled->SCHEDULED, in_progress->IN_PROGRESS; urgency urgent->HIGH (not URGENT: these are weeks old, URGENT would set due tomorrow and page; HIGH gives 3 days for Kavi reconciliation) else ROUTINE; category by keyword (leak/flood/drain/shower->PLUMBING, ac->AC, handle/sticker/paint->FURNITURE, tv/power->ELECTRICAL, else OTHER); `reporter_phone='not-on-file (imported from MOPS task <id>)'`; `last_sync_source='partner_inbound'` (no outbound echo); room_id+property_id from rooms by unit_code; description from label + MOPS description.
- [ ] **Step 2:** Set `partner_name='lazybee'`, `partner_external_id=<new ticket id>` on the 12 prod rows.
- [ ] **Step 3:** Verify 12 local tickets exist, 0 outbound queue rows added, prod rows linked. Run the runner once dry to confirm no send storm (ledger + future due dates should hold it to zero or near-zero).

### Task 6: Bridge parity canary

- [ ] **Step 1:** hyve-iot table + pg_cron job (hourly) that snapshots parity state:

```sql
CREATE TABLE IF NOT EXISTS bridge_parity_status (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),  -- single row
  checked_at timestamptz NOT NULL,
  delivered_24h int NOT NULL,
  prod_received_24h int,           -- null = probe failed
  ok boolean NOT NULL,
  detail text);
```

Populated by a new edge function `bridge-parity` (service role) that counts our `partner_outbound_queue` deliveries in 24h and queries millia-prod PostgREST `partner_inbound_log` (service key stored as hyve-iot secret `MILLIA_PROD_SERVICE_KEY`, never on the mini) for rows received in 24h. `ok = deliveries==0 OR prod_received>0`. pg_cron hits it hourly at minute 23.
- [ ] **Step 2:** watchdog (mini) new check `bridge:parity`: read `bridge_parity_status` via existing hyve REST access; CRITICAL when `ok=false`, BACKGROUND when `checked_at` stale > 3h. Unit tests for the classifier; live run. Commit.
- [ ] **Step 3:** Confirm the canary fires RED right now (bridge genuinely delivers to dev), which is correct and lands in Mark's next digest as CRITICAL.

### Task 7: Decision card + Jason briefing draft

- [ ] Loops board update, TODO.md entries, and the inline report to Mark containing: the split-brain evidence, the one decision (have Jason repoint millia-dev.fly.dev `SUPABASE_URL` to millia-prod, or bless dev as canonical and migrate staff), note that `MILLIA_SUPABASE_URL` for sync-rooms needs the same decision, the frozen MOPS-outbound-queue-since-18-Jul flag, and a drafted (NOT sent) WhatsApp to Jason.

## Non-goals

Touching Jason's fly deployment or Millia repo code; re-sending the 21 historical resolved tickets; importing the Power Cards campaign; building the full CP lane UX (P6).
