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

## What agents read

Grounding for replies and posts comes from `GET /listings` (prices, photos, features, available_from) and `GET /listings/{code}/calendar` (occupancy windows). There is deliberately no tenant identity anywhere on this API; if a task genuinely needs tenant data, it is not an agent task, it goes through Claudine's own session.

## Not yet on the API

Viewings (`property_viewings`) and the full worker claim/report protocol (`fn_claim_listing_work` / `fn_report_listing_result`) keep their existing paths for now. Migrating each skill onto the API is tracked as follow-up work per skill.
