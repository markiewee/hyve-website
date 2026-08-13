# PRD: Lazybee CRM + Maintenance Flow

**Date:** 2026-08-13 (corrected same day after reading the codebase)
**Author:** Claudine. **Owner:** Mark.
**Design spec:** `docs/superpowers/specs/2026-08-13-lazybee-crm-maintenance-design.md` (also needs correcting, see below)
**Status:** Corrected draft. The first version of this PRD assumed a green field and was wrong.

## 0. Correction notice

The 13 August design and the first cut of this PRD proposed building a CRM data layer and a set of `/v1/leads` endpoints. **Both already exist and have existed since the 16 August migration series.** Reading the code before planning would have caught it; I planned first. What follows is rewritten against the actual state of the system.

Already built and live:

- `leads` table with `phone_e164`, `identifiers[]`, `lifecycle` (ACTIVE|STORED), `activation_condition` jsonb, `activation_checked_at`, `budget_monthly`, `move_in`, `move_out`, `occupants`, `location_preference`, `role`, `next_action`, `next_action_due`, `channel_id`, `idempotency_key`
- Endpoints `POST /v1/leads`, `GET /v1/leads`, `GET /v1/leads/stalled`, `GET /v1/leads/{id}`, `PATCH|POST /v1/leads/{id}`, all internal-scope gated except create
- Identity resolution in `matchLead`: phone_e164, then chat_id, then identifiers overlap, then email. Never matches on name
- `partnerLeads.js` with `normalisePhone`, `validateLead`, `mergeIdentifiers`, `leadView` whitelist, and `ACTIVATION_TYPES` = DATE, ROOM, BUDGET, MANUAL
- `lead_stage_policy` table with per-stage patience days, and the `v_leads_stalled` view
- Ticket severity and SLA: `dueAtFor()` in JS mirrored by `fn_ticket_due_at` in SQL with a trigger, plus `shouldChase`, `shouldEscalate`, `MAX_CHASES`, and the `v_tickets_overdue` view
- Ticket columns for the charge lane: `charge_to_tenant`, `charge_amount`, `reporter_phone`, `lead_id`, `chase_count`, `last_chased_at`

Live data as of today: **251 leads, all of them ACTIVE, zero STORED, zero armed activation conditions, and only 60 of 251 carrying a phone_e164.** The machinery to store and wake a lead exists and has never been used once.

## 1. Real problem

The CRM is built and idle. Nothing arms an activation condition, nothing evaluates one, and nothing sends a reactivation. The inbound worker never writes a lead at all, so 191 of 251 leads have no phone key and inquiries arriving on WhatsApp today do not reach the table. Tickets carry a due date but nobody is told about it: no acknowledgement to the reporter, no notification to whoever has the hands, and CP tickets wait on a captain who does not exist. Mark is still the routing layer.

The gap is not schema. It is the moving parts that were never wired to the schema.

## 2. Goals

1. Every inbound inquiry becomes or touches a lead, with a phone key where one is knowable.
2. Leads that are not ready now get stored with an armed condition, and something evaluates those conditions nightly and sends the reactivation.
3. Every ticket acknowledges its reporter, reaches the right hands, and cannot close without photo proof.
4. Kavi gets the operational stream. Mark gets URGENT and money only.
5. No new Vercel functions, no partner-visible change.

### Non-goals

- Money Approval (rent invoicing, payment matching, arrears, deposits). Own spec, next.
- A CRM interface. The machine board is the window.
- Rewriting identity resolution, stage policy, or SLA math. All three exist and work.
- Onboarding document verification and the compliance agent.

## 3. Corrections to the approved design

| Design said | Reality | Resolution |
|---|---|---|
| Six stages NEW > QUALIFYING > VIEWING > BOOKING_SENT > SIGNED > TENANT | DB has eleven: new, qualified, viewing_booked, viewed, viewing_done, agreement_sent, signed, cold, closed_won, closed_lost, lost | Keep the DB vocabulary. It is richer and already has patience policy per stage. The board renders them grouped |
| Add `/v1/leads` endpoints | They exist | Extend, do not add. Only genuinely missing verb is an explicit stage-transition route, and `PATCH /{id}` already covers it |
| Internal and agent scopes | Only `partner` and `internal` exist. "Agent" is a separate `channel_pins` mechanism | Use internal scope. No migration needed |
| Idempotency-Key header | Idempotency is a body field `idempotency_key` | Use the body field, matching bookings and tickets |
| SLA: URGENT same day, ROUTINE next captain visit, COSMETIC monthly | Code has URGENT 4h, HIGH 48h, ROUTINE 7 days, COSMETIC 30 days | Mark to confirm: adopt the shipped numbers, or change `SLA_HOURS` and `fn_ticket_due_at` together |
| Photo required before RESOLVED | Not implemented. `ticket_photos` table exists, the API never touches it | Genuine build |

## 4. What actually needs building

### 4.1 The activation loop (nothing exists)

- FR1: A nightly job reads STORED leads with an armed `activation_condition` and evaluates it against live room sell-state.
- FR2: DATE fires within 8 weeks of the stored date; ROOM fires when the named listing enters the sell window; BUDGET fires when a matching room's price falls to `max_monthly` or below; MANUAL fires when set by hand.
- FR3: On fire, a humanised reactivation message sends automatically, the condition clears, `activation_checked_at` stamps, and the lead returns to an active status.
- FR4: Quiet hours 21:00 to 09:00 Singapore time hold sends until morning.
- FR5: If sell-state is unreadable the job sends nothing and reports degraded to the board. It never fires on stale data.
- FR6: Nothing currently arms a condition. The worker and Claudine both gain the ability to store a lead with a condition when a prospect says "not yet" or "too expensive" or "wrong dates".

### 4.2 Worker writes leads (nothing exists)

- FR7: The inbound worker creates or touches a lead for every inquiry on the Hyve line, through `POST /v1/leads`, carrying phone, source, chat id as an identifier, and the first message as context.
- FR8: The worker holds no database credentials. It reaches the API with the key already in `~/.agent-runner/lazybee-api.env`, which must be internal scope for the read and update verbs.
- FR9: Maintenance intent raises a ticket instead, through the existing `POST /v1/tickets` with `reporter_phone`.
- FR10: Failures queue locally and retry. An inquiry is never dropped.

### 4.3 Backfill (nothing exists)

- FR11: 191 of 251 leads have no `phone_e164`. A one-off backfill derives it where the raw `phone` or `chat_id` allows, using the same `fn_normalise_phone` the API uses, and reports what it could not resolve rather than guessing.
- FR12: The 52 leads in `hyve-ops.json` are reconciled into the table or explicitly declared dead. Their `stage` values (`replied`, `inquiry`) are not legal statuses and need mapping.

### 4.4 Maintenance wiring (partly exists)

- FR13: Every ticket intake sends an acknowledgement to the reporter within 15 minutes.
- FR14: A ticket cannot move to RESOLVED without at least one row in `ticket_photos`. The API must start reading that table.
- FR15: IH routes to Edward, TG routes to Sophia. CP has no captain, so every CP ticket opens a contractor quote request instead of an assignment.
- FR16: The chase machinery exists but nothing runs it. A scheduled runner calls it so `shouldChase` and `shouldEscalate` actually fire.
- FR17: Tenant-caused damage sets `charge_to_tenant` and drafts an invoice with photos attached, held for Mark's approval. The columns exist; the flow does not.

### 4.5 Notifications (nothing exists)

- FR18: Kavi receives instant WhatsApp for: ticket created, SLA breach warning, contractor quote received, viewing booked or rescheduled, photo proof submitted.
- FR19: Kavi receives one morning digest: open tickets by severity and age, today's viewings, rooms in the sell window, overdue acknowledgements.
- FR20: Mark receives URGENT pings, money approvals, and Kavi's escalations only.
- FR21: All outbound passes the humanise pipeline. No dashes, no emojis.

### 4.6 Board (partly exists)

- FR22: The board's CRM hub already reads leads. It gains stored-lead counts, armed conditions, and reactivations fired this week.
- FR23: The `map.html` CRM view still shows a NOT BUILT chip and cites "a thin leads table". Both are stale and must be corrected.

## 5. Known defect found while mapping

`leads.date_initiated` exists in production but appears in no migration. It was added by hand. Three frontend files write and read it (`useLeads.js`, `LeadCard.jsx`, `LeadDrawer.jsx`). A fresh environment rebuilt from migrations would break the portal's Add Lead flow. Fix: add the column to a migration so the repo matches production.

## 6. Success criteria

- A person messaging the Hyve line today appears in `leads` with a phone key within one sweep.
- A lead stored with a DATE condition receives exactly one reactivation when its window opens, and none on a rerun.
- `phone_e164` coverage rises from 60 of 251 to as close to complete as the raw data honestly allows, with the unresolvable ones listed rather than guessed.
- A ticket raised on WhatsApp is acknowledged inside 15 minutes and cannot close without a photo.
- A CP ticket produces a quote request, never a silent wait.
- Mark's notification volume drops to URGENT plus money. University Living's partner key still gets 403 on lead reads and unchanged responses everywhere else.

## 7. Rollout

1. **PR 1, hyve-website:** photo-gate on resolve, the `date_initiated` migration fix, and any endpoint gaps found while wiring. Small.
2. **PR 2, agent-link-mini:** worker writes leads and tickets, 15-minute acknowledgement, Kavi instant updates, per-type kill switches defaulting off.
3. **PR 3, lazybee-machine:** nightly activation job, reactivation sends, board CRM hub additions, Kavi's morning digest, map.html correction.
4. **One-off:** phone_e164 backfill and hyve-ops.json reconciliation, run and reported, not scheduled.

Category expansion (PEST, LOCK, WIFI, APPLIANCE) rides the existing plan at `docs/superpowers/plans/2026-08-12-expand-ticket-categories.md` and still awaits Mark's approval.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Backfill guesses a phone number wrong and fuses two people | Use `fn_normalise_phone` only, never infer; report unresolvable rows instead of guessing; merges stay additive and reversible |
| First-ever reactivation sends embarrass us on 251 untested leads | Ship the job in report-only mode first, review one night's would-send list, then arm |
| Kavi's stream becomes noise | Five instant event types only, everything else batched into the morning digest |
| Worker writes duplicate leads under retry | Body `idempotency_key` plus the existing partial unique index on `(channel_id, idempotency_key)` |
| Vercel twelve-function ceiling | Repo sits at exactly 12. All work rides the existing catch-all; verify the dashboard still lists 12 after deploy |
| SLA numbers change in one place only | `SLA_HOURS` in JS and `fn_ticket_due_at` in SQL must change together; a test pins the hours |
