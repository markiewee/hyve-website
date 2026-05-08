# Lazybee Marketing Site — UI Review

**Audited:** 2026-05-08
**Branch reviewed:** `rename/lazybee-cleanup` (9 commits ahead of master)
**Live site audited:** https://lazybee.sg (currently still serving the old "Hyve" build)
**Method:** Live screenshots at desktop 1440×900 and mobile (iPhone 13 / 390px) via headless Chromium + source review of every public page component.
**Screenshots:** `/Users/mark/Desktop/hyve-website/.audit-screenshots/` (gitignored)

---

## Executive Summary

1. **The Lazybee rename has not shipped to prod.** Live site still says "Hyve" everywhere — logo, "Why Hyve", "The Hyve Story", "Start your Hyve journey", "JOIN THE HYVE", footer copyright "Hyve Living Systems", FAQs section title "Hyve-Specific Questions". This is the single biggest brand-credibility issue on the entire site. Every other finding below is secondary until this deploys. The repo branch is clean — this is purely a "merge & deploy" gap.
2. **Mobile FAQ + WhatsApp FAB collision is breaking interaction.** The floating WhatsApp button sits directly on top of the "Living Experience" accordion's expand arrow on mobile (375–412px viewports). Tapping that section opens WhatsApp instead of expanding. Critical conversion blocker — the FAQ page is a primary objection-handling stop before booking.
3. **Pricing copy is inconsistent across pages and contradicts the SEO claim.** Hidden SEO text and CTAs claim "from S$950/month all-inclusive", but live property cards show $600 (Chiltern Park), $700 (Thomson Grove), $1000 (Ivory Heights). Either the data is wrong or the marketing copy is. Both are eroding trust the moment a prospect lands. Decide which is true and align the entire site.

---

## Per-Page Scorecard (0-10)

| Page | Hierarchy | Density | Mobile | Brand | CTA | Polish | Total |
|---|---|---|---|---|---|---|---|
| `/` Home | 7 | 7 | 7 | 3 | 7 | 6 | **37/60** |
| `/properties` | 6 | 7 | 5 | 3 | 6 | 5 | **32/60** |
| `/property/:id` | 7 | 6 | 6 | 4 | 8 | 5 | **36/60** |
| `/locations` | 6 | 6 | 4 | 3 | 5 | 5 | **29/60** |
| `/about` | 7 | 7 | 7 | 3 | 7 | 5 | **36/60** |
| `/faqs` | 5 | 3 | 3 | 2 | 5 | 4 | **22/60** |
| `/contact` | 7 | 7 | 6 | 3 | 8 | 6 | **37/60** |
| `/blog` | 5 | 6 | 7 | 4 | 4 | 5 | **31/60** |

Brand is uniformly low because the live site is still Hyve-branded. Once deploy ships, brand re-scores ~7 across the board (logo, palette, voice are coherent; the only real brand miss in the repo is mixed serifed italic accents — see B-1).

---

## CRITICAL — fix before next launch push

### C-1. Deploy the Lazybee rename
- **Where:** entire site (logo, footer, FAQ section, hero copy, "Why Hyve" feature heading, CTA section, footer copyright). The repo `rename/lazybee-cleanup` branch already has all the fixes; live prod is just out of date.
- **Severity:** critical
- **Screenshot evidence:** every screenshot in `/Users/mark/Desktop/hyve-website/.audit-screenshots/` shows "hyve" wordmark logo, "JOIN THE HYVE" footer, "© 2026 Hyve Living Systems".
- **Fix:** merge `rename/lazybee-cleanup` to master and redeploy. Sanity-served FAQ titles ("Hyve-Specific Questions") also need a one-time edit in the Sanity dataset — the React fallback is correct but Sanity content overrides it (see `FAQsPage.jsx:195-200`).

### C-2. Floating WhatsApp button overlaps tappable accordion arrows
- **Where:** `src/components/FloatingWhatsApp.jsx:7` — `fixed bottom-6 right-6 w-14 h-14`. On `/faqs` mobile (~390px viewport) the FAB sits exactly on top of the chevron-right of the "Living Experience" section header, swallowing the tap.
- **Severity:** critical (mobile only)
- **Fix:** either (a) on routes `/faqs` and `/blog/:slug`, raise the FAB's `bottom-6` to `bottom-24` so it sits above the second-section accordion clickable row, or (b) add right-side padding on FAQ accordion headers so the chevron lives ≥ 80px from the right edge on mobile. Recommended: (a), it's a one-line conditional based on `useLocation()` in `FloatingWhatsApp.jsx`.

### C-3. Pricing inconsistency — $600 / $700 / $950 / $1,000
- **Where:** `PropertiesPage.jsx:164` renders `${property.startingPrice}` straight from Sanity. `HomePage.jsx:84` SEO description claims "from S$950/month". `PropertiesPage.jsx:290` hidden SEO copy claims "Standard S$950-1,050/mo". Live properties index shows $600 / $700 / $1,000 starting prices.
- **Severity:** critical (trust signal)
- **Fix:** decide the correct floor price, then either (a) fix the Sanity records' `startingPrice` field, or (b) update the SEO/hidden copy in `HomePage.jsx:84`, `PropertiesPage.jsx:206`, and the `sr-only` blocks in `HomePage.jsx:382-399` and `PropertiesPage.jsx:288-294`. Either way, **the visible price card and the SEO claim must match**. Right now AI assistants and search snippets will quote $950 while the page itself shows $600.

---

## HIGH PRIORITY — fix this week

### H-1. Properties filter bar wraps badly on tablet (768-900px)
- **Where:** `PropertiesPage.jsx:220-253`. `flex-wrap gap-3` plus a 240px-min search input plus a 'Clear Filters' button = on a ~768px viewport the bar wraps to two lines and the title above it loses alignment with the right edge.
- **Severity:** high
- **Fix:** drop `min-w-[240px]` to `min-w-[180px]` (line 232), or wrap the filter-bar block in `md:flex-row flex-col items-stretch md:items-end` and stack on tablet.

### H-2. Locations page map is hidden behind sidebar on mobile, and sidebar is too long
- **Where:** `LocationsPage.jsx:94` uses `flex-col md:flex-row h-auto md:h-[calc(100vh-80px)]`. On mobile the map is rendered AFTER the entire neighborhoods scroll list (which is several screen-heights tall). A first-time mobile visitor sees a card list, then nothing for ages, then a map. The map is the entire value of this page and it is buried.
- **Severity:** high (mobile)
- **Fix:** on mobile, swap order — render the map first at a fixed `h-[60vh]`, then the neighborhood cards below. Or add a sticky "View on map" button at the top of the sidebar that scrolls to the map. Current layout treats mobile as an afterthought.

### H-3. FAQ live content does not match repo content
- **Where:** Sanity-served sections override the much better repo content. Live shows generic sections ("Living Experience", "Community & House Rules"). Repo (`FAQsPage.jsx:40-187`) has the operationally-useful "Condo-Specific", "Transfer of Tenancy", "Issues & Maintenance" sections.
- **Severity:** high
- **Fix:** in Sanity Studio, either delete the FAQ document so the React fallback wins, or replace the Sanity content with the local fallback. The repo content is markedly more useful (referral bonus mechanics, license transfer flow, captain escalation). Right now the page reads like a template.

### H-4. About page "Multiple" stat reads as a typo, not a number
- **Where:** `AboutPage.jsx:189-190`. Stats show "16 Residents", "3 Properties", **"Multiple Nationalities"**. The third tile uses the same `text-4xl font-extrabold text-[#006b5f]` treatment as the numbers, so visually "Multiple" looks like a broken data fetch.
- **Severity:** high
- **Fix:** either replace with a number ("8+ Nationalities") or change the visual treatment of that tile — e.g., make "Multiple" smaller and put a flag-row icon above it.

### H-5. About page founder photo grayscale-on-default looks dead
- **Where:** `AboutPage.jsx:163` — `grayscale hover:grayscale-0`. On mobile (no hover), all three founder photos stay grayscale forever. The Team section reads as obituary, not "energetic startup".
- **Severity:** high
- **Fix:** drop the grayscale entirely, or apply `md:grayscale md:hover:grayscale-0` so mobile shows full color and desktop keeps the editorial reveal. Recommended: drop entirely, the photos already look professional.

### H-6. Blog is built on fake data with no Sanity integration
- **Where:** `BlogPage.jsx:3,16` and `BlogPostPage.jsx:7,24` — both import from `data/sampleData`. Mark already noted this is "currently fake." Risk: anyone deep-linking from social/SEO crawlers sees fictitious authors and dates ("Resident since 2026 — Thomson Grove" on Home is also fabricated).
- **Severity:** high (trust + legal)
- **Fix:** either (a) gate `/blog` behind a feature flag so the route 404s until real content exists, (b) noindex the blog routes in `SEO.jsx` until real posts ship, or (c) wire to Sanity. At minimum, hide /blog from the navbar (`Navbar.jsx:16`) until ready.

---

## MEDIUM — backlog

### M-1. Five different teal/green hex values in use
- **Where:** `#006b5f`, `#14b8a6`, `#71f8e4`, `#89f5e7`, `teal-500`, `teal-600`, `teal-700` (Tailwind), plus `#005048`, `#005049` for text-on-light pills. These are scattered across Navbar, HomePage, Footer with no token discipline. Files: `Navbar.jsx:36,44,56`, `HomePage.jsx:102,107,121,144,189-204,323,343,348,376`, `Footer.jsx:51,112,117`.
- **Fix:** introduce CSS custom properties in `index.css` (`--brand-deep: #006b5f`, `--brand-mid: #14b8a6`, `--brand-soft: #71f8e4`) and find/replace. Future audits will be 10× easier. Not urgent — visually it does cohere — but it makes any palette tweak a 50-file PR.

### M-2. Three different page-background blues
- **Where:** `bg-[#f8f9ff]` (Home, Properties, About), `bg-[#eff4ff]` (Why-Lazybee, About-story, sidebar), `bg-[#dee9fc]` (testimonial), `bg-[#e6eeff]` (Locations map area, About team), `bg-gray-50` (FAQs, Blog post). FAQs and BlogPostPage stand out as different from the rest of the site (`FAQsPage.jsx:240,271`, `BlogPostPage.jsx:226,264`).
- **Fix:** standardize on `bg-[#f8f9ff]` for default page background. FAQ + BlogPost use Tailwind `gray-50` — fix to the brand tone.

### M-3. Five different font families referenced inline
- **Where:** `font-['Plus_Jakarta_Sans']`, `font-['Manrope']`, `font-['Inter']`, plus default system. Used inconsistently — e.g., Footer uses Inter for nav links uppercase, Navbar uses Plus Jakarta Sans for nav links. Both work, but it should be a system not vibes.
- **Fix:** lock typography rules: Plus Jakarta Sans for headings + nav, Manrope for body, Inter for ALL CAPS small labels. Document in `CLAUDE.md` or a one-page design-tokens.md.

### M-4. Hero badge "THE SANCTUARY" pattern repeats across every page
- **Where:** Home, About, Contact, Blog, Locations, Properties all open with a `bg-[#71f8e4]` pill above the H1. Same shape, different copy. By page 3 it feels formulaic.
- **Fix:** vary the visual treatment per page (e.g., About could open with no badge; Contact could show a status indicator instead — "Reply within a few hours" with a green dot).

### M-5. Newsletter form has no real backend
- **Where:** `Footer.jsx:10-18` — `handleNewsletterSubmit` only sets local state, doesn't post anywhere. Comment says "Not wired to a backend yet". User submits, sees thanks, nothing happens.
- **Fix:** either wire to a real provider (MailerLite free tier, Buttondown, Loops) or remove the form until ready. Currently it's a trust-erosion liability.

### M-6. Hero image on Home is a property photo, not a curated brand shot
- **Where:** `HomePage.jsx:128-143`. The lg:col-span-6 hero image is `featuredProperties[0]` — the first Sanity property's first image. So if Mark reorders properties or one uploads a bad photo, Home gets demoted.
- **Fix:** put a dedicated `homepageHero` field on Sanity's `homePage` document and use that. Decouples brand imagery from CRUD on properties.

### M-7. Property detail "Coming Soon" rooms with "Move In Now — Special Rate" tag is contradictory
- **Where:** `PropertyDetailPage.jsx:768-774`. A room is in the "Coming Soon" section (i.e., not yet available) but flagged "Move In Now — Special Rate" if it's <3 months out. The "Move In Now" copy directly contradicts the section header.
- **Fix:** rename to "Soon — Lock In Special Rate" or move <3-month rooms into the Available list with a "Pre-book" badge.

### M-8. Footer social icons use Material Symbols `public` and `alternate_email` — not real social icons
- **Where:** `Footer.jsx:38, 44, 138, 144`. The Instagram link uses a globe icon. Email uses an @ symbol. These are wrong and visually weak.
- **Fix:** swap globe → `instagram` icon (or use a Lucide `Instagram` component for proper SVG). Same for email — `mail` is fine but `alternate_email` reads as an unused accessibility hint.

---

## LOW — cosmetic backlog

- **L-1.** `HomePage.jsx:33` references `ApiService` which is never imported (line 31, 41). If Sanity ever returns empty, the catch path will throw `ReferenceError`. Same in `PropertiesPage.jsx:30,50`. Defensive bug — won't fire today, will fire tomorrow.
- **L-2.** Hardcoded testimonial "Rebekah F. — Resident since 2026 — Thomson Grove" (`HomePage.jsx:336-339`) is fabricated. Risk: a real prospect asks at viewing.
- **L-3.** `BlogPostPage.jsx:53-63` has duplicate `shareMenuRef` and `shareMenuRef2` because the share button appears twice on the page; the click-outside handler is doing double-work. Refactor to a single `useShareMenu` hook.
- **L-4.** `LocationsPage.jsx:159-163` regex price-prefixing is hard to read and runs on every render. Memoize or move to Sanity's data shape.
- **L-5.** Material Symbols icons require a network font request (~30KB for the variable axis). For the handful of icons actually used, a Lucide migration would shave ~25KB.
- **L-6.** `PropertyDetailPage.jsx` is 1,159 lines. Split into `PropertyHero`, `PropertyRooms`, `PropertyMap`, `PropertyTestimonials`, `BookViewingSidebar`. Not a UI issue, a maintenance one. Mark already flagged this.
- **L-7.** Newsletter input on Footer has `outline-1 outline-[rgba(187,202,198,0.15)]` — that opacity is so low the field looks borderless on a `bg-slate-50` footer. Bump to `0.4` or use `border` instead.
- **L-8.** Navbar shadow `shadow-sm` is invisible on the `bg-white/70` translucent nav. No visual separation between nav and hero on scroll. Add `border-b border-slate-100` for clearer affordance.
- **L-9.** Mobile sticky bottom CTA on PropertyDetailPage (line 1003) and FloatingWhatsApp FAB both sit at the bottom — visual clutter. Hide the FAB on `/property/:id` mobile.

---

## QUICK WINS — sub-30 minute fixes (vet & batch)

1. **Deploy the rename** (C-1). One git merge + Vercel deploy. **The single biggest visible fix.**
2. **Lift the WhatsApp FAB on mobile FAQ pages** (C-2). 5 lines in `FloatingWhatsApp.jsx`.
3. **Drop the grayscale on founder photos** (H-5). Delete one Tailwind class.
4. **Hide /blog from navbar** (H-6 mitigation). Comment out one line in `Navbar.jsx:16`.
5. **Replace "Multiple" stat with "8+ Nationalities"** (H-4). One string change in `AboutPage.jsx:190`.
6. **Add `border-b border-slate-100` to Navbar** (L-8). One Tailwind class.
7. **Swap globe/at icons for real Instagram/mail icons** (M-8). 4 line changes in Footer.
8. **Update Sanity FAQ doc to mirror local fallback** (H-3). 10 minutes in Sanity Studio.
9. **Update Sanity property `startingPrice` records OR update SEO copy** (C-3). 5 minutes either way once decided.
10. **Add `noindex` to `/blog` routes until real content** (H-6 mitigation). One conditional in `SEO.jsx`.

---

## SUGGESTED FIX ORDER (impact ÷ effort)

| Rank | Fix | Impact | Effort | Notes |
|---|---|---|---|---|
| 1 | C-1 Deploy Lazybee rename | 10 | 1 | Already done in branch — just merge + deploy |
| 2 | C-2 Mobile WhatsApp FAB collision | 9 | 1 | 5-line conditional |
| 3 | C-3 Reconcile pricing copy | 9 | 2 | Decision + Sanity data edits |
| 4 | H-2 Mobile Locations map ordering | 8 | 2 | One flex-direction reverse + sticky button |
| 5 | H-3 FAQ Sanity content sync | 8 | 2 | Sanity studio paste from FAQsPage.jsx fallback |
| 6 | H-6 Hide blog or noindex it | 7 | 1 | One nav line + one SEO conditional |
| 7 | H-4 / H-5 / L-8 batch | 6 | 1 | Three one-liners |
| 8 | H-1 Filter bar tablet wrap | 5 | 2 | One min-w + flex tweak |
| 9 | M-7 "Move In Now" tag rename | 5 | 1 | One string |
| 10 | M-1 / M-2 / M-3 Design token consolidation | 7 | 6 | Pay down debt before adding new pages |

---

## Appendix — files audited

- `src/components/Navbar.jsx` (115 LOC)
- `src/components/Footer.jsx` (153 LOC)
- `src/components/FloatingWhatsApp.jsx` (23 LOC)
- `src/components/HomePage.jsx` (406 LOC)
- `src/components/PropertiesPage.jsx` (300 LOC)
- `src/components/PropertyDetailPage.jsx` (1,159 LOC)
- `src/components/LocationsPage.jsx` (327 LOC)
- `src/components/AboutPage.jsx` (236 LOC)
- `src/components/FAQsPage.jsx` (382 LOC)
- `src/components/ContactPage.jsx` (316 LOC)
- `src/components/BlogPage.jsx` (285 LOC)
- `src/components/BlogPostPage.jsx` (514 LOC)

Live screenshots (gitignored): `desktop` + `mobile` × 8 routes = 16 PNGs in `.audit-screenshots/`.
