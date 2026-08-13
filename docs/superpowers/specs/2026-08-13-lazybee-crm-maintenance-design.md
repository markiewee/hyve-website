# Lazybee CRM + Maintenance Flow

**Date:** 2026-08-13
**Status:** Design approved verbally by Mark (13 Aug brainstorm). Awaiting spec sign-off, then plan, PRD, PR drafts.
**Owner:** Mark. **Author:** Claudine.
**Scope:** One system, two lanes on the same rails: the CRM lane (lead in, tenant out) and the maintenance lane (issue in, resolved out). Plus the Kavi updates lane and the named Money Approval boundary. Spans three repos: hyve-website (Partner API), lazybee-machine (board), agent-link-mini (inbound worker).

> **CORRECTION, 13 Aug (same day):** This spec was written before reading the code and assumed a green field. Most of what it proposes to build already exists: the `leads` table carries phone_e164, identifiers, lifecycle, and activation_condition; the `/v1/leads` endpoints are live; ticket SLA math and the chase machinery are implemented. What is genuinely missing is the wiring: nothing arms or evaluates an activation condition, the worker never writes a lead, no acknowledgement is sent, no photo gate exists, and Kavi gets nothing. The corrected build is in `docs/superpowers/plans/2026-08-13-lazybee-crm-maintenance-prd.md`. Read that PRD, not this spec, for scope. Also note the stage vocabulary here (six stages) is not what the database uses (eleven).

## Locked decisions (13 Aug unless noted)

| Decision | Call |
|---|---|
| Pipeline stages | NEW > QUALIFYING > VIEWING > BOOKING SENT > SIGNED > TENANT |
| Identity | One lead per phone (E.164). Platform IDs and WA handles are aliases; merge on first WhatsApp contact |
| Reactivation sends | Auto-send, one per lead per condition, quiet hours respected |
| Write path | Partner API only. Mini keeps zero DB creds |
| Activation conditions | DATE + ROOM + BUDGET + MANUAL, checked nightly against sell-state |
| SLA ladder | URGENT same day + Telegram to Mark. HIGH 48h. ROUTINE next captain visit. COSMETIC monthly batch. 15 min ack, 48h auto-chase, photo proof before RESOLVED |
| Tenant-caused damage | Charge lane opens by default with photo evidence; invoice waits for Mark's tap |
| CP hands | Contractor-only. Every CP ticket goes to the quote lane |
| Spend ladder (12 Aug) | Consumables under S$30 auto-buy (Foodpanda, Valu$ only), captain cap S$50, contractors quote first |
| Captains (12 Aug) | IH Edward, TG Sophia, CP none |
| Naming | The money layer is called **Money Approval**, not money spine |
| Day-to-day updates | Kavi runs day to day and receives operational updates. Mark keeps money approvals and URGENT only |

## Lane 1: CRM

**Data.** Extend the hyve-iot `leads` table (thin today) rather than a new table:

- `phone` text, E.164, unique when present
- `aliases` jsonb: `[{platform, id, handle, seen_at}]` for Roomies, Carousell, WA LIDs, uhomes, etc.
- `stage` enum: NEW, QUALIFYING, VIEWING, BOOKING_SENT, SIGNED, TENANT
- `status` enum: ACTIVE, STORED, CLOSED
- `activation` jsonb: `{type: DATE|ROOM|BUDGET|MANUAL, params, armed_at}` (nullable, STORED only)
- `source` text (first door they came through), `room_interest` text[], `budget_max` numeric, `move_in` date
- `dots` jsonb append-only notes (the hospitality "collect and connect" field)
- `last_touch_at`, `owe_reply` boolean, timestamps

Merge rule: a write that arrives with an alias already attached to a phone-keyed lead lands on that lead. First WhatsApp contact from a known alias attaches the phone and merges any alias-only record into it (histories concatenate, earliest created_at wins, no deletes without merge trace in `dots`).

**Stage rules.** Forward moves happen on real events (viewing booked, booking link sent, agreement signed, move-in). Backward moves are manual only. TENANT hands off to onboarding. A lead in any active stage with no touch for 2 days follows the standing prospect autoclose: status CLOSED, reason recorded. Suppliers and landlords are never in this table.

**STORED + activation.** A nightly job (runs on the laptop first, portable to the mini) evaluates all STORED leads against the live sell-state from lazybee-rooms-state:

- DATE: today is within 8 weeks of their stated move-in
- ROOM: a room matching `room_interest` enters the sell window
- BUDGET: a matching room's price drops to `budget_max` or below
- MANUAL: Mark or Claudine armed it by hand

On fire: reactivation message auto-sends (humanised, references their original ask), lead wakes to ACTIVE/QUALIFYING, condition disarms so it cannot fire twice. Quiet hours 21:00 to 09:00 SGT hold sends until morning.

**Board.** The machine board CRM hub reads `leads` live: per-stage counts, owe-reply list, stuck list (48h no touch in an active stage), reactivations fired this week. No separate CRM UI; the board is the window.

## Lane 2: Write path (Partner API)

New endpoints on hyve-website `/api/v1`, same key scheme and envelope as bookings/tickets, `internal` and `agent` scopes only:

- `POST /v1/leads`: create or upsert by phone or alias. Idempotency-Key honoured
- `PATCH /v1/leads/{id}`: field updates, alias attach, dots append
- `POST /v1/leads/{id}/stage`: explicit stage transition with reason
- `GET /v1/leads?stage=&status=&owe_reply=`: board and worker reads

The beeper-inbound worker writes through these: any new inquiry on the Hyve line creates or touches a lead (alias + source + first message as a dot). Maintenance keywords in a tenant conversation raise a ticket through the existing ticket endpoints instead. The board's "moved to CRM / ticket made" feed then reflects reality.

## Lane 3: Maintenance flow

**Intake, any door:** tenant portal form, WhatsApp via the inbound worker (keyword and photo detection), Telegram from Mark, admin manual. All doors converge on `POST /v1/tickets` with `reporter_phone` (fixes the portal-only submitted_by gap). Depends on the pending expand-ticket-categories plan (PEST, LOCK, WIFI, APPLIANCE) which this spec assumes merges first.

**Clock:** acknowledgement to the reporter within 15 minutes (worker sends it). Severity sets the SLA: URGENT same day plus immediate Telegram to Mark; HIGH 48h; ROUTINE queued for the property's next captain visit; COSMETIC batched monthly. Stalled tickets auto-chase their assignee at 48h. Nothing marks RESOLVED without a photo attached.

**Hands:** IH tickets route to Edward, TG to Sophia. CP is contractor-only: every CP ticket opens a quote request; quotes land as /send taps for Mark (Money Approval boundary). Spend ladder applies everywhere: under S$30 consumables auto-buy via Foodpanda from Valu$, captain jobs cap at S$50, anything above needs a contractor quote approved by Mark.

**Tenant-caused damage:** when evidence shows tenant cause, the charge lane opens by default: photos attach, an invoice drafts automatically, and it goes out only on Mark's tap. Waiving is Mark's explicit call, recorded on the ticket.

## Lane 4: Kavi updates (day-to-day operator)

Kavi runs day to day. The machine keeps her current without Mark in the loop:

- **Instant to Kavi (WhatsApp, auto-send):** new ticket created (property, severity, summary), SLA breach warnings before they escalate, contractor quote received (so she can sanity-check before Mark's tap), viewing booked or rescheduled, photo-proof submitted for her eyeball
- **Daily digest to Kavi (morning, one message):** open tickets by severity and age, today's viewings, rooms in the sell window, overdue acks
- **Mark keeps only:** URGENT pings, all Money Approval taps (quotes, charge invoices, refunds), and anything Kavi escalates

Kavi's WhatsApp contact and group chat id are confirmed at build time (the AC-servicing group exists already). Messages go through the humanise pipeline like all outbound WhatsApp.

## Money Approval (named boundary, own spec to follow)

Every money movement in the machine terminates in a Mark tap: contractor quotes, tenant-caused charge invoices, refunds and deposit deductions, any commitment above the spend ladder. This spec wires the maintenance-side taps. The full Money Approval lane (rent invoicing on schedule, payment matching, arrears escalation, deposit ledger from collection to return) is the next brainstorm and its own spec; nothing here blocks on it.

## Build order

1. **PR 1 (hyve-website):** leads schema migration + /v1/leads endpoints + tests
2. **PR 2 (agent-link-mini):** worker writes leads and tickets through the API; 15-min ack; Kavi instant updates
3. **PR 3 (lazybee-machine + laptop job):** nightly activation job, reactivation sends, board CRM hub, Kavi daily digest
4. Maintenance categories: rides the already-pending expand-ticket-categories PR (Mark approval outstanding)

## Error handling and testing

- API: same error envelope as v1; 422 on bad stage transitions; merge conflicts return the surviving lead id
- Worker: API failure queues the write locally and retries; never drops an inquiry; NEEDS-LOGIN pattern reused for send failures
- Nightly job: a run that cannot read sell-state sends nothing and reports degraded to the board rather than firing on stale data
- Tests: unit tests on merge rules, stage transitions, activation predicates, SLA clock math; live smoke on preview before any merge, QA rows cleaned

## Open items (not blocking this build)

- CP viewing access: contractor-only covers repairs, not door-opening for viewings. Lockbox self-viewing or paid opener is Mark's call
- Demand lanes on Mark's taps: coliving.com currency to SGD, uhomes rep chase, UL commission terms, Airbnb connector login
- Money Approval full spec: next brainstorm
