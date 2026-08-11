# Internal agent access to the Partner API

*For Claudine agents and workers (Mac mini and elsewhere). 2026-08-10.*

The rule: agents do not hold Supabase service credentials. Everything an agent needs from hyve-iot goes through `https://www.lazybee.sg/api/v1` with a channel-scoped API key. The public docs at `/developers` cover the shared surface (listings, calendars, rates, booking requests, bookings, webhooks); this file covers what is internal-only.

## Keys and scopes

Keys are minted with `node scripts/mint-partner-key.mjs <slug> "<Name>" <label> internal` and hang off the channel row for the platform the agent operates (`roomies`, `carousell`, and so on). The `internal` scope unlocks `/placements`; everything else behaves exactly as documented publicly. The channel `enabled` kill switch applies to agents too: a disabled channel's key gets 403 everywhere.

## Reporting placement state (the "last updated thing")

When an agent creates, refreshes, verifies or pauses a listing on its platform, it reports the outcome:

```bash
curl -s -X POST https://www.lazybee.sg/api/v1/placements \
  -H "Authorization: Bearer $AGENT_KEY" -H "Content-Type: application/json" \
  -d '{
    "listing_code": "IH-STD1",
    "external_id": "roomies-listing-4471",
    "url": "https://roomies.sg/rooms/4471",
    "status": "LIVE",
    "pushed": true,
    "verified": true,
    "drift": {}
  }'
```

`pushed: true` stamps `last_pushed_at`, `verified: true` stamps `last_verified_at`, `drift` records any disagreement found on read-back (empty object means verified in agreement), `error` records a failure message. Statuses: `NOT_LISTED`, `PENDING`, `LIVE`, `PAUSED`, `ERROR`. `GET /placements` returns the channel's own rows.

Two more fields for observation reports: `observed` stores whatever the agent saw on the platform verbatim (title, price, views, verdict, anything) into `observed_state` and stamps `observed_at` server-side, and `expires_at` (ISO date or null) records when the platform will silently kill the listing, which is how Carousell expiry stops being invisible.

## Sell priority (rule 18)

`GET /internal/sell-state` (internal scope only) returns the rooms worth marketing right now, straight from the same database views the ops board uses:

```json
{ "data": [ { "listing_code": "CP-MR", "price": 2200, "frees_on": "2026-09-14",
              "next_arrival": null, "should_be_live": true } ] }
```

`should_be_live` is the rule-18 verdict (goes empty inside the sell window with no follow-on booking). Agents must use this endpoint rather than re-deriving the rule client-side, so the rule lives in exactly one place.

## Filing a lead (the CRM write path)

`POST /v1/leads` is how a worker turns a conversation into a row somebody can act on. Before this existed the reply brain answered a prospect, recorded an outcome on the board feed, and left the `leads` table untouched, so "moved to CRM" was narration rather than a fact.

```bash
curl -s -X POST https://www.lazybee.sg/api/v1/leads \
  -H "Authorization: Bearer $LZB_KEY" -H "Content-Type: application/json" \
  -d '{"name":"Jane Tan","phone":"91234567","chat_id":"358",
       "source":"whatsapp","budget_monthly":1400,"move_in":"2026-09-01",
       "occupants":1,"matched_room_codes":["CP-MR"],
       "idempotency_key":"thread-358-2026-08-11"}'
```

One person, one row. The matcher resolves in order of how much an identifier can be trusted: a normalised phone is definitive, then `chat_id`, then an alias in `identifiers[]`, then email. It never matches on name, because two different Jane Tans are two people. The response says which of those it matched on, and whether it created a row:

```json
{"id":"...","name":"Jane Tan","phone":"+6591234567","status":"new",
 "lifecycle":"ACTIVE","matched_on":"phone","created":false}
```

Two behaviours worth knowing before you wire a worker to this. A lead is never walked backwards: the brain files `status: "new"` on every fresh message, and the endpoint refuses to let that overwrite a lead that already reached `signed`. And handles accumulate rather than replace, so a prospect who arrives as a Carousell username, becomes a WhatsApp LID and finally sends a real number stays one row the whole way.

Send the raw `phone` even when it is not dialable. WhatsApp LID privacy identifiers (`90070873755`, `305823417484`) look like phone numbers and are not; the API keeps them as aliases and leaves the key column null rather than inventing a number that would merge two strangers.

`GET /leads` (internal scope) filters on `lifecycle`, `status` and `phone`. `GET /leads/{id}` reads one.

`POST /leads/{id}` (or `PATCH`) moves a lead you already have the id for. This is the safe verb: it cannot create a row and cannot change who somebody is, because `phone`, `email`, `chat_id` and `identifiers` are not accepted on it at all. Use `POST /leads` when you are filing a conversation and need the matcher to work out whose it is; use this when you already know.

```bash
curl -s -X POST https://www.lazybee.sg/api/v1/leads/$ID \
  -H "Authorization: Bearer $LZB_KEY" -H "Content-Type: application/json" \
  -d '{"lifecycle":"ACTIVE","next_action":"reactivated: CP-MR is back on the market"}'
```

It accepts `status`, `lifecycle`, `activation_condition`, `budget_monthly`, `move_in`, `move_out`, `occupants`, `location_preference`, `role`, `next_action`, `next_action_due`, `matched_room_codes`, `property_interest`, `prospect_summary` and `notes`. Anything you omit is left alone. Returns the updated lead, or `404` if there is no such id.

## Leads that stopped moving

`GET /v1/leads/stalled` (internal scope). The leads table had 239 rows and no notion of a stage being overdue, so it silted up: 122 sat at `qualified` with 53 untouched for over a week, and 19 of the 22 at `new` had never been triaged at all. A prospect nobody moved is not a pipeline, it is a list.

Each stage gets its own patience, in `public.lead_stage_policy`, because they are not alike and because how long to wait is a commercial judgement rather than a property of the code. A new enquiry silent two days is dead; a booked viewing with no outcome recorded is our failure and gets two days as well; a cold lead is worth one look a month, not a daily nag. Terminal statuses are excluded, and so are `STORED` leads, which are parked against a condition and belong to the activator rather than the chaser.

Rows come back worst-stage first rather than oldest first, because a viewing nobody followed up is more expensive than a cold lead a month past its nudge, however old that one is.

`auto_closeable` marks rows that Mark's standing rule covers: a first enquiry that went quiet. It is deliberately only a flag. Reading this endpoint never closes anything, and the rule excludes anybody who told us a budget or a room, because that is a real prospect somebody worked for and not a dead contact.

## Agent attribution (the concierge lane)

Six agents and referrers have had a PIN since the channel pricing page was built, and every one of them read `use_count` 0, because nothing anywhere consumed a PIN. They were credentials for a door that had not been cut.

A PIN is how somebody without an API key gets credited. Platforms authenticate as themselves and their bookings are stamped from the key; an agent has six digits instead, and the point of those digits is that a booking they introduced is recorded as theirs and pays what their channel says it pays.

Pass `channel_pin` on `POST /v1/leads` or `POST /v1/bookings`. The agent's channel then wins over the calling key's channel, because who introduced this is exactly the question a PIN answers. Attach it at the lead where you can: an agent introduces a person well before a booking exists, and waiting until money is involved is how the credit gets lost.

```bash
curl -s -X POST https://www.lazybee.sg/api/v1/leads \
  -H "Authorization: Bearer $LZB_KEY" -H "Content-Type: application/json" \
  -d '{"name":"Jane Tan","phone":"91234567","channel_pin":"591886"}'
```

Two rules worth knowing before you wire anything to this. Only an internal-scope key may present a PIN, because a partner key doing so would be one channel claiming another channel's commission. And a bad PIN is refused loudly (`422` unknown, `403` disabled) rather than ignored: attribution that silently vanishes is somebody's commission silently vanishing, discovered weeks later with nothing to point at.

`GET /v1/pins/{pin}` (internal scope) reads back the label, channel, commission terms and usage. Commission is quoted from the channel and never invented: a channel with nothing recorded returns `null`, not zero, because "we do not know" and "they get nothing" are different answers and only one is safe to put in front of an agent.

## What a tenant is missing on file

`GET /v1/compliance` (internal scope) checks every current tenant against the required document set. Nothing had ever asked, and the first run answered: 20 of 20 have a gap, 19 have no IRAS stamping recorded, and 7 have no signed agreement in either `tenant_documents` or `onboarding_progress`.

The required set is config, not code. It lives in `public.compliance_requirements` (`doc_kind`, `applies_to`, `accepts[]`, `is_required`, `why`), because whether a short-stay guest needs stamping is a judgement and the person who owns that judgement should be able to change it without a migration and a deploy.

```bash
curl -s "https://www.lazybee.sg/api/v1/compliance?urgency=CRITICAL" \
  -H "Authorization: Bearer $LZB_KEY"
```

`CRITICAL` means no signed agreement exists anywhere, which is the one that is not a filing problem. An agreement counts as held if it is signed in either place we record signing, since the portal writes one and the document store the other and a tenant is no less covered because the paperwork landed in the other one.

Each row carries `next_actions`, and the response leads with a `summary` so callers do not each count the array and disagree about the number. The room and the name travel; `tenant_profile_id` does not, because it addresses the most sensitive file this company holds.

### Closing a ticket

`POST /v1/tickets/{id}` with `status: "RESOLVED"` now requires a `resolution_note` saying what was actually done, and an owner. Closing is the moment the system stops looking at a ticket, which makes it the only moment the record can still be made honest.

The discipline half exists already: all 26 resolved tickets carry a note. The other half does not, and 23 of those 26 have no `resolved_by` at all, so the record reads "it was fixed, we think, by someone", which is not something anybody can stand behind three months later. If you do not pass `resolved_by`, the calling key's label is used, because a named agent is still a named actor.

Nothing short of `RESOLVED` is affected: triaging, scheduling and acknowledging are untouched.

## Half-finished move-ins

`GET /v1/onboardings` (internal scope) answers the question `onboarding_progress` was never asked: who stopped, at which step, and how long ago. Every step in that table has always carried a timestamp and nothing read them, so the first run found two tenants who moved in on 15 June and never finished, one of them still without a signed tenancy agreement, and two tenancies that began on 1 August with the deposit unpaid.

Rows come back worst first. `urgency` is decided by the `v_onboardings_stuck` view rather than by the API, so a dashboard and an agent cannot disagree about what is urgent: `CRITICAL` means the tenancy has already started while the agreement is unsigned or the deposit unpaid, `HIGH` is a stall of two weeks or an unverified ID on an occupied room, then `NORMAL` and `FRESH`.

```bash
curl -s "https://www.lazybee.sg/api/v1/onboardings?started=true" \
  -H "Authorization: Bearer $LZB_KEY"
```

Filters: `urgency` and `started=true` (only rooms somebody is already living in). Each row carries a `next_action` naming what would unstick it, so a chaser does not need its own copy of the step map. The tenant's name and room travel because a chaser cannot chase an anonymous row; the tenancy file does not. No signature, no signed-agreement url, no Stripe session, no profile id.

## Filing a ticket (nothing dies in chat)

`POST /v1/tickets` (internal scope) exists because `maintenance_tickets.submitted_by` used to be NOT NULL against a portal account, so a fault reported in a house WhatsApp group could not become a ticket at all. It is now attributable to a phone instead.

```bash
curl -s -X POST https://www.lazybee.sg/api/v1/tickets \
  -H "Authorization: Bearer $LZB_KEY" -H "Content-Type: application/json" \
  -d '{"listing_code":"CP-MR","description":"No water in the bathroom since this morning",
       "reporter_phone":"+6591234567","reporter_name":"Jane",
       "source":"whatsapp","idempotency_key":"ticket-358-2026-08-11"}'
```

Category and severity are inferred from the text when you do not say, and an explicit value always wins, because the person standing in the flat knows better than a keyword list. Severity is a clock, not an adjective: `URGENT` 4h, `HIGH` 48h, `ROUTINE` 7d, `COSMETIC` 30d, and the returned `due_at` is what the chaser and the board both judge lateness by. URGENT also emails admin@lazybee.sg immediately, because for those a row is not enough.

Pass `property_slug` instead of `listing_code` for shared space: a lift, a corridor light and a front gate belong to a building and to no room.

`GET /tickets?open=true` and `?overdue=true` list work. `PATCH /tickets/{id}` moves it: `status`, `severity`, `scheduled_for`, `resolution_note`, `charge_to_tenant`, and `{"chased": true}` to stamp a nudge and bump the count.

## What agents read

Grounding for replies and posts comes from `GET /listings` (prices, photos, features, available_from) and `GET /listings/{code}/calendar` (occupancy windows). There is deliberately no tenant identity anywhere on this API; if a task genuinely needs tenant data, it is not an agent task, it goes through Claudine's own session.

## Not yet on the API

Onboarding steps, tenant documents and the compliance required-set are still portal-only. Viewings (`property_viewings`) and the full worker claim/report protocol (`fn_claim_listing_work` / `fn_report_listing_result`) keep their existing paths for now. Migrating each skill onto the API is tracked as follow-up work per skill.
