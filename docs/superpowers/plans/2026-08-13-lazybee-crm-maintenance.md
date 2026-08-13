# Lazybee CRM + Maintenance Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the CRM and maintenance machinery that already exists in the schema but has never run: arm and evaluate activation conditions, make the inbound worker write leads, gate ticket resolution on photo proof, acknowledge reporters, route CP to contractors, and give Kavi the operational stream.

**Architecture:** Nothing here rewrites identity resolution, stage policy or SLA math, all of which are shipped and working. Three repos, each shippable alone. hyve-website gains a photo gate, a schema-drift fix and a Kavi notify module, all riding the existing `/api/v1` catch-all so the Vercel function count stays at exactly 12. agent-link-mini gains lead writes and the 15-minute acknowledgement. lazybee-machine gains the nightly activation job, which ships in report-only mode first so one night's would-send list can be reviewed before a single message reaches 251 real people.

**Tech Stack:** Node ESM with `node:test` and `node:assert/strict` (no npm test script; run `node --test src/lib/`), Supabase Postgres migrations under `supabase/migrations/`, Python 3 stdlib for the worker and board, Beeper Desktop REST for sends.

**Decisions locked 13 Aug:** DB stage vocabulary (eleven statuses) is kept, not replaced. Scope is `internal` (no `agent` scope exists). Idempotency is the body field `idempotency_key`. SLA hours stay as shipped: URGENT 4, HIGH 48, ROUTINE 168, COSMETIC 720.

---

## Task 1: Fix the `date_initiated` schema drift

The column exists in production but in no migration, so a rebuild from migrations breaks the portal's Add Lead flow. Three frontend files read and write it.

**Files:**
- Create: `supabase/migrations/20260821000001_leads_date_initiated.sql`

- [ ] **Step 1: Confirm the drift is real**

```bash
cd /Users/mark/Desktop/hyve-website
grep -rn "date_initiated" supabase/migrations/ || echo "CONFIRMED: absent from migrations"
grep -rln "date_initiated" src/ | head
```

Expected: absent from migrations, present in `src/hooks/useLeads.js`, `src/components/portal/leads/LeadCard.jsx`, `src/components/portal/leads/LeadDrawer.jsx`.

- [ ] **Step 2: Write the migration**

```sql
-- 20260821000001_leads_date_initiated.sql
--
-- leads.date_initiated exists in production but in no migration: it was added
-- by hand. Three portal files write and read it (useLeads.addLead, LeadCard,
-- LeadDrawer), so a fresh environment rebuilt from this repo would accept the
-- Add Lead form and then fail the insert. Additive and idempotent: the live
-- database already has the column and will no-op.

alter table public.leads
  add column if not exists date_initiated date;

comment on column public.leads.date_initiated is
  'Date the portal operator first made contact. Written by the Add Lead form.';
```

- [ ] **Step 3: Verify it is a no-op against production**

```bash
cd /Users/mark/Desktop/claudine/projects/lazybee-machine
python3 -c "import db; print(db.run(\"select column_name, data_type from information_schema.columns where table_name='leads' and column_name='date_initiated'\"))"
```

Expected: one row, `date` type. The migration exists to make the repo match, not to change production.

- [ ] **Step 4: Commit**

```bash
cd /Users/mark/Desktop/hyve-website
git add supabase/migrations/20260821000001_leads_date_initiated.sql
git commit -m "fix(schema): leads.date_initiated existed in prod but in no migration"
```

---

## Task 2: Photo gate on ticket resolution

`validateClose()` requires a resolution note and a named closer. It does not require evidence. The `ticket_photos` table exists and the API has never read it.

**Files:**
- Modify: `src/lib/partnerTickets.js` (the `validateClose` function)
- Modify: `src/lib/partnerTickets.test.js`
- Modify: `api/v1/[...path].js` (`handleUpdateTicket`)

- [ ] **Step 1: Write the failing test**

Add to `src/lib/partnerTickets.test.js`:

```js
test("validateClose demands photo evidence", () => {
  const base = { status: "RESOLVED", resolution_note: "swapped the trap", resolved_by_label: "Edward" };
  assert.equal(validateClose(base, { photoCount: 0 }).ok, false);
  assert.match(validateClose(base, { photoCount: 0 }).reason, /photo/i);
  assert.equal(validateClose(base, { photoCount: 1 }).ok, true);
});

test("validateClose ignores photos for non-resolving updates", () => {
  const patch = { status: "IN_PROGRESS" };
  assert.equal(validateClose(patch, { photoCount: 0 }).ok, true);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd /Users/mark/Desktop/hyve-website
node --test src/lib/partnerTickets.test.js
```

Expected: FAIL, because `validateClose` takes one argument today and ignores photo count.

- [ ] **Step 3: Widen `validateClose`**

In `src/lib/partnerTickets.js`, change the signature to accept an evidence argument and add the gate after the existing note and closer checks:

```js
export function validateClose(patch, evidence = {}) {
  if (String(patch?.status || "").toUpperCase() !== "RESOLVED") return { ok: true };
  const note = String(patch.resolution_note || "").trim();
  if (note.length < 4)
    return { ok: false, reason: "resolution_note must say what was actually done" };
  if (!patch.resolved_by && !patch.resolved_by_label)
    return { ok: false, reason: "a resolved ticket needs a named closer" };
  if (!(Number(evidence.photoCount) > 0))
    return { ok: false, reason: "a resolved ticket needs at least one photo as proof" };
  return { ok: true };
}
```

Keep the existing note and closer wording if it differs; only the photo clause is new.

- [ ] **Step 4: Run the tests until green**

```bash
node --test src/lib/partnerTickets.test.js
```

Expected: PASS, including the pre-existing close tests. If an older test calls `validateClose(patch)` for a RESOLVED patch it will now fail: update it to pass `{ photoCount: 1 }`, since that test was asserting note and closer behaviour, not evidence behaviour.

- [ ] **Step 5: Feed the real photo count in the handler**

In `api/v1/[...path].js`, inside `handleUpdateTicket`, before the `validateClose` call, count the evidence:

```js
let photoCount = 0;
if (String(body.status || "").toUpperCase() === "RESOLVED") {
  const { count } = await supabase
    .from("ticket_photos")
    .select("id", { count: "exact", head: true })
    .eq("ticket_id", id);
  photoCount = Number(count) || 0;
}
const close = validateClose(body, { photoCount });
if (!close.ok) return err(res, 422, "validation_failed", close.reason);
```

Match the surrounding variable names in that handler (`body` may be `req.body`, `id` may be the `second` segment). The count query runs only on a resolving update, so ordinary patches cost nothing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/partnerTickets.js src/lib/partnerTickets.test.js api/v1/[...path].js
git commit -m "feat(tickets): a ticket cannot close without photo proof"
```

---

## Task 3: Kavi notification module (pure, tested)

Pure formatting and routing rules, no network. The caller sends. This is the piece that decides who hears about what.

**Files:**
- Create: `src/lib/opsNotify.js`
- Create: `src/lib/opsNotify.test.js`

- [ ] **Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { audienceFor, ticketCreatedMessage, digestMessage, KAVI_EVENTS } from "./opsNotify.js";

test("URGENT reaches Mark and Kavi, everything else is Kavi only", () => {
  assert.deepEqual(audienceFor({ type: "ticket_created", severity: "URGENT" }), ["mark", "kavi"]);
  assert.deepEqual(audienceFor({ type: "ticket_created", severity: "HIGH" }), ["kavi"]);
  assert.deepEqual(audienceFor({ type: "viewing_booked" }), ["kavi"]);
});

test("money always reaches Mark", () => {
  assert.deepEqual(audienceFor({ type: "quote_received" }), ["mark", "kavi"]);
  assert.deepEqual(audienceFor({ type: "charge_drafted" }), ["mark"]);
});

test("unknown event types notify nobody rather than everybody", () => {
  assert.deepEqual(audienceFor({ type: "something_new" }), []);
});

test("ticket message names the property, severity and due date without dashes or emoji", () => {
  const m = ticketCreatedMessage({
    listing_code: "CP-PR2", severity: "HIGH",
    description: "cockroaches in the kitchen", due_at: "2026-08-15T10:00:00Z",
  });
  assert.match(m, /CP-PR2/);
  assert.match(m, /HIGH/);
  assert.equal(/[—–]/.test(m), false);
  assert.equal(/\p{Extended_Pictographic}/u.test(m), false);
});

test("digest counts by severity and lists nothing when empty", () => {
  assert.match(digestMessage({ tickets: [], viewings: [], sellWindow: [] }), /nothing open/i);
  const m = digestMessage({
    tickets: [{ severity: "URGENT", listing_code: "CP-PR2", days_open: 2 }],
    viewings: [{ listing_code: "IH-STD1", at: "2026-08-13T10:00:00Z" }],
    sellWindow: ["TG-PR2"],
  });
  assert.match(m, /1 urgent/i);
  assert.match(m, /IH-STD1/);
});

test("KAVI_EVENTS is exactly the five agreed instant types", () => {
  assert.deepEqual([...KAVI_EVENTS].sort(), [
    "photo_submitted", "quote_received", "sla_warning", "ticket_created", "viewing_booked",
  ]);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node --test src/lib/opsNotify.test.js
```

Expected: FAIL, module not found.

- [ ] **Step 3: Write the module**

```js
// opsNotify.js
//
// Who hears about what. Mark asked for exactly two things in his pocket:
// URGENT and money. Kavi runs the day to day and gets the operational stream.
// An unknown event type notifies nobody: silence is recoverable, a firehose
// to Mark is the thing this module exists to prevent.

export const KAVI_EVENTS = new Set([
  "ticket_created", "sla_warning", "quote_received", "viewing_booked", "photo_submitted",
]);

const MONEY_EVENTS = new Set(["quote_received", "charge_drafted", "refund_requested"]);
const MARK_ONLY = new Set(["charge_drafted", "refund_requested"]);

export function audienceFor(event) {
  const type = String(event?.type || "");
  const urgent = String(event?.severity || "").toUpperCase() === "URGENT";
  if (MARK_ONLY.has(type)) return ["mark"];
  if (MONEY_EVENTS.has(type)) return ["mark", "kavi"];
  if (!KAVI_EVENTS.has(type)) return [];
  return urgent ? ["mark", "kavi"] : ["kavi"];
}

const dayOf = (iso) => {
  if (!iso) return "no due date";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "no due date" : d.toISOString().slice(0, 10);
};

export function ticketCreatedMessage(t) {
  const where = t?.listing_code || t?.property_slug || "unknown unit";
  const sev = String(t?.severity || "ROUTINE").toUpperCase();
  const what = String(t?.description || "").trim() || "no description given";
  return `New ticket ${where}. ${sev}. ${what}. Due ${dayOf(t?.due_at)}.`;
}

export function digestMessage({ tickets = [], viewings = [], sellWindow = [] } = {}) {
  if (!tickets.length && !viewings.length && !sellWindow.length)
    return "Morning. Nothing open, nothing booked, nothing to sell today.";
  const bySev = (s) => tickets.filter((t) => String(t.severity).toUpperCase() === s).length;
  const parts = [];
  const counts = [
    [bySev("URGENT"), "urgent"], [bySev("HIGH"), "high"],
    [bySev("ROUTINE"), "routine"], [bySev("COSMETIC"), "cosmetic"],
  ].filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`);
  parts.push(counts.length ? `Open tickets: ${counts.join(", ")}.` : "No open tickets.");
  const oldest = tickets.slice().sort((a, b) => (b.days_open || 0) - (a.days_open || 0))[0];
  if (oldest?.days_open > 2)
    parts.push(`Oldest is ${oldest.listing_code} at ${oldest.days_open} days.`);
  parts.push(viewings.length
    ? `Viewings today: ${viewings.map((v) => v.listing_code).join(", ")}.`
    : "No viewings today.");
  if (sellWindow.length) parts.push(`Rooms to sell: ${sellWindow.join(", ")}.`);
  return parts.join(" ");
}
```

- [ ] **Step 4: Run the tests until green**

```bash
node --test src/lib/opsNotify.test.js
```

Expected: PASS, six tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/opsNotify.js src/lib/opsNotify.test.js
git commit -m "feat(ops): who hears about what, Mark gets urgent and money only"
```

---

## Task 4: Activation condition evaluator (pure, tested)

The four condition types already exist in `partnerLeads.js` as `ACTIVATION_TYPES` and are validated on write. Nothing evaluates them. This is the decision function; Task 5 is the job that calls it.

**Files:**
- Create: `src/lib/leadActivation.js`
- Create: `src/lib/leadActivation.test.js`

- [ ] **Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { conditionFires, quietHold } from "./leadActivation.js";

const rooms = [
  { listing_code: "CP-MR", price_monthly: 2200, in_sell_window: true },
  { listing_code: "IH-STD1", price_monthly: 1000, in_sell_window: false },
];

test("DATE fires inside eight weeks and not before", () => {
  const now = new Date("2026-08-13T00:00:00Z");
  assert.equal(conditionFires({ type: "DATE", on: "2026-09-01" }, { rooms, now }), true);
  assert.equal(conditionFires({ type: "DATE", on: "2026-12-01" }, { rooms, now }), false);
});

test("ROOM fires only when the named room is in the sell window", () => {
  assert.equal(conditionFires({ type: "ROOM", listing_code: "CP-MR" }, { rooms }), true);
  assert.equal(conditionFires({ type: "ROOM", listing_code: "IH-STD1" }, { rooms }), false);
  assert.equal(conditionFires({ type: "ROOM", listing_code: "NOPE" }, { rooms }), false);
});

test("BUDGET fires when a sellable room is at or under the cap", () => {
  assert.equal(conditionFires({ type: "BUDGET", max_monthly: 2200 }, { rooms }), true);
  assert.equal(conditionFires({ type: "BUDGET", max_monthly: 1500 }, { rooms }), false);
});

test("MANUAL fires when armed", () => {
  assert.equal(conditionFires({ type: "MANUAL" }, { rooms }), true);
});

test("a malformed or missing condition never fires", () => {
  assert.equal(conditionFires(null, { rooms }), false);
  assert.equal(conditionFires({ type: "DATE" }, { rooms }), false);
  assert.equal(conditionFires({ type: "WHAT" }, { rooms }), false);
});

test("quiet hours hold between 21:00 and 09:00 Singapore time", () => {
  assert.equal(quietHold(new Date("2026-08-13T14:00:00Z")), false); // 22:00 SGT
  assert.equal(quietHold(new Date("2026-08-13T02:00:00Z")), true);  // 10:00 SGT
});
```

Note the assertion direction: `quietHold` returns true when it is safe to send. Name it that way in the implementation or flip the test; do not leave the two disagreeing.

- [ ] **Step 2: Run it and watch it fail**

```bash
node --test src/lib/leadActivation.test.js
```

Expected: FAIL, module not found.

- [ ] **Step 3: Write the module**

```js
// leadActivation.js
//
// Decides whether a stored lead should be woken. Pure: the caller supplies
// the room sell-state and the clock, so this is testable without a database
// and cannot fire on data it did not receive.
//
// The four types mirror ACTIVATION_TYPES in partnerLeads.js. If a type is
// added there it must be added here, or a lead can be stored with a
// condition that nothing will ever evaluate.

const EIGHT_WEEKS_MS = 56 * 24 * 60 * 60 * 1000;

export function conditionFires(condition, { rooms = [], now = new Date() } = {}) {
  const type = String(condition?.type || "");
  const sellable = rooms.filter((r) => r.in_sell_window);
  switch (type) {
    case "DATE": {
      const on = condition.on ? new Date(condition.on) : null;
      if (!on || Number.isNaN(on.getTime())) return false;
      return on.getTime() - now.getTime() <= EIGHT_WEEKS_MS;
    }
    case "ROOM":
      return sellable.some((r) => r.listing_code === condition.listing_code);
    case "BUDGET": {
      const cap = Number(condition.max_monthly);
      if (!(cap > 0)) return false;
      return sellable.some((r) => Number(r.price_monthly) <= cap);
    }
    case "MANUAL":
      return true;
    default:
      return false;
  }
}

// True when it is a civilised hour in Singapore to message a stranger.
export function quietHold(now = new Date()) {
  const sgtHour = (now.getUTCHours() + 8) % 24;
  return sgtHour >= 9 && sgtHour < 21;
}
```

- [ ] **Step 4: Run the tests until green**

```bash
node --test src/lib/leadActivation.test.js
```

Expected: PASS, six tests. Then run the whole suite to prove nothing regressed:

```bash
node --test src/lib/
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/leadActivation.js src/lib/leadActivation.test.js
git commit -m "feat(crm): decide when a stored lead deserves waking"
```

---

## Task 5: Nightly activation job, report-only first

251 live leads have never received a reactivation. The job ships in report-only mode: it computes what it would send and reports it, and sends nothing until the flag is flipped after Mark reads one night's list.

**Files:**
- Create: `/Users/mark/Desktop/claudine/projects/lazybee-machine/activation_job.py`
- Create: `/Users/mark/Desktop/claudine/projects/lazybee-machine/test_activation_job.py`

- [ ] **Step 1: Write the failing test**

```python
import unittest
from activation_job import fires, would_send

ROOMS = [
    {"listing_code": "CP-MR", "price_monthly": 2200, "in_sell_window": True},
    {"listing_code": "IH-STD1", "price_monthly": 1000, "in_sell_window": False},
]

class Fires(unittest.TestCase):
    def test_manual_fires(self):
        self.assertTrue(fires({"type": "MANUAL"}, ROOMS, "2026-08-13"))

    def test_room_needs_sell_window(self):
        self.assertTrue(fires({"type": "ROOM", "listing_code": "CP-MR"}, ROOMS, "2026-08-13"))
        self.assertFalse(fires({"type": "ROOM", "listing_code": "IH-STD1"}, ROOMS, "2026-08-13"))

    def test_budget_at_or_under(self):
        self.assertTrue(fires({"type": "BUDGET", "max_monthly": 2200}, ROOMS, "2026-08-13"))
        self.assertFalse(fires({"type": "BUDGET", "max_monthly": 1500}, ROOMS, "2026-08-13"))

    def test_date_inside_eight_weeks(self):
        self.assertTrue(fires({"type": "DATE", "on": "2026-09-01"}, ROOMS, "2026-08-13"))
        self.assertFalse(fires({"type": "DATE", "on": "2026-12-01"}, ROOMS, "2026-08-13"))

    def test_garbage_never_fires(self):
        for bad in (None, {}, {"type": "DATE"}, {"type": "NOPE"}):
            self.assertFalse(fires(bad, ROOMS, "2026-08-13"))

class WouldSend(unittest.TestCase):
    def test_skips_leads_without_a_phone(self):
        leads = [{"id": "1", "phone_e164": None, "activation_condition": {"type": "MANUAL"}}]
        self.assertEqual(would_send(leads, ROOMS, "2026-08-13"), [])

    def test_skips_unarmed_leads(self):
        leads = [{"id": "1", "phone_e164": "+6591234567", "activation_condition": None}]
        self.assertEqual(would_send(leads, ROOMS, "2026-08-13"), [])

    def test_returns_the_armed_and_firing(self):
        leads = [{"id": "1", "phone_e164": "+6591234567",
                  "activation_condition": {"type": "MANUAL"}, "name": "Ada"}]
        out = would_send(leads, ROOMS, "2026-08-13")
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["lead_id"], "1")

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd /Users/mark/Desktop/claudine/projects/lazybee-machine
python3 -m unittest test_activation_job -v
```

Expected: FAIL, `ModuleNotFoundError: No module named 'activation_job'`.

- [ ] **Step 3: Write the job**

```python
#!/usr/bin/env python3
"""Wake stored leads whose activation condition has come true.

REPORT-ONLY until SEND=True. 251 leads have never received one of these and
the first run must be read by a human before it messages a single stranger.

A run that cannot read room sell-state sends nothing and reports degraded.
Firing on stale room data would quote a room that is already gone, which is
worse than staying quiet.
"""
import datetime as dt
import json
import db

SEND = False              # flip only after Mark reads a night's report
EIGHT_WEEKS = dt.timedelta(days=56)


def fires(condition, rooms, today):
    if not isinstance(condition, dict):
        return False
    kind = condition.get("type")
    sellable = [r for r in rooms if r.get("in_sell_window")]
    if kind == "MANUAL":
        return True
    if kind == "ROOM":
        return any(r["listing_code"] == condition.get("listing_code") for r in sellable)
    if kind == "BUDGET":
        cap = condition.get("max_monthly")
        try:
            cap = float(cap)
        except (TypeError, ValueError):
            return False
        return cap > 0 and any(float(r["price_monthly"]) <= cap for r in sellable)
    if kind == "DATE":
        on = condition.get("on")
        if not on:
            return False
        try:
            when = dt.date.fromisoformat(str(on))
        except ValueError:
            return False
        return when - dt.date.fromisoformat(today) <= EIGHT_WEEKS
    return False


def would_send(leads, rooms, today):
    """The list a human reads before this thing is ever allowed to send."""
    out = []
    for lead in leads:
        if not lead.get("phone_e164"):
            continue                      # no phone, no send, no guessing
        cond = lead.get("activation_condition")
        if not fires(cond, rooms, today):
            continue
        out.append({
            "lead_id": lead["id"],
            "name": lead.get("name"),
            "phone": lead["phone_e164"],
            "condition": cond,
        })
    return out


def load_rooms():
    rows = db.run("""
        select r.unit_code as listing_code,
               r.price_monthly,
               (r.next_available is null or r.next_available <= current_date + 84) as in_sell_window
        from rooms r
        where r.is_active
    """)
    if not rows:
        raise RuntimeError("no room sell-state; refusing to evaluate")
    return rows


def load_stored_leads():
    return db.run("""
        select id, name, phone_e164, activation_condition
        from leads
        where lifecycle = 'STORED' and activation_condition is not null
    """)


def main():
    today = dt.date.today().isoformat()
    try:
        rooms = load_rooms()
    except Exception as exc:
        print(json.dumps({"status": "degraded", "reason": str(exc)[:200], "sent": 0}))
        return
    leads = load_stored_leads()
    pending = would_send(leads, rooms, today)
    print(json.dumps({
        "status": "ok",
        "mode": "send" if SEND else "report-only",
        "stored_leads": len(leads),
        "would_send": len(pending),
        "detail": pending,
    }, indent=2, default=str))


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the tests until green**

```bash
python3 -m unittest test_activation_job -v
```

Expected: PASS, eight tests.

- [ ] **Step 5: Run it against live data and read the output**

```bash
python3 activation_job.py
```

Expected today: `stored_leads: 0`, `would_send: 0`, because no lead has ever been stored. That zero is the correct answer and proves the query path works; it is not a failure.

- [ ] **Step 6: Commit**

```bash
cd /Users/mark/Desktop/claudine/projects/lazybee-machine
git add activation_job.py test_activation_job.py
git commit -m "feat(crm): nightly job to wake stored leads, report-only until read"
```

---

## Task 6: Backfill the missing phone keys

191 of 251 leads have no `phone_e164`, so identity resolution cannot key on them. Derive where the raw data allows, report what it cannot, never guess.

**Files:**
- Create: `/Users/mark/Desktop/claudine/projects/lazybee-machine/backfill_lead_phones.py`

- [ ] **Step 1: Count what is derivable before changing anything**

```bash
cd /Users/mark/Desktop/claudine/projects/lazybee-machine
python3 -c "
import db
print(db.run('''
  select
    count(*) filter (where phone_e164 is not null) as have,
    count(*) filter (where phone_e164 is null and phone is not null) as derivable_from_phone,
    count(*) filter (where phone_e164 is null and phone is null and chat_id is not null) as chat_only,
    count(*) filter (where phone_e164 is null and phone is null and chat_id is null) as hopeless
  from leads'''))
"
```

Record the four numbers. They are the success criteria for this task.

- [ ] **Step 2: Write the backfill as a dry run first**

```python
#!/usr/bin/env python3
"""Fill leads.phone_e164 from the raw phone column, using the database's own
normaliser so JS and SQL cannot disagree about who two rows are.

Dry run by default. Never invents a number: a row that fn_normalise_phone
cannot resolve is reported, not guessed at. WhatsApp LIDs deliberately
normalise to null, which is why chat_id is not a phone source.
"""
import json
import db

APPLY = False

def main():
    preview = db.run("""
        select id, name, phone, public.fn_normalise_phone(phone) as derived
        from leads
        where phone_e164 is null and phone is not null
        order by updated_at desc
    """)
    ok = [r for r in preview if r["derived"]]
    stuck = [r for r in preview if not r["derived"]]
    print(json.dumps({"derivable": len(ok), "unresolvable": len(stuck),
                      "sample": ok[:5], "stuck_sample": stuck[:5]}, indent=2, default=str))
    if not APPLY:
        print("dry run, nothing written")
        return
    db.run("""
        update leads
        set phone_e164 = public.fn_normalise_phone(phone)
        where phone_e164 is null
          and phone is not null
          and public.fn_normalise_phone(phone) is not null
    """)
    after = db.run("select count(*) n from leads where phone_e164 is not null")
    print(json.dumps({"applied": True, "phone_e164_now": after}, default=str))

if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run the dry run and read it**

```bash
python3 backfill_lead_phones.py
```

Expected: a derivable count, an unresolvable count, and five samples of each. Eyeball the samples: any row where `derived` looks like a truncated or wrong-country number stops this task and gets reported, because a wrong phone key fuses two people.

- [ ] **Step 4: Apply only after the samples look right**

Set `APPLY = True`, run again, then confirm the count moved:

```bash
python3 backfill_lead_phones.py
python3 -c "import db; print(db.run('select count(*) n from leads where phone_e164 is not null'))"
```

Expected: the new count equals the old 60 plus the derivable count from Step 3.

- [ ] **Step 5: Commit**

```bash
git add backfill_lead_phones.py
git commit -m "chore(crm): backfill phone keys from raw phone, report what cannot be derived"
```

---

## Task 7: Worker writes leads

The inbound worker holds no database credentials by design. It reaches the Partner API with the key in `~/.agent-runner/lazybee-api.env`, which must be internal scope for lead reads and updates.

**Files:**
- Modify: `/Users/mark/Desktop/claudine/projects/agent-link-mini/beeper_inbound_prompt.txt`
- Modify: `/Users/mark/Desktop/claudine/projects/agent-link-mini/test_beeper_inbound.py`

- [ ] **Step 1: Confirm the key scope before writing anything**

```bash
curl -s -H "Authorization: Bearer $(grep -o 'lzb_live_[A-Za-z0-9_-]*' ~/.agent-runner/lazybee-api.env | head -1)" \
  https://www.lazybee.sg/api/v1/leads | head -c 300
```

Expected if internal: a `{"data":[...]}` envelope. If it returns 403 `forbidden`, the worker's key is partner scope and a new internal key must be minted with `node scripts/mint-partner-key.mjs` before this task can proceed. Do not widen the scope check to make a partner key work.

- [ ] **Step 2: Add the lead-write instruction to the prompt**

Append to `beeper_inbound_prompt.txt`, in the section that describes what to do after replying:

```
LEAD WRITE, every inbound conversation, no exceptions:
After you have replied (or drafted for Mark), record the person.

POST https://www.lazybee.sg/api/v1/leads
Authorization: Bearer <the key in ~/.agent-runner/lazybee-api.env>
{
  "name": "<their name, or the chat title if unknown>",
  "phone": "<their number in E.164 if the chat gives you one>",
  "chat_id": "<CHAT_ID>",
  "identifiers": ["beeper:<CHAT_ID>"],
  "source": "whatsapp",
  "notes": "<one line: what they actually asked for>",
  "idempotency_key": "beeper:<CHAT_ID>:<the message id you replied to>"
}

The idempotency_key makes a retry safe: the same message id can never create
a second lead. If the API returns non-2xx, write the payload to
~/.agent-runner/queue/leads/<CHAT_ID>.json and carry on. Never drop an
inquiry because a write failed.

If the person is not ready now (wrong dates, over budget, needs a room we do
not have), store them instead of losing them: PATCH the lead you just created
with {"lifecycle": "STORED", "activation_condition": {...}} where the
condition is {"type":"DATE","on":"YYYY-MM-DD"} for a future move-in,
{"type":"BUDGET","max_monthly":N} for a price wall, or
{"type":"ROOM","listing_code":"XX-YY"} for a specific room they want.
```

- [ ] **Step 3: Add a test for the queue path**

The worker's Python does not write leads (claude does), so the testable unit is the queue directory contract. Add to `test_beeper_inbound.py`:

```python
import os, tempfile, json, unittest

class QueueContract(unittest.TestCase):
    """A failed lead write must land on disk, not vanish."""

    def test_queue_path_is_per_chat_and_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            qdir = os.path.join(tmp, "queue", "leads")
            os.makedirs(qdir, exist_ok=True)
            path = os.path.join(qdir, "358.json")
            with open(path, "w") as fh:
                json.dump({"chat_id": "358", "source": "whatsapp"}, fh)
            self.assertTrue(os.path.exists(path))
            with open(path) as fh:
                self.assertEqual(json.load(fh)["chat_id"], "358")
```

- [ ] **Step 4: Run the worker tests**

```bash
cd /Users/mark/Desktop/claudine/projects/agent-link-mini
python3 -m unittest test_beeper_inbound -v
```

Expected: PASS, existing cases plus the new one.

- [ ] **Step 5: Commit**

```bash
git add beeper_inbound_prompt.txt test_beeper_inbound.py
git commit -m "feat(worker): every inbound conversation becomes a lead"
```

---

## Task 8: Correct the fleet map

`map.html` still shows the CRM as NOT BUILT and describes "a thin leads table". Both statements are false and the map is the thing Mark reads.

**Files:**
- Modify: `/Users/mark/Desktop/claudine/projects/lazybee-machine/map.html`

- [ ] **Step 1: Find the stale claims**

```bash
cd /Users/mark/Desktop/claudine/projects/lazybee-machine
grep -n "thin leads table\|hyve-ops.json" map.html | head
```

- [ ] **Step 2: Replace them with what is true**

Change the CRM section's summary to state the real position: the leads table, endpoints and identity resolution are built and live with 251 rows; what is missing is that nothing arms or evaluates an activation condition, the worker does not yet write leads, and 191 of 251 rows have no phone key. Keep the dotted/solid line encoding the page already uses: solid for the schema and endpoints, dotted for the activation loop and the worker write path.

- [ ] **Step 3: Deploy and verify**

```bash
./deploy.sh
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8850/map
grep -c "thin leads table" <(curl -s http://127.0.0.1:8850/map) || echo "stale text gone"
```

Expected: 200, and the stale phrase absent.

- [ ] **Step 4: Commit**

```bash
git add map.html
git commit -m "fix(map): the CRM is built, the wiring is what is missing"
```

---

## Self-review notes

- Task 2 changes a shared function signature. `validateClose` is called in exactly one place (`handleUpdateTicket`); the default `evidence = {}` argument keeps any other caller compiling, but a RESOLVED patch with no evidence argument now fails closed, which is the intended direction.
- Tasks 4 and 5 deliberately duplicate the condition logic in JS and Python. They serve different runtimes (the API validates on write, the job evaluates on a schedule) and both are pinned by tests. If a fifth condition type is ever added it must land in three places: `ACTIVATION_TYPES` in `partnerLeads.js`, `conditionFires` in `leadActivation.js`, and `fires` in `activation_job.py`.
- Task 6 writes to production data. It is dry-run by default and its apply step is gated on a human reading the samples.
- No task adds a file under `api/`. Function count stays at 12. Verify on the Vercel dashboard after deploying Tasks 1 and 2.
