# Lazybee Partner API v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public, versioned partner API (`lazybee.sg/api/v1`) plus a `/developers` docs page, exposing properties, listings, media, calendars, channel-resolved rates, booking-request intake and signed webhooks, without exceeding the 12-function Vercel cap.

**Architecture:** One catch-all Vercel function `api/v1/[...path].js` (the dead `api/send-room-request.js` is deleted in the same commit, holding the count at 12). All decision logic lives in pure `src/lib/partner*.js` modules tested with `node --test`, following the `api/booking/[...path].js` + `src/lib` pattern. Data comes from the listing-distribution tables already on this branch; prices resolve through `supabase/functions/_shared/channelPricing.js`; webhooks are driven by database triggers plus a pg_cron retry sweep (no polling).

**Tech Stack:** Vercel serverless (Node, ESM), @supabase/supabase-js (service role), node:crypto, node:test, React (docs page), Supabase Postgres with pg_net + pg_cron.

**Spec:** `docs/superpowers/specs/2026-08-10-partner-api-v1.md`. Branch: `feat/partner-api`, stacked on `feat/channel-pricing`.

**Conventions that bind every task:** no em-dashes in any file this plan creates; ESM everywhere; `process.env.VITE_IOT_SUPABASE_URL` + `IOT_SUPABASE_SERVICE_ROLE_KEY` for the client, exactly as `api/booking/[...path].js:39` does; conventional commit messages.

---

## File map

| File | Responsibility |
|---|---|
| `supabase/migrations/20260812000000_partner_api.sql` | Create: `channel_api_keys`, `booking_requests`, `webhook_subscriptions`, `webhook_deliveries`, `api_request_log`. RLS: service role only |
| `supabase/migrations/20260812000001_partner_api_webhooks.sql` | Create: change triggers that enqueue deliveries + pg_cron retry sweep |
| `src/lib/partnerAuth.js` (+ `.test.js`) | Key format, sha256 hashing, header parsing, rate-limit decision |
| `src/lib/partnerWindows.js` (+ `.test.js`) | Collapse `room_calendar` rows into anonymous open/unavailable windows |
| `src/lib/partnerSerialize.js` (+ `.test.js`) | Profile merge (NULL inherits, empty string blanks), resource shapes, rate card via `quotedPrice` |
| `src/lib/partnerWebhooks.js` (+ `.test.js`) | Event names, HMAC signing scheme |
| `api/v1/[...path].js` | The single router: auth, rate limit, endpoints, internal dispatch |
| `api/send-room-request.js` | DELETE (broken, zero callers) |
| `src/pages/DevelopersPage.jsx` | Public docs page |
| `src/App.jsx`, `scripts/prerender.mjs` | Route + prerender registration for `/developers` |
| `scripts/mint-partner-key.mjs` | Operator script: create partner channel + key, print once |

---

### Task 1: Schema migration

**Files:**
- Create: `supabase/migrations/20260812000000_partner_api.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Partner API v1: identity, intake, webhooks, audit.
--
-- A partner IS a listing_channels row (mechanism 'api'). These tables hang
-- off that row. Everything here is reachable only through the service role:
-- the API function authenticates partners itself, so no table below carries
-- an anon or authenticated policy on purpose.

begin;

-- Keys are stored hashed. The plaintext is shown once at mint time and never
-- persisted. rate_limit_per_min lives on the row so a partner can be slowed
-- without a deploy.
create table if not exists public.channel_api_keys (
  id                 uuid primary key default gen_random_uuid(),
  channel_id         uuid not null references public.listing_channels(id) on delete cascade,
  key_hash           text not null unique,
  label              text not null,
  rate_limit_per_min integer not null default 60 check (rate_limit_per_min > 0),
  created_at         timestamptz not null default now(),
  last_used_at       timestamptz,
  revoked_at         timestamptz
);
create index if not exists channel_api_keys_channel_idx on public.channel_api_keys (channel_id);

-- One row per inbound lead or booking request. The ENQUIRY row it creates in
-- room_calendar records but never blocks (Mark's rule); this table is the
-- partner-visible state machine.
create table if not exists public.booking_requests (
  id               uuid primary key default gen_random_uuid(),
  channel_id       uuid not null references public.listing_channels(id) on delete restrict,
  room_id          uuid not null references public.rooms(id) on delete restrict,
  idempotency_key  text,
  move_in          date not null,
  duration_months  numeric not null check (duration_months > 0),
  applicant_name   text not null,
  applicant_email  text not null,
  applicant_phone  text,
  applicant_nationality text,
  note             text,
  status           text not null default 'received'
                   check (status in ('received','in_review','confirmed','declined')),
  calendar_id      uuid references public.room_calendar(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- Same partner retrying the same submission must not create a second lead.
create unique index if not exists booking_requests_idem_key
  on public.booking_requests (channel_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists booking_requests_channel_idx
  on public.booking_requests (channel_id, created_at desc);

create table if not exists public.webhook_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  channel_id  uuid not null references public.listing_channels(id) on delete cascade,
  url         text not null,
  -- Subset of: listing.calendar.updated, listing.rates.updated,
  -- listing.profile.updated, booking_request.updated
  events      text[] not null,
  secret      text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists webhook_subscriptions_channel_idx
  on public.webhook_subscriptions (channel_id) where active;

-- One row per (event, subscription) delivery attempt chain. The dispatcher
-- delivers PENDING rows; failures stay PENDING with attempts incremented
-- until the cap, then become DEAD. Rows older than 30 days are pruned by the
-- retry sweep's cleanup statement.
create table if not exists public.webhook_deliveries (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.webhook_subscriptions(id) on delete cascade,
  event_type      text not null,
  payload         jsonb not null,
  status          text not null default 'PENDING'
                  check (status in ('PENDING','DELIVERED','DEAD')),
  attempts        integer not null default 0,
  last_error      text,
  created_at      timestamptz not null default now(),
  delivered_at    timestamptz
);
create index if not exists webhook_deliveries_pending_idx
  on public.webhook_deliveries (status, created_at) where status = 'PENDING';

-- Minimal audit: who called what, when, how it went. No bodies stored.
create table if not exists public.api_request_log (
  id         bigint generated always as identity primary key,
  key_id     uuid references public.channel_api_keys(id) on delete set null,
  method     text not null,
  path       text not null,
  status     integer not null,
  ms         integer,
  created_at timestamptz not null default now()
);
create index if not exists api_request_log_key_time_idx
  on public.api_request_log (key_id, created_at desc);

-- Service role only. Enabling RLS with no policies denies anon/authenticated.
alter table public.channel_api_keys      enable row level security;
alter table public.booking_requests      enable row level security;
alter table public.webhook_subscriptions enable row level security;
alter table public.webhook_deliveries    enable row level security;
alter table public.api_request_log       enable row level security;

commit;
```

- [ ] **Step 2: Apply to hyve-iot (additive only, nothing existing is touched)**

Run: `cd /Users/mark/Desktop/hyve-website && npx supabase db push --linked`
Expected: lists `20260812000000_partner_api.sql` as applied, exit 0. If the CLI is not linked, apply the file's SQL via the Supabase dashboard SQL editor on project `diiilqpfmlxjwiaeophb` instead (the flow used for prior migrations on this branch).

- [ ] **Step 3: Verify tables exist and are RLS-locked**

Run (dashboard SQL editor or psql):
```sql
select tablename, rowsecurity from pg_tables where tablename in
('channel_api_keys','booking_requests','webhook_subscriptions','webhook_deliveries','api_request_log');
```
Expected: 5 rows, all `rowsecurity = true`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260812000000_partner_api.sql
git commit -m "feat(partner-api): schema for keys, booking requests, webhooks, audit"
```

---

### Task 2: partnerAuth module

**Files:**
- Create: `src/lib/partnerAuth.js`
- Test: `src/lib/partnerAuth.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/lib/partnerAuth.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { mintKey, hashKey, parseAuthHeader, allowRequest } from "./partnerAuth.js";

test("mintKey produces the documented format and 256 bits of entropy", () => {
  const k = mintKey();
  assert.match(k, /^lzb_live_[A-Za-z0-9_-]{43}$/);
  assert.notEqual(mintKey(), k);
});

test("hashKey is a stable sha256 hex of the full key string", () => {
  const h = hashKey("lzb_live_abc");
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, hashKey("lzb_live_abc"));
  assert.notEqual(h, hashKey("lzb_live_abd"));
});

test("parseAuthHeader accepts only a well-formed bearer key", () => {
  assert.equal(parseAuthHeader("Bearer lzb_live_x"), "lzb_live_x");
  assert.equal(parseAuthHeader("bearer lzb_live_x"), "lzb_live_x");
  assert.equal(parseAuthHeader("Bearer sk_other"), null);
  assert.equal(parseAuthHeader(""), null);
  assert.equal(parseAuthHeader(undefined), null);
});

test("allowRequest is a strict under-limit check", () => {
  assert.equal(allowRequest(0, 60), true);
  assert.equal(allowRequest(59, 60), true);
  assert.equal(allowRequest(60, 60), false);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /Users/mark/Desktop/hyve-website && node --test src/lib/partnerAuth.test.js`
Expected: FAIL, cannot find module `./partnerAuth.js`.

- [ ] **Step 3: Implement**

```js
// src/lib/partnerAuth.js
//
// Partner API key handling. Pure on purpose, same reasoning as
// listingCanonical.js: what authenticates a partner is testable without a
// network. Keys look like lzb_live_<32 random bytes, base64url>; only the
// sha256 of the whole string is ever stored.

import { createHash, randomBytes } from "node:crypto";

export const KEY_PREFIX = "lzb_live_";

export function mintKey() {
  return KEY_PREFIX + randomBytes(32).toString("base64url");
}

export function hashKey(key) {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function parseAuthHeader(header) {
  if (!header || typeof header !== "string") return null;
  const m = header.match(/^bearer\s+(\S+)$/i);
  if (!m) return null;
  return m[1].startsWith(KEY_PREFIX) ? m[1] : null;
}

/** Fixed-window limiter decision: `count` requests already seen this minute. */
export function allowRequest(count, limitPerMin) {
  return count < limitPerMin;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test src/lib/partnerAuth.test.js`
Expected: 4 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add src/lib/partnerAuth.js src/lib/partnerAuth.test.js
git commit -m "feat(partner-api): key mint, hash, header parse, rate decision"
```

---

### Task 3: partnerWindows module

**Files:**
- Create: `src/lib/partnerWindows.js`
- Test: `src/lib/partnerWindows.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/lib/partnerWindows.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { unavailableWindows, calendarView } from "./partnerWindows.js";

const row = (starts_on, ends_on) => ({ starts_on, ends_on });

test("merges overlapping and adjacent blocking rows into one window", () => {
  const out = unavailableWindows(
    [row("2026-09-01", "2026-09-10"), row("2026-09-10", "2026-09-20"), row("2026-09-25", "2026-09-26")],
    { from: "2026-09-01", horizonDays: 60 }
  );
  assert.deepEqual(out, [
    { start: "2026-09-01", end: "2026-09-20" },
    { start: "2026-09-25", end: "2026-09-26" },
  ]);
});

test("null ends_on means occupied to the horizon", () => {
  const out = unavailableWindows([row("2026-09-01", null)], { from: "2026-08-15", horizonDays: 30 });
  assert.equal(out.length, 1);
  assert.equal(out[0].start, "2026-09-01");
  assert.equal(out[0].end, "2026-09-14"); // from + 30 days
});

test("windows before `from` are clipped, windows past horizon are clipped", () => {
  const out = unavailableWindows([row("2026-01-01", "2026-12-31")], { from: "2026-08-15", horizonDays: 10 });
  assert.deepEqual(out, [{ start: "2026-08-15", end: "2026-08-25" }]);
});

test("calendarView output carries ONLY start, end and status keys", () => {
  const view = calendarView(
    [{ starts_on: "2026-09-01", ends_on: "2026-09-10", kind: "TENANCY", source: "roomies", notes: "tenant Jane" }],
    { from: "2026-08-15", horizonDays: 90 }
  );
  for (const w of view) {
    assert.deepEqual(Object.keys(w).sort(), ["end", "start", "status"]);
    assert.ok(["open", "unavailable"].includes(w.status));
  }
});

test("calendarView interleaves open gaps between unavailable windows", () => {
  const view = calendarView([row("2026-09-01", "2026-09-10")], { from: "2026-08-15", horizonDays: 60 });
  assert.equal(view[0].status, "open");
  assert.equal(view[0].start, "2026-08-15");
  assert.equal(view[1].status, "unavailable");
  assert.equal(view[2].status, "open");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test src/lib/partnerWindows.test.js`
Expected: FAIL, cannot find module `./partnerWindows.js`.

- [ ] **Step 3: Implement**

```js
// src/lib/partnerWindows.js
//
// Collapse room_calendar rows into anonymous date windows for the partner
// API. The input rows are whatever the caller selected (ACTIVE, blocks=true);
// the output deliberately knows nothing but dates and a two-value status.
// Kind, source, notes and identity never pass through here, and the test
// asserts the exact key set to keep it that way.

const DAY_MS = 24 * 60 * 60 * 1000;

const toMs = (iso) => Date.parse(iso + "T00:00:00Z");
const toIso = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Merge blocking rows into disjoint [start, end] date windows, clipped to
 * [from, from + horizonDays]. `ends_on: null` reads as occupied forever. */
export function unavailableWindows(rows, { from, horizonDays }) {
  const fromMs = toMs(from);
  const horizonMs = fromMs + horizonDays * DAY_MS;
  const spans = rows
    .map((r) => ({
      start: Math.max(toMs(r.starts_on), fromMs),
      end: Math.min(r.ends_on == null ? horizonMs : toMs(r.ends_on), horizonMs),
    }))
    .filter((s) => s.end >= s.start && s.end >= fromMs && s.start <= horizonMs)
    .sort((a, b) => a.start - b.start);

  const merged = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end + DAY_MS) last.end = Math.max(last.end, s.end);
    else merged.push({ ...s });
  }
  return merged.map((s) => ({ start: toIso(s.start), end: toIso(s.end) }));
}

/** Full calendar: open gaps interleaved with unavailable windows. */
export function calendarView(rows, opts) {
  const busy = unavailableWindows(rows, opts);
  const fromMs = toMs(opts.from);
  const horizonMs = fromMs + opts.horizonDays * DAY_MS;
  const view = [];
  let cursor = fromMs;
  for (const w of busy) {
    const wStart = toMs(w.start);
    if (wStart > cursor) view.push({ start: toIso(cursor), end: toIso(wStart - DAY_MS), status: "open" });
    view.push({ start: w.start, end: w.end, status: "unavailable" });
    cursor = toMs(w.end) + DAY_MS;
  }
  if (cursor <= horizonMs) view.push({ start: toIso(cursor), end: toIso(horizonMs), status: "open" });
  return view;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test src/lib/partnerWindows.test.js`
Expected: 5 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add src/lib/partnerWindows.js src/lib/partnerWindows.test.js
git commit -m "feat(partner-api): anonymous calendar window collapsing"
```

---

### Task 4: partnerSerialize module

**Files:**
- Create: `src/lib/partnerSerialize.js`
- Test: `src/lib/partnerSerialize.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/lib/partnerSerialize.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { mergeProfiles, rateCard, listingResource, propertyResource } from "./partnerSerialize.js";

test("mergeProfiles: NULL inherits from property, empty string is a deliberate blank", () => {
  const property = { title: "Ivory Heights", description: "Condo near Jurong East.", fields: { house_rules: "No smoking", mrt: "Jurong East" } };
  const room = { title: "IH Standard 1", description: null, fields: { house_rules: "", view: "pool" } };
  const m = mergeProfiles(property, room);
  assert.equal(m.title, "IH Standard 1");
  assert.equal(m.description, "Condo near Jurong East."); // null inherited
  assert.equal(m.fields.house_rules, ""); // empty string stays blank
  assert.equal(m.fields.mrt, "Jurong East"); // inherited
  assert.equal(m.fields.view, "pool");
});

test("rateCard resolves through channel pricing: percent channel grossed up", () => {
  const card = rateCard(
    { price_monthly: 1500, deposit: 1500, min_stay_months: 3 },
    { commission_pct: 0.10, commission_months: null, gross_up: true, fee_fixed: null },
    12
  );
  assert.equal(card.monthly_rate, Math.round((1500 / 0.9) * 100) / 100);
  assert.equal(card.currency, "SGD");
  assert.equal(card.duration_months, 12);
});

test("rateCard with no commission configured quotes base", () => {
  const card = rateCard({ price_monthly: 1500, deposit: 1500, min_stay_months: 3 },
    { commission_pct: null, commission_months: null, gross_up: true, fee_fixed: null }, 12);
  assert.equal(card.monthly_rate, 1500);
});

test("listingResource exposes ONLY the documented keys", () => {
  const res = listingResource({
    code: "IH-STD1", propertySlug: "ivory-heights",
    profile: { title: "t", description: "d", fields: { features: ["aircon"], media: [{ url: "https://x/1.jpg", hero: true }] } },
    room: { price_monthly: 1500, deposit: 1500, min_stay_months: 3, max_occupancy: 2 },
    channel: { commission_pct: null, commission_months: null, gross_up: true, fee_fixed: null },
    availableFrom: "2026-09-01", durationMonths: 12,
  });
  assert.deepEqual(Object.keys(res).sort(),
    ["available_from", "code", "features", "links", "max_occupancy", "media", "profile", "property", "rate_card", "updated_at"].sort());
  assert.equal(res.links.canonical, "https://lazybee.sg/rooms/IH-STD1");
  assert.equal(res.links.book, "https://book.lazybee.sg");
});

test("propertyResource never leaks room or tenant data", () => {
  const res = propertyResource({
    slug: "ivory-heights",
    profile: { title: "Ivory Heights", description: "d", fields: { media: [], features: ["pool"] } },
    listingCount: 7,
  });
  assert.deepEqual(Object.keys(res).sort(),
    ["features", "links", "listing_count", "media", "profile", "slug", "updated_at"].sort());
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test src/lib/partnerSerialize.test.js`
Expected: FAIL, cannot find module `./partnerSerialize.js`.

- [ ] **Step 3: Implement**

```js
// src/lib/partnerSerialize.js
//
// Resource shapes for the partner API. The exact output key sets are asserted
// by tests: adding a field here without updating the test is a build failure,
// which is the mechanism that keeps tenant data and margin math out of the
// public surface. Prices resolve through the same arithmetic every other
// channel uses (channelPricing.js), so the API can never drift from what a
// platform listing would show.

import { quotedPrice } from "../../supabase/functions/_shared/channelPricing.js";

const SITE = "https://lazybee.sg";
const BOOKING = "https://book.lazybee.sg";

/** Room profile over property profile: NULL inherits, empty string blanks. */
export function mergeProfiles(propertyProfile, roomProfile) {
  const base = propertyProfile ?? {};
  const over = roomProfile ?? {};
  const pick = (a, b) => (b === null || b === undefined ? a ?? null : b);
  return {
    title: pick(base.title, over.title),
    description: pick(base.description, over.description),
    fields: { ...(base.fields ?? {}), ...Object.fromEntries(
      Object.entries(over.fields ?? {}).filter(([, v]) => v !== null && v !== undefined)
    ) },
  };
}

export function rateCard(room, channel, durationMonths) {
  const quoted = quotedPrice(Number(room.price_monthly), channel, durationMonths);
  return {
    monthly_rate: quoted == null ? Number(room.price_monthly) : Math.round(quoted * 100) / 100,
    deposit: room.deposit == null ? null : Number(room.deposit),
    min_stay_months: room.min_stay_months == null ? null : Number(room.min_stay_months),
    currency: "SGD",
    duration_months: durationMonths,
  };
}

export function listingResource({ code, propertySlug, profile, room, channel, availableFrom, durationMonths, updatedAt }) {
  return {
    code,
    property: propertySlug,
    profile: { title: profile.title ?? null, description: profile.description ?? null },
    media: profile.fields?.media ?? [],
    features: profile.fields?.features ?? [],
    rate_card: rateCard(room, channel, durationMonths),
    available_from: availableFrom ?? null,
    max_occupancy: room.max_occupancy ?? null,
    links: { canonical: `${SITE}/rooms/${code}`, book: BOOKING },
    updated_at: updatedAt ?? null,
  };
}

export function propertyResource({ slug, profile, listingCount, updatedAt }) {
  return {
    slug,
    profile: { title: profile.title ?? null, description: profile.description ?? null },
    media: profile.fields?.media ?? [],
    features: profile.fields?.features ?? [],
    listing_count: listingCount,
    links: { canonical: `${SITE}/properties/${slug}`, book: BOOKING },
    updated_at: updatedAt ?? null,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test src/lib/partnerSerialize.test.js`
Expected: 5 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add src/lib/partnerSerialize.js src/lib/partnerSerialize.test.js
git commit -m "feat(partner-api): resource serializers with asserted key whitelists"
```

---

### Task 5: partnerWebhooks module

**Files:**
- Create: `src/lib/partnerWebhooks.js`
- Test: `src/lib/partnerWebhooks.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/lib/partnerWebhooks.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { EVENT_TYPES, signPayload, verifySignature, eventForChange } from "./partnerWebhooks.js";

test("event catalogue is exactly the documented four", () => {
  assert.deepEqual([...EVENT_TYPES].sort(), [
    "booking_request.updated",
    "listing.calendar.updated",
    "listing.profile.updated",
    "listing.rates.updated",
  ]);
});

test("signature is HMAC-SHA256 over timestamp.body and round-trips", () => {
  const body = JSON.stringify({ a: 1 });
  const sig = signPayload("whsec_abc", body, 1723300000);
  assert.match(sig, /^t=1723300000,v1=[0-9a-f]{64}$/);
  assert.equal(verifySignature("whsec_abc", body, sig), true);
  assert.equal(verifySignature("whsec_abc", body + " ", sig), false);
  assert.equal(verifySignature("whsec_wrong", body, sig), false);
});

test("table changes map to event names", () => {
  assert.equal(eventForChange("room_calendar"), "listing.calendar.updated");
  assert.equal(eventForChange("listing_channels"), "listing.rates.updated");
  assert.equal(eventForChange("listing_profiles"), "listing.profile.updated");
  assert.equal(eventForChange("booking_requests"), "booking_request.updated");
  assert.equal(eventForChange("rooms"), "listing.rates.updated");
  assert.equal(eventForChange("unrelated_table"), null);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test src/lib/partnerWebhooks.test.js`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement**

```js
// src/lib/partnerWebhooks.js
//
// Webhook event naming and signing. The signature format is the widely
// understood t=<unix>,v1=<hmac> scheme so partners can verify with ten lines
// of code, documented on /developers.

import { createHmac, timingSafeEqual } from "node:crypto";

export const EVENT_TYPES = new Set([
  "listing.calendar.updated",
  "listing.rates.updated",
  "listing.profile.updated",
  "booking_request.updated",
]);

const TABLE_EVENTS = {
  room_calendar: "listing.calendar.updated",
  listing_channels: "listing.rates.updated",
  rooms: "listing.rates.updated",
  listing_profiles: "listing.profile.updated",
  booking_requests: "booking_request.updated",
};

export function eventForChange(table) {
  return TABLE_EVENTS[table] ?? null;
}

export function signPayload(secret, body, timestampSec) {
  const t = timestampSec ?? Math.floor(Date.now() / 1000);
  const mac = createHmac("sha256", secret).update(`${t}.${body}`, "utf8").digest("hex");
  return `t=${t},v1=${mac}`;
}

export function verifySignature(secret, body, header) {
  const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header ?? "");
  if (!m) return false;
  const expected = createHmac("sha256", secret).update(`${m[1]}.${body}`, "utf8").digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(m[2], "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test src/lib/partnerWebhooks.test.js`
Expected: 3 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add src/lib/partnerWebhooks.js src/lib/partnerWebhooks.test.js
git commit -m "feat(partner-api): webhook event catalogue and hmac signing"
```

---

### Task 6: The router function (and the send-room-request deletion)

**Files:**
- Create: `api/v1/[...path].js`
- Delete: `api/send-room-request.js`

- [ ] **Step 1: Write the router**

```js
// /api/v1/[...path]
//
// Lazybee Partner API v1. Single catch-all serverless function, same shape as
// /api/booking/[...path].js and for the same reason: the Hobby plan caps this
// repo at 12 functions. All logic that can be pure lives in src/lib/partner*
// with tests beside it; this file is wiring.
//
// Routes (all under /api/v1):
//   GET    /ping
//   GET    /properties            GET /properties/{slug}
//   GET    /listings              GET /listings/{code}
//   GET    /listings/{code}/calendar
//   POST   /booking-requests      GET /booking-requests/{id}
//   GET    /webhooks              POST /webhooks       DELETE /webhooks/{id}
//   POST   /internal/dispatch     (secret-gated, not partner-facing)
//
// Spec: docs/superpowers/specs/2026-08-10-partner-api-v1.md

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { hashKey, parseAuthHeader, allowRequest } from "../../src/lib/partnerAuth.js";
import { calendarView, unavailableWindows } from "../../src/lib/partnerWindows.js";
import { mergeProfiles, listingResource, propertyResource } from "../../src/lib/partnerSerialize.js";
import { EVENT_TYPES, signPayload, eventForChange } from "../../src/lib/partnerWebhooks.js";

const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);

const CALENDAR_HORIZON_DAYS = 365;
const DEFAULT_DURATION_MONTHS = 12;
const MAX_DELIVERY_ATTEMPTS = 8;

const err = (res, status, code, message) =>
  res.status(status).json({ error: { code, message } });

// ── Partner auth ─────────────────────────────────────────────────────
// Key -> channel row. Channel must be enabled (the kill switch gates the
// whole API) and the key not revoked. Rate limit is a fixed one-minute
// window counted from api_request_log.
async function authenticate(req) {
  const key = parseAuthHeader(req.headers.authorization);
  if (!key) return { error: [401, "unauthorized", "Missing or malformed Authorization header"] };
  const { data: keyRow } = await supabase
    .from("channel_api_keys")
    .select("id, rate_limit_per_min, revoked_at, channel:listing_channels(id, slug, name, enabled, commission_pct, commission_months, gross_up, fee_fixed)")
    .eq("key_hash", hashKey(key))
    .maybeSingle();
  if (!keyRow || keyRow.revoked_at) return { error: [401, "unauthorized", "Unknown or revoked key"] };
  if (!keyRow.channel?.enabled) return { error: [403, "channel_disabled", "This channel is not enabled"] };
  const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("api_request_log")
    .select("id", { count: "exact", head: true })
    .eq("key_id", keyRow.id)
    .gte("created_at", oneMinAgo);
  if (!allowRequest(count ?? 0, keyRow.rate_limit_per_min))
    return { error: [429, "rate_limited", "Rate limit exceeded; slow down"] };
  return { keyRow };
}

async function logRequest(keyId, req, status, startedMs) {
  try {
    await supabase.from("api_request_log").insert({
      key_id: keyId, method: req.method, path: req.url?.slice(0, 200) ?? "",
      status, ms: Date.now() - startedMs,
    });
    await supabase.from("channel_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyId);
  } catch { /* audit must never break serving */ }
}

// ── Data loads ───────────────────────────────────────────────────────
async function loadPropertyProfiles() {
  const { data } = await supabase
    .from("listing_profiles")
    .select("property_id, title, description, fields, updated_at, property:properties(id, name, slug)")
    .eq("scope", "PROPERTY");
  return data ?? [];
}

async function loadRoomListings() {
  const { data } = await supabase
    .from("listing_profiles")
    .select("room_id, title, description, fields, updated_at, room:rooms(id, code, price_monthly, deposit, min_stay_months, max_occupancy, is_active, property_id)")
    .eq("scope", "ROOM");
  return (data ?? []).filter((r) => r.room && r.room.is_active !== false);
}

async function availableFromFor(roomId) {
  const { data } = await supabase.rpc("fn_room_next_available", { p_room_id: roomId });
  return typeof data === "string" ? data : (data?.next_available ?? null);
}

// ── Handlers ─────────────────────────────────────────────────────────
async function handleProperties(res, slugFilter) {
  const [props, listings] = await Promise.all([loadPropertyProfiles(), loadRoomListings()]);
  const countByProperty = {};
  for (const l of listings) countByProperty[l.room.property_id] = (countByProperty[l.room.property_id] ?? 0) + 1;
  const out = props
    .filter((p) => p.property && (!slugFilter || p.property.slug === slugFilter))
    .map((p) => propertyResource({
      slug: p.property.slug,
      profile: { title: p.title ?? p.property.name, description: p.description, fields: p.fields },
      listingCount: countByProperty[p.property.id] ?? 0,
      updatedAt: p.updated_at,
    }));
  if (slugFilter && out.length === 0) return err(res, 404, "not_found", "No such property");
  return res.status(200).json(slugFilter ? out[0] : { data: out });
}

async function handleListings(res, channel, query, codeFilter) {
  const [props, listings] = await Promise.all([loadPropertyProfiles(), loadRoomListings()]);
  const propProfileById = Object.fromEntries(props.filter((p) => p.property).map((p) => [p.property.id, p]));
  const duration = clampDuration(query.duration_months);
  const rows = [];
  for (const l of listings) {
    if (codeFilter && l.room.code !== codeFilter) continue;
    const propRow = propProfileById[l.room.property_id];
    if (query.property && propRow?.property?.slug !== query.property) continue;
    const profile = mergeProfiles(
      propRow ? { title: propRow.title, description: propRow.description, fields: propRow.fields } : null,
      { title: l.title, description: l.description, fields: l.fields }
    );
    const availableFrom = await availableFromFor(l.room.id);
    if (query.available_from && availableFrom && availableFrom > query.available_from) continue;
    const resource = listingResource({
      code: l.room.code, propertySlug: propRow?.property?.slug ?? null, profile,
      room: l.room, channel, availableFrom, durationMonths: duration, updatedAt: l.updated_at,
    });
    if (query.max_rate && resource.rate_card.monthly_rate > Number(query.max_rate)) continue;
    rows.push(resource);
  }
  if (codeFilter) {
    if (rows.length === 0) return err(res, 404, "not_found", "No such listing");
    return res.status(200).json(rows[0]);
  }
  return res.status(200).json({ data: rows });
}

function clampDuration(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_DURATION_MONTHS;
  return Math.min(Math.max(n, 1), 36);
}

async function handleCalendar(res, code) {
  const { data: room } = await supabase.from("rooms").select("id, code").eq("code", code).maybeSingle();
  if (!room) return err(res, 404, "not_found", "No such listing");
  const from = new Date().toISOString().slice(0, 10);
  const { data: rows } = await supabase
    .from("room_calendar")
    .select("starts_on, ends_on")
    .eq("room_id", room.id).eq("status", "ACTIVE").eq("blocks", true);
  return res.status(200).json({
    listing: code,
    from, horizon_days: CALENDAR_HORIZON_DAYS,
    windows: calendarView(rows ?? [], { from, horizonDays: CALENDAR_HORIZON_DAYS }),
  });
}

async function handleCreateBookingRequest(req, res, channel) {
  const b = req.body ?? {};
  const missing = ["listing_code", "move_in", "duration_months"].filter((f) => !b[f]);
  if (!b.applicant?.name || !b.applicant?.email) missing.push("applicant.name/email");
  if (missing.length) return err(res, 422, "validation_failed", `Missing: ${missing.join(", ")}`);
  const { data: room } = await supabase.from("rooms").select("id, code").eq("code", b.listing_code).maybeSingle();
  if (!room) return err(res, 422, "validation_failed", "Unknown listing_code");

  if (b.idempotency_key) {
    const { data: existing } = await supabase
      .from("booking_requests").select("id, status, created_at")
      .eq("channel_id", channel.id).eq("idempotency_key", b.idempotency_key).maybeSingle();
    if (existing) return res.status(200).json(bookingRequestView(existing, b.listing_code));
  }

  // Enquiry records, never blocks: Mark's rule, enforced at insert.
  const { data: cal } = await supabase.from("room_calendar").insert({
    room_id: room.id, starts_on: b.move_in, ends_on: null, kind: "ENQUIRY",
    source: channel.slug, status: "ACTIVE", blocks: false, auto_created: true,
    notes: `Partner API booking request`,
  }).select("id").single();

  const { data: created, error: insErr } = await supabase.from("booking_requests").insert({
    channel_id: channel.id, room_id: room.id, idempotency_key: b.idempotency_key ?? null,
    move_in: b.move_in, duration_months: b.duration_months,
    applicant_name: b.applicant.name, applicant_email: b.applicant.email,
    applicant_phone: b.applicant.phone ?? null, applicant_nationality: b.applicant.nationality ?? null,
    note: b.note ?? null, calendar_id: cal?.id ?? null,
  }).select("id, status, created_at").single();
  if (insErr) return err(res, 500, "internal", "Could not record the request");

  await notifyAdmin(channel, b, room.code);
  return res.status(201).json(bookingRequestView(created, room.code));
}

const bookingRequestView = (row, code) => ({
  id: row.id, listing_code: code, status: row.status, created_at: row.created_at,
});

// Resend, the portal's transport (see api/portal/claim-reserve.js).
async function notifyAdmin(channel, b, roomCode) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Lazybee Co-living <hello@lazybee.sg>",
        to: ["admin@lazybee.sg"],
        subject: `Partner booking request: ${roomCode} via ${channel.name}`,
        text: `Channel: ${channel.name}\nListing: ${roomCode}\nMove-in: ${b.move_in} for ${b.duration_months} months\nApplicant: ${b.applicant.name} <${b.applicant.email}> ${b.applicant.phone ?? ""}\nNote: ${b.note ?? ""}`,
      }),
    });
  } catch { /* notification failure must not fail the request */ }
}

async function handleGetBookingRequest(res, channel, id) {
  const { data } = await supabase
    .from("booking_requests").select("id, status, created_at, room:rooms(code)")
    .eq("id", id).eq("channel_id", channel.id).maybeSingle();
  if (!data) return err(res, 404, "not_found", "No such booking request for this key");
  return res.status(200).json(bookingRequestView(data, data.room?.code ?? null));
}

// ── Webhook subscription CRUD ────────────────────────────────────────
async function handleWebhooks(req, res, channel, id) {
  if (req.method === "GET") {
    const { data } = await supabase.from("webhook_subscriptions")
      .select("id, url, events, active, created_at").eq("channel_id", channel.id).eq("active", true);
    return res.status(200).json({ data: data ?? [] });
  }
  if (req.method === "POST") {
    const { url, events } = req.body ?? {};
    if (!url || !/^https:\/\//.test(url)) return err(res, 422, "validation_failed", "url must be https");
    if (!Array.isArray(events) || events.length === 0 || !events.every((e) => EVENT_TYPES.has(e)))
      return err(res, 422, "validation_failed", `events must be a non-empty subset of: ${[...EVENT_TYPES].join(", ")}`);
    const secret = "whsec_" + randomBytes(24).toString("base64url");
    const { data } = await supabase.from("webhook_subscriptions")
      .insert({ channel_id: channel.id, url, events, secret }).select("id, url, events, created_at").single();
    return res.status(201).json({ ...data, secret });
  }
  if (req.method === "DELETE" && id) {
    await supabase.from("webhook_subscriptions").update({ active: false })
      .eq("id", id).eq("channel_id", channel.id);
    return res.status(204).end();
  }
  return err(res, 405, "method_not_allowed", "Unsupported method");
}

// ── Internal dispatch (DB trigger + retry sweep call this) ───────────
async function handleDispatch(req, res) {
  if (req.headers["x-dispatch-secret"] !== process.env.PARTNER_DISPATCH_SECRET)
    return err(res, 401, "unauthorized", "Bad dispatch secret");
  const { data: pending } = await supabase
    .from("webhook_deliveries")
    .select("id, event_type, payload, attempts, subscription:webhook_subscriptions(id, url, secret, active)")
    .eq("status", "PENDING").lte("attempts", MAX_DELIVERY_ATTEMPTS).limit(50);
  let delivered = 0, failed = 0;
  for (const d of pending ?? []) {
    if (!d.subscription?.active) {
      await supabase.from("webhook_deliveries").update({ status: "DEAD", last_error: "subscription inactive" }).eq("id", d.id);
      continue;
    }
    const body = JSON.stringify({ id: d.id, type: d.event_type, created_at: new Date().toISOString(), data: d.payload });
    try {
      const r = await fetch(d.subscription.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lazybee-Signature": signPayload(d.subscription.secret, body) },
        body, signal: AbortSignal.timeout(5000),
      });
      if (r.ok) {
        await supabase.from("webhook_deliveries").update({ status: "DELIVERED", delivered_at: new Date().toISOString() }).eq("id", d.id);
        delivered++;
      } else throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      const attempts = d.attempts + 1;
      await supabase.from("webhook_deliveries").update({
        attempts, last_error: String(e).slice(0, 300),
        status: attempts >= MAX_DELIVERY_ATTEMPTS ? "DEAD" : "PENDING",
      }).eq("id", d.id);
      failed++;
    }
  }
  return res.status(200).json({ delivered, failed });
}

// ── Router ───────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const started = Date.now();
  const segs = [].concat(req.query.path ?? []);
  const [head, second, third] = segs;

  if (req.method === "OPTIONS") return res.status(204).end();
  if (head === "internal" && second === "dispatch" && req.method === "POST")
    return handleDispatch(req, res);

  const auth = await authenticate(req);
  if (auth.error) return err(res, ...auth.error);
  const { keyRow } = auth;
  const channel = keyRow.channel;

  const finish = (status) => logRequest(keyRow.id, req, status, started);
  const originalJson = res.json.bind(res);
  res.json = (payload) => { finish(res.statusCode); return originalJson(payload); };

  try {
    if (head === "ping" && req.method === "GET")
      return res.status(200).json({ ok: true, partner: channel.name, version: "v1" });
    if (head === "properties" && req.method === "GET")
      return handleProperties(res, second ?? null);
    if (head === "listings" && req.method === "GET" && third === "calendar")
      return handleCalendar(res, second);
    if (head === "listings" && req.method === "GET")
      return handleListings(res, channel, req.query, second ?? null);
    if (head === "booking-requests" && req.method === "POST" && !second)
      return handleCreateBookingRequest(req, res, channel);
    if (head === "booking-requests" && req.method === "GET" && second)
      return handleGetBookingRequest(res, channel, second);
    if (head === "webhooks")
      return handleWebhooks(req, res, channel, second ?? null);
    return err(res, 404, "not_found", "Unknown route; see https://lazybee.sg/developers");
  } catch (e) {
    console.error("partner api error:", e);
    return err(res, 500, "internal", "Something went wrong on our side");
  }
}
```

- [ ] **Step 2: Delete the dead function**

Run: `git rm api/send-room-request.js`
Expected: file removed. (It calls `nodemailer.createTransporter`, which does not exist, and nothing in `src/` references the route: verified 10 Aug.)

- [ ] **Step 3: Syntax-check and count functions**

Run: `node --check "api/v1/[...path].js" && find api -type f -name '*.js' | wc -l`
Expected: no syntax error, count prints `12`.

- [ ] **Step 4: Run the whole partner test suite**

Run: `node --test src/lib/partnerAuth.test.js src/lib/partnerWindows.test.js src/lib/partnerSerialize.test.js src/lib/partnerWebhooks.test.js`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add "api/v1/[...path].js"
git commit -m "feat(partner-api): v1 catch-all router; drop dead send-room-request

Function count holds at 12 (one in, one out)."
```

---

### Task 7: Webhook enqueue triggers and retry sweep

**Files:**
- Create: `supabase/migrations/20260812000001_partner_api_webhooks.sql`

- [ ] **Step 1: Write the migration**

Follow the secret + `net.http_post` pattern from `20260810000000_rent_crons_support.sql` (read it first; it defines how this database stores callable secrets and schedules crons). The migration must:

```sql
-- Partner webhook plumbing. Changes enqueue deliveries synchronously in the
-- trigger (cheap inserts), then poke the dispatcher over pg_net. A pg_cron
-- sweep redelivers failures and prunes old rows. The dispatch URL and secret
-- live in the same config mechanism rent_crons_support established.

begin;

-- Fan out one delivery row per active subscription that wants this event.
create or replace function public.fn_partner_enqueue_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_event text;
  v_payload jsonb;
begin
  v_event := case tg_table_name
    when 'room_calendar'    then 'listing.calendar.updated'
    when 'listing_channels' then 'listing.rates.updated'
    when 'rooms'            then 'listing.rates.updated'
    when 'listing_profiles' then 'listing.profile.updated'
    when 'booking_requests' then 'booking_request.updated'
  end;
  if v_event is null then return null; end if;

  -- Payloads carry pointers, never contents: the partner re-reads the API,
  -- which applies all the whitelisting in one place.
  v_payload := jsonb_build_object(
    'table', tg_table_name,
    'change', lower(tg_op),
    'occurred_at', now()
  );
  if tg_table_name = 'room_calendar' then
    v_payload := v_payload || jsonb_build_object('room_id', coalesce(new.room_id, old.room_id));
  elsif tg_table_name = 'booking_requests' then
    v_payload := v_payload || jsonb_build_object('booking_request_id', coalesce(new.id, old.id));
  end if;

  insert into public.webhook_deliveries (subscription_id, event_type, payload)
  select s.id, v_event, v_payload
  from public.webhook_subscriptions s
  where s.active and v_event = any(s.events)
    -- booking_request events go only to the channel that owns the request
    and (tg_table_name <> 'booking_requests' or s.channel_id = coalesce(new.channel_id, old.channel_id));

  return null;
end $$;

drop trigger if exists trg_partner_events_calendar on public.room_calendar;
create trigger trg_partner_events_calendar
  after insert or update or delete on public.room_calendar
  for each row execute function public.fn_partner_enqueue_event();

drop trigger if exists trg_partner_events_profiles on public.listing_profiles;
create trigger trg_partner_events_profiles
  after insert or update on public.listing_profiles
  for each row execute function public.fn_partner_enqueue_event();

drop trigger if exists trg_partner_events_channels on public.listing_channels;
create trigger trg_partner_events_channels
  after update on public.listing_channels
  for each row execute function public.fn_partner_enqueue_event();

drop trigger if exists trg_partner_events_rooms on public.rooms;
create trigger trg_partner_events_rooms
  after update of price_monthly on public.rooms
  for each row execute function public.fn_partner_enqueue_event();

drop trigger if exists trg_partner_events_requests on public.booking_requests;
create trigger trg_partner_events_requests
  after update of status on public.booking_requests
  for each row execute function public.fn_partner_enqueue_event();

commit;
```

Then append (same file) the dispatcher poke and sweep, using the exact secret-storage and `cron.schedule` idiom found in `20260810000000_rent_crons_support.sql` (mirror its helper if one exists rather than inventing a second mechanism): a statement-level poke is unnecessary; a `cron.schedule('partner-webhook-dispatch', '* * * * *', ...)` calling `net.http_post('https://lazybee.sg/api/v1/internal/dispatch', headers with X-Dispatch-Secret)` delivers within a minute and doubles as the retry sweep, plus a daily `delete from public.webhook_deliveries where created_at < now() - interval '30 days'` scheduled as `partner-webhook-prune`. If `rent_crons_support` stores secrets in a config table, read `PARTNER_DISPATCH_SECRET` from there; generate the value with `openssl rand -base64 32` and set the same value as a Vercel env var.

- [ ] **Step 2: Apply and verify**

Run: `npx supabase db push --linked` (or dashboard SQL editor).
Then verify: `select jobname from cron.job where jobname like 'partner-webhook%';`
Expected: `partner-webhook-dispatch` and `partner-webhook-prune`.

- [ ] **Step 3: Smoke the queue end to end**

In SQL editor: insert a test subscription pointing at a request-bin URL you control, update any `room_calendar` row's `notes`, wait 60s, confirm the bin received a signed POST and `webhook_deliveries.status = 'DELIVERED'`. Delete the test subscription and delivery rows after.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260812000001_partner_api_webhooks.sql
git commit -m "feat(partner-api): event triggers, minutely dispatch, retry sweep"
```

---

### Task 8: Key mint script

**Files:**
- Create: `scripts/mint-partner-key.mjs`

- [ ] **Step 1: Write the script**

```js
// scripts/mint-partner-key.mjs
//
// Mint an API key for a partner channel. Creates the channel row if the slug
// does not exist (mechanism 'api', enabled FALSE: a human flips the kill
// switch after commercials are agreed). Prints the key ONCE; only the hash
// is stored.
//
// Usage:
//   node scripts/mint-partner-key.mjs <channel-slug> "<Partner Name>" [label]
// Env: VITE_IOT_SUPABASE_URL, IOT_SUPABASE_SERVICE_ROLE_KEY (same as api/).

import { createClient } from "@supabase/supabase-js";
import { mintKey, hashKey } from "../src/lib/partnerAuth.js";

const [slug, name, label = "default"] = process.argv.slice(2);
if (!slug || !name) {
  console.error('Usage: node scripts/mint-partner-key.mjs <channel-slug> "<Partner Name>" [label]');
  process.exit(1);
}

const supabase = createClient(process.env.VITE_IOT_SUPABASE_URL, process.env.IOT_SUPABASE_SERVICE_ROLE_KEY);

let { data: channel } = await supabase.from("listing_channels").select("id, slug, enabled").eq("slug", slug).maybeSingle();
if (!channel) {
  ({ data: channel } = await supabase
    .from("listing_channels")
    .insert({ slug, name, mechanism: "api", enabled: false })
    .select("id, slug, enabled")
    .single());
  console.log(`created channel ${slug} (enabled=false; flip it when commercials are signed)`);
}

const key = mintKey();
const { error } = await supabase.from("channel_api_keys").insert({ channel_id: channel.id, key_hash: hashKey(key), label });
if (error) { console.error("insert failed:", error.message); process.exit(1); }

console.log(`\nPartner:  ${name} (${slug})`);
console.log(`Label:    ${label}`);
console.log(`API key (shown once, store it now):\n\n  ${key}\n`);
console.log(`Channel enabled: ${channel.enabled}. Rates: set commission on listing_channels to activate channel pricing.`);
```

- [ ] **Step 2: Verify against live (safe: creates a disabled channel)**

Run: `cd /Users/mark/Desktop/hyve-website && set -a && source .env.local 2>/dev/null; node scripts/mint-partner-key.mjs smoke-test "Smoke Test"`
Expected: prints a `lzb_live_...` key once. Then in SQL editor: confirm `channel_api_keys` has one row whose `key_hash` is 64 hex chars, and delete the smoke-test channel row (cascade removes the key).

- [ ] **Step 3: Commit**

```bash
git add scripts/mint-partner-key.mjs
git commit -m "feat(partner-api): operator key mint script"
```

---

### Task 9: /developers docs page

**Files:**
- Create: `src/pages/DevelopersPage.jsx`
- Modify: `src/App.jsx` (route, beside the `/faqs` route at src/App.jsx:119)
- Modify: `scripts/prerender.mjs` (add `/developers` to the route list and to the changefreq/priority maps near lines 177 and 185)

- [ ] **Step 1: Write the page**

Structure and styling copy `src/pages/FAQsPage.jsx` (same layout components, same design tokens; read it first and mirror its imports). Content sections, in order, each an `<h2>` with prose and `<pre>` blocks for examples:

1. **Overview**: what the API is, base URL `https://lazybee.sg/api/v1`, JSON, SGD, ISO 8601 dates, version v1.
2. **Authentication**: `Authorization: Bearer lzb_live_...`; keys are issued per partner; request access via `partners@lazybee.sg`. Example curl:
```
curl -s https://lazybee.sg/api/v1/ping -H "Authorization: Bearer $LAZYBEE_API_KEY"
```
3. **Properties**: `GET /properties`, `GET /properties/{slug}`, example response built from the real `propertyResource` shape (slug, profile, media, features, listing_count, links, updated_at).
4. **Listings**: `GET /listings` with `property`, `available_from`, `max_rate`, `duration_months` params; `GET /listings/{code}`; example response with the real `listingResource` shape including `rate_card`.
5. **Calendar**: `GET /listings/{code}/calendar`; explain windows are `open` or `unavailable` and carry no occupant information by design.
6. **Booking requests**: `POST /booking-requests` request body, `idempotency_key` semantics, status lifecycle `received / in_review / confirmed / declined`, `GET /booking-requests/{id}`.
7. **Webhooks**: `POST /webhooks` with events list, the four event types, the `Lazybee-Signature: t=...,v1=...` scheme, and a 10-line Node verification snippet using `crypto.createHmac("sha256", secret).update(t + "." + body)`.
8. **Rate limits and errors**: default 60 requests/minute per key, `429` on excess, error envelope `{ "error": { "code", "message" } }`.
9. **Request access**: one line, `partners@lazybee.sg`.

No fabricated changelog, no invented dates anywhere on the page.

- [ ] **Step 2: Register the route**

In `src/App.jsx`, import the page and add beside the FAQs route:
```jsx
<Route path="/developers" element={<DevelopersPage />} />
```

In `scripts/prerender.mjs`, add `/developers` wherever `/faqs` appears in the route list, plus `'/developers': 'monthly'` to the changefreq map and `'/developers': '0.5'` to the priority map.

- [ ] **Step 3: Build and verify prerender**

Run: `npm run build`
Expected: build green; `dist/developers/index.html` exists; the prerender guard (h1/links/canonical checks) passes for the new route.

- [ ] **Step 4: Commit**

```bash
git add src/pages/DevelopersPage.jsx src/App.jsx scripts/prerender.mjs
git commit -m "feat(partner-api): /developers docs page, prerendered"
```

---

### Task 10: Preview deploy smoke test

**Files:** none (verification only)

- [ ] **Step 1: Push the branch and get the preview URL**

Run: `git push -u origin feat/partner-api`
Expected: Vercel builds a preview. Confirm in the Vercel dashboard the deployment lists exactly 12 functions. Set `PARTNER_DISPATCH_SECRET` in Vercel env (all environments) before smoking webhooks.

- [ ] **Step 2: Mint a smoke key and curl the read surface**

Using the smoke-test channel from Task 8 (recreate it, then SQL: `update listing_channels set enabled = true where slug = 'smoke-test';`):

```bash
K="lzb_live_..." ; B="https://<preview-url>/api/v1"
curl -s $B/ping -H "Authorization: Bearer $K"                    # {"ok":true,...}
curl -s $B/properties -H "Authorization: Bearer $K"              # 3 properties
curl -s $B/listings?property=ivory-heights -H "Authorization: Bearer $K"
curl -s $B/listings/IH-STD1/calendar -H "Authorization: Bearer $K"
curl -s $B/ping                                                  # 401 envelope
```

- [ ] **Step 3: PII sweep on real output**

Run: `curl -s $B/listings -H "Authorization: Bearer $K" ; curl -s $B/listings/IH-STD1/calendar -H "Authorization: Bearer $K"` and grep the combined output for every current tenant surname and email domain from `tenant_profiles` (pull the list from SQL first). Expected: zero matches, and calendar windows contain only `start`, `end`, `status`.

- [ ] **Step 4: Booking request round trip**

```bash
curl -s -X POST $B/booking-requests -H "Authorization: Bearer $K" -H "Content-Type: application/json" \
  -d '{"listing_code":"IH-STD1","move_in":"2026-10-01","duration_months":6,"idempotency_key":"smoke-1","applicant":{"name":"Smoke Test","email":"smoke@example.com"}}'
```
Expected: 201 with `{id, listing_code, status: "received"}`; repeating the exact call returns 200 with the same id; a `room_calendar` ENQUIRY row exists with `blocks = false`; admin email received. Then `update booking_requests set status='declined'` in SQL and confirm the webhook fires to a registered test subscription. Clean up all smoke rows (booking request, calendar row, subscription, channel).

- [ ] **Step 5: Log completion**

Update TODO.md and the loops board per house rules. Do not merge: the PR waits for Mark's review.

---

## Self-review notes (run after drafting, fixed inline)

- Spec coverage: properties, listings, media, features, calendar, rate_card (channel-resolved with duration param), booking requests + idempotency + ENQUIRY non-blocking row + Resend notify, webhook CRUD + signed delivery + retry + prune, manual keys + kill switch, /developers page, function count 12, PII whitelists tested. `available_from` reuses `fn_room_next_available`. All spec sections have tasks.
- The `fn_room_next_available` rpc argument name must be checked against `20260810000004` at implementation time (the function signature gained a defaulted argument; call it with named args exactly as defined there).
- Type consistency: `channel` object shape (`commission_pct, commission_months, gross_up, fee_fixed, slug, name, enabled, id`) is identical in authenticate(), serializers and mint script. Window key set (`start, end, status`) is asserted in tests and restated in docs page copy.
- Deliberate scope cuts (YAGNI, spec-sanctioned): no pagination cursors in v1 (19 listings; the envelope `{data: [...]}` leaves room to add them without breaking), no self-serve keys, no outbound push mappers.
