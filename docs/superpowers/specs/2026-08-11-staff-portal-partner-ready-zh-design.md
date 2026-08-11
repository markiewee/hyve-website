# Staff room desk, partner-ready and Chinese-first

**Date:** 2026-08-11
**Status:** Design, awaiting Mark's approval
**Repo:** hyve-website
**Driver:** Lili at Awehome (集好家) is being given a dedicated staff PIN so she can evaluate our inventory. The room desk was built for staff who already know the business. It now has a channel partner in it, and it shows things it should not, in a language she does not read.

## What changes, in one line each

1. Remove the roll-at-asking stat tile. It is our monthly revenue if every room lets, and no counterparty should see it.
2. Translate the free text. Property and room descriptions render in English today even in Chinese mode.
3. Show the resident roster as nationality, gender and lease end. No names. It is empty today.
4. Make the whole desk render Chinese, including the developer-facing empty state that currently leaks a table name.

Non-goals: booking, enquiry capture, per-agent accounts, commission display. Those belong to the booking site and are out of scope here.

## 1. Remove the roll tile

`src/components/staff/PropertyPanel.jsx:35` renders `sgd(roll)` under `staff.prop.rollAtAsking`. Delete the tile, leaving three stats: rooms, open today, bathrooms. Delete `staff.prop.rollAtAsking` from both `en.json` and `zh.json`, since `dictionaries.test.js` asserts key parity in both directions and an orphan would sit there forever.

The `roll` computation itself goes with it if nothing else uses it.

## 2. Free text in Chinese

`properties.description` and `rooms.description` are free text and cannot be handled by the closed-set `roomVocab.js` mapping. Neither table has a `_zh` column.

**Decision: store the translation, do not translate at runtime.** A machine translation call needs a paid API and a 13th serverless function, and this repo is at 12 of 12. Stored columns cost nothing at read time and can be edited without a deploy.

```sql
alter table public.properties add column if not exists description_zh text;
alter table public.rooms      add column if not exists description_zh text;
alter table public.properties add column if not exists house_rules_zh jsonb;
```

Read path picks the translation and falls back to English, so an untranslated row degrades to today's behaviour rather than to a blank:

```js
const desc = lang === 'zh' ? (row.description_zh || row.description) : row.description;
```

Content: 3 property descriptions, 19 room descriptions and one house-rules array to be written in Chinese and applied as a data migration. Written to sell, not machine-rendered.

`properties.name` and `rooms.name` stay as they are. "Chiltern Park" is an address, not a phrase to translate.

## 3. Resident roster

Empty today because the browser queries `tenant_profiles` directly and its only RLS policy is admin-only, so an anonymous PIN holder gets nothing. Mark wants nationality visible. Names must not be.

**A new security-definer RPC, modelled on `rooms_for_pin`.** That function's own comment sets the standard this one has to meet: it returns prices and commission only, so that a leaked PIN is a commercial annoyance and can never become anything worse. The same test applies here.

```sql
create or replace function public.housemates_for_staff_pin(p_pin text)
returns table (
  property_id uuid,
  unit_code   text,
  nationality text,
  gender      text,
  lease_end   date
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Unknown or disabled PIN returns an empty set, never an error: do not
  -- confirm which PINs exist.
  if not exists (
    select 1 from public.staff_pins where pin = p_pin and enabled = true
  ) then
    return;
  end if;

  return query
  select r.property_id,
         r.unit_code::text,
         td.nationality::text,
         tp.gender::text,
         tp.lease_end::date
    from public.tenant_profiles tp
    join public.rooms r on r.id = tp.room_id
    left join public.tenant_details td on td.tenant_profile_id = tp.id
   where tp.is_active
     and tp.archived_at is null
   order by r.unit_code;
end;
$$;

grant execute on function public.housemates_for_staff_pin(text) to anon, authenticated;
```

What it deliberately does not return: `full_name`, any ID or passport field, `monthly_rent`, `user_id`, `email`, `phone`. A test pins the returned column set the way `partnerSerialize.test.js` pins the API surface, so adding a field here is a build failure rather than a quiet leak.

### The one place the existing model has to bend

`staffPin.js` stores only `{ v: "staff-pin-v1", exp }` in localStorage. The PIN itself is discarded after `redeem_staff_pin` succeeds, so on a later page load there is no PIN to pass to this RPC.

**Decision: keep the PIN in the same localStorage record.** The alternatives are a session-token round trip, which is real work for a credential the codebase already calls a doormat rather than a lock, or exposing the roster to plain anon, which would make nationality and lease dates readable by anyone holding the anon key that ships in the bundle. Retaining a 6 digit PIN in the same store that already grants this exact view adds no access that the holder does not have.

This is a deliberate weakening and it is written down so it is not rediscovered as a bug.

### Nationality is dirty data

26 active tenants. 4 have no nationality at all. The recorded values mix demonyms with country names and one residency status: `American` and `United States` both appear, `Netherlands` sits beside `Lithuanian`, and `Singapore PR` is a pass status rather than a citizenship.

Add `src/i18n/nationalityVocab.js`, the same closed-map pattern as `roomVocab.js`: normalise the DB value to a canonical key, then translate the key. `United States` and `American` collapse to one key. `Singapore PR` keeps its own key because it means something real to a prospective housemate. A missing value renders as 未提供 rather than an empty cell.

`nationalityVocab.test.js` reads the live distinct values the way `roomVocab.test.js` reads the live rooms, so a nationality nobody has seen before fails the test instead of silently rendering in English.

## 4. Chinese everywhere

- **Default the desk to Chinese.** `LanguageContext` pins `useState("en")` so prerendered HTML matches the first client render. `/staff` is not in `ROUTE_META` and is therefore not prerendered, so it can safely open in Chinese while the marketing site keeps its English default. The toggle stays on both the gate and the desk.
- **Delete the developer empty state.** "Signed out. The roster reads `tenant_profiles`, which the anon key cannot see" names our schema to a channel partner. With the RPC in place the state is unreachable; the replacement copy is a plain "暂无室友信息".
- **Sweep the remaining English.** `keys-resolve.test.js` already proves every `t('...')` resolves in both dictionaries, so anything still rendering English is a raw string rather than a missing key. Find those and key them.
- Prices stay in S$. Dates render in Chinese order, 2027年3月.

## What Lili will not see

Stated explicitly so it can be checked at QA: tenant names, our base-versus-quoted margin, the roll if full, sell-now urgency flags, any ID or passport data, and any other property's residents.

## Testing

- `dictionaries.test.js` passes with `staff.prop.rollAtAsking` removed from both files.
- New `housematesForPin.test.js` pins the RPC's returned column set exactly.
- New `nationalityVocab.test.js` fails on an unmapped nationality.
- `keys-resolve.test.js` continues to pass.
- Manual QA by Mark on `/staff` with PIN `879533`, in Chinese, checking the six exclusions above by eye.

## Rollout

Migrations apply to hyve-iot (`diiilqpfmlxjwiaeophb`). No new serverless function, so the 12 function cap is untouched. PR against `hyve-website`, Mark reviews the preview deploy before Lili is given the PIN.
