# Staff Desk Booking Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A room desk PIN holder at lazybee.sg/staff books a room for a student and gets a one-time onboarding link on the spot, and sees every booking they made, with the student's progress, on a My bookings tab.

**Architecture:** Pure validation and stage logic in `src/lib/deskBooking.js`. One new route, `POST /api/booking/desk-book`, inside the existing catch-all (12-function cap), which resolves the PIN and its channel server side, quotes with the Partner API's `quoteFor`, and creates the same pending tenant + invite token the admin onboarding invite creates. One migration adds desk columns to `booking_requests` and a security-definer RPC `desk_bookings_for_pin`. UI is a form inside `RoomCard` and a `MyBookings` tab on the desk page.

**Tech Stack:** React 19 + Vite, Vercel Node functions, Supabase hyve-iot (`diiilqpfmlxjwiaeophb`), Resend, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-25-staff-desk-booking-link-design.md`. Supersedes `docs/superpowers/plans/2026-09-24-staff-desk-booking-request.md`.

---

## File map

| File | Change | Responsibility |
|---|---|---|
| `supabase/migrations/20260925000000_desk_bookings.sql` | create | desk columns on `booking_requests`, RPC `desk_bookings_for_pin` |
| `src/lib/deskBooking.js` | create | `validateDeskBooking`, `tenancyEnd`, `deskStage`. Pure. |
| `src/lib/deskBooking.test.js` | create | tests for the three functions |
| `api/booking/[...path].js` | modify | route `desk-book`, `handleDeskBook` |
| `src/components/staff/BookRoomForm.jsx` | create | form + link result panel |
| `src/components/staff/RoomCard.jsx` | modify | "Book this room" button, takes `pin` |
| `src/components/staff/PropertyPanel.jsx` | modify | pass `pin` through to `RoomCard` |
| `src/components/staff/MyBookings.jsx` | create | the My bookings list |
| `src/pages/staff/StaffRoomDeskPage.jsx` | modify | keep `pin` in state, Rooms / My bookings tabs |
| `src/i18n/en.json`, `src/i18n/zh.json` | modify | `staff.book.*`, `staff.mine.*` |
| `docs/superpowers/plans/2026-09-24-staff-desk-booking-request.md` | modify | mark superseded |

Run tests with: `node --test src/lib/deskBooking.test.js`

---

### Task 1: Migration

**Files:** Create `supabase/migrations/20260925000000_desk_bookings.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Desk bookings: a room desk PIN holder books a room and gets an onboarding
-- link on the spot. Recorded in booking_requests next to Partner API requests
-- so Mark reads one list. Spec: 2026-09-25-staff-desk-booking-link-design.md

alter table public.booking_requests
  add column if not exists source text not null default 'api',
  add column if not exists staff_pin text references public.staff_pins(pin) on delete set null,
  add column if not exists tenant_profile_id uuid references public.tenant_profiles(id) on delete set null,
  add column if not exists quoted_monthly numeric,
  add column if not exists quoted_deposit numeric;

alter table public.booking_requests
  drop constraint if exists booking_requests_source_check;
alter table public.booking_requests
  add constraint booking_requests_source_check check (source in ('api', 'desk'));

create index if not exists booking_requests_staff_pin_idx
  on public.booking_requests (staff_pin, created_at desc);

-- My bookings. Only rows made with this PIN. The student's name is returned
-- because the consultant typed it in. The invite URL is returned only while the
-- link can still be used, so an old list is not a pile of live credentials.
create or replace function public.desk_bookings_for_pin(p_pin text)
returns table (
  id                  uuid,
  created_at          timestamptz,
  unit_code           text,
  move_in             date,
  duration_months     numeric,
  applicant_name      text,
  applicant_email     text,
  quoted_monthly      numeric,
  invite_url          text,
  invite_expires_at   timestamptz,
  signed_up           boolean,
  details_at          timestamptz,
  id_at               timestamptz,
  ta_signed_at        timestamptz,
  deposit_at          timestamptz,
  cancelled           boolean
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select br.id, br.created_at, r.unit_code, br.move_in, br.duration_months,
         br.applicant_name, br.applicant_email, br.quoted_monthly,
         case when tp.user_id is null and tp.invite_token is not null
                   and tp.invite_expires_at > now()
              then 'https://lazybee.sg/portal/signup?token=' || tp.invite_token end,
         tp.invite_expires_at,
         tp.user_id is not null,
         op.personal_details_completed_at, op.id_verification_completed_at,
         op.ta_signed_at, op.deposit_completed_at,
         (tp.id is null or tp.is_active = false)
    from public.booking_requests br
    join public.staff_pins sp on sp.pin = br.staff_pin and sp.enabled = true
    join public.rooms r on r.id = br.room_id
    left join public.tenant_profiles tp on tp.id = br.tenant_profile_id
    left join public.onboarding_progress op on op.tenant_profile_id = tp.id
   where br.staff_pin = p_pin
     and br.source = 'desk'
   order by br.created_at desc
   limit 200;
$$;

revoke all on function public.desk_bookings_for_pin(text) from public;
grant execute on function public.desk_bookings_for_pin(text) to anon, authenticated;
```

- [ ] **Step 2: Apply to hyve-iot and check it**

Apply through the Supabase Management API (the MCP is unauthorised here). Token from `~/.chudbrain/secrets.env`:

```bash
TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' ~/.chudbrain/secrets.env | cut -d= -f2-)
python3 -c "import json,sys;print(json.dumps({'query':open(sys.argv[1]).read()}))" supabase/migrations/20260925000000_desk_bookings.sql > /tmp/mig.json
curl -s -X POST "https://api.supabase.com/v1/projects/diiilqpfmlxjwiaeophb/database/query" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data @/tmp/mig.json
curl -s -X POST "https://api.supabase.com/v1/projects/diiilqpfmlxjwiaeophb/database/query" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"query":"select count(*) from desk_bookings_for_pin($$000000$$)"}'
```

Expected: first call `[]`, second `[{"count":0}]`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260925000000_desk_bookings.sql
git commit -m "feat(db): desk bookings on booking_requests, desk_bookings_for_pin"
```

---

### Task 2: Pure logic

**Files:** Create `src/lib/deskBooking.js`, `src/lib/deskBooking.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/lib/deskBooking.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { validateDeskBooking, tenancyEnd, deskStage } from "./deskBooking.js";

const today = new Date("2026-09-25T00:00:00+08:00");
const good = {
  pin: "900712", room_id: "3b2c1d4e-0000-4000-8000-000000000001",
  move_in: "2026-12-07", months: 6,
  student: { name: " Wei Ling ", email: "WL@Example.com ", phone: "+65 9123 4567", nationality: "Malaysia" },
};

test("accepts a complete booking and normalises it", () => {
  const r = validateDeskBooking(good, today);
  assert.equal(r.ok, true);
  assert.equal(r.value.student.name, "Wei Ling");
  assert.equal(r.value.student.email, "wl@example.com");
  assert.equal(r.value.months, 6);
});

test("rejects a bad pin, missing name, bad email, bad date", () => {
  const r = validateDeskBooking({ ...good, pin: "12", student: { name: "", email: "nope" }, move_in: "07/12/2026" }, today);
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors.sort(), ["email", "move_in", "name", "pin"]);
});

test("rejects a move-in in the past and months outside 3 to 36", () => {
  assert.deepEqual(validateDeskBooking({ ...good, move_in: "2026-09-01" }, today).errors, ["move_in"]);
  assert.deepEqual(validateDeskBooking({ ...good, months: 2 }, today).errors, ["months"]);
  assert.deepEqual(validateDeskBooking({ ...good, months: 37 }, today).errors, ["months"]);
});

test("tenancy ends the day before the same date N months on", () => {
  assert.equal(tenancyEnd("2026-09-26", 12), "2027-09-25");
  assert.equal(tenancyEnd("2026-12-07", 6), "2027-06-06");
  assert.equal(tenancyEnd("2027-01-31", 1), "2027-02-27");
});

test("stage is the furthest step reached", () => {
  const now = new Date("2026-09-25T12:00:00Z");
  assert.equal(deskStage({ cancelled: true }, now), "cancelled");
  assert.equal(deskStage({ deposit_at: "x", signed_up: true }, now), "deposit");
  assert.equal(deskStage({ ta_signed_at: "x", signed_up: true }, now), "agreement");
  assert.equal(deskStage({ id_at: "x", signed_up: true }, now), "id");
  assert.equal(deskStage({ details_at: "x", signed_up: true }, now), "details");
  assert.equal(deskStage({ signed_up: true }, now), "signedUp");
  assert.equal(deskStage({ signed_up: false, invite_expires_at: "2026-09-30T00:00:00Z" }, now), "linkSent");
  assert.equal(deskStage({ signed_up: false, invite_expires_at: "2026-09-20T00:00:00Z" }, now), "expired");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test src/lib/deskBooking.test.js`
Expected: FAIL, `Cannot find module './deskBooking.js'`.

- [ ] **Step 3: Implement**

```js
// src/lib/deskBooking.js
//
// The room desk booking form, checked the same way in the browser and on the
// server. Pure: no supabase, no fetch. Spec 2026-09-25-staff-desk-booking-link.

export const MIN_MONTHS = 3; // the legal minimum at all three properties
export const MAX_MONTHS = 36; // quoteFor clamps to 36, so we stop there too

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f-]{36}$/i;

const clean = (v) => (typeof v === "string" ? v.trim() : "");

function isRealDate(s) {
  if (!ISO.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Returns { ok: true, value } or { ok: false, errors: [field, ...] }. */
export function validateDeskBooking(body, today = new Date()) {
  const b = body || {};
  const s = b.student || {};
  const errors = [];

  const pin = clean(String(b.pin ?? ""));
  if (!/^\d{6}$/.test(pin)) errors.push("pin");

  const room_id = clean(b.room_id);
  if (!UUID.test(room_id)) errors.push("room_id");

  const move_in = clean(b.move_in);
  const todayIso = new Date(today.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10); // SGT
  if (!isRealDate(move_in) || move_in < todayIso) errors.push("move_in");

  const months = Number(b.months);
  if (!Number.isInteger(months) || months < MIN_MONTHS || months > MAX_MONTHS) errors.push("months");

  const name = clean(s.name);
  if (name.length < 2) errors.push("name");
  const email = clean(s.email).toLowerCase();
  if (!EMAIL.test(email)) errors.push("email");

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      pin, room_id, move_in, months,
      student: { name, email, phone: clean(s.phone) || null, nationality: clean(s.nationality) || null },
    },
  };
}

/** Last day of an N-month licence: the day before the same date N months on. */
export function tenancyEnd(startIso, months) {
  const [y, m, d] = startIso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  target.setUTCDate(target.getUTCDate() - 1);
  return target.toISOString().slice(0, 10);
}

/** How far a student has got, from a desk_bookings_for_pin row. */
export function deskStage(row, now = new Date()) {
  if (row.cancelled) return "cancelled";
  if (row.deposit_at) return "deposit";
  if (row.ta_signed_at) return "agreement";
  if (row.id_at) return "id";
  if (row.details_at) return "details";
  if (row.signed_up) return "signedUp";
  if (row.invite_expires_at && new Date(row.invite_expires_at) < now) return "expired";
  return "linkSent";
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test src/lib/deskBooking.test.js`
Expected: `# pass 5`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/deskBooking.js src/lib/deskBooking.test.js
git commit -m "feat(staff): desk booking validation, tenancy end, stage"
```

---

### Task 3: Server route

**Files:** Modify `api/booking/[...path].js` (imports at the top, new handler above `export default`, one `case` in the switch)

- [ ] **Step 1: Add imports** below the existing imports

```js
import crypto from "crypto";
import { validateDeskBooking, tenancyEnd } from "../../src/lib/deskBooking.js";
import { quoteFor } from "../../src/lib/partnerNotify.js";
```

- [ ] **Step 2: Add the handler** above `export default async function handler`

```js
// ── Desk booking: a room desk PIN books a room and gets an onboarding link ──
// Spec 2026-09-25-staff-desk-booking-link-design.md. Instant link, no
// approval; the room is only committed when the deposit lands. Never blocks
// on overlap (Rule 17).
async function handleDeskBook(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const v = validateDeskBooking(req.body);
  if (!v.ok) return res.status(422).json({ error: "validation_failed", fields: v.errors });
  const b = v.value;

  const { data: pinRow } = await supabase
    .from("staff_pins").select("pin, label, channel_id, enabled").eq("pin", b.pin).maybeSingle();
  if (!pinRow || !pinRow.enabled) return res.status(401).json({ error: "bad_pin" });

  // No channel on the PIN (Mark, captains) books as direct.
  const chanQuery = supabase.from("listing_channels")
    .select("id, slug, name, commission_months, commission_pct, fee_fixed, gross_up");
  const { data: channel } = pinRow.channel_id
    ? await chanQuery.eq("id", pinRow.channel_id).maybeSingle()
    : await chanQuery.eq("slug", "direct").maybeSingle();
  if (!channel) return res.status(500).json({ error: "no_channel" });

  const { data: room } = await supabase
    .from("rooms").select("id, unit_code, name, property_id, price_monthly, deposit_months, min_stay_months, property:properties(name)")
    .eq("id", b.room_id).maybeSingle();
  if (!room) return res.status(422).json({ error: "validation_failed", fields: ["room_id"] });

  const q = quoteFor(room, channel, b.months);
  const deposit = q?.deposit ?? q?.monthly ?? null;

  const invite_token = crypto.randomBytes(32).toString("hex");
  const invite_expires_at = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const { data: profile, error: pErr } = await supabase.from("tenant_profiles").insert({
    room_id: room.id, property_id: room.property_id, role: "TENANT",
    invite_token, invite_expires_at, is_active: true,
    monthly_rent: q?.monthly ?? null, lease_months: b.months,
    notes: `Desk booking by ${pinRow.label} via ${channel.name}`,
  }).select("id").single();
  if (pErr) {
    console.error("[desk-book] profile", pErr);
    return res.status(500).json({ error: "could_not_create" });
  }

  await supabase.from("tenant_details").insert({
    tenant_profile_id: profile.id, full_name: b.student.name, email: b.student.email,
    phone: b.student.phone, nationality: b.student.nationality,
  });
  await supabase.from("onboarding_progress").insert({
    tenant_profile_id: profile.id, room_id: room.id,
    current_step: "PERSONAL_DETAILS", status: "ONBOARDING",
    tenancy_start_date: b.move_in, tenancy_end_date: tenancyEnd(b.move_in, b.months),
    licence_period: `${b.months} months`, deposit_amount: deposit,
  });
  const { data: cal } = await supabase.from("room_calendar").insert({
    room_id: room.id, starts_on: b.move_in, ends_on: tenancyEnd(b.move_in, b.months),
    kind: "ENQUIRY", source: channel.slug, status: "ACTIVE", blocks: false,
    auto_created: true, notes: `Desk booking, ${b.student.name}`,
  }).select("id").single();
  const { data: br, error: brErr } = await supabase.from("booking_requests").insert({
    channel_id: channel.id, room_id: room.id, move_in: b.move_in, duration_months: b.months,
    applicant_name: b.student.name, applicant_email: b.student.email,
    applicant_phone: b.student.phone, applicant_nationality: b.student.nationality,
    calendar_id: cal?.id ?? null, source: "desk", staff_pin: b.pin,
    tenant_profile_id: profile.id, quoted_monthly: q?.monthly ?? null, quoted_deposit: deposit,
  }).select("id").single();
  if (brErr) console.error("[desk-book] booking_requests", brErr);

  const invite_url = `https://lazybee.sg/portal/signup?token=${invite_token}`;
  try {
    await sendOwnerEmail(
      OWNER_NOTIFY_TO,
      `Desk booking: ${room.unit_code}, ${b.student.name}, via ${channel.name}`,
      `<p><b>${ownerEsc(pinRow.label)}</b> booked <b>${ownerEsc(room.unit_code)}</b> for ` +
        `${ownerEsc(b.student.name)} &lt;${ownerEsc(b.student.email)}&gt; ${ownerEsc(b.student.phone ?? "")}.</p>` +
        `<p>Move-in ${b.move_in}, ${b.months} months, ` +
        `S$${q?.monthly ?? "?"}/mo, deposit S$${deposit ?? "?"}.</p>` +
        `<p>The student has an onboarding link valid 7 days. Cancel from Admin, Onboarding if needed.</p>`,
    );
  } catch (e) {
    console.error("[desk-book] email", e);
  }

  return res.status(201).json({
    id: br?.id ?? null, invite_url, expires_at: invite_expires_at,
    monthly: q?.monthly ?? null, deposit,
  });
}
```

- [ ] **Step 3: Add the route** to the switch, before `default:`

```js
      case "desk-book":
        return await handleDeskBook(req, res);
```

- [ ] **Step 4: Check it parses and the lib tests still pass**

Run: `node --check "api/booking/[...path].js" && node --test src/lib/deskBooking.test.js src/lib/partnerNotify.test.js`
Expected: no syntax error, all pass.

- [ ] **Step 5: Commit**

```bash
git add "api/booking/[...path].js"
git commit -m "feat(staff): POST /api/booking/desk-book returns an onboarding link"
```

---

### Task 4: Book form on the room card

**Files:** Create `src/components/staff/BookRoomForm.jsx`. Modify `src/components/staff/RoomCard.jsx`, `src/components/staff/PropertyPanel.jsx`.

- [ ] **Step 1: Create the form**

```jsx
// src/components/staff/BookRoomForm.jsx
//
// Book a room for a student and get their onboarding link. The server prices
// it; this form never sends a price. Spec 2026-09-25-staff-desk-booking-link.

import { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { validateDeskBooking, MIN_MONTHS, MAX_MONTHS } from '../../lib/deskBooking';

const EMPTY = { name: '', email: '', phone: '', nationality: '', move_in: '', months: 12 };

export default function BookRoomForm({ room, pin, onClose }) {
  const { t } = useLanguage();
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [failed, setFailed] = useState(null);
  const [copied, setCopied] = useState(false);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const bad = (k) => errors.includes(k);

  async function submit(e) {
    e.preventDefault();
    const body = {
      pin, room_id: room.id, move_in: f.move_in, months: Number(f.months),
      student: { name: f.name, email: f.email, phone: f.phone, nationality: f.nationality },
    };
    const v = validateDeskBooking(body);
    if (!v.ok) { setErrors(v.errors); return; }
    setErrors([]); setBusy(true); setFailed(null);
    try {
      const r = await fetch('/api/booking/desk-book', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v.value),
      });
      const j = await r.json();
      if (!r.ok) {
        if (j.fields) setErrors(j.fields);
        setFailed(t('staff.book.failed'));
      } else setResult(j);
    } catch {
      setFailed(t('staff.book.failed'));
    }
    setBusy(false);
  }

  async function copy() {
    try { await navigator.clipboard.writeText(result.invite_url); setCopied(true); } catch { /* the link is on screen to copy by hand */ }
  }

  if (result) {
    const wa = `https://wa.me/?text=${encodeURIComponent(t('staff.book.shareText', { unit: room.unit_code, url: result.invite_url }))}`;
    return (
      <div className="bookform done">
        <div className="h3">{t('staff.book.doneTitle', { name: f.name })}</div>
        <p className="small">{t('staff.book.doneBody')}</p>
        <input className="input" readOnly value={result.invite_url} onFocus={(e) => e.target.select()} />
        <div className="bookform-actions">
          <button type="button" className="btn btn-sm" onClick={copy}>{copied ? t('staff.book.copied') : t('staff.book.copy')}</button>
          <a className="btn btn-ghost btn-sm" href={wa} target="_blank" rel="noopener noreferrer">{t('staff.book.whatsapp')}</a>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>{t('staff.book.close')}</button>
        </div>
        <p className="small">{t('staff.book.expires')}</p>
      </div>
    );
  }

  return (
    <form className="bookform" onSubmit={submit} noValidate>
      <div className="h3">{t('staff.book.title', { unit: room.unit_code })}</div>
      <label className={`field${bad('name') ? ' bad' : ''}`}>
        <span className="label">{t('staff.book.name')}</span>
        <input className="input" value={f.name} onChange={set('name')} autoComplete="off" />
      </label>
      <label className={`field${bad('email') ? ' bad' : ''}`}>
        <span className="label">{t('staff.book.email')}</span>
        <input className="input" type="email" value={f.email} onChange={set('email')} autoComplete="off" />
      </label>
      <label className="field">
        <span className="label">{t('staff.book.phone')}</span>
        <input className="input" value={f.phone} onChange={set('phone')} autoComplete="off" />
      </label>
      <label className="field">
        <span className="label">{t('staff.book.nationality')}</span>
        <input className="input" value={f.nationality} onChange={set('nationality')} autoComplete="off" />
      </label>
      <div className="bookform-row">
        <label className={`field${bad('move_in') ? ' bad' : ''}`}>
          <span className="label">{t('staff.book.moveIn')}</span>
          <input className="input" type="date" value={f.move_in} onChange={set('move_in')} />
        </label>
        <label className={`field${bad('months') ? ' bad' : ''}`}>
          <span className="label">{t('staff.book.months')}</span>
          <input className="input" type="number" min={MIN_MONTHS} max={MAX_MONTHS} value={f.months} onChange={set('months')} />
        </label>
      </div>
      {errors.length > 0 && <div className="note note-bad">{t('staff.book.fix')}</div>}
      {failed && <div className="note note-bad">{failed}</div>}
      <div className="bookform-actions">
        <button type="submit" className="btn btn-sm" disabled={busy}>{busy ? t('staff.book.working') : t('staff.book.submit')}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>{t('staff.book.cancel')}</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Wire it into RoomCard**

In `src/components/staff/RoomCard.jsx` add `import { useState } from 'react';` and `import BookRoomForm from './BookRoomForm';` to the imports. Change the signature to `export default function RoomCard({ room, property, today, channel, pin })`, add `const [booking, setBooking] = useState(false);` as its first line, and add this block directly after the `video_tour_url` block, inside the card body:

```jsx
        {pin && (booking ? (
          <BookRoomForm room={room} pin={pin} onClose={() => setBooking(false)} />
        ) : (
          <button type="button" className="btn btn-sm" style={{ marginTop: 'var(--s5)' }} onClick={() => setBooking(true)}>
            {t('staff.book.open')}
          </button>
        ))}
```

- [ ] **Step 3: Pass `pin` through PropertyPanel**

In `src/components/staff/PropertyPanel.jsx`, add `pin` to the component props and to every `<RoomCard ... />` it renders: `<RoomCard ... channel={channel} pin={pin} />`.

- [ ] **Step 4: Styles** in `src/styles/lazybee.css`, next to the other `.staff*` rules

```css
.bookform { margin-top: var(--s5); padding: var(--s5); border: 1px solid var(--line); border-radius: var(--r); display: grid; gap: var(--s4); }
.bookform .field { display: grid; gap: var(--s2); }
.bookform .field.bad .input { border-color: var(--bad); }
.bookform-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s4); }
.bookform-actions { display: flex; flex-wrap: wrap; gap: var(--s3); }
@media (max-width: 560px) { .bookform-row { grid-template-columns: 1fr; } }
```

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/BookRoomForm.jsx src/components/staff/RoomCard.jsx src/components/staff/PropertyPanel.jsx src/styles/lazybee.css
git commit -m "feat(staff): book a room from the desk and copy the student's link"
```

---

### Task 5: My bookings tab

**Files:** Create `src/components/staff/MyBookings.jsx`. Modify `src/pages/staff/StaffRoomDeskPage.jsx`.

- [ ] **Step 1: Create the list**

```jsx
// src/components/staff/MyBookings.jsx
//
// Every booking made with this PIN and how far each student has got. The
// link comes back only while it can still be used (desk_bookings_for_pin).

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../i18n/LanguageContext';
import { deskStage } from '../../lib/deskBooking';
import { formatDate } from '../../lib/staffRooms';

const STAGE_BADGE = {
  linkSent: 'badge', signedUp: 'badge', details: 'badge', id: 'badge',
  agreement: 'badge badge-ok', deposit: 'badge badge-ok',
  expired: 'badge badge-warn', cancelled: 'badge badge-warn',
};

export default function MyBookings({ pin }) {
  const { t, lang } = useLanguage();
  const [rows, setRows] = useState(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    supabase.rpc('desk_bookings_for_pin', { p_pin: pin }).then(({ data }) => setRows(data || []));
  }, [pin]);

  if (rows === null) return <div className="skeleton" style={{ height: 200 }} />;
  if (rows.length === 0) return <div className="empty"><div className="h3">{t('staff.mine.none')}</div></div>;

  return (
    <div className="mybookings">
      {rows.map((r) => {
        const stage = deskStage(r);
        return (
          <div className="mybooking" key={r.id}>
            <div>
              <b>{r.applicant_name}</b>
              <div className="small">{r.unit_code}, {formatDate(r.move_in, lang)}, {t('staff.mine.months', { n: r.duration_months })}</div>
            </div>
            <span className={STAGE_BADGE[stage]}>{t(`staff.mine.stage.${stage}`)}</span>
            {r.invite_url && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={async () => {
                try { await navigator.clipboard.writeText(r.invite_url); setCopied(r.id); } catch { /* nothing to do */ }
              }}>
                {copied === r.id ? t('staff.book.copied') : t('staff.mine.copyLink')}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Tabs on the desk page**

In `src/pages/staff/StaffRoomDeskPage.jsx`:

1. Import: `import MyBookings from '../../components/staff/MyBookings';`
2. State: `const [pin, setPin] = useState(null);` and `const [tab, setTab] = useState('rooms');`
3. Inside `fetchData`, after `pin = readPin(...)` succeeds, call `setPin(pin);`
4. Pass `pin={pin}` to every `<RoomCard>` and to `<PropertyPanel>`.
5. Directly under the greeting `<div className="greet">…</div>`, add:

```jsx
        {pin && (
          <div className="stafftabs" style={{ marginTop: 'var(--s6)' }}>
            <button type="button" className={`chip${tab === 'rooms' ? ' on' : ''}`} aria-pressed={tab === 'rooms'} onClick={() => setTab('rooms')}>
              {t('staff.mine.roomsTab')}
            </button>
            <button type="button" className={`chip${tab === 'mine' ? ' on' : ''}`} aria-pressed={tab === 'mine'} onClick={() => setTab('mine')}>
              {t('staff.mine.tab')}
            </button>
          </div>
        )}
        {tab === 'mine' && pin && <section className="sec-sm"><MyBookings pin={pin} /></section>}
```

6. Wrap the existing search section and results (from `<section className="sec-sm"><RoomSearch` down to the closing of the `!loading && !error` block) in `{tab === 'rooms' && ( <> … </> )}`.

- [ ] **Step 3: Styles** in `src/styles/lazybee.css`

```css
.mybookings { display: grid; gap: var(--s3); }
.mybooking { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: var(--s4); padding: var(--s4) var(--s5); border: 1px solid var(--line); border-radius: var(--r); }
@media (max-width: 560px) { .mybooking { grid-template-columns: 1fr; } }
```

- [ ] **Step 4: Commit**

```bash
git add src/components/staff/MyBookings.jsx src/pages/staff/StaffRoomDeskPage.jsx src/styles/lazybee.css
git commit -m "feat(staff): My bookings tab with each student's onboarding stage"
```

---

### Task 6: Strings, EN and ZH

**Files:** Modify `src/i18n/en.json`, `src/i18n/zh.json` (inside the existing `"staff"` object)

- [ ] **Step 1: English**

```json
"book": {
  "open": "Book this room",
  "title": "Book {unit} for a student",
  "name": "Student's full name",
  "email": "Student's email",
  "phone": "Phone (WhatsApp)",
  "nationality": "Nationality",
  "moveIn": "Move-in date",
  "months": "Months (3 to 36)",
  "submit": "Get the student's link",
  "working": "Creating link...",
  "cancel": "Cancel",
  "fix": "Check the fields marked in red.",
  "failed": "That didn't go through. Try again, or message us on WhatsApp +65 8069 5410.",
  "doneTitle": "Link ready for {name}",
  "doneBody": "Send this to the student. They sign up, upload their passport and pass, sign the agreement and pay the deposit. The room is theirs once the deposit is in.",
  "copy": "Copy link",
  "copied": "Copied",
  "whatsapp": "Share on WhatsApp",
  "close": "Done",
  "expires": "The link works for 7 days. Track it under My bookings.",
  "shareText": "Hi! Here's your Lazybee link for room {unit}. Sign up and finish the steps to secure the room: {url}"
},
"mine": {
  "tab": "My bookings",
  "roomsTab": "Rooms",
  "none": "No bookings from this login yet.",
  "months": "{n} months",
  "copyLink": "Copy link",
  "stage": {
    "linkSent": "Link sent",
    "signedUp": "Signed up",
    "details": "Details in",
    "id": "ID and pass in",
    "agreement": "Agreement signed",
    "deposit": "Deposit paid",
    "expired": "Link expired",
    "cancelled": "Cancelled"
  }
}
```

- [ ] **Step 2: Chinese** (same keys)

```json
"book": {
  "open": "预订此房间",
  "title": "为学生预订 {unit}",
  "name": "学生全名",
  "email": "学生邮箱",
  "phone": "电话（WhatsApp）",
  "nationality": "国籍",
  "moveIn": "入住日期",
  "months": "租期（3 至 36 个月）",
  "submit": "生成学生链接",
  "working": "正在生成链接...",
  "cancel": "取消",
  "fix": "请检查红色标记的栏位。",
  "failed": "提交失败，请重试，或通过 WhatsApp +65 8069 5410 联系我们。",
  "doneTitle": "{name} 的链接已生成",
  "doneBody": "请把链接发给学生。学生注册、上传护照和准证、签署协议并支付押金。押金到账后房间即归该学生。",
  "copy": "复制链接",
  "copied": "已复制",
  "whatsapp": "通过 WhatsApp 分享",
  "close": "完成",
  "expires": "链接 7 天内有效，可在「我的预订」查看进度。",
  "shareText": "你好！这是你在 Lazybee {unit} 房间的链接，注册并完成步骤即可锁定房间：{url}"
},
"mine": {
  "tab": "我的预订",
  "roomsTab": "房间",
  "none": "此账号还没有预订。",
  "months": "{n} 个月",
  "copyLink": "复制链接",
  "stage": {
    "linkSent": "已发送链接",
    "signedUp": "已注册",
    "details": "已填资料",
    "id": "已上传证件",
    "agreement": "已签协议",
    "deposit": "已付押金",
    "expired": "链接已过期",
    "cancelled": "已取消"
  }
}
```

- [ ] **Step 3: Check both files parse and every key exists in both**

Run: `node -e "const e=require('./src/i18n/en.json').staff,z=require('./src/i18n/zh.json').staff;for(const g of ['book','mine']){const a=JSON.stringify(Object.keys(e[g]).sort()),b=JSON.stringify(Object.keys(z[g]).sort());if(a!==b)throw g}console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add src/i18n/en.json src/i18n/zh.json
git commit -m "feat(staff): EN and ZH strings for desk booking and My bookings"
```

---

### Task 7: Build, preview QA, PR

- [ ] **Step 1: Full test run and build**

Run: `node --test src/lib/*.test.js && npm run lint && npm run build`
Expected: all tests pass, lint clean, build succeeds (prerender included, which is why every `localStorage` read stays inside an effect).

- [ ] **Step 2: Mark the old plan superseded**

Add this line under the title of `docs/superpowers/plans/2026-09-24-staff-desk-booking-request.md`:

```markdown
> **Superseded 25 Sep 2026** by `2026-09-25-staff-desk-booking-link.md` (instant link instead of enquiry-then-approve).
```

- [ ] **Step 3: Push and open the PR, then QA on the Vercel preview**

```bash
git add docs/superpowers/plans/2026-09-24-staff-desk-booking-request.md
git commit -m "docs: the enquiry plan is superseded by the booking link plan"
git push -u origin feat/staff-desk-booking-request
gh pr create --title "feat: book a room from the staff desk and send the student a link" --body-file /tmp/pr-body.md
```

On the preview, with Mark's own PIN (Mark enters it): book a vacant room for a test student `test+desk@lazybee.sg`, confirm the link opens `/portal/signup`, the booking shows on My bookings as "Link sent", the owner email arrives, and a `booking_requests` row has `source = 'desk'`. Check the form at 375px wide. Then delete the test rows (tenant_profiles, tenant_details, onboarding_progress, room_calendar, booking_requests) and say which rows were deleted.

- [ ] **Step 4: Merge after green** (Mark's standing auto-merge rule for his repos), then repeat the booking smoke test on lazybee.sg and delete the test rows.
