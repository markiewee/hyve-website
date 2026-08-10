# PRD: Partner API v1.1, real bookings and the internal agent scope

*2026-08-10, same evening as v1 shipped. Mark's instruction, verbatim intent: partners and our own agents should be able to MAKE a booking and query its status, and the Mac mini agents (Roomies, Carousell, coliving and friends) should go through this API with their own keys instead of holding Supabase service credentials. Mark explicitly waived the review pause for this build ("you can just do the plan, PRD and launch without me actually telling you what to do"), so this document is the record, not a request for sign-off. Rule 19 remains the default for future work.*

## Problem

v1 ships booking REQUESTS (leads we confirm later) but no way to place a confirmed booking or track it. Separately, every automation that touches hyve-iot today carries the service-role key, which can read tenant PII and write anything. The agent survey (rooms-state, coliving room-type generator, airbnb-audit, update-all-platforms, the Roomies worker) shows what they actually need: room and rate grounding (already served by /listings and /calendar), a place to report platform listing state ("pushed and verified at T"), and now bookings.

## What ships

**Bookings.** `POST /bookings` places a confirmed hold: a `channel_bookings` row plus a `room_calendar` entry with kind PLATFORM_BOOKING, blocks true, source the channel slug. Overlaps are ACCEPTED silently by design (Mark's standing rule: overbooking is intentional, never auto-decline). `GET /bookings` lists the channel's own, `GET /bookings/{id}` reads one, `POST /bookings/{id}/cancel` cancels (booking status cancelled, calendar row CANCELLED). Same idempotency-key contract as booking requests. A new `booking.updated` webhook event fires on create and status change, to the owning channel only.

**Internal agent scope.** `channel_api_keys.scope`: `partner` (default) or `internal`. Internal keys unlock `POST /placements` and `GET /placements`: the agent reports `{listing_code, external_id?, url?, status?, pushed?, verified?, drift?, error?}` and the API upserts `listing_placements` for that channel, stamping `last_pushed_at` and `last_verified_at`. This is the "last updated thing": Roomies or Carousell refreshes a listing on-platform, then tells the API, and the placement row is the audit trail. Partners never see or touch placements.

**Reads for agents are already covered**: /listings carries prices, photos, features and available_from; /calendar carries occupancy windows. Tenant identity has no route through this API at all, which is the point of taking service keys away from the mini.

## Explicitly out (noted for later)

Viewings through the API (property_viewings inserts stay where they are), the full worker claim/report protocol (fn_claim_listing_work and fn_report_listing_result keep their existing RPC contract until deliberately ported), migrating each skill onto the API (follow-up task per skill).

## Success criteria

1. A partner or agent key can place a booking, list and read its own bookings, cancel one, and receive booking.updated webhooks, with idempotent retries safe.
2. A booking blocks the calendar (windows show it) and a cancel unblocks it.
3. Internal keys can report placements and read their own; partner keys get 403 there; nothing partner-visible changed shape (v1 whitelist tests still pass untouched).
4. Function count stays 12; production QA green including the cron-delivered booking.updated event; Roomies and Carousell channels hold internal keys at the end.
