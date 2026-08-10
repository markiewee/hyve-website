# Staff PIN Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put `/staff` behind a per-person six digit PIN instead of a portal login, so staff without portal accounts can use it and any one person can be revoked without disturbing the rest.

**Architecture:** Copies the `channel_pins` pattern shipped on 11 Aug in `supabase/migrations/20260811000005_channel_pins.sql`. A `staff_pins` table that the anon role can never read, plus a `security definer` function the anon role may call, which returns false for a bad PIN rather than saying whether it exists. The React side is a gate component that wraps the page, holds the unlock in `localStorage` with an expiry, and replaces `AuthGuard` on the route.

**Tech Stack:** Postgres (Supabase project `diiilqpfmlxjwiaeophb`, hyve-iot), React 19, `node:test`.

**What this is and is not.** It stops a prospect or a competitor casually opening the room desk. It does not make room prices secret: the Supabase anon key ships in the client bundle and `rooms` is anon-readable, which it has to be because `book.lazybee.sg` renders the public listings from those same rows. The genuinely sensitive table, `tenant_profiles`, is already RLS-protected and stays that way. Do not describe this to anyone as making the data private.

---

### Task 1: The migration

**Files:**
- Create: `supabase/migrations/20260813000000_staff_pins.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Staff access PINs for the room desk at /staff.
--
-- Modelled directly on channel_pins (20260811000005). Same reasoning: one row
-- per person so usage is attributable and a single PIN can be revoked on its
-- own, six digits because these get read out loud and typed on a phone.
--
-- What this protects is the page, not the data. rooms is anon-readable by
-- design so the public booking site can render listings, and the anon key is in
-- the client bundle. tenant_profiles is the sensitive one and its own RLS
-- already keeps it out of reach. This gate exists so the internal tool is not
-- sitting on a guessable URL for anyone who wanders past.

create table if not exists public.staff_pins (
  pin          text primary key,
  label        text not null,
  enabled      boolean not null default true,
  note         text,
  last_used_at timestamptz,
  use_count    integer not null default 0,
  created_at   timestamptz not null default now(),

  constraint staff_pins_format check (pin ~ '^[0-9]{6}$')
);

comment on table public.staff_pins is
  'A PIN opens the staff room desk at /staff. One row per person so usage is '
  'attributable and a single PIN can be revoked without changing everyone else''s.';
comment on column public.staff_pins.label is
  'Who holds it, e.g. "Edward, IH captain". Shown in the admin list, never public.';

-- ── redeeming a PIN ─────────────────────────────────────────────────────────
--
-- Returns true or false, and records the use. security definer is what lets an
-- anonymous caller check a PIN without staff_pins itself ever being readable.
--
-- A wrong PIN returns false rather than raising, and the function never reveals
-- whether a given PIN exists but is disabled: both cases look identical.

create or replace function public.redeem_staff_pin(p_pin text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  ok boolean := false;
begin
  update public.staff_pins
     set use_count = use_count + 1,
         last_used_at = now()
   where pin = p_pin
     and enabled = true;

  if found then
    ok := true;
  end if;

  return ok;
end;
$$;

-- The room desk is opened by people without portal accounts, so the check has
-- to be callable with no session at all.
grant execute on function public.redeem_staff_pin(text) to anon, authenticated;

-- staff_pins itself stays admin-only. The anon role never reads it directly, it
-- only ever goes through redeem_staff_pin.
alter table public.staff_pins enable row level security;

drop policy if exists staff_pins_admin_all on public.staff_pins;
create policy staff_pins_admin_all on public.staff_pins
  for all to authenticated
  using (
    exists (select 1 from public.tenant_profiles tp
             where tp.user_id = auth.uid() and tp.role = 'ADMIN')
  )
  with check (
    exists (select 1 from public.tenant_profiles tp
             where tp.user_id = auth.uid() and tp.role = 'ADMIN')
  );
```

- [ ] **Step 2: Apply it to hyve-iot**

```bash
set -a; . ~/.chudbrain/secrets.env; set +a
curl -s -X POST "https://api.supabase.com/v1/projects/diiilqpfmlxjwiaeophb/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  --data-binary "$(python3 -c "import json,sys;print(json.dumps({'query':open('supabase/migrations/20260813000000_staff_pins.sql').read()}))")"
```

Expected: `[]` or a success payload, no error key.

- [ ] **Step 3: Prove the security properties, do not assume them**

Three checks, all run with the anon key, not the service key:

1. A bad PIN returns false: `select public.redeem_staff_pin('000000')` gives `false`.
2. `staff_pins` is unreadable: a REST `GET /rest/v1/staff_pins` with the anon key returns 401 or an empty set, never rows.
3. A good PIN returns true and increments `use_count`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260813000000_staff_pins.sql
git commit -m "feat(staff): staff_pins table and redeem function"
```

---

### Task 2: The unlock, with an expiry

**Files:**
- Create: `src/lib/staffPin.js`
- Test: `src/lib/staffPin.test.js`

Pure storage logic, separated so the expiry rule is testable without a browser.

- [ ] **Step 1: Write the failing test**

```js
// Run with: node --test src/lib/staffPin.test.js
//
// A gate that forgets too fast is a gate people prop open. One that never
// forgets is one you cannot revoke. The expiry is the whole design, so it is
// the part worth testing.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readUnlock, buildUnlock, UNLOCK_DAYS } from "./staffPin.js";

const NOW = new Date("2026-08-13T09:00:00Z").getTime();
const day = 86400000;

test("a fresh unlock is valid", () => {
  assert.equal(readUnlock(JSON.stringify(buildUnlock(NOW)), NOW), true);
});

test("an unlock is still valid one hour before it expires", () => {
  const u = JSON.stringify(buildUnlock(NOW));
  assert.equal(readUnlock(u, NOW + UNLOCK_DAYS * day - 3600000), true);
});

test("an unlock is dead once past its expiry", () => {
  const u = JSON.stringify(buildUnlock(NOW));
  assert.equal(readUnlock(u, NOW + UNLOCK_DAYS * day + 1), false);
});

test("nothing stored means locked", () => {
  assert.equal(readUnlock(null, NOW), false);
  assert.equal(readUnlock("", NOW), false);
});

test("corrupt storage means locked, not a thrown error", () => {
  assert.equal(readUnlock("{not json", NOW), false);
  assert.equal(readUnlock(JSON.stringify({ nope: 1 }), NOW), false);
});

test("an expiry in the far future is not trusted on its own", () => {
  // Someone hand-editing localStorage can set any expiry they like. The gate is
  // a doormat, not a lock, but it should at least reject a payload that does not
  // carry the shape we wrote.
  assert.equal(readUnlock(JSON.stringify({ exp: NOW + 400 * day }), NOW), false);
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `node --test src/lib/staffPin.test.js`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement**

```js
// Where the staff room desk remembers that this browser has been let in.
//
// localStorage rather than a cookie: there is no server session to attach a
// cookie to, the whole site is static plus Supabase. Thirty days because a
// captain should not retype a PIN on every shift, and revoking a person is done
// by disabling their row, which bites the next time they unlock.

export const UNLOCK_DAYS = 30;
export const STORAGE_KEY = "lzb-staff-unlock";

const MARK = "staff-pin-v1";

export function buildUnlock(now) {
  return { v: MARK, exp: now + UNLOCK_DAYS * 86400000 };
}

export function readUnlock(raw, now) {
  if (!raw) return false;
  try {
    const u = JSON.parse(raw);
    if (!u || u.v !== MARK || typeof u.exp !== "number") return false;
    return u.exp > now;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run it, expect pass**

Run: `node --test src/lib/staffPin.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/staffPin.js src/lib/staffPin.test.js
git commit -m "feat(staff): the unlock record and its expiry"
```

---

### Task 3: The gate component

**Files:**
- Create: `src/components/staff/StaffPinGate.jsx`

- [ ] **Step 1: Write it**

Renders its children once unlocked, and a single PIN field otherwise, styled with the `.lzb` classes so the gate looks like the page behind it. Six digits, `inputMode="numeric"`, submits on Enter. On a wrong PIN it says the PIN was not recognised and nothing more, matching what the database does.

```jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { LazybeeRoot } from '../../hooks/useLazybeeTheme';
import { buildUnlock, readUnlock, STORAGE_KEY } from '../../lib/staffPin';

export default function StaffPinGate({ children }) {
  const [open, setOpen] = useState(null); // null while we read storage
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [bad, setBad] = useState(false);

  // Read in an effect, not in the initialiser: the prerender step runs this in
  // Node where localStorage does not exist.
  useEffect(() => {
    let raw = null;
    try { raw = window.localStorage.getItem(STORAGE_KEY); } catch { /* private mode */ }
    setOpen(readUnlock(raw, Date.now()));
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (pin.length !== 6 || busy) return;
    setBusy(true);
    setBad(false);
    const { data, error } = await supabase.rpc('redeem_staff_pin', { p_pin: pin });
    setBusy(false);
    if (error || data !== true) {
      setBad(true);
      setPin('');
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(buildUnlock(Date.now())));
    } catch { /* not worth blocking entry over */ }
    setOpen(true);
  }

  if (open === null) return null;
  if (open) return children;

  return (
    <LazybeeRoot>
      <main className="wrap" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <form onSubmit={submit} style={{ maxWidth: 380, margin: '0 auto', width: '100%' }}>
          <div className="label">Lazybee, internal</div>
          <h1 className="h1" style={{ fontSize: 'clamp(26px,3vw,36px)', marginTop: 'var(--s3)' }}>
            Room desk
          </h1>
          <p className="small" style={{ marginTop: 'var(--s3)' }}>
            Enter your six digit staff PIN. Ask Mark if you do not have one.
          </p>
          <div className="field" style={{ marginTop: 'var(--s5)' }}>
            <label className="label" htmlFor="staff-pin">PIN</label>
            <input
              className="input"
              id="staff-pin"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              autoFocus
              aria-invalid={bad || undefined}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            {bad && <div className="error">That PIN was not recognised.</div>}
          </div>
          <button
            className="btn btn-accent"
            type="submit"
            style={{ marginTop: 'var(--s5)', width: '100%' }}
            disabled={pin.length !== 6 || busy}
          >
            {busy ? 'Checking' : 'Open the room desk'}
          </button>
        </form>
      </main>
    </LazybeeRoot>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/staff/StaffPinGate.jsx
git commit -m "feat(staff): the PIN gate"
```

---

### Task 4: Swap the route from AuthGuard to the PIN

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Change the route**

```jsx
<Route path="/staff" element={<StaffPinGate><StaffRoomDeskPage /></StaffPinGate>} />
```

Import `StaffPinGate` from `./components/staff/StaffPinGate`. Remove the `AuthGuard` wrapper and its comment from this route only; `AuthGuard` stays imported for every portal route.

The reason for the swap, worth keeping in the comment: the room desk is opened by captains and sales people who do not all have portal accounts, and `AuthGuard` required one. A PIN is issued per person and revoked per person, which is the same control without the account.

- [ ] **Step 2: Build and lint**

Run: `npm run build:client && npx eslint src/components/staff src/lib/staffPin.js src/App.jsx`
Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat(staff): gate the room desk on a PIN rather than a portal account"
```

---

### Task 5: Issue the first PINs

**Files:** none. This is data.

- [ ] **Step 1: Mint one PIN per person who uses the page**

Ask Mark for the list of names first. Do not invent holders. One row each:

```sql
insert into public.staff_pins (pin, label) values ('<six digits>', '<name, role>');
```

- [ ] **Step 2: Give Mark the list inline**

Paste the PINs and their labels into chat, never a file path (rule 13). These are credentials, so they go to Mark and nobody else, and never to Momo (rule 3).

---

### Task 6: Verify in a real browser

- [ ] **Step 1: Locked by default**

Open `/staff` in a private window. Expected: the PIN form, and no room codes or prices anywhere in the DOM.

- [ ] **Step 2: A wrong PIN is refused and says nothing useful**

Enter `000000`. Expected: "That PIN was not recognised", still locked.

- [ ] **Step 3: A real PIN opens it and is remembered**

Enter a real one. Expected: the room desk. Reload. Expected: straight in, no prompt.

- [ ] **Step 4: Revocation bites**

Disable that PIN with `update public.staff_pins set enabled = false where pin = '<pin>'`, clear localStorage, reload. Expected: refused.

- [ ] **Step 5: Usage is recorded**

`select pin, label, use_count, last_used_at from public.staff_pins` shows the count climbing on the PIN used.

---

## Out of scope

- **An admin screen to issue and revoke PINs.** For now that is SQL, the same as `channel_pins` was on day one. Worth adding to an existing admin page later so Mark is not dependent on me to onboard someone. Not worth blocking this on.
- **The `rooms.next_available` discrepancy on TG-PR2.** Still open, still affects the booking site as much as this page.
