# Lazybee Viewing Booking — V2 Design

**Date:** 2026-05-06
**Status:** Approved by Mark, ready for implementation
**Replaces:** `2026-04-01-lazybee-viewing-booking-system-design.md` (3-way poll workflow — DELETED)

---

## Goal

Make booking a Lazybee room viewing **bulletproof** — kill the failure modes that have been bleeding leads:
1. **No-shows** (A)
2. **Captain conflicts** (B)
3. **Multi-channel chaos** (C) — leads from Roomies/Carousell/PG/IG/WA fall through cracks
4. **Scheduling friction** (D) — back-and-forth WA to find time → prospect drops off
5. **Access fails** (E) — door code wrong, prospect can't get in
6. **Post-viewing void** (F) — viewing happens, no follow-up

Out of scope for V2:
- Captain confirm-each-booking + escalation chain (manual for now)
- Backup captain logic (manual)
- Competing prospects priority queue (G — not picked as failure mode)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Public:  lazybee.sg/book                    /book/[prop]/[room]│
│  Admin:   lazybee.sg/portal/admin/viewings                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│  Next.js API routes (lazybee-website)                          │
│  - /api/book/slots?property=X&date=Y                        │
│  - /api/book/create                                          │
│  - /api/book/cancel?token=...                                │
│  - /api/auth/google/{login,callback}                         │
│  - /api/cron/viewing-reminders  (Vercel Cron, hourly)        │
└──┬───────────────┬────────────────────────────┬─────────────┘
   │               │                            │
   ▼               ▼                            ▼
┌────────┐   ┌──────────────┐         ┌────────────────────┐
│Supabase│   │Google Cal API│         │ Resend             │
│(lazybee-  │   │              │         │                    │
│ iot,   │   │"Lazybee Viewings│         │ confirm / 24h /    │
│ diiilq │   │  " calendar  │         │ 2h / cancel /      │
│ pfmlxj │   │              │         │ captain notify     │
│ wiae)  │   │              │         │                    │
└────────┘   └──────────────┘         └────────────────────┘
```

**One-line flow:** Prospect lands on deep-link → page calls `/api/book/slots` (time bands MINUS busy events on Lazybee Viewings cal) → prospect picks slot + fills form → `/api/book/create` writes Supabase row, creates Google Cal event, sends 3 emails (prospect confirmation w/ .ics, captain notify, you notify).

---

## Hybrid intake (kills C — multi-channel chaos)

Every reply across Roomies / Carousell / PropertyGuru / IG / WhatsApp contains the **same booking URL**. Deep links per room land prospect on a pre-filled booking page:
- `lazybee.sg/book/IH/PR1` → "Book a viewing for Premium Room 1 at Ivory Heights"
- `lazybee.sg/book` → generic landing, prospect picks property → room

If prospect goes silent on chat, Claudine pivots to concierge mode (existing behavior, unchanged).

---

## Data model

### Extend existing `property_viewings` table

```sql
ALTER TABLE property_viewings
  ADD COLUMN slot_start          timestamptz,
  ADD COLUMN slot_end            timestamptz,
  ADD COLUMN gcal_event_id       text,
  ADD COLUMN cancel_token        text UNIQUE,
  ADD COLUMN source              text, -- 'roomies' | 'carousell' | 'pg' | 'ig' | 'wa' | 'organic'
  ADD COLUMN reminder_24h_sent_at  timestamptz,
  ADD COLUMN reminder_2h_sent_at   timestamptz;

-- Backfill slot_start from existing viewing_date + viewing_time
-- (one-shot for any V1 records we keep)

-- Status enum (ensure these values exist):
-- 'pending' | 'confirmed' | 'cancelled' | 'no_show' | 'attended'
```

### New `leads` table (separate intake from viewings)

```sql
CREATE TABLE leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  email           text,
  phone           text,
  property_interest text[],  -- ['TG','IH','CP']
  first_contact_at timestamptz NOT NULL DEFAULT now(),
  source          text,
  status          text DEFAULT 'new',  -- 'new' | 'viewing_booked' | 'viewed' | 'closed_won' | 'closed_lost'
  viewing_id      uuid REFERENCES property_viewings(id),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX leads_email_idx ON leads(email);
CREATE INDEX leads_phone_idx ON leads(phone);
CREATE INDEX leads_status_idx ON leads(status);
```

A booking creates BOTH a `property_viewings` row AND a `leads` row (if no existing lead with same email/phone).

---

## Google Calendar integration

### One-time setup (Mark)

1. Google Cloud Console → OAuth 2.0 Client ID (Web app)
2. Authorized redirect URIs:
   - `https://lazybee.sg/api/auth/google/callback`
   - `http://localhost:3000/api/auth/google/callback`
3. Create dedicated **"Lazybee Viewings"** Google Calendar
4. Drop **Client ID + Secret + Calendar ID** into Vercel env

### Code

`src/lib/googleCalendar.js`:
- `getOAuthClient()` — uses stored refresh token in env var
- `listFreeBusy(startISO, endISO)` — read busy ranges on Lazybee Viewings cal
- `createEvent({summary, description, start, end, attendees})` — write event, returns `{id, htmlLink}`
- `cancelEvent(eventId)` — cancel by ID
- `getAvailableSlots(date, propertyCode)` — apply BOOKING_BANDS env, subtract busy ranges, return free 30-min slots

### Slot calculation

- `BOOKING_BANDS` env var (JSON):
  ```json
  {"weekday":["19:00-21:00"],"weekend":["11:00-15:00"]}
  ```
- Slots are 30-min increments within bands
- Apply `BOOKING_LEAD_TIME_HOURS` (default 12) → no same-day, no <12h ahead bookings
- Apply `BOOKING_HORIZON_DAYS` (default 14) → 2-week horizon
- Subtract busy events from the cal → return free slots

---

## API routes

### `GET /api/book/slots`

Query: `?property=IH&date=2026-05-10` (optional `room=PR1`)
Response:
```json
{
  "slots": [
    {"start":"2026-05-10T11:00:00+08:00","end":"2026-05-10T11:30:00+08:00"},
    {"start":"2026-05-10T11:30:00+08:00","end":"2026-05-10T12:00:00+08:00"}
  ]
}
```

### `POST /api/book/create`

Body:
```json
{
  "property":"IH",
  "room":"PR1",            // optional
  "slot_start":"2026-05-10T11:00:00+08:00",
  "name":"Jane Doe",
  "email":"jane@example.com",
  "phone":"+6591234567",
  "source":"roomies",
  "notes":"Looking for May move-in"
}
```

Logic (in transaction):
1. Re-check slot still free (race condition guard)
2. Generate `cancel_token` (32 bytes random hex)
3. Insert `property_viewings` row (status=`confirmed`)
4. Upsert `leads` row, link via `viewing_id`
5. Create Google Cal event:
   - Summary: `Lazybee Viewing — Jane Doe @ IH-PR1`
   - Description: prospect details + cancel link
   - Attendees: prospect email
6. Update viewing row with `gcal_event_id`
7. Fire 3 emails via Resend:
   - Prospect: confirmation w/ .ics + cancel link
   - Captain (assigned to property): notify
   - Mark (admin@lazybee.sg): notify

Response:
```json
{ "success": true, "viewing_id": "...", "cancel_url": "..." }
```

### `GET /api/book/cancel?token=...`

Public page (no auth) — confirms cancel.

### `POST /api/book/cancel?token=...`

Logic:
1. Find viewing by `cancel_token`
2. Set status=`cancelled`
3. Cancel Google Cal event
4. Email prospect + captain + Mark
5. Free up the slot

---

## Email cadence (Resend)

Extend `supabase/functions/viewing-notify/index.ts`:

| Trigger | Recipient | Template |
|---|---|---|
| Booking created | Prospect | `viewing-confirmation` (incl. .ics, cancel link, address, captain WA) |
| Booking created | Captain | `viewing-captain-notify` (prospect details, time, room) |
| Booking created | Mark | `viewing-admin-notify` (slim summary) |
| 24h before | Prospect | `viewing-reminder-24h` (re-confirm + cancel link) |
| 2h before | Prospect | `viewing-reminder-2h` (door code, mailbox loc, captain phone, parking) |
| Booking cancelled | All 3 | `viewing-cancelled` |

Templates extend the existing lazybee.sg-branded HTML pattern in `viewing-notify/index.ts`.

---

## Vercel Cron

`vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/viewing-reminders", "schedule": "0 * * * *" }
  ]
}
```

`/api/cron/viewing-reminders` runs hourly:
- Query confirmed viewings within 23-25h window where `reminder_24h_sent_at IS NULL` → send + mark
- Query confirmed viewings within 1.5-2.5h window where `reminder_2h_sent_at IS NULL` → send + mark

---

## Public pages

### `/book` (landing)

- Property selector (3 cards: TG / IH / CP, each with image + room count)
- Click → `/book/[property]`

### `/book/[property]` (property selected)

- Hero with property photos, location, price range
- Optional room selector (or "I'm flexible" → no room_id)
- Date picker (next 14 days, weekend/weekday distinction)
- Slot list (loads via `/api/book/slots`)
- Form: name, email, phone, optional notes, source (auto-set from URL `?src=roomies`)
- Submit → `/api/book/create` → redirect to `/book/confirmed/[viewing_id]`

### `/book/[property]/[room]` (deep link)

Same as above, room pre-selected.

### `/book/confirmed/[viewing_id]`

- "Booked! See you Sat 2pm @ IH"
- Add-to-calendar button (.ics download)
- Cancel link
- Captain WhatsApp link
- Property address + meeting point instructions

### `/book/cancel?token=...`

- "Cancel viewing for Sat 2pm @ IH?"
- Confirm button → POST cancel → success page

---

## Admin page (refactor existing)

`src/pages/portal/AdminViewingsPage.jsx`:

- Replace V1 V2 split with single page
- Live calendar grid (next 14 days) — green = free, blue = booked
- List view: upcoming viewings, sortable by date / property / captain
- Click viewing → modal with full details + cancel button
- "Override availability" — block out a slot manually (creates a non-bookable event on Lazybee Viewings cal)
- Lead tab: all leads, filter by status

Delete `AdminViewingsPageV2.jsx` and `CaptainViewingsPage.jsx` (poll-era).

---

## Failure mode coverage

| Failure | How V2 fixes |
|---|---|
| **A. No-shows** | Confirmation + 24h + 2h reminders w/ re-confirm; cancel link makes graceful exit easy → fewer ghosts |
| **B. Captain conflicts** | Slots come from Google Cal free/busy → if captain blocks time on cal, slot disappears; manual confirm out of scope (V3) |
| **C. Multi-channel chaos** | Single deep-link URL pasted in every reply → all channels converge into one funnel |
| **D. Scheduling friction** | Self-serve calendar widget → no back-and-forth; commits prospect immediately |
| **E. Access fails** | 2h reminder includes door code, mailbox loc, captain WA, parking — fresh and timed perfectly |
| **F. Post-viewing void** | Lead status auto-updates `viewing_booked` → `viewed` (cron post-slot); admin sees stale viewings, can trigger follow-up |

---

## Cleanup (DELETE before/during build)

**Tables (Supabase, lazybee-iot project `diiilqpfmlxjwiaeophb`):**
- `viewing_polls`
- `viewing_poll_responses`

**Files:**
- `src/pages/viewing/ViewingPollPage.jsx`
- `src/pages/portal/AdminViewingsPageV2.jsx`
- `src/pages/portal/CaptainViewingsPage.jsx`
- Old `/view/{token}` poll routes (refactor to `/book/[property]/[room]`)

**Docs:**
- `docs/superpowers/specs/2026-04-01-lazybee-viewing-booking-system-design.md`
- `docs/superpowers/specs/2026-04-01-lazybee-viewing-pages-stitch-brief.md`

---

## Implementation phases

1. **Foundation** — Mark provides OAuth creds + Cal ID; migration applied; old poll tables/files deleted
2. **Backend** — googleCalendar.js lib; /api/book/* routes; viewing-notify extended
3. **Frontend** — /book pages + admin refactor
4. **Cron + reminders** — Vercel cron + 24h/2h templates
5. **QA + cutover** — test end-to-end with a fake booking; deploy; update Roomies/Carousell/PG templates with new deep links

---

## Open questions / V3 backlog

- Captain confirm-each-booking + escalation (manual today)
- Competing prospects priority (G — out of scope V2)
- WhatsApp deep-linking on confirmation page (wa.me/<captain>?text=...)
- SMS reminders (Twilio) — only if email open rate is bad
- Multi-room comparison viewings ("show me PR1 + STD2 in one slot")
- Captain availability set per-day in admin (override BOOKING_BANDS)
