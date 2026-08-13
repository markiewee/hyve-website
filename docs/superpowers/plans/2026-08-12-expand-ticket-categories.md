# Expand Ticket Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand maintenance ticket categories from 6 to 10 (add PEST, LOCK, WIFI, APPLIANCE) so the enum matches the tenant self-help vocabulary, fix the suggestCategory ordering bug that mis-tags pest reports as PLUMBING, and accept reporter_email as a third reporter identifier.

**Architecture:** The category enum lives in three places that must stay in lockstep: the DB CHECK constraint (`supabase/migrations/20260321000000_initial_schema.sql:75`), the API-side validation (`src/lib/partnerTickets.js` `TICKET_CATEGORIES`), and the portal picker (`src/components/portal/TicketForm.jsx` `CATEGORIES`). `src/pages/portal/NewIssuePage.jsx` already uses the 10-name vocabulary (AC, PLUMBING, ELECTRICAL, WIFI, LOCK, APPLIANCE, PEST, FURNITURE, CLEANING, OTHER) and passes `preselectedCategory` into TicketForm, so the portal names are adopted as canonical. suggestCategory gets reordered: problem-naming words (pest, wifi, lock, appliance) are checked before room-fixture words (sink, drain, socket) because fixtures appear as incidental location detail.

**Tech Stack:** Plain JS lib + node test runner, Supabase SQL migration, React (portal), Vercel deploy on merge to master.

**Evidence this is broken today (all live, 12 Aug):**
1. Ticket `1cffb9d2` (CP-PR2 cockroach) auto-categorised **PLUMBING** because its description mentions "drain / sink" from the diagnostic question. PLUMBING regex runs before any pest word is checked.
2. POST /v1/tickets with `category: "PEST"` is a 422 (enum has no PEST).
3. NewIssuePage PEST/WIFI/LOCK/APPLIANCE self-help paths preselect categories TicketForm's DB insert cannot store (CHECK constraint violation, after the tenant already uploaded photos).
4. Cockroach reporters (CP-PR2 tenants) have no phone on file, only an email; validateTicket demands phone or portal account, so honest intake needed a "not-on-file" marker string.

---

### Task 1: Migration, expand the CHECK constraint + reporter_email column

**Files:**
- Create: `supabase/migrations/20260821000000_expand_ticket_categories.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Expand maintenance ticket categories to match the tenant self-help
-- vocabulary (NewIssuePage already offers PEST / LOCK / WIFI / APPLIANCE
-- and preselects them into TicketForm, where the old constraint made the
-- insert fail after photos were already uploaded).
ALTER TABLE public.maintenance_tickets
  DROP CONSTRAINT IF EXISTS maintenance_tickets_category_check;

ALTER TABLE public.maintenance_tickets
  ADD CONSTRAINT maintenance_tickets_category_check
  CHECK (category IN (
    'AC', 'PLUMBING', 'ELECTRICAL', 'WIFI', 'LOCK',
    'APPLIANCE', 'PEST', 'FURNITURE', 'CLEANING', 'OTHER'
  ));

-- Third reporter identifier. The CP-PR2 cockroach reporters (12 Aug) have
-- an email on file but no phone; phone-or-portal-account was too narrow.
ALTER TABLE public.maintenance_tickets
  ADD COLUMN IF NOT EXISTS reporter_email TEXT;
```

- [ ] **Step 2: Confirm constraint name matches production before applying**

Run: `grep -n "maintenance_tickets_category_check\|category TEXT NOT NULL CHECK" supabase/migrations/20260321000000_initial_schema.sql`
Expected: line 75 shows the inline CHECK (unnamed, so Postgres named it `maintenance_tickets_category_check` by convention). If production disagrees, query `information_schema.check_constraints` and use the real name.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260821000000_expand_ticket_categories.sql
git commit -m "feat(tickets): expand category constraint to the self-help vocabulary, add reporter_email"
```

### Task 2: partnerTickets.js, enum + suggestCategory ordering + reporter_email

**Files:**
- Modify: `src/lib/partnerTickets.js:16-18` (TICKET_CATEGORIES)
- Modify: `src/lib/partnerTickets.js:107-115` (suggestCategory)
- Modify: `src/lib/partnerTickets.js:119-132` (validateTicket)
- Modify: `src/lib/partnerTickets.js:137-163` (ticketInsert)
- Test: `src/lib/partnerTickets.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// Categories: the portal self-help vocabulary is canonical.
assert.ok(TICKET_CATEGORIES.has("PEST"));
assert.ok(TICKET_CATEGORIES.has("LOCK"));
assert.ok(TICKET_CATEGORIES.has("WIFI"));
assert.ok(TICKET_CATEGORIES.has("APPLIANCE"));

// The live failure of 12 Aug: a pest report whose diagnostic text mentions
// plumbing fixtures must still be PEST. Fixtures are where, not what.
assert.equal(
  suggestCategory("Cockroach sightings x2, locate source: drain / under sink / kitchen"),
  "PEST",
);
assert.equal(suggestCategory("saw a roach in the bathroom"), "PEST");
assert.equal(suggestCategory("wifi router keeps dropping, no internet"), "WIFI");
assert.equal(suggestCategory("washing machine drum not spinning"), "APPLIANCE");
assert.equal(suggestCategory("keypad passcode not working on my door"), "LOCK");
// Regression guards: the old six still route correctly.
assert.equal(suggestCategory("toilet won't flush"), "PLUMBING");
assert.equal(suggestCategory("corridor light bulb out"), "ELECTRICAL");

// reporter_email is a sufficient identifier on its own.
assert.ok(validateTicket({
  description: "roach in bathroom", listing_code: "CP-PR2",
  reporter_email: "tenant@example.com",
}).ok);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/lib/partnerTickets.test.js`
Expected: FAIL (PEST not in set, suggestCategory returns PLUMBING/CLEANING, validateTicket missing identifier).

- [ ] **Step 3: Implement**

```js
export const TICKET_CATEGORIES = new Set([
  "AC", "PLUMBING", "ELECTRICAL", "WIFI", "LOCK",
  "APPLIANCE", "PEST", "FURNITURE", "CLEANING", "OTHER",
]);
```

suggestCategory, problem-naming words before fixture words:

```js
export function suggestCategory(description) {
  const t = String(description ?? "").toLowerCase();
  // Specific problems first. A cockroach "near the sink" is a pest problem,
  // not a sink problem: fixture words are where, problem words are what.
  if (/\bpest|cockroach|\broach(es)?\b|bed.?bug|rodent|\brats?\b|\bmice\b|\bmouse\b|termite|\bants?\b|infest/.test(t)) return "PEST";
  if (/wi.?fi\b|internet|router|broadband|\bnetwork\b/.test(t)) return "WIFI";
  if (/\block(s|ed)?\b|latch|keypad|passcode|door code|access code|gate code|door handle|\bkeys?\b/.test(t)) return "LOCK";
  if (/washing machine|\bwasher\b|\bdryer\b|fridge|refrigerator|freezer|microwave|kettle|\boven\b|stove|\bhob\b|induction|water heater|dishwasher/.test(t)) return "APPLIANCE";
  if (/aircon|air con|\bac\b|cooling|fan coil/.test(t)) return "AC";
  if (/water|leak|toilet|sink|drain|tap|shower|pipe|flush|clog/.test(t)) return "PLUMBING";
  if (/power|electric|socket|light|bulb|switch|breaker|wiring/.test(t)) return "ELECTRICAL";
  if (/bed|mattress|chair|table|wardrobe|desk|sofa|drawer|cupboard/.test(t)) return "FURNITURE";
  if (/clean|dirty|rubbish|trash|mould|mold|smell/.test(t)) return "CLEANING";
  return "OTHER";
}
```

validateTicket line 124 becomes:

```js
  if (!b.reporter_phone && !b.reporter_email && !b.submitted_by)
    missing.push("one of: reporter_phone, reporter_email, submitted_by");
```

ticketInsert row gains, next to reporter_phone:

```js
    reporter_email: b.reporter_email ?? null,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/lib/partnerTickets.test.js`
Expected: PASS, including all pre-existing tests (the "pest|cockroach|bug" words must be REMOVED from the CLEANING regex is not needed: CLEANING never contained them at the word level that fires first now; verify no existing assertion expected pest → CLEANING; if one does, update it to PEST, the behaviour change is the point).

- [ ] **Step 5: Commit**

```bash
git add src/lib/partnerTickets.js src/lib/partnerTickets.test.js
git commit -m "feat(tickets): 10-category vocabulary, pest-first suggestion order, reporter_email"
```

### Task 3: TicketForm picker

**Files:**
- Modify: `src/components/portal/TicketForm.jsx:7`

- [ ] **Step 1: Update the array**

```jsx
const CATEGORIES = [
  "AC", "PLUMBING", "ELECTRICAL", "WIFI", "LOCK",
  "APPLIANCE", "PEST", "FURNITURE", "CLEANING", "OTHER",
];
```

Grid is `grid-cols-3`, so 10 buttons render as 4 rows; no layout change needed. Labels render the raw enum string, as today.

- [ ] **Step 2: Verify the preselect path**

Run: `grep -n "preselectedCategory" src/pages/portal/NewIssuePage.jsx src/components/portal/TicketForm.jsx`
Expected: every NewIssuePage key (AC, PLUMBING, ELECTRICAL, WIFI, LOCK, APPLIANCE, PEST, FURNITURE, CLEANING, OTHER) is now present in CATEGORIES, so the preselected button highlights instead of pointing at a value the picker cannot show.

- [ ] **Step 3: Commit**

```bash
git add src/components/portal/TicketForm.jsx
git commit -m "feat(portal): ticket picker carries the full 10-category vocabulary"
```

### Task 4: Full suite + PR

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all green (236+ tests as of 12 Aug).

- [ ] **Step 2: Open the PR**

```bash
git push -u origin feat/expand-ticket-categories
gh pr create --title "feat(tickets): expand issue types to the self-help vocabulary" --body-file <PR draft>
```

### Post-merge manual steps (not in the PR)

1. Apply the migration to hyve-iot production (same channel as the 11 Aug rate-counter migration).
2. Recategorise live tickets via PATCH /v1/tickets/{id}: `1cffb9d2` cockroach → PEST; CP-PR1 door handle (16 Jun) → LOCK; CP-STD1 stove-not-working (7 May) → APPLIANCE. Leave the burned socket ELECTRICAL, that is a socket, and IH-PR2 mold as-is pending a MOLD decision (deliberately out of scope, mold routes to CLEANING by keyword).
3. Confirm the portal PEST self-help path submits end to end with a real photo.
