# PRD: Lazybee Partner API v1

*2026-08-10. Owner: Mark. Status: awaiting approval. Spec: `docs/superpowers/specs/2026-08-10-partner-api-v1.md`. Plan: `docs/superpowers/plans/2026-08-10-partner-api-v1.md`. Branch: `feat/partner-api-v1`.*

## Problem

Aggregator platforms want to list Lazybee inventory and send us tenants. The first concrete request (Pranjal Singh's team, 10 Aug) asks for API access to photos, availability, pricing, amenities, descriptions, booking data and property URLs. Today the only way to give any platform our inventory is manual copying, which is exactly the drift problem the listing-distribution layer was built to kill. There is no public surface a partner can integrate against, and every future partner conversation hits the same wall.

## What we ship

A public, versioned partner API at `https://lazybee.sg/api/v1` plus a `lazybee.sg/developers` docs page. It is a thin HTTP surface over the listing-distribution layer already in production (listing profiles, room calendar, channel pricing), so partners consume the same single source of truth the site does.

**Read:** properties (3 buildings), listings (19 rooms) with media, features, merged profiles, links and `available_from`, per-listing calendars as anonymous open/unavailable date windows.

**Write:** `POST /booking-requests` lets a partner push a tenant lead. It records an enquiry that never blocks the room, notifies admin@lazybee.sg, and gives the partner a status they can poll: received, in review, confirmed, declined.

**Push:** webhook subscriptions with signed deliveries for calendar, rate, profile and booking-request changes. Database triggers enqueue, a minutely sweep delivers and retries. Partners never need to poll us.

**Docs:** one prerendered page in the site design covering auth, every endpoint with example responses, webhook signature verification, rate limits, and a request-access contact. Versioned plainly as v1.

## How pricing behaves

A partner is a row in `listing_channels` with their commission terms. Their key returns rates resolved through the existing channel-pricing arithmetic: base price until we configure their commission, their grossed-up contracted rate after. We never expose base and partner rate side by side, so margin math stays ours. Rate quotes accept a `duration_months` parameter because month-based agent commissions depend on lease length.

## Access model

Keys are minted by us with a one-command script, shown once, stored hashed, revocable, rate-limited per key. The channel `enabled` kill switch gates the entire API per partner, so a key can exist before commercials are signed and the partner still gets nothing until we flip the switch.

## What v1 deliberately does not do

Self-serve signup or key dashboards, OAuth, pagination (19 listings; the response envelope leaves room to add it without a breaking change), outbound push to partner systems, availability import from partners, multi-currency, any exposure of tenant identity, other channels' data, or commission structures.

## Safety rails

Zero tenant PII in any response or event, enforced by tests that assert exact output key sets. New tables are service-role only. Webhook payloads carry pointers, not content, so all whitelisting lives in one place. Deliveries are HMAC-signed. The function count stays at exactly 12 (the new catch-all replaces the dead, broken `send-room-request` function), so deploys stay on the free plan.

## Success criteria

1. Pranjal's team can integrate from the docs page alone, without a call: pull inventory, read calendars and rates, register a webhook, push a booking request.
2. Function count is 12 after merge and the build stays green.
3. PII sweep on live responses finds nothing, and the key-whitelist tests lock that in.
4. A new partner goes from "yes" to working key in under a day using the mint script.

## Rollout

Build on `feat/partner-api-v1` per the implementation plan (10 tasks, TDD, one migration pair, preview-deploy smoke test before review). After merge: set the dispatch secret env var, mint Pranjal's key with commission unset, flip `enabled` when Mark says so, and reply to Pranjal's email with the docs URL. The reply email is drafted for Mark's approval, not auto-sent.

## Open questions for Mark

1. The docs page needs a request-access contact. `partners@lazybee.sg` does not exist yet: create it as an alias, or use founders@lazybee.sg?
2. Pranjal's commercial terms are unknown. Proposed default: mint his key now with no commission configured (he sees base prices), set the real modifier when the deal is agreed. OK?
3. Rate limit default of 60 requests per minute per partner: fine, or set higher for launch?
