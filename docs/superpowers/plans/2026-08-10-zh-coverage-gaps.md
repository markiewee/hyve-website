# Chinese Coverage Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close every remaining English string on a page a visitor has switched to Chinese, across lazybee.sg and book.lazybee.sg, and drop the formal register for a direct one that matches Mark's English voice.

**Architecture:** No new mechanism. The dictionaries and the two lookups shipped in #46 and #4 already work; this fills the gaps they missed and adds one thing they did not have, a mapping layer for the values that arrive from the database in English. Dates start formatting through the date-fns `zhCN` locale, which is already a dependency.

**Tech Stack:** Existing. `src/i18n/{en,zh}.json` plus `useLanguage()` on the main site, `lib/dict.ts` plus `tFor`/`useT` on the booking site. No new packages.

---

## What the audit found

Measured on the live sites on 10 Aug 2026, after switching each to Chinese.

**lazybee.sg** renders 3,017 Han characters and **60 English fragments**, concentrated in:

| Area | What is still English |
|---|---|
| Owner portal mock | The whole thing bar the 8 keys already done: the intro paragraph, the four tab labels, the four stat tiles, seven document rows, five maintenance-log rows, eight gallery captions |
| The comb | "Click a filled cell to open the listing", "See it live", "List a unit like this", every room name and amenity, the unit addresses |
| Homes strip | MRT station names |
| Hero | The district label, "D19 Serangoon" |

**book.lazybee.sg** room page carries **37 English fragments**:

| Area | What is still English |
|---|---|
| Spec rows | Home, Deposit, Rent, "1 month", "$1,000 / month", "/ month" |
| Pay block | "What you'll pay", "Security deposit (1 mo)", the deposit explainer |
| Reserve panel | The three tab labels, "Email (optional)", "Reserve, no deposit", the 3-day hold blurb, the move-in window sentence |
| Elsewhere | "Search", the "from" price prefix, "· by Lazybee", the "room · Co-living in Singapore" subtitle |
| Dates | "Available from 1 Oct 2026" formats through the English locale |

The rest is data: room names, room types, amenities, bed types, building names, descriptions and addresses, all arriving from hyve-iot in English.

## Three calls I made rather than asking

1. **Register: 你, not 您, everywhere.** Mark's English voice is direct and unstuffy and the formal 您 currently on the site reads like a bank letter. This is a mechanical sweep over both dictionaries and reverses in one command if he disagrees.
2. **Proper nouns: translate the generic part, keep the building names English.** "Master Room" becomes 主人房 and "Queen bed" becomes 双人床, but Chiltern Park stays Chiltern Park so a visitor can still match it to an address, a listing or a Grab destination. No database change: a mapping layer in the front end covers the finite set of room types, bed types and amenities.
3. **SEO tags stay English.** The tab title keeps reading "Be a lazy landlord". English remains the crawlable version and rankings stay untouched.

## File Structure

**hyve-website** (worktree at `/Users/mark/Desktop/hyve-website-zh`, branch `feat/zh-coverage-gaps`)

| File | Responsibility |
|---|---|
| `src/i18n/roomVocab.js` | *Create.* Maps the finite English vocabulary out of `lazybeeRooms.js` (room types, bed types, amenities, bathroom types) to a dictionary key. Anything unmapped falls through unchanged rather than blanking. |
| `src/i18n/{en,zh}.json` | *Modify.* The portal-mock block, the comb block, the room vocabulary, the district names. Register sweep 您 to 你. |
| `src/data/ownerPage.js` | *Modify.* `PORTAL_TABS`, `PORTAL_TILES`, `DOCS`, `LOG`, `GAL` become key arrays, matching what `COMPARE_ROWS` and `FAQ` already do. |
| `src/components/owners/PortalSection.jsx` | *Modify.* Resolve those arrays through `t()`. |
| `src/components/owners/CombSection.jsx` | *Modify.* Room names and amenities through `roomVocab`, plus the three loose UI strings. |
| `src/components/owners/StaticSections.jsx` | *Modify.* MRT station labels in the homes strip. |
| `src/lib/ownerModel.js` | *Modify.* `DI` district names become keys. |

**hyve-booking** (branch `feat/zh-coverage-gaps`)

| File | Responsibility |
|---|---|
| `lib/roomVocab.ts` | *Create.* The same mapping, for the values `getListableRooms()` returns. |
| `lib/dateFormat.ts` | *Create.* One `formatDate(date, lang)` wrapping date-fns with the `zhCN` locale, so "1 Oct 2026" becomes 2026年10月1日. |
| `lib/dict.ts` | *Modify.* The room-page block, the reserve panel, the pay block, the room vocabulary. Register sweep. |
| `app/rooms/[unitCode]/page.tsx` | *Modify.* Spec rows, subtitle, pay block. |
| `components/{BookingPanel,ReserveForm,ReserveDetailsForm,PriceChart,SearchBar,RoomCard,BookingFlow,Hero}.tsx` | *Modify.* The strings listed in the audit, and dates through `formatDate`. |

---

## Task 1: The room vocabulary mapping

**Files:**
- Create: `src/i18n/roomVocab.js`
- Test: `src/i18n/roomVocab.test.js`

- [ ] **Step 1: Write the failing test**

```js
// Run with: node --test src/i18n/roomVocab.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOMS } from '../data/lazybeeRooms.js';
import { vocabKey, VOCAB } from './roomVocab.js';

test('every amenity, bed and room type in the live data has a mapping', () => {
  const seen = new Set();
  for (const r of ROOMS) {
    if (r.type) seen.add(r.type);
    if (r.bed) seen.add(r.bed);
    for (const a of r.amenities ?? []) seen.add(a);
  }
  const unmapped = [...seen].filter((v) => !VOCAB[v]);
  assert.deepEqual(unmapped, [], `no Chinese for: ${unmapped.join(', ')}`);
});

test('an unknown value falls through unchanged rather than blanking', () => {
  assert.equal(vocabKey('Rooftop helipad'), 'Rooftop helipad');
});

test('a mapped value returns a dictionary key, not the Chinese directly', () => {
  // Keeps one source of truth: the words live in the dictionaries like
  // everything else, and this file only says which key a value maps to.
  assert.equal(vocabKey('Queen bed'), 'owner.vocab.queenBed');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/i18n/roomVocab.test.js`
Expected: FAIL, cannot resolve `./roomVocab.js`.

- [ ] **Step 3: Write the mapping**

```js
// src/i18n/roomVocab.js
//
// The room data in lazybeeRooms.js is pulled from hyve-iot and is English, so a
// visitor reading Chinese still met "Queen bed" and "Ensuite bathroom" in the
// middle of a Chinese card. The vocabulary is small and closed, so it maps here
// rather than being translated in the database, which would need a migration and
// a second column on every room.
//
// Values map to dictionary KEYS, not to Chinese, so the words stay in en.json and
// zh.json with everything else and the parity tests still cover them.

export const VOCAB = {
  'Master room': 'owner.vocab.masterRoom',
  'Premium room': 'owner.vocab.premiumRoom',
  'Standard room': 'owner.vocab.standardRoom',
  'Queen bed': 'owner.vocab.queenBed',
  'Super single bed': 'owner.vocab.superSingleBed',
  'Super single': 'owner.vocab.superSingle',
  'Single bed': 'owner.vocab.singleBed',
  'Ensuite bathroom': 'owner.vocab.ensuiteBathroom',
  'Study table': 'owner.vocab.studyTable',
  'Wardrobe': 'owner.vocab.wardrobe',
  'WiFi': 'owner.vocab.wifi',
};

/** The key for a value, or the value itself when we have never seen it. */
export function vocabKey(value) {
  return VOCAB[value] ?? value;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test src/i18n/roomVocab.test.js`
Expected: PASS, 3 tests. If test one fails it has found a value in the live data the map does not cover, which is the point of reading it off `ROOMS` rather than a hardcoded list.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/roomVocab.js src/i18n/roomVocab.test.js
git commit -m "feat(i18n): map the room vocabulary to dictionary keys"
```

---

## Task 2: Translate the owner portal mock

**Files:** `src/data/ownerPage.js`, `src/components/owners/PortalSection.jsx`, `src/i18n/{en,zh}.json`

The largest single gap: roughly sixty strings, and the section that is meant to prove transparency to an owner currently proves it only in English.

- [ ] **Step 1: Turn the five arrays into key arrays**

`PORTAL_TABS`, `PORTAL_TILES`, `DOCS`, `LOG` and `GAL` follow the pattern `COMPARE_ROWS` and `FAQ` already use: the array holds `owner.portal.*` keys and the component resolves them. Dates inside the log rows ("7 Aug 2026") and money ("S$180") stay as literals in the data, since they are values rather than prose.

- [ ] **Step 2: Add both languages under `owner.portal`**

Keys mirror the array shape: `owner.portal.tab1`, `owner.portal.tile1.label`, `owner.portal.doc1.title`, `owner.portal.doc1.meta`, `owner.portal.doc1.status`, `owner.portal.log1.title`, `owner.portal.log1.body`, `owner.portal.log1.status`, `owner.portal.gal1.caption`.

- [ ] **Step 3: Resolve them in the component, then verify**

Run: `node --test src/i18n/` then `npm run build`
Expected: parity and key-resolution tests pass, homepage prerenders with an unchanged English word count.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(i18n): translate the owner portal statement, documents, log and photos"
```

---

## Task 3: The comb, the homes strip and the districts

**Files:** `src/components/owners/CombSection.jsx`, `StaticSections.jsx`, `src/lib/ownerModel.js`, dictionaries

- [ ] **Step 1** Route room names, bed types and amenities through `vocabKey()` then `t()`.
- [ ] **Step 2** Translate the three loose strings: "Click a filled cell to open the listing", "See it live", "List a unit like this".
- [ ] **Step 3** Turn the `DI` district map in `ownerModel.js` into keys so "D19 Serangoon" reads 19区 实龙岗. `ownerModel.test.js` asserts on the model's arithmetic, not on `DI`, so it is unaffected; run it to confirm.
- [ ] **Step 4** MRT station names in the homes strip take the same vocabulary treatment.
- [ ] **Step 5** Run `node --test src/lib/ownerModel.test.js src/i18n/` and `npm run build`, then commit.

---

## Task 4: The booking room page

**Files:** `app/rooms/[unitCode]/page.tsx`, `components/{BookingPanel,PriceChart,ReserveForm,ReserveDetailsForm}.tsx`, `lib/dict.ts`, `lib/roomVocab.ts`

- [ ] **Step 1** Spec rows: Home, Room type, Deposit, Rent, and their values ("1 month", "$1,000 / month").
- [ ] **Step 2** The pay block: "What you'll pay", "Security deposit (1 mo)", the explainer sentence.
- [ ] **Step 3** The reserve panel: three tab labels, "Email (optional)", "Reserve, no deposit", the 3-day hold blurb, and the move-in window sentence, which takes three numbers and so needs placeholders rather than concatenation.
- [ ] **Step 4** `lib/roomVocab.ts`, the same mapping as Task 1 against the shape `getListableRooms()` returns.
- [ ] **Step 5** Run `npx tsc --noEmit && npx vitest run && npm run build`, then commit.

---

## Task 5: Dates in Chinese

**Files:** Create `lib/dateFormat.ts`; modify `RoomCard.tsx`, `BookingFlow.tsx`, `app/rooms/[unitCode]/page.tsx`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { formatDate } from "./dateFormat";

describe("formatDate", () => {
  test("English keeps the existing format so nothing shifts for EN visitors", () => {
    expect(formatDate("2026-10-01", "en")).toBe("1 Oct 2026");
  });
  test("Chinese uses the Chinese order and units", () => {
    expect(formatDate("2026-10-01", "zh")).toBe("2026年10月1日");
  });
});
```

- [ ] **Step 2** Implement over date-fns with the `zhCN` locale, already a dependency.
- [ ] **Step 3** Replace every `format(...)` call that produces visitor-facing text.
- [ ] **Step 4** Run the suite, then commit.

---

## Task 6: The register sweep, 您 to 你

**Files:** `src/i18n/zh.json`, `lib/dict.ts`

Deliberately last, so it is one reviewable commit and one `git revert` if Mark wants the formal register back.

- [ ] **Step 1** Replace 您 with 你 and 您的 with 你的 across both Chinese dictionaries.
- [ ] **Step 2** Read the diff rather than trusting the sweep. A few lines need a human eye: 您好 as a greeting, and any place the pronoun starts a sentence where the rhythm changes.
- [ ] **Step 3** Run every test in both repos, then commit on its own.

---

## Task 7: Verify before saying it is done

- [ ] **Step 1** Both sites, both languages, in a real browser at 390px and desktop.
- [ ] **Step 2** Re-run the audit that produced this plan: count English fragments on a page switched to Chinese. The target is that everything left is a building name, a channel brand or a person's name.
- [ ] **Step 3** Report the before and after counts to Mark with the actual numbers, not an assurance.
