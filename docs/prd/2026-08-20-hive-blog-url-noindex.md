# PRD: recover The Hive from "Excluded by 'noindex' tag"

Date: 2026-08-20
Owner: Claudine
Repos: hyve-website (primary), hyve-booking (one file)

## Problem

Google Search Console reports lazybee.sg URLs under "Excluded by 'noindex' tag".
The affected URLs are all `/blog/<slug>`, plus `/hive/topic/money` and three
`/hive/<slug>` URLs that do not exist.

Root cause, verified live on 2026-08-20:

- The Hive archive is served at `www.lazybee.sg/hive/<slug>`.
- 561 internal links inside the Hive markdown point at `lazybee.sg/blog/<slug>`.
- `/blog/:slug` is the retired Sanity route (`src/components/BlogPostPage.jsx`).
  It is not in `PRERENDER_ROUTES`, so no static file exists for it.
- Vercel's catch-all rewrite `/((?!api/|pitchv1).*)` therefore serves `app.html`.
- `scripts/prerender.mjs:165` injects `<meta name="robots" content="noindex,nofollow">`
  into `app.html`, and Vercel returns HTTP 200.

So Googlebot follows an internal link, receives a 200 response carrying noindex,
and files the URL as "Excluded by 'noindex' tag". The article itself is fine; the
URL pointing at it is wrong.

Evidence:

    /blog/chiltern-park-ivory-heights-thomson-grove-guide
      200, <title>Lazybee: managed co-living in Singapore</title>, robots noindex,nofollow
    /hive/chiltern-park-ivory-heights-thomson-grove-guide
      200, <title>Chiltern Park, Ivory Heights, Thomson Grove...</title>, robots index,follow

Secondary causes, same mechanism:

- `/hive/topic/money` is not a real topic. The seven real ones are costs,
  moving-to-singapore, neighbourhoods, operators, rules, students, work.
  `vercel.json` already redirects three other retired topic slugs; money was missed.
- `what-a-room-actually-costs`, `why-three-months-not-twelve` and
  `three-homes-nineteen-rooms` are placeholder slugs hardcoded in
  hyve-booking `components/HiveTeaser.tsx`. They were never swapped for real
  articles after The Hive shipped, and they link to the apex host, which 307s.

## Scale

- 561 `/blog/` links in `src/content/hive` (en 231, zh 231, bn 99, my 0)
- 65 distinct slugs
- 50 slugs / 395 links resolve to an article that exists under `/hive`
- 15 slugs / 166 links point at articles that were never written

Worst offenders among the 15: `renting-on-ep-s-pass-student-pass-singapore` (46),
`cost-of-renting-singapore-2026-budget` (36), `can-foreigners-rent-in-singapore` (13),
`student-housing-near-nus-a-co-living-guide` (13),
`under-21-renting-in-singapore-what-the-law-actually-requires` (12).

## Goals

1. Every Hive article is reachable at an indexable URL from inside the site.
2. Every URL Google has already crawled resolves with a 301 to a real page.
3. No internal link points at a page that does not exist.
4. No internal link takes an apex to www hop.

## Non-goals

- Writing the 15 missing articles. Separate job, tracked separately.
- Refactoring `vercel.json` to a legacy `routes` array so un-prerendered paths can
  return a real 404 instead of 200-with-noindex. Recorded as a follow-up below.

## Changes

### 1. hyve-website `vercel.json`, redirects (order matters, first match wins)

- 15 explicit `/blog/<dead-slug>` 301s to the closest topic hub, listed before
  the generic rule so they win.
- 3 explicit `/hive/<placeholder-slug>` 301s to the real article.
- `/hive/topic/money` 301 to `/hive/topic/costs`.
- `/blog/:slug` 301 to `/hive/:slug`.
- `/blog` 301 to `/hive`.

### 2. hyve-website `src/content/hive/**`, link rewrite

Rewrite the 395 recoverable links from `https://lazybee.sg/blog/<slug>` to
`https://www.lazybee.sg/hive/<slug>`. Fixes the noindex and the apex hop together.

### 3. hyve-website `src/content/hive/**`, unlink the dead ones

For the 15 slugs with no article, convert `[text](https://lazybee.sg/blog/<slug>)`
to plain `text`. Prose is preserved, the broken link is not.

### 4. hyve-booking `components/HiveTeaser.tsx`

Swap the three placeholder slugs for real articles and point at the www host:

    what-a-room-actually-costs   -> whats-included-in-coliving-rent-singapore
    why-three-months-not-twelve  -> ura-minimum-stay-breach-fines
    three-homes-nineteen-rooms   -> chiltern-park-ivory-heights-thomson-grove-guide

## Verification (must pass before this is called done)

- `grep -rc "lazybee.sg/blog/" src/content` returns 0.
- Build runs clean and `scripts/prerender.mjs` emits the same route count as before.
- After deploy, curl as Googlebot:
  - `/blog/<any of the 50>` returns 301 to `/hive/<same slug>`
  - `/hive/<same slug>` returns 200 with `robots index,follow`
  - `/hive/topic/money` returns 301 to `/hive/topic/costs`
  - the three former placeholder URLs return 301 to a real article
- Sitemap URL count unchanged (no route was added or removed).

## Follow-up, not in this change

Un-prerendered public routes return 200 with noindex rather than 404. That is why
this failure was silent for months: a wrong URL looks alive to Vercel and dead to
Google, and nothing alerts. Fixing it means moving `vercel.json` from
`rewrites` to a legacy `routes` array so a non-portal miss can carry status 404,
which touches portal routing and needs its own test pass.
