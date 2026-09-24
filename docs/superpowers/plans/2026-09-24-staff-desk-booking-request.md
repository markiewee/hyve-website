# Staff Desk Booking Request Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A partner consultant signed into lazybee.sg/staff with their desk PIN can request a room for a student straight from the room card, and the request lands exactly where a Partner API booking request lands.

**Architecture:** A pure validator (`src/lib/staffBookingRequest.js`) checks the form. A shared recorder (`src/lib/recordBookingRequest.js`) does the enquiry calendar row, the `booking_requests` insert and the sales email, and is used by BOTH the existing Partner API handler and the new desk route, so the two paths cannot drift. The desk route lives inside the existing `api/booking/[...path].js` catch-all (Vercel 12-function cap, no new function). It resolves the PIN server side with the service key, attributes the request to the PIN's channel (Amber's PIN is on the `amber` channel), and never blocks the room: it is an ENQUIRY, Mark confirms, then the student gets the tenant portal link as today.

**Tech Stack:** React 19 + Vite (desk page), Vercel Node functions, Supabase (hyve-iot `diiilqpfmlxjwiaeophb`), Resend, `node:test`.

**Out of scope:** confirming a request into a tenancy (stays manual, Mark), payments, any change to book.lazybee.sg, any overlap check (Rule 17: never block on overlap).

---

## File map

| File | Change | Responsibility |
|---|---|---|
| `src/lib/staffBookingRequest.js` | create | Validate and normalise the desk form. Pure. |
| `src/lib/staffBookingRequest.test.js` | create | Pins validation rules. |
| `src/lib/recordBookingRequest.js` | create | ENQUIRY calendar row + `booking_requests` insert + email, supabase injected. |
| `src/lib/recordBookingRequest.test.js` | create | Fake-supabase test of the recorder. |
| `src/lib/partnerNotify.js` | modify | `bookingRequestEmail` takes optional `introducedBy`. |
| `src/lib/partnerNotify.test.js` | modify | Pin the new line. |
| `api/v1/[...path].js` | modify `handleCreateBookingRequest` | Call the shared recorder (behaviour unchanged). |
| `api/booking/[...path].js` | modify | New route `staff-booking-request`. |
| `src/components/staff/BookRoomForm.jsx` | create | The form inside a room card. |
| `src/components/staff/RoomCard.jsx` | modify | "Request this room" button opens the form. |
| `src/pages/staff/StaffRoomDeskPage.jsx:228` | modify | Pass `pin` to `RoomCard`. |
| `src/i18n/en.json`, `src/i18n/zh.json` | modify | `staff.book.*` keys, EN + ZH. |

---

### Task 1: Form validator

**Files:** Create `src/lib/staffBookingRequest.js`, `src/lib/staffBookingRequest.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/staffBookingRequest.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { validateStaffBookingRequest, MIN_MONTHS, MAX_MONTHS } from "./staffBookingRequest.js";

const good = {
  pin: "900712", listing_code: "ih-std2", move_in: "2026-12-07", duration_months: 6,
  applicant: { name: " Wei Ling ", email: "WL@Example.com", phone: "+65 9123 4567", nationality: "MY" },
  note: "Starts NUS Jan intake",
};

test("accepts a complete request and normalises it", () => {
  const r = validateStaffBookingRequest(good);
  assert.equal(r.ok, true);
  assert.equal(r.value.listing_code, "IH-STD2");
  assert.equal(r.value.applicant.name, "Wei Ling");
  assert.equal(r.value.applicant.email, "wl@example.com");
  assert.equal(r.value.duration_months, 6);
});

test("3 months is the legal minimum, 36 the maximum", () => {
  assert.equal(MIN_MONTHS, 3);
  assert.equal(MAX_MONTHS, 36);
  assert.equal(validateStaffBookingRequest({ ...good, duration_months: 2 }).ok, false);
  assert.equal(validateStaffBookingRequest({ ...good, duration_months: 37 }).ok, false);
  assert.equal(validateStaffBookingRequest({ ...good, duration_months: 3 }).ok, true);
});

test("names every missing or bad field", () => {
  const r = validateStaffBookingRequest({ pin: "12", move_in: "07/12/2026", applicant: { email: "nope" } });
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing.sort(),
    ["applicant.email", "applicant.name", "duration_months", "listing_code", "move_in", "pin"].sort());
});

test("phone, nationality and note are optional", () => {
  const r = validateStaffBookingRequest({ ...good, applicant: { name: "A", email: "a@b.co" }, note: undefined });
  assert.equal(r.ok, true);
  assert.equal(r.value.applicant.phone, null);
  assert.equal(r.value.note, null);
});
```

- [ ] **Step 2: Run it, expect FAIL** (`Cannot find module './staffBookingRequest.js'`)

Run: `node --test src/lib/staffBookingRequest.test.js`

- [ ] **Step 3: Implement**

```js
// src/lib/staffBookingRequest.js
//
// The desk form, checked before anything touches the database. Same rules as
// the Partner API's booking request, plus the PIN, and the lease floor set to
// 3 months because that is the Singapore minimum and every Lazybee room's.

import { isIsoDate } from "./partnerBookings.js";
import { isPinShaped } from "./partnerPins.js";

export const MIN_MONTHS = 3;
export const MAX_MONTHS = 36;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (s) => (typeof s === "string" && s.trim() ? s.trim() : null);

export function validateStaffBookingRequest(body) {
  const b = body ?? {};
  const a = b.applicant ?? {};
  const missing = [];
  if (!isPinShaped(b.pin)) missing.push("pin");
  const code = clean(b.listing_code)?.toUpperCase() ?? null;
  if (!code) missing.push("listing_code");
  if (!isIsoDate(b.move_in)) missing.push("move_in");
  const months = Number(b.duration_months);
  if (!Number.isInteger(months) || months < MIN_MONTHS || months > MAX_MONTHS) missing.push("duration_months");
  const name = clean(a.name);
  if (!name) missing.push("applicant.name");
  const email = clean(a.email)?.toLowerCase() ?? null;
  if (!email || !EMAIL_RE.test(email)) missing.push("applicant.email");
  if (missing.length) return { ok: false, missing };
  return {
    ok: true,
    value: {
      pin: String(b.pin).trim(), listing_code: code, move_in: b.move_in, duration_months: months,
      applicant: { name, email, phone: clean(a.phone), nationality: clean(a.nationality) },
      note: clean(b.note),
    },
  };
}
```

- [ ] **Step 4: Run it, expect PASS** (`node --test src/lib/staffBookingRequest.test.js`)
- [ ] **Step 5: Commit** `git add src/lib/staffBookingRequest*.js && git commit -m "feat(staff): validate a desk booking request"`

### Task 2: "Introduced by" line in the sales email

**Files:** Modify `src/lib/partnerNotify.js` (`bookingRequestEmail`), `src/lib/partnerNotify.test.js`

- [ ] **Step 1: Add the failing test** to `src/lib/partnerNotify.test.js`

```js
test("booking request email names the consultant when one is given", () => {
  const room = { unit_code: "IH-STD2", name: "Standard 2", price_monthly: 1000, deposit_months: 1, property: { name: "Ivory Heights 122" } };
  const channel = { name: "Amber (amberstudent.com)", slug: "amber" };
  const request = { move_in: "2026-12-07", duration_months: 6, applicant: { name: "Wei Ling", email: "wl@example.com" } };
  const withBy = bookingRequestEmail({ channel, room, request, requestId: "r1", introducedBy: "Amber" });
  assert.match(withBy.text, /^Introduced by: Amber \(staff desk\)$/m);
  const without = bookingRequestEmail({ channel, room, request, requestId: "r1" });
  assert.doesNotMatch(without.text, /Introduced by/);
});
```

- [ ] **Step 2: Run, expect FAIL** (`node --test src/lib/partnerNotify.test.js`)
- [ ] **Step 3: Implement.** In `bookingRequestEmail`, destructure `introducedBy` and add one line to the `compose([...])` array directly after the `Channel:` line:

```js
export function bookingRequestEmail({ channel, room, request, requestId, introducedBy = null }) {
  // ...existing body unchanged...
      `Channel: ${channel.name}`,
      introducedBy && `Introduced by: ${introducedBy} (staff desk)`,
  // ...rest unchanged...
```

- [ ] **Step 4: Run, expect PASS**, and the rest of `partnerNotify.test.js` still green.
- [ ] **Step 5: Commit** `git commit -am "feat(notify): booking request email can name the desk consultant"`

### Task 3: Shared recorder, and the Partner API uses it

**Files:** Create `src/lib/recordBookingRequest.js`, `src/lib/recordBookingRequest.test.js`; modify `api/v1/[...path].js` `handleCreateBookingRequest`

- [ ] **Step 1: Failing test with a fake supabase**

```js
// src/lib/recordBookingRequest.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { recordBookingRequest } from "./recordBookingRequest.js";

function fakeSupabase() {
  const inserts = [];
  const from = (table) => ({
    insert(row) {
      inserts.push({ table, row });
      const data = table === "room_calendar" ? { id: "cal1" } : { id: "req1", status: "PENDING", created_at: "now" };
      return { select: () => ({ single: async () => ({ data, error: null }) }) };
    },
  });
  return { from, inserts };
}

test("writes a non-blocking ENQUIRY and a booking request, then emails", async () => {
  const sb = fakeSupabase();
  const sent = [];
  const out = await recordBookingRequest({
    supabase: sb, sendEmail: async (m) => sent.push(m),
    channel: { id: "ch1", slug: "amber", name: "Amber" },
    room: { id: "room1", unit_code: "IH-STD2", price_monthly: 1000 },
    request: { move_in: "2026-12-07", duration_months: 6, applicant: { name: "W", email: "w@x.co" }, note: null },
    calendarNote: "Staff desk booking request", introducedBy: "Amber",
  });
  assert.equal(out.id, "req1");
  const cal = sb.inserts.find((i) => i.table === "room_calendar").row;
  assert.equal(cal.kind, "ENQUIRY");
  assert.equal(cal.blocks, false);
  assert.equal(cal.source, "amber");
  const req = sb.inserts.find((i) => i.table === "booking_requests").row;
  assert.equal(req.channel_id, "ch1");
  assert.equal(req.calendar_id, "cal1");
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /Introduced by: Amber/);
});
```

- [ ] **Step 2: Run, expect FAIL** (`node --test src/lib/recordBookingRequest.test.js`)
- [ ] **Step 3: Implement** (body lifted verbatim from `handleCreateBookingRequest`, only the calendar note and `introducedBy` are parameters)

```js
// src/lib/recordBookingRequest.js
//
// One way to record a booking request, used by the Partner API and the staff
// desk, so a request looks the same in booking_requests, room_calendar and the
// sales inbox whoever made it. Enquiries never block the room: Mark's rule.

import { bookingRequestEmail } from "./partnerNotify.js";

export async function recordBookingRequest({
  supabase, sendEmail, channel, room, request, idempotencyKey = null,
  calendarNote = "Partner API booking request", introducedBy = null,
}) {
  const { data: cal } = await supabase.from("room_calendar").insert({
    room_id: room.id, starts_on: request.move_in, ends_on: null, kind: "ENQUIRY",
    source: channel.slug, status: "ACTIVE", blocks: false, auto_created: true, notes: calendarNote,
  }).select("id").single();

  const { data: created, error } = await supabase.from("booking_requests").insert({
    channel_id: channel.id, room_id: room.id, idempotency_key: idempotencyKey,
    move_in: request.move_in, duration_months: request.duration_months,
    applicant_name: request.applicant.name, applicant_email: request.applicant.email,
    applicant_phone: request.applicant.phone ?? null, applicant_nationality: request.applicant.nationality ?? null,
    note: request.note ?? null, calendar_id: cal?.id ?? null,
  }).select("id, status, created_at").single();
  if (error) throw new Error("Could not record the request");

  await sendEmail(bookingRequestEmail({ channel, room, request, requestId: created.id, introducedBy }));
  return created;
}
```

- [ ] **Step 4: Run, expect PASS**
- [ ] **Step 5: Switch the Partner API to it.** In `api/v1/[...path].js` add `import { recordBookingRequest } from "../../src/lib/recordBookingRequest.js";` and replace everything in `handleCreateBookingRequest` from `// Enquiry records, never blocks` down to the final `return` with:

```js
  let created;
  try {
    created = await recordBookingRequest({
      supabase, sendEmail: sendAdminEmail, channel, room, request: b,
      idempotencyKey: b.idempotency_key ?? null,
    });
  } catch {
    return err(res, 500, "internal", "Could not record the request");
  }
  return res.status(201).json(bookingRequestView(created, room.unit_code));
```

Remove `bookingRequestEmail` from the `partnerNotify.js` import line if nothing else in the file uses it (`grep -n bookingRequestEmail api/v1/\[...path\].js`).

- [ ] **Step 6: Run all lib tests** `node --test src/lib/*.test.js` → all PASS
- [ ] **Step 7: Commit** `git commit -am "refactor: one recorder for booking requests, Partner API uses it"`

### Task 4: Desk route `POST /api/booking/staff-booking-request`

**Files:** Modify `api/booking/[...path].js`

- [ ] **Step 1: Add imports** next to the others at the top:

```js
import { validateStaffBookingRequest } from "../../src/lib/staffBookingRequest.js";
import { recordBookingRequest } from "../../src/lib/recordBookingRequest.js";
```

- [ ] **Step 2: Add the handler** above `export default async function handler`:

```js
// A consultant on the staff desk asks for a room for a student. The PIN is
// the whole credential, checked here with the service key, and it decides
// the channel: Amber's desk PIN books as Amber. A PIN with no channel (our
// own) books as Direct. Never blocks the room; Mark confirms by hand.
const ROOM_FOR_DESK = "id, unit_code, name, price_monthly, deposit_months, property:properties(name)";

async function sendDeskEmail({ subject, text }) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Lazybee Co-living <hello@lazybee.sg>",
        to: ["mark@meetmillia.com"], cc: ["jane@meetmillia.com"], subject, text,
      }),
    });
  } catch { /* the request is recorded; a lost email must not fail it */ }
}

async function handleStaffBookingRequest(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const v = validateStaffBookingRequest(req.body);
  if (!v.ok) return res.status(422).json({ error: "validation_failed", missing: v.missing });
  const r = v.value;

  const { data: pinRow } = await supabase.from("staff_pins")
    .select("pin, enabled, display_name, label, channel:listing_channels(id, slug, name, enabled, commission_months, commission_pct, fee_fixed, gross_up)")
    .eq("pin", r.pin).maybeSingle();
  if (!pinRow || !pinRow.enabled) return res.status(403).json({ error: "bad_pin" });

  let channel = pinRow.channel;
  if (!channel) {
    const { data } = await supabase.from("listing_channels")
      .select("id, slug, name, enabled, commission_months, commission_pct, fee_fixed, gross_up")
      .eq("slug", "direct").single();
    channel = data;
  }
  if (!channel?.enabled) return res.status(403).json({ error: "channel_disabled" });

  const { data: room } = await supabase.from("rooms").select(ROOM_FOR_DESK).eq("unit_code", r.listing_code).maybeSingle();
  if (!room) return res.status(422).json({ error: "validation_failed", missing: ["listing_code"] });

  const created = await recordBookingRequest({
    supabase, sendEmail: sendDeskEmail, channel, room, request: r,
    calendarNote: `Staff desk booking request (${pinRow.display_name ?? pinRow.label})`,
    introducedBy: pinRow.display_name ?? pinRow.label,
  });
  return res.status(201).json({ id: created.id, listing_code: room.unit_code, status: created.status });
}
```

- [ ] **Step 3: Route it.** Inside the `switch (route)` add, before `default:`:

```js
      case "staff-booking-request":
        return await handleStaffBookingRequest(req, res);
```

- [ ] **Step 4: Local smoke.** `vercel dev` (or `npm run dev` + `vercel dev --listen 3001`), then:

```bash
curl -s -X POST localhost:3001/api/booking/staff-booking-request -H 'Content-Type: application/json' \
  -d '{"pin":"000000","listing_code":"IH-STD2","move_in":"2026-12-07","duration_months":6,"applicant":{"name":"T","email":"t@t.co"}}'
```

Expected: `{"error":"bad_pin"}` with 403. With `"duration_months":2` expected 422 naming `duration_months`. Do NOT post a real PIN locally against prod data.

- [ ] **Step 5: Commit** `git commit -am "feat(staff): desk route records a booking request under the PIN's channel"`

### Task 5: The form on the room card

**Files:** Create `src/components/staff/BookRoomForm.jsx`; modify `src/components/staff/RoomCard.jsx`, `src/pages/staff/StaffRoomDeskPage.jsx:228`, `src/i18n/en.json`, `src/i18n/zh.json`

- [ ] **Step 1: i18n keys** under `staff` in both files (ZH written by hand, checked by `dictionaries.test.js`):

```json
"book": {
  "cta": "Request this room",
  "title": "Request {room} for a student",
  "name": "Student's full name",
  "email": "Student's email",
  "phone": "Phone (optional)",
  "nationality": "Nationality (optional)",
  "moveIn": "Move-in date",
  "months": "Lease length (months, 3 minimum)",
  "note": "Anything we should know (optional)",
  "send": "Send request",
  "sending": "Sending...",
  "sent": "Sent. We confirm within one working day and email the student their tenant portal link.",
  "failed": "That did not go through. Check the fields or WhatsApp +65 8069 5410.",
  "cancel": "Cancel"
}
```

```json
"book": {
  "cta": "申请这个房间",
  "title": "为学生申请 {room}",
  "name": "学生全名",
  "email": "学生邮箱",
  "phone": "电话（选填）",
  "nationality": "国籍（选填）",
  "moveIn": "入住日期",
  "months": "租期（月，最少 3 个月）",
  "note": "备注（选填）",
  "send": "提交申请",
  "sending": "提交中...",
  "sent": "已提交。我们会在一个工作日内确认，并把租客门户链接发给学生。",
  "failed": "提交失败。请检查填写内容，或 WhatsApp +65 8069 5410。",
  "cancel": "取消"
}
```

Run `node --test src/i18n/*.test.js` → PASS.

- [ ] **Step 2: The form**

```jsx
// src/components/staff/BookRoomForm.jsx
//
// Lives inside a room card. Posts to /api/booking/staff-booking-request with
// the desk PIN; the server decides the channel from the PIN, never the page.
import { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

export default function BookRoomForm({ room, pin, onClose }) {
  const { t } = useLanguage();
  const [f, setF] = useState({ name: '', email: '', phone: '', nationality: '', move_in: '', months: 12, note: '' });
  const [state, setState] = useState('idle'); // idle | sending | sent | failed
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setState('sending');
    try {
      const r = await fetch('/api/booking/staff-booking-request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin, listing_code: room.unit_code, move_in: f.move_in, duration_months: Number(f.months),
          applicant: { name: f.name, email: f.email, phone: f.phone, nationality: f.nationality }, note: f.note,
        }),
      });
      setState(r.ok ? 'sent' : 'failed');
    } catch { setState('failed'); }
  }

  if (state === 'sent') return <p className="notice">{t('staff.book.sent')}</p>;
  return (
    <form className="staffbook" onSubmit={submit}>
      <div className="label">{t('staff.book.title', { room: room.unit_code })}</div>
      <input required placeholder={t('staff.book.name')} value={f.name} onChange={set('name')} />
      <input required type="email" placeholder={t('staff.book.email')} value={f.email} onChange={set('email')} />
      <input placeholder={t('staff.book.phone')} value={f.phone} onChange={set('phone')} />
      <input placeholder={t('staff.book.nationality')} value={f.nationality} onChange={set('nationality')} />
      <label>{t('staff.book.moveIn')}<input required type="date" value={f.move_in} onChange={set('move_in')} /></label>
      <label>{t('staff.book.months')}<input required type="number" min="3" max="36" value={f.months} onChange={set('months')} /></label>
      <textarea placeholder={t('staff.book.note')} value={f.note} onChange={set('note')} />
      {state === 'failed' && <p className="notice notice-warn">{t('staff.book.failed')}</p>}
      <div className="row">
        <button className="btn btn-primary btn-sm" disabled={state === 'sending'}>
          {state === 'sending' ? t('staff.book.sending') : t('staff.book.send')}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>{t('staff.book.cancel')}</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: RoomCard.** Signature becomes `RoomCard({ room, property, today, channel, pin })`; add `import BookRoomForm from './BookRoomForm';` and `const [booking, setBooking] = useState(false);` (import `useState` if not already), and after the 3D tour block, before the closing `</div>`:

```jsx
        {pin && (booking
          ? <BookRoomForm room={room} pin={pin} onClose={() => setBooking(false)} />
          : <button className="btn btn-primary btn-sm" style={{ marginTop: 'var(--s5)' }} onClick={() => setBooking(true)}>
              {t('staff.book.cta')}
            </button>)}
```

- [ ] **Step 4: Lift the PIN into page state and pass it.** Today `pin` is a local inside the `fetchData` effect (`StaffRoomDeskPage.jsx:87`). Add `const [deskPin, setDeskPin] = useState(null);` beside the other `useState` calls, call `setDeskPin(pin);` right after the `readPin` try/catch inside `fetchData`, and at line 228 render `<RoomCard key={room.id} room={room} property={property} today={today} channel={channel} pin={deskPin} />`.
- [ ] **Step 5: Build + lint** `npm run build:client && npm run lint` → no errors.
- [ ] **Step 6: Commit** `git commit -am "feat(staff): request a room from the desk"`

### Task 6: Ship and verify

- [ ] Open the PR (`feat/staff-desk-booking-request` → `master`), auto-merge per Mark's standing rule once CI is green.
- [ ] On the Vercel preview, run the Task 4 curl against `/api/booking/staff-booking-request` with a bad PIN (403) and a 2-month lease (422).
- [ ] One real end-to-end with Mark's own desk PIN typed by Mark (Claudine does not enter PINs): request IH-STD2 for "TEST, delete me", confirm a `booking_requests` row on channel `direct`, an ENQUIRY `room_calendar` row with `blocks=false`, and the email to mark@meetmillia.com. Then delete both test rows.
- [ ] Partner API regression: `node --test src/lib/*.test.js` green on master after merge.
