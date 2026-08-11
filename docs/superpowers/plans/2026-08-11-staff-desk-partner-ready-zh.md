# Plan: staff room desk, partner-ready and Chinese-first

Spec: `docs/superpowers/specs/2026-08-11-staff-portal-partner-ready-zh-design.md`
Branch: `feat/staff-desk-partner-ready-zh`

Ordered so each task leaves the tree working. Database first, because the front end reads it.

## 1. Migration: columns and the roster RPC

`supabase/migrations/20260814000000_staff_desk_partner_ready.sql`

- `description_zh text` on `properties` and `rooms`, `house_rules_zh jsonb` on `properties`.
- `housemates_for_staff_pin(p_pin text)` returning `property_id, unit_code, nationality, gender, lease_end` and nothing else. Unknown or disabled PIN returns an empty set rather than raising, matching `rooms_for_pin`.
- `grant execute ... to anon, authenticated`.

Verify against hyve-iot after applying: the function exists, a bad PIN returns 0 rows, a good PIN returns rows, and the returned column list is exactly the five above.

## 2. Migration: Chinese content

`supabase/migrations/20260814000001_staff_desk_zh_content.sql`

Fills `description_zh` for 3 properties and the rooms that carry a description, plus `house_rules_zh`. Written to sell, not transliterated. Idempotent updates keyed on `code` and `unit_code`.

## 3. `src/i18n/nationalityVocab.js` and its test

Closed map from the dirty DB values to dictionary keys, same shape as `roomVocab.js`. Collapses `American` and `United States`. Keeps `Singapore PR` as its own key. `nationalityKey(null)` resolves to the not-provided key rather than blank.

Test asserts every value currently in the database maps, so a new nationality fails the build rather than rendering English.

## 4. `src/lib/localisedText.js` and its test

`localised(row, field, lang)` returning the `_zh` variant in Chinese when non-empty, else the English. One helper, used by both the property panel and the room card, so the fallback rule exists in exactly one place.

## 5. PIN retention

- `staffPin.js`: `buildUnlock(now, pin)` writes `pin` into the record; `readPin(raw, now)` returns it only when the unlock is still valid. Existing `readUnlock` untouched so old records keep working, they simply have no PIN and the roster stays empty until the next unlock.
- `StaffPinGate.jsx`: pass the PIN into `buildUnlock`.

## 6. `StaffRoomDeskPage.jsx`

- Replace the `tenant_profiles` select with `supabase.rpc('housemates_for_staff_pin', { p_pin })`, PIN read from storage.
- Group by `unit_code` rather than `room_id`, since that is what the RPC returns.
- Default the desk to Chinese. Safe here and only here: `/staff` is absent from `ROUTE_META` so it is never prerendered, which is the constraint that pins the rest of the site to English on first render.

## 7. `PropertyPanel.jsx`

- Delete the roll tile and the now-unused `roll` computation.
- Roster becomes nationality, gender, lease end. No names, no username.
- Delete the English developer empty state, replace with a keyed string.
- Property description through `localised`.

## 8. `RoomCard.jsx`

Room description through `localised`.

## 9. Dictionaries

- Remove `staff.prop.rollAtAsking` from `en.json` and `zh.json`.
- Add `staff.prop.noHousemates`, `staff.prop.nationality`, `staff.prop.gender`, `staff.prop.until`.
- Add nationality vocab entries under `owner.vocab` alongside the existing room vocabulary.
- Genders render through existing or new vocab keys rather than raw DB values.

## 10. Verify

`node --test` across the i18n and lib suites, a production build, and a manual pass on the running dev server in Chinese with PIN 879533 checking the six exclusions the spec lists.
