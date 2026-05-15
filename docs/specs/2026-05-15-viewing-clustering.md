# Viewing Clustering — Spec
*Lazybee booking V3 · 2026-05-15 · author: Claudine on behalf of Mark*

> One-line problem: Mark hosts every viewing across CP / IH / TG. The current `/book` lets prospects pick any time on any day, which produces geographically impossible clusters (Serangoon → Jurong East → Serangoon in 30 min). This spec replaces free-pick with **3 weekly windows + property-anchored clustering** so each window collapses into 1 property + a same-day cluster.

This is a **V3 booking** — additive on the V2 GCal-backed booking system already shipped (`docs/specs/2026-05-06-lazybee-viewing-booking-v2-design.md`). It does not throw away the V2 plumbing (Google Calendar, Resend, viewing-notify edge fn, cancel tokens, `property_viewings` table). It replaces the slot computation and adds an off-horizon lead capture path.

---

## 1. Core mechanic

### 1.1 The 3 windows
Hard-coded — never configurable from the public form. Mark can override via GCal control plane (§1.3).

| Window key | Day | SGT range | Duration | Slot count (15 min grid) |
|---|---|---|---|---|
| `fri-evening` | Friday | 19:00 – 22:00 | 3 h | 12 |
| `sat-morning` | Saturday | 10:00 – 13:00 | 3 h | 12 |
| `sun-afternoon` | Sunday | 16:00 – 18:00 | 2 h | 8 |

All other day/time combinations: **booking form shows closed**, no fallback.
Per-week max if all 3 windows fully booked: **32 viewings/week** (12 + 12 + 8).
Per-week max with realistic single-property anchor + 30 min travel buffer cross-property: ~20.

### 1.2 Slot grid
- Slot length: **15 min**.
- Each viewing reserves **1 slot**.
- Same-property back-to-back: **allowed, no buffer between**.
- Cross-property: **30 min travel buffer required after last booked slot of prior cluster**.
- Per day, per property: **at most 1 cluster** (a second TG booking same day must extend the existing TG cluster or be denied).
- Per slot: **at most 1 prospect** (no group viewings).

### 1.3 GCal control plane (Mark-driven, default)
Calendar: `viewings.lazybee.sg@gmail.com` — already exists, env `HYVE_VIEWINGS_CAL_ID` (rename pending → `LAZYBEE_VIEWINGS_CAL_ID`).

**Open a window:** Mark drops a single GCal event titled exactly `booking window` at the **start time** of one of the 3 weekly windows. Duration of the GCal event is irrelevant — just its existence at that start time.

- `Friday 19:00 SGT` GCal event named `booking window` → opens Fri-evening
- `Saturday 10:00 SGT` GCal event named `booking window` → opens Sat-morning
- `Sunday 16:00 SGT` GCal event named `booking window` → opens Sun-afternoon

**Close a window:** No event present at that start time → window stays closed all week.

**Pre-anchor a property (admin override):** Mark titles the GCal event `booking window — TG only` (or `IH only`, `CP only`). The property-only suffix is parsed by the slot resolver and locks the window to that property before any prospect books.

**Why GCal as control plane:** Mark already lives in his GCal. Zero new UI. The GCal sync is already implemented (`src/lib/googleCalendar.js`) — we extend it, not replace it.

### 1.4 First-booking anchor (auto)
If a window is open (GCal event exists, no `— XX only` suffix), the **first booking of that window** assigns the property anchor. From then until the end of the window, the property is locked.

If a prospect cancels and they were the only booking in that window, the anchor unlocks and the next booking re-anchors.

### 1.5 Booking horizon
Rolling **7 days**. Form only shows windows whose start time is `now ≤ start ≤ now + 7d`. Anything further out → off-horizon capture flow (§4).

---

## 2. Slot state machine

For a given (window, slot, property-of-interest), the slot resolver returns one of:

| State | Meaning | UI treatment |
|---|---|---|
| `OPEN-ANY` | Window open, no anchor yet, slot is far enough from any existing booking → any property can claim. | Clickable, "Open" |
| `PROP-RESERVED` | Window has an anchor or sub-anchor, this slot is within the 30-min travel rule for the prospect's property → only same-property prospects can book. | Clickable for matching property, greyed for others ("Booked for IH this week") |
| `BLOCKED-BUFFER` | Within 30 min of an existing-cluster boundary on the *other* side — i.e. would conflict with a cross-property travel buffer. | Greyed, "Travel buffer" |
| `BOOKED` | Already taken by an active viewing (status ∈ {`pending`, `confirmed`}). | Greyed, "Booked" |
| `WINDOW-CLOSED` | No GCal `booking window` event covers this window. | Greyed, "Closed this week" |
| `OUT-OF-HORIZON` | Window is > 7 days out. | Hidden entirely from the slot grid; off-horizon capture shown below. |

### 2.1 Resolver algorithm (single-prospect view)
Inputs:
- `propertyOfInterest` (CP | IH | TG) — from URL `/book/:property`
- `windows[]` — fixed list of next 7 days' Fri-evening, Sat-morning, Sun-afternoon windows
- `bookings[]` — all `property_viewings WHERE status IN ('pending','confirmed') AND slot_start BETWEEN start_of_window AND end_of_window`
- `gcalEvents[]` — events on viewings cal in the same range (filtered to those titled `booking window` or `booking window — XX only`)

For each window:

```
state = derive_window_state(window, gcalEvents)   // CLOSED | OPEN-ANY | OPEN-PROP(X)
if state == CLOSED:
    mark all 12 slots as WINDOW-CLOSED
    continue

cluster_anchor = null
if state == OPEN-PROP(X):
    cluster_anchor = X
elif bookings.window > 0:
    cluster_anchor = bookings.window[0].property   // first booking sets anchor

for each slot in window:
    if slot is in bookings (active):
        slot.state = BOOKED
        continue

    if cluster_anchor is null:
        // window is open, no bookings yet
        slot.state = OPEN-ANY
        continue

    // cluster has an anchor. compute earliest/latest booked slot in cluster.
    earliest = min(b.slot_start for b in bookings if b.property == cluster_anchor)
    latest   = max(b.slot_end   for b in bookings if b.property == cluster_anchor)

    if propertyOfInterest == cluster_anchor:
        // same-property — must be adjacent to existing cluster (no gap), or window edge
        if slot.start >= earliest - 0min and slot.end <= latest + 30min_extension_max:
            // adjacent or extending
            slot.state = PROP-RESERVED  // (clickable for them)
        else:
            slot.state = PROP-RESERVED  // (still allowed for them — entire window belongs to anchor)
    else:
        // cross-property: must respect 30-min travel buffer
        if slot.end <= earliest - 30min or slot.start >= latest + 30min:
            slot.state = OPEN-ANY (sub-anchor candidate for this prospect's property)
        elif slot.end <= earliest or slot.start >= latest:
            // within 30 min of cluster boundary
            slot.state = BLOCKED-BUFFER
        else:
            slot.state = PROP-RESERVED  // greyed for them

    // window-edge exception: at exact window.start or window.end, no buffer needed
    if slot.start == window.start or slot.end == window.end:
        if slot.state == BLOCKED-BUFFER:
            slot.state = OPEN-ANY  // start/end exempt
```

After the cluster_anchor is determined, the resolver also checks for **sub-anchors** (one cross-property cluster booked already in the window). For each sub-anchor, repeat the buffer check. Implementation: walk bookings sorted by `slot_start`, group adjacent same-property bookings into clusters, then for each (cluster_i, cluster_i+1) gap require ≥ 30 min for cross-property.

### 2.2 Worked example (Mark approved)
Friday 16 May 19:00–22:00 SGT window. 12 slots: 19:00, 19:15, 19:30, 19:45, 20:00, 20:15, 20:30, 20:45, 21:00, 21:15, 21:30, 21:45.

| Event | Result |
|---|---|
| T+0: Alice books **TG 19:45–20:00** | Anchor = TG. Cluster_TG = [19:45, 20:00). |
| T+0 state for TG prospect | 19:00–19:30 = `PROP-RESERVED` (TG can use). 19:45 = `BOOKED`. 20:00–21:45 = `PROP-RESERVED`. |
| T+0 state for CP prospect | 19:00–19:15 = `OPEN-ANY` (window-edge exception). 19:30 = `BLOCKED-BUFFER` (15 min before TG). 19:45 = `BOOKED`. 20:00–20:15 = `BLOCKED-BUFFER` (within 30 min after TG end). 20:30–21:45 = `OPEN-ANY` (sub-anchor candidate, exactly 30 min after TG ends). |
| T+1: Bob (CP) tries **20:00** | Blocked — within 30 min of TG end (TG ends 20:00, CP needs ≥ 20:30). Form rejects with "earliest CP slot tonight is 20:30". |
| T+2: Bob (CP) books **20:30–20:45** | Sub-anchor CP. Cluster_CP = [20:30, 20:45). |
| T+2 state for TG prospect | 20:00–20:15 = `PROP-RESERVED` (TG can extend). 20:30 = `BOOKED`. 21:00–21:45 = `OPEN-ANY` (sub-anchor for TG, ≥ 30 min after CP). Wait — TG already anchored, so 21:00–21:45 stays as `PROP-RESERVED` extending TG cluster. **Cross-buffer rule applies in both directions.** A TG booking at 21:00 would not violate any rule (≥ 30 min after CP ends 20:45). Allowed. |
| T+3: Carl (TG) tries **20:15–20:30** | Would extend TG cluster to end 20:30, which would push CP buffer to 21:00 — but CP is already booked at 20:30. **Blocked: "would invalidate existing CP booking at 20:30."** |

### 2.3 Cancellation logic
When a viewing is cancelled (`status = 'cancelled'`):
1. Remove from `bookings[]` for resolver purposes.
2. Recompute cluster_anchor from remaining bookings in that window.
3. If `cluster_anchor` becomes null → window unlocks back to `OPEN-ANY` for next first-booker.
4. Downstream cross-property bookings stay valid (cancelling shouldn't ever invalidate someone who's already booked).
5. **No automatic re-shuffling.** No rescheduling notifications. The slot just becomes available for the next form load.

---

## 3. Data model changes

### 3.1 `property_viewings` — add `viewing_rules_version`
```sql
ALTER TABLE property_viewings
  ADD COLUMN IF NOT EXISTS viewing_rules_version TEXT NOT NULL DEFAULT 'v0';

-- Backfill: existing 24 rows get 'v0' (grandfathered)
UPDATE property_viewings SET viewing_rules_version = 'v0' WHERE viewing_rules_version IS NULL;

-- New bookings created via the V3 flow set 'v1'
```

`v0` = grandfathered, do not apply clustering rules retroactively.
`v1` = subject to V3 clustering rules.

### 3.2 `leads` — extend `intent` JSONB for off-horizon capture
No new columns. Already-existing `intent jsonb` and `activity_log jsonb` carry everything.

`intent` shape additions:
```json
{
  "off_horizon": true,
  "target_move_in_date": "2026-08-15",
  "reminder_due_at": "2026-08-05T10:00:00+08:00",
  "reminder_channel": ["whatsapp", "email"],
  "reminder_sent_count": 0,
  "reminder_last_sent_at": null,
  "preferred_property": "TG",
  "preferred_room_code": "TG-PR2"
}
```

`activity_log` entry types added:
- `off_horizon_captured`
- `reminder_fired` (with `channel` payload)
- `reminder_snoozed` (admin manual)
- `reminder_bumped` (admin manual)
- `auto_marked_cold` (after 2 unanswered reminders)

### 3.3 `viewing_windows` — derived view (read-only, optional helper)
Not strictly required (can compute in app code) but useful for the admin Kanban / debugging:

```sql
-- A function rather than a table — windows are not stored, they're derived
CREATE OR REPLACE FUNCTION public.get_viewing_windows(_horizon_days int DEFAULT 7)
RETURNS TABLE (
  window_key text,
  window_start timestamptz,
  window_end   timestamptz,
  day_of_week  text
) LANGUAGE sql STABLE AS $$
  WITH days AS (
    SELECT generate_series(
      date_trunc('day', now() AT TIME ZONE 'Asia/Singapore'),
      date_trunc('day', now() AT TIME ZONE 'Asia/Singapore') + ((_horizon_days - 1) || ' days')::interval,
      '1 day'
    ) AS d
  )
  SELECT
    CASE EXTRACT(DOW FROM d)::int
      WHEN 5 THEN 'fri-evening'
      WHEN 6 THEN 'sat-morning'
      WHEN 0 THEN 'sun-afternoon'
    END AS window_key,
    (CASE EXTRACT(DOW FROM d)::int
      WHEN 5 THEN d + interval '19 hours'
      WHEN 6 THEN d + interval '10 hours'
      WHEN 0 THEN d + interval '16 hours'
    END) AT TIME ZONE 'Asia/Singapore' AS window_start,
    (CASE EXTRACT(DOW FROM d)::int
      WHEN 5 THEN d + interval '22 hours'
      WHEN 6 THEN d + interval '13 hours'
      WHEN 0 THEN d + interval '18 hours'
    END) AT TIME ZONE 'Asia/Singapore' AS window_end,
    to_char(d, 'Day') AS day_of_week
  FROM days
  WHERE EXTRACT(DOW FROM d)::int IN (0, 5, 6);
$$;
```

Use is optional — most resolution happens in `src/lib/viewingClustering.js` (new file). The function exists for SQL-based reporting and admin dashboards.

---

## 4. Off-horizon prospect capture

### 4.1 Trigger
Bottom of `/book/:property` form: "Need a date further out? Tell us your move-in date and we'll ping you when slots open." mini-form with:
- name (required)
- email or phone (at least one required)
- target move-in date (required, must be > 7 days away)
- preferred property (defaulted from URL)
- preferred room code (optional)

### 4.2 Save behaviour
`POST /api/booking/leads/off-horizon` →
```js
{
  name, email, phone, target_move_in_date,
  property: 'TG', room_code: 'TG-PR2',
  source: 'organic'
}
```
Inserts a `leads` row with:
- `status = 'new'`
- `property_interest = ['TG']`
- `intent.off_horizon = true`
- `intent.target_move_in_date = '2026-08-15'`
- `intent.reminder_due_at = target_move_in_date - 10 days` (so we reach out 7-10 days before)
- `intent.reminder_channel = ['whatsapp', 'email']`
- `intent.reminder_sent_count = 0`
- `activity_log` += `{type: 'off_horizon_captured', when: now, payload: {target_move_in_date, property}}`

Confirmation copy: *"Got it. We'll reach out 7-10 days before {Month} with open slots."* and end with the booking link on its own line per house rule (`https://lazybee.sg/book`).

### 4.3 Daily reminder cron
**Webhook-driven, no polling for inbound** — the firing itself uses the existing daily Vercel cron at `/api/booking/cron`. (This is allowed per the no-polling rule: scheduled time-trigger.)

Add a new sweep to the cron handler:
```sql
SELECT id, name, email, phone, intent
FROM leads
WHERE status IN ('new','qualified')
  AND (intent->>'off_horizon')::boolean = true
  AND (intent->>'reminder_due_at')::timestamptz <= now()
  AND (intent->>'reminder_sent_count')::int < 2
  AND (
    intent->>'reminder_last_sent_at' IS NULL
    OR (intent->>'reminder_last_sent_at')::timestamptz < now() - interval '7 days'
  );
```

For each row:
1. Call `viewing-notify` edge function with new event `lead-off-horizon-reminder`.
2. Edge function fires multichannel: email via Resend (already wired) + WhatsApp via Beeper Local API (new — service-to-service call).
3. Increment `intent.reminder_sent_count`, set `intent.reminder_last_sent_at = now()`.
4. Append `activity_log` entry `{type: 'reminder_fired', channel: 'whatsapp+email', when: now}`.
5. If `reminder_sent_count >= 2` → set `status = 'cold'`, append `auto_marked_cold` log entry.

### 4.4 Auto-cancel triggers
- Booking confirmed (any property_viewings row inserted with matching email/phone/lead_id) → cancel future reminders by setting `intent.off_horizon = false` and clearing `reminder_due_at`.
- `status` flipped to `lost` or `cold` → reminders skip (already excluded by SQL).
- Manual snooze from Kanban drawer → set `intent.reminder_due_at = now + 7d`, append `reminder_snoozed` log.
- Manual bump from Kanban drawer → call viewing-notify directly, increment count, append `reminder_bumped` log.

### 4.5 Frequency cap
SQL filter `(intent->>'reminder_sent_count')::int < 2` and "≥ 7 days since last reminder" cap to **max 1 reminder per prospect per 7 days, max 2 lifetime** before auto-cold.

---

## 5. API contracts

All new/changed endpoints live under `/api/booking/*` (catch-all already exists).

### 5.1 `GET /api/booking/windows?property=<XX>`
**New endpoint.** Returns the next 7 days of windows + their state for the given property of interest.

Request:
```
GET /api/booking/windows?property=TG
```

Response (200):
```json
{
  "windows": [
    {
      "key": "fri-evening",
      "date": "2026-05-15",
      "window_start": "2026-05-15T19:00:00+08:00",
      "window_end":   "2026-05-15T22:00:00+08:00",
      "state": "OPEN-ANY",
      "anchor_property": null,
      "free_slot_count": 12,
      "slots": [
        { "start": "2026-05-15T19:00:00+08:00", "end": "2026-05-15T19:15:00+08:00", "state": "OPEN-ANY" },
        { "start": "2026-05-15T19:15:00+08:00", "end": "2026-05-15T19:30:00+08:00", "state": "OPEN-ANY" },
        ...
      ]
    },
    {
      "key": "sat-morning",
      "date": "2026-05-16",
      "window_start": "2026-05-16T10:00:00+08:00",
      "window_end":   "2026-05-16T13:00:00+08:00",
      "state": "OPEN-PROP",
      "anchor_property": "IH",
      "free_slot_count": 0,
      "slots": []  // empty when state != open for this prospect's property
    },
    {
      "key": "sun-afternoon",
      "date": "2026-05-17",
      "window_start": "2026-05-17T16:00:00+08:00",
      "window_end":   "2026-05-17T18:00:00+08:00",
      "state": "WINDOW-CLOSED",
      "anchor_property": null,
      "free_slot_count": 0,
      "slots": []
    }
  ],
  "horizon_days": 7,
  "rules_version": "v1",
  "computed_at": "2026-05-15T10:00:00+08:00"
}
```

Errors:
- 400 `property required`
- 400 `unknown property '<X>'`
- 503 `calendar service unavailable` (GCal failure)

Cache: `Cache-Control: no-store` (state changes per booking).

### 5.2 `GET /api/booking/slots?property=<XX>&date=<YYYY-MM-DD>` — DEPRECATED
Old V2 endpoint. Keep alive for now — the V3 flow uses `/windows`. After cutover stability, remove.

### 5.3 `POST /api/booking/create` — extend
Same payload as V2, plus server-side validation against the new state machine.

Server logic (new in V3):
1. Parse `slot_start`. Resolve which window it falls into.
2. Reject if `viewing_rules_version='v1'` (form sends this) AND any of:
   - Window is closed (no GCal event).
   - Slot conflicts with existing active booking at that exact start.
   - Slot violates 30-min cross-property buffer against existing bookings in window.
   - Slot is `OPEN-PROP(X)` and prospect's property ≠ X.
   - "Would-extend-and-invalidate-downstream" check (Carl in §2.2 worked example).
3. On success, write `viewing_rules_version='v1'` along with all V2 fields.

Response: same as V2 (`{success, viewing_id, cancel_url}`).
New error codes:
- 409 `window-closed` — Mark hasn't opened this window.
- 409 `wrong-property` (with body `{anchor_property: 'IH'}`) — anchor mismatch.
- 409 `travel-buffer` (with body `{earliest_allowed: '2026-05-16T20:30:00+08:00'}`) — cross-property buffer.
- 409 `would-block-existing` — same-property extension would invalidate a booked cross-property slot.

### 5.4 `POST /api/booking/leads-off-horizon`
> Note: route uses `-` separator (not `/`) because the Vercel `[...path].js`
> catch-all only matches single-segment paths reliably.

**New endpoint.** Captures off-horizon leads (§4.2).

Request:
```json
{
  "name": "Marco",
  "email": "marco@example.com",
  "phone": "+6591234567",
  "target_move_in_date": "2026-08-15",
  "property": "TG",
  "room_code": "TG-PR2",
  "source": "organic"
}
```
Validation:
- `name` ≥ 2 chars.
- `email` or `phone` required.
- `target_move_in_date` valid ISO date, must be > 7 days from now (else reject and tell client to use main flow).
- `property` in CP/IH/TG.

Response (200):
```json
{ "success": true, "lead_id": "uuid" }
```

### 5.5 `POST /api/booking/admin-lead-reminder?id=<lead-id>` — admin-only
For Kanban manual snooze/bump. Service-role gated like other admin endpoints.

Body:
```json
{ "action": "snooze" | "bump" | "cancel" }
```

### 5.6 `GET /api/booking/cron` — extend
Existing daily cron also runs the off-horizon reminder sweep (§4.3) before the existing 24h reminder sweep.

---

## 6. GCal integration

Reuses the existing OAuth refresh-token flow in `src/lib/googleCalendar.js`. **No new auth.**

New function: `listBookingWindowEvents(rangeStartIso, rangeEndIso)` — returns all events with summary matching `^booking window( — (CP|IH|TG) only)?$` within the range. Filtered locally after `events.list`.

```js
// src/lib/googleCalendar.js
export async function listBookingWindowEvents(rangeStartIso, rangeEndIso) {
  const cal = getCalendarClient();
  const calendarId = getCalendarId();
  const r = await cal.events.list({
    calendarId,
    timeMin: rangeStartIso,
    timeMax: rangeEndIso,
    singleEvents: true,
    orderBy: "startTime",
    timeZone: TZ,
    q: "booking window",  // server-side keyword filter; we re-filter client-side
  });
  const items = r.data.items || [];
  return items
    .filter(ev => /^booking window( — (CP|IH|TG) only)?$/i.test((ev.summary || "").trim()))
    .map(ev => {
      const m = (ev.summary || "").match(/— (CP|IH|TG) only/i);
      return {
        start: ev.start?.dateTime || ev.start?.date,
        end:   ev.end?.dateTime   || ev.end?.date,
        summary: ev.summary,
        anchorProperty: m ? m[1].toUpperCase() : null,
      };
    });
}
```

**Caching:** None at the API layer (Mark wants real-time control). Per request, one `events.list` + one `freebusy.query` to GCal. Aggregate budget: ~200ms/window-list call. Acceptable.

### 6.1 Auto-create GCal events when booking confirmed
Already implemented in V2 (`createEvent` in `googleCalendar.js`). Continues unchanged. The viewing event sits inside the `booking window` event in Mark's GCal, which is what makes the visual feedback obvious to him.

### 6.2 Calendar ID env rename
The env is currently `HYVE_VIEWINGS_CAL_ID` (legacy from pre-rename). The Lazybee migration TODO (`lazybee.md` §15) lists adding `LAZYBEE_VIEWINGS_CAL_ID` before merge. **In V3, support both.** Code reads `LAZYBEE_VIEWINGS_CAL_ID` with fallback to `HYVE_VIEWINGS_CAL_ID`. Belt and braces during migration.

---

## 7. Cron jobs

### 7.1 Existing daily cron — extended
`vercel.json` cron: `{ "path": "/api/booking/cron", "schedule": "0 12 * * *" }` (12:00 UTC = 20:00 SGT).

Order of sweeps inside the cron:
1. Off-horizon reminder sweep (§4.3).
2. 24h-before viewing reminder sweep (existing).
3. (Optional) 2h-before reminder if `?include_2h=1` query param.

No new cron added — just additional logic in the existing handler. Saves us a Vercel hobby cron slot.

### 7.2 Why no GCal webhook?
The "no polling, only webhooks" rule applies to **inbound** state changes from external sources. GCal does support push notifications (calendar.watch + channel) and we *could* subscribe. We're deliberately not, because:
1. Booking windows resolve **on demand** (every form load) — there's no background sync to keep in shape.
2. The data flow is the form → GCal (write), not GCal → us (read). Reads are pull-style, but happen at user request, not on a polling schedule. No background poller exists.
3. Adding webhooks would mean storing `cms_content`-style cached state in Postgres, which adds a sync surface for no benefit.

This is consistent with the rule spirit: no background polling.

---

## 8. Frontend changes

### 8.1 New file: `src/pages/book/_clusteringMeta.js`
Constants: window definitions, slot grid math helpers, label formatters. Pure JS, no React.

### 8.2 New file: `src/lib/viewingClustering.js`
The slot resolver from §2.1, used by both the API route (server-side) and unit tests. Pure JS, no React, no DB dependencies — takes inputs, returns a state map.

### 8.3 Modified: `src/pages/book/BookingFlow.jsx`
- Replace the 14-day date picker (`getNextDays(14)`) with the windows list from `GET /api/booking/windows`.
- For each window, render a card showing:
  - State badge (Open / Booked for IH this week / Closed this week).
  - Slot grid (only rendered when state allows this prospect to book).
- Below the windows list, render the off-horizon mini-form (§4.1). Always visible (not gated on a date input).
- Confirmation message after submit ends with `https://lazybee.sg/book` per house rule.

### 8.4 Modified: `src/pages/book/BookConfirmedPage.jsx`
Add a line below the confirmation: *"Want a different time? You can `cancel here` and book a new slot."* Already exists — just verify booking link CTA at bottom.

### 8.5 Wide-screen breakpoints
Per the Chudlife wide-screen rule: at `@media (min-width: 1600px)` show windows in 3 columns side-by-side instead of stacked. At `(min-width: 2200px)` add a side rail with the off-horizon form so it sits beside the windows. Mobile + 1280px untouched.

---

## 9. Admin overrides

### 9.1 Direct admin booking
`AdminViewingsPage` already lets Mark create viewings directly. In V3, the admin path **bypasses validation** — the resolver is only enforced for `viewing_rules_version='v1'` rows submitted via the public form. Admin-created rows get `viewing_rules_version='admin'` (logged) and a non-blocking warning is shown if rules would have been violated.

### 9.2 GCal pre-anchor
Mark can pre-anchor a window via event title `booking window — TG only` (parsed in §6).

### 9.3 Kanban manual snooze + bump
Already partially built (`/portal/admin/leads`). Add two buttons on the off-horizon-flagged lead drawer:
- **Snooze 7 days** → POST `/api/booking/admin/leads/:id/reminder` with `action: 'snooze'`.
- **Bump now** → POST `/api/booking/admin/leads/:id/reminder` with `action: 'bump'`.

---

## 10. Migration + cutover

### 10.1 Migration
Single new migration: `supabase/migrations/20260515000000_viewing_clustering_v1.sql`.

Contents:
1. Add `viewing_rules_version TEXT DEFAULT 'v0'` to `property_viewings`.
2. Backfill all existing rows (24 of them) to `'v0'`.
3. Add `get_viewing_windows()` SQL function (§3.3).
4. Index: `CREATE INDEX IF NOT EXISTS leads_off_horizon_idx ON leads ((intent->>'off_horizon')) WHERE (intent->>'off_horizon') = 'true';`

No drops, no destructive changes. Existing 24 viewings (incl. the chaotic Sat 17 May ones) keep working.

### 10.2 Cutover plan
1. **Branch:** `feature/viewing-clustering` (already created).
2. **Test on Supabase preview branch:** create a Supabase branch via `mcp__supabase__create_branch`, apply migration there, run synthetic bookings.
3. **Vercel preview deploy:** push to `feature/viewing-clustering`, Vercel auto-creates preview at `hyve-website-feature-viewing-clustering-<hash>.vercel.app`.
4. **Smoke tests on preview:** Mark inserts test GCal `booking window` event, prospect submits via preview URL, verify the cluster math.
5. **Cutover:** merge to `master` on a Monday so the first live cycle is Fri/Sat/Sun.
6. **Existing viewings:** untouched, no rescheduling, no notifications.

### 10.3 Rollback
- Toggle env `BOOKING_RULES_V1_ENABLED=false` → API falls back to V2 `slots` endpoint, frontend falls back to date picker. Single env var.
- Migration is additive only — no rollback needed at the DB layer.

---

## 11. Edge cases

| Case | Handling |
|---|---|
| Prospect picks slot, refreshes form, slot taken | 409 + reload windows. Same as V2. |
| Two prospects submit same slot at same instant | 409 from DB unique check (existing). One wins. |
| GCal event deleted mid-booking flow | API returns `WINDOW-CLOSED` next time form refreshes. Already-confirmed bookings stand. |
| Mark adds `booking window` event during a closed week | Window opens immediately — next form load shows it. |
| Off-horizon prospect's move-in date is in the past | Rejected at API: "Use the main flow — we have slots in the next 7 days." |
| Two overlapping `booking window` events | First event by start time wins. (Doesn't happen in practice — Mark drops one event per window.) |
| GCal API down | API returns 503 to form. Form shows "Couldn't load times — refresh." User retries. |
| Same email books 2 slots in different windows | Allowed. Lead deduped on `email` already. Each viewing has its own row. |
| Captain/admin creates viewing directly via admin UI | `viewing_rules_version='admin'`. Resolver counts it as a regular booking (it shows up in `bookings[]` and affects state). |
| Cancellation triggers re-anchor | Yes — see §2.3. No notifications sent for the unaffected bookings. |
| Daylight saving | SGT has no DST. All times +08:00. No edge case here. |
| Cron runs twice in same day (manual + scheduled) | `intent.reminder_last_sent_at` + 7-day cap prevents double-send. |
| Beeper Local API down for off-horizon WhatsApp | Email still fires. WhatsApp logged as `reminder_send_failed` in activity_log. Cron retries next day (still gated by 7-day rule, so effectively waits a week). Acceptable. |

---

## 12. Test plan

Pure-function tests against `src/lib/viewingClustering.js`:
1. **Closed window** — 0 slots returned in any state.
2. **Open window, no bookings, no anchor** — all 12 slots `OPEN-ANY`.
3. **Anchor booked, same-property prospect** — all slots either `BOOKED` or `PROP-RESERVED`.
4. **Anchor booked, cross-property prospect** — slots within 30 min of cluster = `BLOCKED-BUFFER`, slots outside = `OPEN-ANY`. Window-edge exceptions.
5. **Two clusters, gap exactly 30 min** — boundary slot becomes `OPEN-ANY` for both clusters' properties.
6. **Two clusters, gap < 30 min** — should never happen (would have been rejected at booking time). Test that resolver doesn't crash.
7. **Same-property extension would invalidate downstream** — Carl scenario from §2.2. Returns `would-block-existing`.
8. **Cancellation re-anchors** — cancel anchor's only booking, next first-booker re-anchors.
9. **Pre-anchored via GCal `— XX only`** — first booking must be XX, others rejected.
10. **Booking horizon** — windows > 7 days hidden.
11. **Off-horizon capture** — POST creates lead with correct `intent.reminder_due_at` = move_in - 10d.
12. **Reminder cron** — 1 reminder per 7d, max 2, then `cold`.

Synthetic E2E (against Supabase branch + Vercel preview):
- Drop GCal event titled `booking window` at upcoming Sat 10:00.
- Hit `/api/booking/windows?property=TG` → expect Sat-morning state `OPEN-ANY`.
- POST `/api/booking/create` for TG 10:00. → 200.
- Hit `/api/booking/windows?property=CP` → expect Sat 10:00 `BOOKED`, 10:15-10:30 `BLOCKED-BUFFER`, 10:30+ `OPEN-ANY`.
- POST `/api/booking/create` for CP 10:00 → 409 `window has anchor TG`.
- POST `/api/booking/create` for CP 10:30 → 200.
- Hit `/api/booking/windows?property=TG` → expect 10:00 `BOOKED`, 10:15 `OPEN-ANY` for TG (extending), 10:30 `BOOKED`.

---

## 13. Out of scope (V3.1 candidates)

- **House captain assignment for V3 windows.** Currently captain is assigned per-viewing post-booking. No change.
- **Variable window length per week** (e.g. Mark moves Friday window to 6-9pm). Hard-coded for now. Can drive from a `viewing_window_overrides` table later.
- **Multi-prospect group viewings.** Skipped per spec.
- **SMS reminders** in addition to WhatsApp + email. Out of scope.
- **Public "next free slot" widget** for the homepage. Out of scope.

---

## 14. Self-review

| Spec section | Design from intake | Spec | Match? |
|---|---|---|---|
| 3 windows Fri/Sat/Sun | Yes | §1.1 | ✓ |
| 15-min slot grid | Yes | §1.2 | ✓ |
| GCal control plane | Yes | §1.3 | ✓ |
| 7-day rolling horizon | Yes | §1.5 | ✓ |
| Anchor + travel buffer state machine | Yes | §2 | ✓ |
| Worked example | Yes | §2.2 | ✓ Carl test included |
| Cancellation logic | Yes | §2.3 | ✓ |
| `viewing_rules_version` migration | Yes | §3.1, §10.1 | ✓ |
| Off-horizon capture (Marco) | Yes | §4 | ✓ |
| Daily reminder cron, 7d frequency cap, 2-reminder lifetime | Yes | §4.3-§4.5 | ✓ |
| Email + WhatsApp dual channel | Yes | §4.3 | ✓ Beeper Local API |
| Admin overrides via GCal `— XX only` | Yes | §6, §9.2 | ✓ |
| Manual snooze + bump from Kanban | Yes | §4.4, §9.3 | ✓ |
| Cutover Monday | Yes | §10.2 | ✓ |
| Existing 22 viewings untouched | Yes (actually 24 in DB) | §10.1 | ✓ |
| Wide-screen breakpoints | Yes (per global rule) | §8.5 | ✓ |
| Booking link in confirmation copy | Yes | §4.2 | ✓ |
| No polling | Yes | §7.2 | ✓ |
| Vercel preview deploy | Yes | §10.2 | ✓ |

**Open question (no blocker):** the spec calls for "Mark drops a single event titled `booking window` at the start time" — what if Mark forgets and the cron-job-of-his-eyeballs fails? Mitigation: the leasing-consultant skill (or a future light bot) can DM Mark on Thursday afternoon: "open any windows for the weekend?" Out of scope for V3, captured in `gsd:add-backlog`-style note for follow-up.

Spec is internally consistent. Proceed to plan.
