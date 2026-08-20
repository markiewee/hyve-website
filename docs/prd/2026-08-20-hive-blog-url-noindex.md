# PRD: lazybee.sg URLs excluded by "noindex"

Date: 2026-08-20
Owner: Claudine
Repos: hyve-website

## Problem

Google Search Console reports lazybee.sg URLs under "Excluded by 'noindex' tag".
Reported examples: two `/blog/<slug>` URLs, `/hive/topic/money`, and three
`/hive/<slug>` URLs.

Root cause, verified live on 2026-08-20:

- `/blog/:slug` is a live route backed by Supabase `cms_content`
  (`type='blog_post'`, `published=true`), 206 published posts.
- `/blog` is not in `PRERENDER_ROUTES`, so no static file exists for it.
- Vercel's catch-all rewrite `/((?!api/|pitchv1).*)` therefore answers every
  `/blog/*` request with `app.html`.
- `scripts/prerender.mjs` injects `<meta name="robots" content="noindex,nofollow">`
  into `app.html`, and Vercel returns HTTP 200.

So all 206 blog posts are served as 200-with-noindex. Google files them under
"Excluded by 'noindex' tag". This was invisible because a wrong URL still looks
alive to Vercel: it returns 200, not 404, so nothing alerts.

Compounding it, 581 internal links inside the Hive markdown pointed at
`lazybee.sg/blog/<slug>` rather than `www.lazybee.sg/hive/<slug>`, on the apex
host, which 307s. The site was routing its own crawl budget into the noindex
shell.

Evidence:

    /blog/chiltern-park-ivory-heights-thomson-grove-guide
      200, <title>Lazybee: managed co-living in Singapore</title>, robots noindex,nofollow
    /hive/chiltern-park-ivory-heights-thomson-grove-guide
      200, <title>Chiltern Park, Ivory Heights, Thomson Grove...</title>, robots index,follow

## The two archives

`cms_content` and The Hive hold the same material, split unevenly. Every row and
every markdown file was created 2026-08-10, from the same source.

    206  published posts in cms_content, all served at /blog/<slug>, all noindex
    120  of those also exist as markdown and are served at /hive/<slug>, indexable
     86  exist ONLY in cms_content, so their only URL is a noindex one

The 86 are invisible to search. Nothing links to an indexable copy because no
indexable copy exists.

Secondary:

- `/hive/topic/money` is not a real topic. The seven real ones are costs,
  moving-to-singapore, neighbourhoods, operators, rules, students, work.
  `vercel.json` already redirects numbers, market and tenants; money was missed.
- `what-a-room-actually-costs`, `why-three-months-not-twelve` and
  `three-homes-nineteen-rooms` were placeholder slugs hardcoded in hyve-booking
  `components/HiveTeaser.tsx` before The Hive shipped. They were never published
  anywhere. That component was fixed on 2026-08-18 and book.lazybee.sg no longer
  references them, but Google crawled them on 18 Aug and still holds them.

## Shipped in this change

1. Internal links, decided per slug rather than by one blanket rule:
   - 376 repointed to the same article in the same language
   - 32 fall back to the English article where no translation exists
   - 173 stay on `/blog` because the post has no Hive counterpart, moved from the
     apex host to www
   - 0 apex `/blog` links remain in the built HTML
2. `vercel.json` redirects:
   - 120 `/blog/<slug>` to `/hive/<slug>`, only where the slug exists in both
   - 3 `/hive/<placeholder>` to the real article
   - 1 `/hive/topic/money` to `/hive/topic/costs`
3. Sitemap count unchanged at 344. No route added or removed.

## Not shipped, needs a decision

The 86 blog-only posts are still 200-with-noindex and still invisible to search.
Two ways to fix, and they are not equivalent:

**A. Migrate the 86 into The Hive, then retire `/blog`.** Generate markdown with
frontmatter from `cms_content`, let the existing prerender pick them up, replace
the 120 explicit redirects with one `/blog/:slug` to `/hive/:slug`, delete
`BlogPage`, `BlogPostPage` and `src/lib/cms.js`. One archive, no duplication, all
206 indexable, multi-language and topic hubs come free. Cost: the build audit
policies h1, link count, canonical and a 50-word floor, so each migrated file has
to earn its place, and tags have to map onto the seven existing topics.

**B. Prerender `/blog` as well.** Smaller change, but it leaves two archives with
120 slugs duplicated across two URLs, which then needs canonical tags on one side
and keeps `src/lib/cms.js` alive.

Recommendation: A.

## Follow-up, separate from either option

Un-prerendered public routes return 200 with noindex rather than 404. That is why
this stayed hidden. Fixing it means moving `vercel.json` from `rewrites` to a
legacy `routes` array so a non-portal miss can carry status 404, which touches
portal routing and needs its own test pass.

## Verification run before this was called done

- `grep -r "https://lazybee.sg/blog/" dist` returns 0 files.
- `npm run build` passes, including the prerender audit.
- `dist/sitemap.xml` still lists 344 URLs.
- Post-deploy checks are in the PR.
