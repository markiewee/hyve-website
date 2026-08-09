# Lazybee Marketing Site Redesign — Design Spec

**Date:** 2026-05-27
**Repo (primary):** `hyve-website` (lazybee.sg — Vite + React, contains marketing pages + portal)
**Repo (secondary):** `hyve-booking` (book.lazybee.sg — Next.js, Booking Site 2.0) — analytics only
**Shared DB:** Supabase `diiilqpfmlxjwiaeophb` (unchanged here)

## Goal
Reposition lazybee.sg as a **pure customer marketing/SEO site**, fully redesigned to match Booking
Site 2.0's dark/terracotta aesthetic. It shows **no individual rooms** — all room browsing and
booking happen on **book.lazybee.sg**. Add full SEO + AI-SEO (AEO/GEO) and PostHog analytics.

## Locked decisions
1. **Site roles:** lazybee.sg = customer marketing/SEO + portal (portal untouched). book.lazybee.sg
   = the room browse/reserve/deposit funnel.
2. **No rooms on the marketing site.** To book, you go to book.lazybee.sg.
3. **Full redesign** of the marketing pages (not a palette swap) in the Booking 2.0 look.
4. **Build in `hyve-website`** (approach #1): port Booking 2.0's design tokens into this app and
   rebuild the marketing pages on them. The portal must stay on lazybee.sg, so the domain/app can't
   move — hence in-place. Theme tokens kept in a single shared file to limit drift.
5. **Analytics = PostHog only** (no GA4/GTM). **Google Search Console** added for SEO indexing.
6. Sanity-driven blog/content stays — re-themed, not removed.

## Design system (port from Booking 2.0 → hyve-website)
Tokens (from `hyve-booking/app/globals.css`), put in one CSS/tokens file:
```
--background: #0c0f0f;  --surface: #121414;  --surface-container: #1e2020;
--foreground: #e2e2e2;  --foreground-variant: #c4c7c7;  --accent: #c47a35;  /* terracotta */
font-display: Hanken Grotesk;  font-sans: Inter;  tracking-display: -0.035em;
```
Component language to mirror: rounded-full accent buttons, glass/`surface-container` cards,
full-bleed hero imagery with top+bottom gradient overlays, `FadeIn`/scroll-reveal motion, optional
ken-burns hero. Restore button pointer cursor (Tailwind preflight). Keep long-form content legible
on dark (sufficient contrast; `foreground-variant` for body).

## Routing, redirects & integration
**Stays on lazybee.sg (reskinned):** `/` Home · `/about` · `/locations` · `/blog` + `/blog/:slug` ·
`/faqs` · `/residents` · `/contact` · `/privacy-policy` · `/terms-of-service` · `/cookie-policy` ·
`/staff` · `/portal/*` (UNTOUCHED).

**Removed from the marketing site → 301-redirect to book.lazybee.sg:**
`/properties`, `/property/:id`, `/book`, `/book/*`, viewing pages. No room-level content remains.
Implement as server-side 301s (Vercel `redirects`/rewrites) so link equity transfers and old
inbound links/bookmarks still work.

**CTAs:** every "Browse rooms / Reserve / Book a viewing / See rooms" button deep-links to
`https://book.lazybee.sg` (locations link may pass a filter param if the booking site supports it).
Redesigned Nav + Footer; primary nav CTA = **"Browse rooms →"** to the booking site.

## Page-by-page redesign
1. **Home** — dark full-bleed hero (property imagery + Hanken headline), retained SEO value props
   (all-inclusive · from S$950/mo · near MRT), "How it works" strip (Browse → Reserve no-deposit →
   Move in), neighbourhood highlights (area-level, NOT rooms), the "Lazybee vs other co-living"
   comparison (kept — strong SEO + AI-citation asset), FAQ teaser, prominent CTA → booking site.
2. **Locations** — the 3 areas (Thomson / Ivory Heights-Jurong / Chiltern Park) as lifestyle + MRT
   marketing; each card "See rooms here →" into the booking site. No room listings.
3. **About** — brand story, mission, the Lazybee promise; dark editorial.
4. **Resident Guide / FAQs / Contact** — rebuilt dark; FAQ accordion; Contact = form + WhatsApp CTA.
5. **Blog + posts** — same Sanity content, new dark editorial layout.
6. **Legal pages** — lighter reskin, readable long-form on dark.

## SEO
- Per-page `<title>` + meta description + canonical; Open Graph + Twitter cards.
- **JSON-LD:** `Organization` + `LodgingBusiness` (consistent NAP + `sameAs` socials) site-wide;
  `FAQPage` on /faqs; `BlogPosting` on posts; `BreadcrumbList` where relevant.
- `sitemap.xml` (content URLs only — no removed room URLs) + `robots.txt`.
- Semantic heading hierarchy; preserve ranking copy + comparison table; fast Core Web Vitals.
- 301s (above) preserve equity from removed room URLs.

## AI-SEO (AEO/GEO — ChatGPT / Claude / Perplexity / Gemini citation)
- **Answer-first, liftable content:** state pricing, inclusions, lease terms, locations as plain
  declarative facts LLMs can quote; Q&A structure on FAQs.
- `FAQPage` schema serves both Google and AI engines. Sharpen the comparison content.
- **`llms.txt`** at the root pointing AI crawlers to key facts (pricing, locations, how-to-book URL).
- **robots.txt explicitly ALLOWS** `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`
  (we want citations). Consistent brand entity/NAP for clean entity resolution.

## Analytics — PostHog (both sites)
- Load PostHog on **both** lazybee.sg and book.lazybee.sg using the **same project**.
- Because book.lazybee.sg is a **subdomain** of lazybee.sg, set the **cross-subdomain cookie** so the
  full funnel (marketing visit → reserve → deposit) stitches into one user journey automatically.
- Autocapture on + custom events: `browse_rooms_click` (outbound, marketing), and on the booking
  site `reserve_created`, `deposit_started`, `deposit_paid`. Session replay optional (on by default,
  can sample).
- **Google Search Console** verification (meta tag) for indexing/coverage — not analytics.

## Out of scope
- The tenant/admin portal (`/portal/*`) and its theme.
- Booking Site 2.0 internals (only its analytics snippet is added).
- Pureloft. Any DB/schema change.

## Open items (need from Mark)
- **PostHog project API key + host** (us/eu cloud) — Mark creates the free project.
- Hero imagery / brand photography selection (can reuse property photos).
- Final homepage headline + any copy he wants verbatim.
- Confirm the 3 location/area framing + neighbourhood blurbs.

## Testing / rollout
- Verify 301s resolve to book.lazybee.sg (old room URLs + bookmarks).
- Lighthouse/CWV pass on the redesigned pages; structured data validates (Rich Results test).
- PostHog events fire on both domains and stitch across the subdomain hop.
- Visually QA each page on mobile + desktop before/after deploy. Portal unaffected (regression check
  on /portal/login + an admin page).
