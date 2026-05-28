# Millia ↔ Partners Webhook Handshake — v1

**Status:** Draft for implementation. Lazybee/Hyve side is the first partner.
**Owners:** Mark (Lazybee/Hyve, partner) · Jason (Millia, central hub).
**Schema version:** `1`.

Millia is the central hub. Partners (Lazybee being the first) conform to this
spec; Millia does not bend to partner-specific shapes. Both sides emit and
accept the same envelope, same auth scheme, same canonical statuses.

---

## 1. Overview

Maintenance tickets are mirrored bidirectionally:

- **Lazybee → Millia:** Lazybee OWNS ticket creation (tenants report via the
  Lazybee portal). Every INSERT/UPDATE on `maintenance_tickets` is shipped to
  Millia as `ticket.created` / `ticket.updated` / `ticket.closed`.
- **Millia → Lazybee:** When a Millia operator (RIA, captain, ops) advances the
  ticket (assigns, escalates, resolves), Millia POSTs back `ticket.updated` /
  `ticket.closed`. Lazybee reflects the change.
- **No `ticket.created` from Millia → Lazybee.** Lazybee is the system of record
  for ticket existence on its rooms.

Every payload is a **full ticket replay**, not a delta. Diff on the receiver.

---

## 2. Auth (symmetric)

Both directions use the same scheme:

| Header                  | Value                                          |
| ----------------------- | ---------------------------------------------- |
| `X-Millia-Signature`    | `sha256=<hex>` — HMAC-SHA256 (see below)       |
| `X-Millia-Timestamp`    | Unix seconds (integer string)                  |
| `X-Millia-Delivery-Id`  | UUID v4 — unique per HTTP attempt              |
| `Content-Type`          | `application/json`                             |

> Header prefix is `X-Millia-*` in both directions. Millia owns the protocol;
> partners conform.

### 2.1 Signature

Compute HMAC-SHA256 over the **literal string** `{timestamp}.{raw_body}`, using
the per-partner shared secret. **Not** just the body — the timestamp is part of
the signed material so it cannot be replayed independently.

```python
# Pseudocode
import hmac, hashlib

mac = hmac.new(
    key=PARTNER_SECRET.encode(),
    msg=f"{timestamp}.{raw_body}".encode(),
    digestmod=hashlib.sha256,
)
header = f"sha256={mac.hexdigest()}"
```

```ts
// Deno / WebCrypto
const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(SECRET),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign"],
);
const sig = await crypto.subtle.sign(
  "HMAC",
  key,
  new TextEncoder().encode(`${timestamp}.${rawBody}`),
);
```

### 2.2 Verification

1. Parse `X-Millia-Timestamp`. If `|now_server - timestamp| > 300` → reject
   `401 {"error": "stale_timestamp"}`.
2. Recompute the HMAC. **Constant-time compare** against the header value.
   Mismatch → `401 {"error": "invalid_signature"}`.
3. Only then parse the body.

### 2.3 Secret

- Single shared secret per partner. Env var name on the Lazybee side:
  `MILLIA_PARTNER_SECRET`. Same value used for inbound verification AND
  outbound signing (symmetric).
- Rotation is out of scope for v1 — coordinate manually.

---

## 3. Canonical status enum

Lowercase, exactly one of:

```
open | in_progress | on_hold | resolved | closed | cancelled
```

Partners that use a different internal vocabulary MUST translate on the way
out and on the way in.

Lazybee's local enum (`maintenance_tickets.status`) and its mapping:

| Lazybee (local) | Canonical (on the wire) |
| --------------- | ----------------------- |
| `OPEN`          | `open`                  |
| `IN_PROGRESS`   | `in_progress`           |
| `ESCALATED`     | `on_hold`               |
| `RESOLVED`      | `resolved`              |
| (none yet)      | `closed`                |
| (none yet)      | `cancelled`             |

`closed` and `cancelled` are **inbound-only** for Lazybee in v1 — Lazybee won't
emit them but must accept them. Receivers MUST `422 schema_violation` any
status outside the canonical set.

---

## 4. Envelope

Identical shape in both directions.

```json
{
  "event": "ticket.updated",
  "delivery_id": "0f1c9c5e-7d3b-4d4a-9c2f-3a5b8e6f1a90",
  "occurred_at": "2026-05-28T12:34:56Z",
  "ticket": {
    "id": "<owning-side ticket uuid>",
    "status": "in_progress",
    "category": "AC",
    "description": "Aircon not cooling, dripping water",
    "room": {
      "id": "<uuid>",
      "unit_code": "CP-MBR",
      "property_code": "CP",
      "property_name": "Chiltern Park"
    },
    "assignee": { "name": "Alam (Navid)", "role": "VENDOR" },
    "notes": "Vendor scheduled site visit 3pm Friday",
    "photos": [
      { "url": "https://diiilqpfmlxjwiaeophb.supabase.co/storage/v1/object/public/ticket-photos/abc.jpg" }
    ],
    "created_at": "2026-05-27T09:00:00Z",
    "updated_at": "2026-05-28T12:34:55Z"
  },
  "meta": { "source": "lazybee_partner", "schema_version": 1 }
}
```

- `ticket.id` is always the **owning side's** id. For Lazybee-originated
  tickets, that's `maintenance_tickets.id` on the Lazybee Supabase. Millia
  echoes that exact UUID back on subsequent updates.
- `ticket.assignee`, `ticket.notes`, `ticket.photos` are optional/nullable.
- `meta.source` is informational; receivers MUST NOT route on it.

---

## 5. Inbound spec (Millia → Lazybee)

From Jason's POV this is **outbound from Millia**.

- **URL:** `POST https://diiilqpfmlxjwiaeophb.supabase.co/functions/v1/ticket-status-callback`
- **Events emitted by Millia:** `ticket.updated`, `ticket.closed`. Never
  `ticket.created` — Lazybee owns creation.
- **Full ticket replay** on each event.
- **Behaviour on Lazybee side:** signature + timestamp + delivery_id checks,
  then enqueue in `partner_inbound_log` and 200 immediately. A separate worker
  applies the update to `maintenance_tickets` and stamps
  `last_sync_source = 'partner_inbound'` so the outbound trigger doesn't echo.

### 5.1 Response codes

| Code  | Body                                                                                | When                                                          |
| ----- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `200` | `{"received": true, "delivery_id": "...", "duplicate": false}`                      | Accepted + enqueued.                                          |
| `200` | `{"received": true, "delivery_id": "...", "duplicate": true}`                       | Idempotent replay — already processed.                        |
| `200` | `{"received": true, "delivery_id": "...", "duplicate": false, "status": "unmapped"}`| `ticket.id` not found locally. Don't retry — config issue.    |
| `401` | `{"error": "invalid_signature"}`                                                    | HMAC mismatch.                                                |
| `401` | `{"error": "stale_timestamp"}`                                                      | Missing/non-numeric timestamp, or `|delta| > 300s`.           |
| `422` | `{"error": "schema_violation", "detail": "..."}`                                    | Bad JSON, missing fields, status outside canonical enum, etc. |

Millia MUST retry on `5xx` and network errors. Millia MUST NOT retry on `4xx`
(including `401`/`422`) — those signal config issues, not transient failure.

### 5.2 Example — happy path

Request:

```http
POST /functions/v1/ticket-status-callback HTTP/1.1
X-Millia-Signature: sha256=4d2b...c81f
X-Millia-Timestamp: 1748431096
X-Millia-Delivery-Id: 0f1c9c5e-7d3b-4d4a-9c2f-3a5b8e6f1a90
Content-Type: application/json

{
  "event": "ticket.updated",
  "delivery_id": "0f1c9c5e-7d3b-4d4a-9c2f-3a5b8e6f1a90",
  "occurred_at": "2026-05-28T12:34:56Z",
  "ticket": {
    "id": "11111111-2222-3333-4444-555555555555",
    "status": "in_progress",
    "category": "AC",
    "description": "Aircon not cooling",
    "room": {"id": "...", "unit_code": "CP-MBR", "property_code": "CP", "property_name": "Chiltern Park"},
    "assignee": {"name": "Alam", "role": "VENDOR"},
    "notes": null,
    "photos": [],
    "created_at": "2026-05-27T09:00:00Z",
    "updated_at": "2026-05-28T12:34:55Z"
  },
  "meta": {"source": "millia_hub", "schema_version": 1}
}
```

Response: `200 {"received": true, "delivery_id": "0f1c9c5e-...", "duplicate": false}`

### 5.3 Example — replay

Same request as 5.2 (same `delivery_id`) sent a second time → 200 with
`duplicate: true`. No re-application.

### 5.4 Example — stale timestamp

`X-Millia-Timestamp: 1748430000` (older than 300s before server time)
→ `401 {"error": "stale_timestamp"}`.

### 5.5 Example — unknown ticket

`ticket.id = "deadbeef-..."` and no local row found → `200 {"received": true,
"delivery_id": "...", "duplicate": false, "status": "unmapped"}`. Logged for
Mark to investigate.

### 5.6 Example — bad status

`ticket.status = "WIP"` → `422 {"error": "schema_violation", "detail":
"invalid_status: WIP"}`.

---

## 6. Outbound spec (Lazybee → Millia)

From Jason's POV this is **inbound to Millia**.

- **URL:** Whatever Jason exposes. Env var on Lazybee side:
  `MILLIA_OUTBOUND_WEBHOOK_URL` (e.g.
  `https://millia-dev.fly.dev/api/v1/partners/lazybee/webhooks/tickets`).
- **Events emitted by Lazybee:** `ticket.created`, `ticket.updated`,
  `ticket.closed`.
- **Same envelope as §4.** Same auth (§2).
- **Trigger:** Supabase database webhook on `maintenance_tickets`
  INSERT/UPDATE → `/functions/v1/ticket-outbound-enqueue` → row in
  `partner_outbound_queue`. The worker (`/functions/v1/partner-outbound-worker`,
  scheduled `*/1 * * * *`) ships it.

### 6.1 Expected response from Millia

Millia MUST follow the response contract in §5.1 (the contract is symmetric).
Lazybee will treat any non-2xx as failure and apply backoff (§6.2).

### 6.2 Retry & dead-letter

- **Retry:** 1m, 2m, 5m, 15m, 30m, 1h, 2h, 4h, 8h (cap). Exponential-ish
  schedule, hard cap at 8h between attempts.
- **Stop condition:** 24h elapsed since `created_at` on the queue row, OR a
  2xx response.
- **Dead-letter:** row moves to `status = 'dead_lettered'`. We `console.error`
  the failure (RIA signal is on Jason's side, not ours). Mark watches function
  logs for these in v1.

### 6.3 Example — happy path

Lazybee POSTs the envelope from §4 to `MILLIA_OUTBOUND_WEBHOOK_URL`.
Millia validates, applies, returns `200 {"received": true, "delivery_id":
"<echo>", "duplicate": false}`. Queue row → `delivered`.

### 6.4 Example — Millia down

Lazybee POSTs, network error / `502`. Queue row stays `pending`, attempt
incremented, `next_attempt_at = now + 60s`. Continues per §6.2. After 24h →
`dead_lettered`.

### 6.5 Example — Millia rejects with 422

Lazybee sent a payload Millia considers malformed (e.g. unknown status — should
never happen with the mapping table in §3, but defensively). Lazybee does NOT
retry. Queue row → `dead_lettered` immediately on `4xx`. **TODO v1.1:** wire
this — current worker treats all non-2xx as retryable until 24h. For now, 4xx
will burn 24h of attempts before dead-lettering, which is wasteful but safe.

---

## 7. Echo prevention

Without care, this design would loop forever: Millia updates → callback to
Lazybee → Lazybee UPDATE → DB webhook → Lazybee outbound → Millia → callback…

The guard is a single column: `maintenance_tickets.last_sync_source`.

| Value                  | Meaning                                                            | Outbound emits? |
| ---------------------- | ------------------------------------------------------------------ | --------------- |
| `local`                | User/admin/API write inside Lazybee.                               | **YES**         |
| `partner_inbound`      | Last write came from a Millia webhook.                             | NO              |
| `outbound_to_partner`  | Audit stamp after the outbound worker successfully delivered.      | NO              |

**Rules:**

1. The `ticket-outbound-enqueue` DB-webhook handler filters
   `record.last_sync_source = 'local'`. Inbound-sourced writes never re-emit.
2. After the inbound worker applies a webhook update, it sets
   `last_sync_source = 'partner_inbound'` in the same UPDATE.
3. After the outbound worker successfully delivers, it stamps
   `last_sync_source = 'outbound_to_partner'` (audit only — outbound is already
   done, no re-emit risk).
4. Any subsequent `local` write (admin edit, tenant update, etc.) resets
   `last_sync_source` back to `local` and the loop continues normally.

### 7.1 Sequence diagram

```
Tenant submits ticket on Lazybee portal
  → maintenance_tickets INSERT (last_sync_source=local)
  → DB webhook → ticket-outbound-enqueue → partner_outbound_queue
  → partner-outbound-worker → POST Millia /api/v1/partners/lazybee/webhooks/tickets
  → Millia 200, queue row=delivered, ticket.last_sync_source=outbound_to_partner

Captain on Millia side marks ticket in_progress
  → Millia POST /functions/v1/ticket-status-callback
  → signature ok, partner_inbound_log INSERT (status=pending), 200
  → worker applies update: maintenance_tickets.status='IN_PROGRESS',
    last_sync_source='partner_inbound'
  → DB webhook fires → ticket-outbound-enqueue
  → record.last_sync_source != 'local' → SKIP. Loop broken.
```

---

## 8. Partner mapping bootstrap (admin-only)

- **URL:** `POST /functions/v1/partner-room-sync`
- **Auth:** Bearer JWT, role `ADMIN` (NOT signature-gated — this is a tooling
  endpoint, not webhook traffic).
- **Body:**
  ```json
  {
    "partner": "millia",
    "rooms": [
      {
        "partner_room_id": "<uuid on Millia side>",
        "partner_unit_code": "CP-MBR",
        "millia_property_id": "<uuid on Millia side>",
        "room_id": "<our rooms.id uuid>"
      }
    ]
  }
  ```
- Upserts into `partner_property_mappings` on PK `(partner, partner_room_id)`.
- Inbound webhooks reference tickets by `ticket.id` (Lazybee-owned UUID), so
  the mapping table is not strictly required for the v1 ticket flow. It IS
  required for future flows where Millia references rooms by partner-side ids
  (e.g. tenant moves, room status changes).
- Inbound webhook arriving for an unknown `ticket.id` → `200` with
  `status: "unmapped"`, logged in `partner_inbound_log`. Task is not modified.

---

## 9. Sequence summary

| Step | Actor       | Action                                                            |
| ---- | ----------- | ----------------------------------------------------------------- |
| 1    | Lazybee     | Tenant creates ticket → DB webhook → outbound queue → worker      |
| 2    | Lazybee     | POST `MILLIA_OUTBOUND_WEBHOOK_URL` with `ticket.created`          |
| 3    | Millia      | Verify HMAC + replay window + dedup. 200 immediately.             |
| 4    | Millia      | Worker creates / updates Millia-side ticket record.               |
| 5    | Millia      | Captain marks `in_progress`. Millia emits `ticket.updated`.       |
| 6    | Lazybee     | `/functions/v1/ticket-status-callback` verifies + enqueues. 200.  |
| 7    | Lazybee     | Worker applies, stamps `last_sync_source='partner_inbound'`.      |
| 8    | (no echo)   | DB webhook fires but enqueue handler skips non-local source.      |

---

## 10. Open items / v1.1 backlog

- **4xx → immediate dead-letter** in outbound worker (currently burns 24h of
  retries before dead-lettering on a 4xx — safe but wasteful).
- **Worker for inbound** — `partner_inbound_log` rows with `status='pending'`
  need a separate scheduled function (or Postgres trigger) to apply them to
  `maintenance_tickets`. Out of scope for the v1 initial implementation;
  pending Mark's call on whether to use a scheduled edge function or a SQL
  trigger.
- **Secret rotation** — manual coordination for now.
- **Per-partner secrets** — only one partner (Millia↔Lazybee) in v1. When a
  second partner appears, swap `MILLIA_PARTNER_SECRET` env var for a per-partner
  lookup keyed off the request URL or a `X-Millia-Partner` header.
- **RIA signal for dead-letters** — Lazybee currently `console.error`s. Adding
  a Telegram or Slack hook is trivial when needed.
- **Env var rename** — current secret is set as `LAZYBEE_WEBHOOK_SECRET` on the
  Lazybee project (legacy name from the prior pass). Either rename to
  `MILLIA_PARTNER_SECRET` or accept both (the edge functions currently fall back).
