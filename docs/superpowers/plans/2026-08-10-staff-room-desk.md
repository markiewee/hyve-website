# Staff Room Desk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/staff` page with the approved `design-preview/staff.html` design, on the real `.lzb` design system, without changing what data the page reads.

**Architecture:** The data layer stays exactly as it is: the same two Supabase queries against `properties`, `rooms` and `tenant_profiles`. Everything else is replaced. Pure decision logic (availability wording, the sell-now window, the price ladder, search matching) is extracted into `src/lib/staffRooms.js` and covered by a `node --test` suite, which is where the real bugs live and the only part worth testing directly. Presentation follows the precedent already set by the owner homepage and The Hive: import `src/styles/lazybee.css`, wrap in `LazybeeRoot`, use the scoped `.lzb` classes rather than Tailwind utilities.

**Tech Stack:** React 19, React Router, Vite, Supabase JS, `src/styles/lazybee.css` (scoped `.lzb`), `node:test` + `node:assert/strict`.

**Visual source of truth:** `design-preview/staff.html`, merged in PR #53. When this plan says "match the mockup", open that file. Do not redesign from the description.

---

## Prior art to copy, not reinvent

| Thing | Where it already exists | Use it for |
|---|---|---|
| `.lzb` token scope, all components | `src/styles/lazybee.css` | every class the new page uses |
| Theme wrapper + provider | `src/hooks/useLazybeeTheme.jsx` (`LazybeeRoot`) | the alabaster/tobacco root |
| Theme button | `src/components/ThemeToggle.jsx` | the header toggle |
| Bee mark | `src/components/owners/OwnerChrome.jsx` (`BeeMark`) | the brandlock |
| Page shell precedent | `src/components/hive/HiveChrome.jsx` | how to structure header + wrapper |
| Test style | `src/lib/comb.test.js` | test file layout and runner comment |

## File Structure

**Create**
- `src/lib/staffRooms.js` — pure logic. No React, no Supabase, no `Date.now()` reads inside functions (today is always passed in, so tests are deterministic).
- `src/lib/staffRooms.test.js` — `node --test` suite for the above.
- `src/pages/staff/StaffRoomDeskPage.jsx` — route component: fetch, state, layout.
- `src/components/staff/RoomSearch.jsx` — the filter panel.
- `src/components/staff/RoomCard.jsx` — one expandable room.
- `src/components/staff/PropertyPanel.jsx` — one property, its meta and its rooms.
- `src/components/staff/StaffReference.jsx` — lease terms, move-in steps, FAQ.

**Modify**
- `src/styles/lazybee.css` — append a staff section, all selectors under `.lzb`.
- `src/App.jsx:125` — point `/staff` at the new page.

**Delete**
- `src/components/StaffResourcePage.jsx` — fully replaced.

Rationale for the split: the current page is 828 lines holding six components, and the new design adds the reference block. Splitting by responsibility keeps each file inside what one person can hold in their head, and matches how `hive/` and `owners/` are already organised.

---

### Task 1: Pure logic module and its tests

**Files:**
- Create: `src/lib/staffRooms.js`
- Test: `src/lib/staffRooms.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/staffRooms.test.js`:

```js
// Run with: node --test src/lib/staffRooms.test.js
//
// The staff page answers a prospect in real time, so the wrong availability
// word or the wrong lease-length price is a wrong quote in a live chat. These
// are the four decisions the page makes; everything else is layout.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isLettable,
  availabilityStatus,
  isSellNow,
  priceLadder,
  roomMatchesSearch,
  EMPTY_SEARCH,
  isSearchActive,
} from "./staffRooms.js";

const TODAY = new Date("2026-08-10T00:00:00");
const room = (over = {}) => ({
  unit_code: "CP-PR1",
  room_type: "premium",
  price_monthly: 1500,
  max_occupancy: 1,
  has_private_bathroom: false,
  next_available: null,
  available_until: null,
  ...over,
});

test("a room is lettable only with both a type and a price", () => {
  assert.equal(isLettable(room()), true);
  assert.equal(isLettable(room({ room_type: null })), false);
  assert.equal(isLettable(room({ price_monthly: null })), false);
});

test("no next_available and no end date reads as open now", () => {
  const s = availabilityStatus(room(), TODAY);
  assert.equal(s.label, "Open now");
  assert.equal(s.tone, "warn");
});

test("free now but ending reads as open now with the end date", () => {
  const s = availabilityStatus(room({ available_until: "2026-09-30" }), TODAY);
  assert.match(s.label, /^Open now, until 30 Sep 2026$/);
});

test("a past next_available is open now, not a negative countdown", () => {
  const s = availabilityStatus(room({ next_available: "2026-08-01" }), TODAY);
  assert.equal(s.label, "Open now");
});

test("inside twelve weeks it opens, beyond it is occupied", () => {
  assert.match(availabilityStatus(room({ next_available: "2026-10-01" }), TODAY).label, /^Opens /);
  assert.equal(availabilityStatus(room({ next_available: "2026-10-01" }), TODAY).tone, "warn");
  assert.match(availabilityStatus(room({ next_available: "2027-06-01" }), TODAY).label, /^Occupied to /);
  assert.equal(availabilityStatus(room({ next_available: "2027-06-01" }), TODAY).tone, "ok");
});

test("the sell window is twelve weeks, inclusive at the boundary", () => {
  // 84 days after 10 Aug 2026 is 2 Nov 2026.
  assert.equal(isSellNow(room({ next_available: "2026-11-02" }), TODAY), true);
  assert.equal(isSellNow(room({ next_available: "2026-11-03" }), TODAY), false);
});

test("a room free now with nothing behind it is always a sell target", () => {
  assert.equal(isSellNow(room(), TODAY), true);
});

test("a room free now but taken again shortly is not a sell target", () => {
  assert.equal(isSellNow(room({ available_until: "2026-09-01" }), TODAY), false);
});

test("the ladder anchors on twelve months at the base price", () => {
  const l = priceLadder(1500);
  assert.deepEqual(l.map((t) => t.months), [3, 6, 12, 24]);
  assert.deepEqual(l.map((t) => t.price), [1600, 1550, 1500, 1450]);
  assert.equal(l.find((t) => t.months === 12).anchor, true);
});

test("no price means no ladder rather than a ladder of NaN", () => {
  assert.equal(priceLadder(null), null);
});

test("budget matches within a 200 band on either side", () => {
  const s = { ...EMPTY_SEARCH, budget: "1500" };
  assert.equal(roomMatchesSearch(room({ price_monthly: 1300 }), "CP", s, TODAY), true);
  assert.equal(roomMatchesSearch(room({ price_monthly: 1700 }), "CP", s, TODAY), true);
  assert.equal(roomMatchesSearch(room({ price_monthly: 1299 }), "CP", s, TODAY), false);
});

test("a fixed date needs the room free by then, flexible allows thirty more days", () => {
  const r = room({ next_available: "2026-11-15" });
  const fixed = { ...EMPTY_SEARCH, date: "2026-11-01", dateMode: "fixed" };
  const flex = { ...EMPTY_SEARCH, date: "2026-11-01", dateMode: "flexible" };
  assert.equal(roomMatchesSearch(r, "CP", fixed, TODAY), false);
  assert.equal(roomMatchesSearch(r, "CP", flex, TODAY), true);
});

test("a room vacated before the move-in date does not match it", () => {
  const r = room({ available_until: "2026-09-01" });
  const s = { ...EMPTY_SEARCH, date: "2026-10-01" };
  assert.equal(roomMatchesSearch(r, "CP", s, TODAY), false);
});

test("the sleeps-two and ensuite chips filter on the real columns", () => {
  assert.equal(roomMatchesSearch(room(), "CP", { ...EMPTY_SEARCH, couple: true }, TODAY), false);
  assert.equal(roomMatchesSearch(room({ max_occupancy: 2 }), "CP", { ...EMPTY_SEARCH, couple: true }, TODAY), true);
  assert.equal(roomMatchesSearch(room(), "CP", { ...EMPTY_SEARCH, ensuite: true }, TODAY), false);
  assert.equal(roomMatchesSearch(room({ has_private_bathroom: true }), "CP", { ...EMPTY_SEARCH, ensuite: true }, TODAY), true);
});

test("an untouched search is not active, any one control makes it active", () => {
  assert.equal(isSearchActive(EMPTY_SEARCH), false);
  assert.equal(isSearchActive({ ...EMPTY_SEARCH, location: "CP" }), true);
  assert.equal(isSearchActive({ ...EMPTY_SEARCH, sell: true }), true);
  // dateMode alone is not a filter: it only qualifies a date.
  assert.equal(isSearchActive({ ...EMPTY_SEARCH, dateMode: "flexible" }), false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/lib/staffRooms.test.js`
Expected: FAIL, `Cannot find module './staffRooms.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/staffRooms.js`:

```js
// The decisions behind the staff room desk. Pure, so they can be tested without
// a browser or a database.
//
// `today` is always a parameter. Reading the clock inside these functions would
// make every test depend on the day it runs, and the availability wording is the
// one thing on the page that must not drift.

/** The twelve week sell window from CLAUDE.md rule 18: viewing to move-in runs
 *  four to eight weeks, so anything opening inside twelve is worth marketing. */
export const SELL_WINDOW_DAYS = 84;

/** Budget matches this far either side of the number the prospect gave. */
export const BUDGET_BAND = 200;

const DAY = 86400000;

/** Midnight-normalised, so a comparison is date to date and not clock to clock. */
export function atMidnight(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysUntil(dateStr, today) {
  return Math.round((atMidnight(dateStr) - atMidnight(today)) / DAY);
}

export function formatDate(dateStr) {
  return atMidnight(dateStr).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** A real lettable bedroom has a type and a price. Kitchens, yards and shared
 *  toilets are rows in the same table with neither, and are not inventory. */
export function isLettable(room) {
  return !!room.room_type && !!room.price_monthly;
}

/**
 * The availability line, worded the way a captain would say it out loud.
 * Returns { label, tone } where tone is 'warn' (sellable) or 'ok' (occupied),
 * matching the .badge-warn / .badge-ok classes in lazybee.css.
 */
export function availabilityStatus(room, today) {
  if (!room.next_available) {
    return room.available_until
      ? { label: `Open now, until ${formatDate(room.available_until)}`, tone: "warn" }
      : { label: "Open now", tone: "warn" };
  }
  const d = daysUntil(room.next_available, today);
  if (d <= 0) return { label: "Open now", tone: "warn" };
  if (d <= SELL_WINDOW_DAYS) return { label: `Opens ${formatDate(room.next_available)}`, tone: "warn" };
  return { label: `Occupied to ${formatDate(room.next_available)}`, tone: "ok" };
}

/** Worth actively marketing: going empty with nothing booked behind it, inside
 *  the sell window. A room free today but with an arrival already booked is
 *  covered, not a target. */
export function isSellNow(room, today) {
  if (!room.next_available) return !room.available_until;
  return daysUntil(room.next_available, today) <= SELL_WINDOW_DAYS;
}

/** The published ladder. Twelve months is the anchor and the one we push. */
export function priceLadder(basePrice) {
  if (!basePrice) return null;
  const base = Number(basePrice);
  return [
    { months: 3, price: base + 100 },
    { months: 6, price: base + 50 },
    { months: 12, price: base, anchor: true },
    { months: 24, price: base - 50 },
  ];
}

export const EMPTY_SEARCH = {
  date: "",
  dateMode: "fixed",
  budget: "",
  location: "ALL",
  sell: false,
  couple: false,
  ensuite: false,
};

/** dateMode is deliberately excluded: on its own it filters nothing, and
 *  counting it would leave the page stuck in results mode with every room. */
export function isSearchActive(s) {
  return !!(
    s.date ||
    s.budget ||
    (s.location && s.location !== "ALL") ||
    s.sell ||
    s.couple ||
    s.ensuite
  );
}

export function roomMatchesSearch(room, propertyCode, s, today) {
  if (s.budget) {
    const b = Number(s.budget);
    if (!room.price_monthly) return false;
    if (room.price_monthly < b - BUDGET_BAND || room.price_monthly > b + BUDGET_BAND) return false;
  }
  if (s.location && s.location !== "ALL" && propertyCode !== s.location) return false;
  if (s.sell && !isSellNow(room, today)) return false;
  if (s.couple && (room.max_occupancy || 1) < 2) return false;
  if (s.ensuite && !room.has_private_bathroom) return false;
  if (s.date) {
    const target = atMidnight(s.date);
    const limit = atMidnight(s.date);
    if (s.dateMode === "flexible") limit.setDate(limit.getDate() + 30);
    const from = room.next_available ? atMidnight(room.next_available) : atMidnight(today);
    if (from > limit) return false;
    // Free today, but taken again before they would move in.
    if (room.available_until && atMidnight(room.available_until) < target) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test src/lib/staffRooms.test.js`
Expected: PASS, 14 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/lib/staffRooms.js src/lib/staffRooms.test.js
git commit -m "feat(staff): extract the room desk decisions into a tested module"
```

---

### Task 2: Staff styles in the scoped design system

**Files:**
- Modify: `src/styles/lazybee.css` (append at end of file)

- [ ] **Step 1: Copy the staff block across**

Open `design-preview/staff.html`. Take everything inside its `<style>` element **except** the two `color-scheme` rules, and append it to `src/styles/lazybee.css` under this banner, prefixing every selector with `.lzb ` so nothing escapes the wrapper:

```css
/* ═══════════════════════════════════════════════════════════════════
   Staff room desk, ported from design-preview/staff.html.
   Layout only. Colour, type, buttons, chips, badges and states all come
   from the tokens above. Every selector is scoped under .lzb for the same
   reason the rest of this file is: the app owns :root and defines its own
   --surface and --accent for the terracotta portal theme.
   ═══════════════════════════════════════════════════════════════════ */
```

The rules to bring across, in order: `.lzb .search`, `.lzb .searchgrid`, `.lzb .seg`, `.lzb .seg button`, `.lzb .searchfoot`, `.lzb .tabs`, `.lzb .prop`, `.lzb .propmeta`, `.lzb .subsec`, `.lzb .chips`, `.lzb .chip-sm`, `.lzb .bullets`, `.lzb .strip`, `.lzb .rooms`, `.lzb .room`, `.lzb .code`, `.lzb .caret`, `.lzb .roomline`, `.lzb .price`, `.lzb .roombody`, `.lzb .ladder`, `.lzb .specs`, `.lzb .booking`, `.lzb .steps`, `.lzb .faq`, plus the three media queries.

- [ ] **Step 2: Keep the two selector fixes that were bug fixes, not style**

These two are load-bearing. Copy them exactly:

```css
/* Direct child only. A bare `.ladder div` also paints the .t and .p inside the
   highlighted rung, which buries brass under the ground colour. */
.lzb .ladder > div{background:var(--bg);padding:11px 8px;text-align:center}

/* start, not stretch: an opened card must not drag its neighbours' height with it */
.lzb .rooms{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));
  gap:var(--s4);margin-top:var(--s4);align-items:start}
```

- [ ] **Step 3: Put color-scheme on the theme scope instead**

The mockup set `color-scheme` on `[data-theme]` at the document root. Here the theme lives on the `.lzb` wrapper, so add it to the existing token blocks near the top of the file rather than appending it:

In the `.lzb, .lzb[data-theme="alabaster"]` block add `color-scheme: light;`
In the `.lzb[data-theme="tobacco"]` block add `color-scheme: dark;`

This is what makes the native date picker and select menu readable in tobacco.

- [ ] **Step 4: Verify nothing leaked**

Run: `npm run build:client`
Expected: build succeeds. Then run: `npm run dev`, open `http://127.0.0.1:5173/portal/login` and confirm the portal login still looks unchanged. The `.lzb` scope means it should, and this is the check that proves it.

- [ ] **Step 5: Commit**

```bash
git add src/styles/lazybee.css
git commit -m "feat(staff): scope the room desk styles into the design system"
```

---

### Task 3: The search panel

**Files:**
- Create: `src/components/staff/RoomSearch.jsx`

- [ ] **Step 1: Write the component**

Markup matches the `<section>` holding `.search` in `design-preview/staff.html`. Controlled by props so the page owns the state.

```jsx
// The filter panel. Every control is a real form element, so the page works
// with a keyboard and reads correctly to a screen reader.

import { BUDGET_BAND } from '../../lib/staffRooms';

const LOCATIONS = [
  { code: 'ALL', label: 'All properties' },
  { code: 'CP', label: 'Chiltern Park, Serangoon' },
  { code: 'IH', label: 'Ivory Heights, Jurong East' },
  { code: 'TG', label: 'Thomson Grove, Upper Thomson' },
];

const CHIPS = [
  { key: 'sell', label: 'Sell now, opens within 12 weeks' },
  { key: 'couple', label: 'Sleeps two' },
  { key: 'ensuite', label: 'Ensuite' },
];

export default function RoomSearch({ search, onChange, onClear, active, count, homeCount }) {
  const set = (k, v) => onChange({ ...search, [k]: v });

  return (
    <div className="search">
      <div className="searchgrid">
        <div className="field" style={{ margin: 0 }}>
          <label className="label" htmlFor="staff-date">Move-in date</label>
          <input
            className="input"
            type="date"
            id="staff-date"
            value={search.date}
            onChange={(e) => set('date', e.target.value)}
          />
          <div className="seg" role="group" aria-label="Date flexibility">
            {['fixed', 'flexible'].map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={search.dateMode === mode}
                onClick={() => set('dateMode', mode)}
              >
                {mode === 'fixed' ? 'Fixed' : 'Flexible'}
              </button>
            ))}
          </div>
        </div>

        <div className="field" style={{ margin: 0 }}>
          <label className="label" htmlFor="staff-budget">
            Budget, plus or minus {BUDGET_BAND}
          </label>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            id="staff-budget"
            placeholder="1200"
            value={search.budget}
            onChange={(e) => set('budget', e.target.value)}
          />
          <div className="help">Blank shows every price.</div>
        </div>

        <div className="field" style={{ margin: 0 }}>
          <label className="label" htmlFor="staff-loc">Property</label>
          <select
            className="select input"
            id="staff-loc"
            value={search.location}
            onChange={(e) => set('location', e.target.value)}
          >
            {LOCATIONS.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          <div className="help">Walk times are in each property panel.</div>
        </div>
      </div>

      <div className="searchfoot">
        <div className="chips" style={{ margin: 0 }}>
          {CHIPS.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`chip chip-sm${search[c.key] ? ' on' : ''}`}
              aria-pressed={!!search[c.key]}
              onClick={() => set(c.key, !search[c.key])}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s4)' }}>
          <span className="label" style={{ letterSpacing: '.14em' }} aria-live="polite">
            {active
              ? `${count} ${count === 1 ? 'room' : 'rooms'}${homeCount ? ` in ${homeCount} ${homeCount === 1 ? 'home' : 'homes'}` : ''}`
              : ''}
          </span>
          {active && (
            <button className="btn btn-ghost btn-sm" type="button" onClick={onClear}>Clear</button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/staff/RoomSearch.jsx
git commit -m "feat(staff): the room desk search panel"
```

---

### Task 4: The room card

**Files:**
- Create: `src/components/staff/RoomCard.jsx`

- [ ] **Step 1: Write the component**

A native `<details>`, so it opens without JavaScript state and is keyboard operable for free. Markup matches `roomCard()` in the mockup.

```jsx
import { availabilityStatus, priceLadder, formatDate, daysUntil } from '../../lib/staffRooms';

const sgd = (n) => `S$${Number(n).toLocaleString('en-SG')}`;
const title = (s) => (s ? s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '');

const Caret = () => (
  <svg className="caret" viewBox="0 0 12 12" aria-hidden="true">
    <path d="M2.5 4.5 6 8l3.5-3.5" />
  </svg>
);

function TagRow({ label, list }) {
  if (!list?.length) return null;
  return (
    <div style={{ marginTop: 'var(--s5)' }}>
      <div className="label">{label}</div>
      <div className="chips">
        {list.map((a, i) => <span key={i} className="chip chip-sm">{a}</span>)}
      </div>
    </div>
  );
}

export default function RoomCard({ room, property, today }) {
  const status = availabilityStatus(room, today);
  const ladder = priceLadder(room.price_monthly);
  const opensLater = room.next_available && daysUntil(room.next_available, today) > 0;

  const chips = [
    room.bed_size && title(room.bed_size),
    room.max_occupancy > 1 && `Sleeps ${room.max_occupancy}`,
    room.has_private_bathroom && 'Ensuite',
  ].filter(Boolean);

  const specs = [
    ['Type', title(room.room_type)],
    ['Size', room.size_sqm ? `${room.size_sqm} sqm` : null],
    ['Bed', title(room.bed_size)],
    ['Floor', room.floor],
    ['Furnishing', title(room.furnishing_level)],
    ['Deposit', room.deposit_months ? `${room.deposit_months} month${room.deposit_months > 1 ? 's' : ''}` : null],
    ['Minimum stay', room.min_stay_months ? `${room.min_stay_months} months` : null],
    ['Maximum pax', room.max_occupancy],
    ['Aircon', room.has_aircon ? 'Yes' : null],
    ['Private bathroom', room.has_private_bathroom ? 'Yes' : 'Shared'],
  ].filter(([, v]) => v !== null && v !== undefined && v !== '');

  return (
    <details className="room">
      <summary>
        <div className="roomtop">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="code">{room.unit_code}</span>
              {property && (
                <span className="label accent" style={{ fontSize: 10 }}>{property.name}</span>
              )}
            </div>
            <p className="small" style={{ marginTop: 4, color: 'var(--ink)' }}>{room.name}</p>
          </div>
          <Caret />
        </div>
        <div className="roomline">
          <span className="price">{sgd(room.price_monthly)}</span>
          <span className="fine">per month</span>
          {chips.map((c) => <span key={c} className="chip chip-sm">{c}</span>)}
        </div>
        <div style={{ marginTop: 'var(--s3)' }}>
          <span className={`badge badge-${status.tone}`}>{status.label}</span>
        </div>
      </summary>

      <div className="roombody">
        {room.photos?.length > 0 && (
          <div className="strip">
            {room.photos.map((url, i) => (
              <a key={i} href={url} download={`${room.unit_code}-${i + 1}.jpg`}>
                <img src={url} alt={`${room.unit_code}, photo ${i + 1}`} loading="lazy" />
                <span className="dl">Save</span>
              </a>
            ))}
          </div>
        )}

        {ladder && (
          <>
            <div className="label" style={{ marginTop: 'var(--s4)' }}>Price by lease length</div>
            <div className="ladder">
              {ladder.map((t) => (
                <div key={t.months} className={t.anchor ? 'on' : undefined}>
                  <div className="t">{t.months} mo</div>
                  <div className="p">{sgd(t.price)}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {opensLater && (
          <div className="note" style={{ marginTop: 'var(--s4)' }}>
            Early bird, S$50 off the first two months if they commit before{' '}
            {formatDate(room.next_available)}. Total saving S$100.
          </div>
        )}

        {room.description && (
          <p className="small" style={{ marginTop: 'var(--s5)' }}>{room.description}</p>
        )}

        <div className="specs">
          {specs.map(([k, v]) => (
            <div className="row" key={k}><span>{k}</span><b>{v}</b></div>
          ))}
        </div>

        <TagRow label="In the room" list={room.amenities} />
        <TagRow label="Fixtures" list={room.facilities} />

        {room.available_until && (
          <div style={{ marginTop: 'var(--s5)' }}>
            <div className="label">Booked behind</div>
            <div className="booking">
              <span>Free now to {formatDate(room.available_until)}</span>
              <span className="badge badge-warn">Bridged gap</span>
            </div>
          </div>
        )}

        {room.video_tour_url && (
          <a
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 'var(--s5)' }}
            href={room.video_tour_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            3D tour
          </a>
        )}
      </div>
    </details>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/staff/RoomCard.jsx
git commit -m "feat(staff): the expandable room card"
```

---

### Task 5: The property panel

**Files:**
- Create: `src/components/staff/PropertyPanel.jsx`

- [ ] **Step 1: Write the component**

Markup matches `propPanel()` in the mockup. The housemates block renders the real roster when `tenants` has rows and the signed-out explanation when it does not, which is the honest behaviour given `tenant_profiles` is RLS-blocked to the anon key.

```jsx
import RoomCard from './RoomCard';
import { isLettable } from '../../lib/staffRooms';

const sgd = (n) => `S$${Number(n).toLocaleString('en-SG')}`;

export default function PropertyPanel({ property, today }) {
  const rooms = (property.rooms || []).filter(isLettable);
  const openNow = rooms.filter(
    (r) => !r.next_available || new Date(r.next_available) <= today,
  ).length;
  const roll = rooms.reduce((s, r) => s + (r.price_monthly || 0), 0);
  const housemates = rooms.flatMap((r) => r.tenant_profiles || []);

  return (
    <>
      <div className="prop">
        <div className="label">{property.code}</div>
        <div className="place" style={{ marginTop: 8 }}>{property.name}</div>
        <p className="small" style={{ marginTop: 6 }}>{property.address}</p>

        <div className="propmeta">
          <div className="stat"><div className="n">{rooms.length}</div><div className="l">Rooms</div></div>
          <div className="stat"><div className="n">{openNow}</div><div className="l">Open today</div></div>
          <div className="stat"><div className="n">{property.num_bathrooms}</div><div className="l">Bathrooms</div></div>
          <div className="stat"><div className="n">{sgd(roll)}</div><div className="l">Roll at asking</div></div>
        </div>

        {property.description && (
          <p className="body" style={{ marginTop: 'var(--s5)', fontSize: 15.5 }}>{property.description}</p>
        )}

        <div className="subsec">
          <div className="label">Housemates</div>
          {housemates.length > 0 ? (
            <div className="rows" style={{ marginTop: 'var(--s3)' }}>
              {housemates.map((t, i) => (
                <div className="row" key={i}>
                  <span>{t.tenant_details?.full_name || t.username}</span>
                  <b>{t.tenant_details?.nationality || ''}</b>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty" style={{ marginTop: 'var(--s3)', padding: 'var(--s5)', textAlign: 'left' }}>
              <p className="small" style={{ margin: 0 }}>
                Signed out. The roster reads <span className="num">tenant_profiles</span>, which the
                anon key cannot see, so this stays empty until a staff account is signed in.
              </p>
            </div>
          )}
        </div>

        <div className="subsec">
          <div className="grid g3" style={{ gap: 'var(--s6)' }}>
            <div>
              <div className="label">Nearest MRT</div>
              <ul className="bullets">
                {(property.nearby_mrt || []).map((m, i) => (
                  <li key={i}><b style={{ color: 'var(--ink)', fontWeight: 400 }}>{m.station}</b>, {m.line}, {m.walking_minutes} min walk</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="label">Nearby</div>
              <ul className="bullets">
                {(property.nearby_amenities || []).map((a, i) => (
                  <li key={i}><b style={{ color: 'var(--ink)', fontWeight: 400 }}>{a.name}</b>, {a.walking_minutes} min walk</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="label">Building facilities</div>
              <div className="chips">
                {(property.facilities || []).map((f, i) => <span key={i} className="chip chip-sm">{f}</span>)}
              </div>
            </div>
          </div>
        </div>

        <div className="subsec">
          <div className="grid g2" style={{ gap: 'var(--s6)' }}>
            <div>
              <div className="label">House rules</div>
              <ul className="bullets">
                {(property.house_rules || []).map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
            <div>
              <div className="label">In every room here</div>
              <div className="chips">
                {(property.amenities || []).map((a, i) => <span key={i} className="chip chip-sm">{a}</span>)}
              </div>
              <div className="label" style={{ marginTop: 'var(--s5)' }}>Common areas</div>
              <p className="small" style={{ marginTop: 6 }}>{property.common_areas}</p>
            </div>
          </div>
        </div>

        {property.images?.length > 0 && (
          <div className="subsec">
            <div className="label">Common area photos, click to save</div>
            <div className="strip">
              {property.images.map((url, i) => (
                <a key={i} href={url} download={`${property.code}-common-${i + 1}.jpg`}>
                  <img src={url} alt={`${property.name}, common area ${i + 1}`} loading="lazy" />
                  <span className="dl">Save</span>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="subsec" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s4)', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="label">Location</div>
            <p className="small" style={{ marginTop: 6 }}>{property.address}</p>
            <p className="fine num" style={{ marginTop: 4 }}>{property.latitude}, {property.longitude}</p>
          </div>
          <a
            className="btn btn-ghost btn-sm"
            target="_blank"
            rel="noopener noreferrer"
            href={`https://www.google.com/maps/search/?api=1&query=${property.latitude},${property.longitude}`}
          >
            Open in maps
          </a>
        </div>
      </div>

      <div style={{ marginTop: 'var(--s7)' }}>
        <div className="label">Rooms, {rooms.length}</div>
        <div className="rooms">
          {rooms.map((r) => <RoomCard key={r.id} room={r} today={today} />)}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/staff/PropertyPanel.jsx
git commit -m "feat(staff): the property panel"
```

---

### Task 6: The reference block

**Files:**
- Create: `src/components/staff/StaffReference.jsx`

- [ ] **Step 1: Write the component**

Lease terms, the five move-in steps and the FAQ. Copy the copy verbatim from the `<!-- reference -->` section of `design-preview/staff.html`, including all ten FAQ entries. These three blocks exist in the old `StaffResourcePage.jsx` as `LeaseTermsSection`, `MoveInProcessSection` and `FAQSection` but were never rendered, so this is the first time staff actually see them.

Structure: a `<section className="rule">`, then the two-column lease terms and inclusions grid, then `.steps`, then a `.faq` list of native `<details>` elements. Use the same `Caret` svg as `RoomCard` (extract it to `src/components/staff/Caret.jsx` and import it in both, rather than defining it twice).

- [ ] **Step 2: Commit**

```bash
git add src/components/staff/StaffReference.jsx src/components/staff/Caret.jsx
git commit -m "feat(staff): surface the lease terms, move-in steps and FAQ"
```

---

### Task 7: The page, wired to the existing data layer

**Files:**
- Create: `src/pages/staff/StaffRoomDeskPage.jsx`
- Modify: `src/App.jsx:125`
- Delete: `src/components/StaffResourcePage.jsx`

- [ ] **Step 1: Write the page**

The Supabase fetch is lifted unchanged from `StaffResourcePage.jsx:703-744`, including the `PROPERTY_ORDER` sort and the tenant grouping. Do not change the queries and do not recompute availability client side: `rooms.next_available` is derived server side, and the guest site reads the same column, so recomputing here would make the two disagree.

```jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import SEO from '../../components/SEO';
import ThemeToggle from '../../components/ThemeToggle';
import { BeeMark } from '../../components/owners/OwnerChrome';
import { LazybeeRoot } from '../../hooks/useLazybeeTheme';
import RoomSearch from '../../components/staff/RoomSearch';
import RoomCard from '../../components/staff/RoomCard';
import PropertyPanel from '../../components/staff/PropertyPanel';
import StaffReference from '../../components/staff/StaffReference';
import { EMPTY_SEARCH, isSearchActive, isLettable, roomMatchesSearch } from '../../lib/staffRooms';
import '../../styles/lazybee.css';

const PROPERTY_ORDER = ['CP', 'IH', 'TG'];

export default function StaffRoomDeskPage() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState(EMPTY_SEARCH);
  const [current, setCurrent] = useState(PROPERTY_ORDER[0]);

  useEffect(() => {
    async function fetchData() {
      const [propRes, tenantRes] = await Promise.all([
        supabase.from('properties').select('*, rooms(*)').order('name'),
        supabase
          .from('tenant_profiles')
          .select('room_id, username, gender, is_active, monthly_rent, moved_in_at, lease_end, tenant_details(full_name, nationality)')
          .eq('is_active', true),
      ]);
      if (propRes.error) {
        setError(propRes.error.message);
        setLoading(false);
        return;
      }
      const byRoom = {};
      (tenantRes.data || []).forEach((t) => {
        (byRoom[t.room_id] ||= []).push(t);
      });
      const sorted = PROPERTY_ORDER
        .map((code) => propRes.data.find((p) => p.code === code))
        .filter(Boolean);
      sorted.forEach((p) => {
        (p.rooms || []).sort((a, b) => a.unit_code.localeCompare(b.unit_code));
        (p.rooms || []).forEach((r) => { r.tenant_profiles = byRoom[r.id] || []; });
      });
      setProperties(sorted);
      setLoading(false);
    }
    fetchData();
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const active = isSearchActive(search);
  const hits = active
    ? properties
        .flatMap((p) => (p.rooms || []).filter(isLettable).map((room) => ({ room, property: p })))
        .filter(({ room, property }) => roomMatchesSearch(room, property.code, search, today))
        .sort((a, b) => (a.room.price_monthly || 0) - (b.room.price_monthly || 0))
    : [];
  const homeCount = new Set(hits.map(({ property }) => property.code)).size;
  const shown = properties.find((p) => p.code === current);

  return (
    <LazybeeRoot>
      <SEO title="Staff Resources" noindex />

      <div className="topbar">
        <span className="brandlock"><BeeMark /><span className="wd">LAZYBEE</span></span>
        <nav className="navlinks">
          <span className="label" style={{ letterSpacing: '.16em' }}>Staff</span>
          <ThemeToggle />
        </nav>
      </div>

      <main className="wrap-wide" style={{ paddingBottom: 'var(--s9)' }}>
        <section className="sec-sm">
          <RoomSearch
            search={search}
            onChange={setSearch}
            onClear={() => setSearch(EMPTY_SEARCH)}
            active={active}
            count={hits.length}
            homeCount={homeCount}
          />
        </section>

        {loading && <div className="skeleton" style={{ height: 320 }} />}
        {error && <div className="note note-bad">Could not load rooms: {error}</div>}

        {!loading && !error && (active ? (
          hits.length > 0 ? (
            <div className="rooms">
              {hits.map(({ room, property }) => (
                <RoomCard key={room.id} room={room} property={property} today={today} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <div className="h3">Nothing matches</div>
              <p className="small" style={{ maxWidth: '46ch', margin: '0 auto' }}>
                Widen the budget, or switch the date to flexible to include rooms freeing
                within thirty days of it.
              </p>
            </div>
          )
        ) : (
          <section>
            <div className="tabs">
              {properties.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  className={`chip${p.code === current ? ' on' : ''}`}
                  aria-pressed={p.code === current}
                  onClick={() => setCurrent(p.code)}
                >
                  {p.code}, {p.name}
                </button>
              ))}
            </div>
            {shown && <PropertyPanel property={shown} today={today} />}
          </section>
        ))}

        <StaffReference />
      </main>
    </LazybeeRoot>
  );
}
```

- [ ] **Step 2: Point the route at it**

In `src/App.jsx`, replace the `StaffResourcePage` import with:

```jsx
import StaffRoomDeskPage from './pages/staff/StaffRoomDeskPage';
```

and change line 125 to:

```jsx
<Route path="/staff" element={<StaffRoomDeskPage />} />
```

- [ ] **Step 3: Delete the old page**

```bash
git rm src/components/StaffResourcePage.jsx
```

- [ ] **Step 4: Verify nothing else imported it**

Run: `grep -rn "StaffResourcePage" src/`
Expected: no output.

- [ ] **Step 5: Build and lint**

Run: `npm run build:client && npm run lint`
Expected: both succeed with no new errors.

- [ ] **Step 6: Commit**

```bash
git add -A src/pages/staff src/App.jsx
git commit -m "feat(staff): the room desk replaces the staff resource page"
```

---

### Task 8: Verify against the mockup in a real browser

**Files:** none changed unless a defect is found.

- [ ] **Step 1: Run the app**

Run: `npm run dev -- --host 127.0.0.1`
Open `http://127.0.0.1:5173/staff`.

- [ ] **Step 2: Walk the checklist**

Confirm each, and fix anything that fails before committing:

- Both themes flip from the header toggle and the choice survives a reload.
- No console errors on load.
- No horizontal scroll at 1440, 390 and 320 pixels wide.
- Budget 1200 returns rooms between 1000 and 1400 and the count line agrees with the number of cards.
- The sell-now chip returns only rooms opening inside twelve weeks.
- A date of 2026-10-15 on fixed returns fewer or equal rooms than the same date on flexible.
- Clear resets every control and returns the page to the property tabs.
- Opening one room card does not stretch its neighbours.
- The twelve month rung is brass with dark readable text in both themes.
- Keyboard tab reaches every control and the focus ring is visible.

- [ ] **Step 3: Confirm the guest site still agrees**

Open `book.lazybee.sg` and pick any room that the staff page calls occupied. The two must show the same date, because both read `rooms.next_available`. A disagreement here means the port changed the data reading, which it must not.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(staff): <what the check caught>"
```

---

---

### Task 9: Close the open door on /staff

Approved by Mark on 10 Aug 2026, alongside the port itself.

**Files:**
- Modify: `src/App.jsx` (the `/staff` route)

- [ ] **Step 1: Wrap the route**

`AuthGuard` already exists at `src/components/portal/AuthGuard.jsx` and is imported in `App.jsx`. Change the route to:

```jsx
<Route path="/staff" element={<AuthGuard requiredRole="HOUSE_CAPTAIN"><StaffRoomDeskPage /></AuthGuard>} />
```

`HOUSE_CAPTAIN` rather than `ADMIN` deliberately. The role ladder in `AuthGuard.jsx` is TENANT 0, HOUSE_CAPTAIN 1, ADMIN 2, SUPER_ADMIN 3, and a captain opening a unit for a viewing needs the room facts as much as the person selling. `ADMIN` would lock captains out of the page they need on site. Tenants, landlords and investors are all excluded either by the role level or by the earlier redirects in the guard.

- [ ] **Step 2: Verify the redirect**

Run: `npm run dev -- --host 127.0.0.1`, then open `http://127.0.0.1:5173/staff` in a private window with no session.
Expected: redirected to `/portal/login`, not a flash of room data.

- [ ] **Step 3: Verify a signed-in staff account still gets in**

Sign in as an account with role `HOUSE_CAPTAIN` or higher and open `/staff`.
Expected: the room desk renders, and the housemates block now shows the real roster rather than the signed-out empty state, because the session key passes the `tenant_profiles` RLS policy.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat(staff): require a staff session for the room desk"
```

**Operational risk to flag on handover:** anyone who uses `/staff` today does so with no login at all. If a member of the sales team has no portal account, this change locks them out on the spot. Confirm every current user of the page has an account at `HOUSE_CAPTAIN` or above before this reaches production.

---

## Out of scope, tracked separately

1. **`rooms.next_available` is wrong for TG-PR2.** The column says 1 Nov 2026; `tenant_profiles`, via the rule 18 report, says 1 May 2027. Production `/staff`, the guest booking site and this page all read that column, so all three are wrong together. The fix belongs in `fn_recompute_room_availability`, not here. Porting the page must not paper over it.

## Self-Review

- **Spec coverage.** Search panel: Task 3. Room card with ladder, early bird, specs, tags, bookings, tour: Task 4. Property panel with housemates, MRT, nearby, facilities, rules, photos, location: Task 5. Reference block: Task 6. Theme toggle, route, data: Task 7. Every section of the mockup maps to a task.
- **Placeholders.** Task 6 describes structure rather than pasting the full FAQ copy, because the copy lives verbatim in `design-preview/staff.html` in the same repo and duplicating ten answers here would create two sources that drift. The file and section are named exactly.
- **Type consistency.** `availabilityStatus` returns `{ label, tone }` in Task 1 and is consumed as `status.tone` in Task 4. `priceLadder` returns `{ months, price, anchor }` in Task 1 and is read as `t.months` / `t.price` / `t.anchor` in Task 4. `roomMatchesSearch(room, propertyCode, search, today)` has the same signature in Task 1 and Task 7. `isLettable` is used in Tasks 5 and 7 and defined in Task 1.
