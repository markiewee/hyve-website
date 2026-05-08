# Lazybee Admin Portal — UX Audit

**Audited:** 2026-05-08
**Branch:** `rename/lazybee-cleanup`
**Method:** Code-only audit. No Playwright in repo, no dev server running, live admin requires SSO. Source review of all 17 admin pages + `PortalLayout.jsx` + `App.jsx`.
**Scope:** `/portal/admin/*` routes. Captain + tenant flows out of scope.

---

## A. Executive Verdict (≤150 words)

The admin "feels disconnected" because three structural choices fight against each other:

1. **The sidebar is a 13-item flat dropdown under "Manage" with no grouping** (`PortalLayout.jsx:36-55`). Money lives in 4 sibling links (Rent / Expenses / Import / Financials). Daily ops (Tasks / Tickets / Announcements / Locks / Devices) sit jumbled next to leasing items. There is no visual or semantic group — Mark has to read the labels every time.
2. **Each page re-implements its own header, primary button, page width, and tab style** — 4 distinct h1 treatments, 3 different "primary CTA" classes, `AdminMembersPage` even uses Tailwind blue (`text-blue-700`) instead of the brand teal. The chrome is missing, so each page reads like a different app.
3. **The "what needs me right now" question has no home.** The dashboard's `pendingActions` (`AdminDashboardPage.jsx:114-201`) is the only inbox-shaped UI in the entire admin and it only covers 4 sources — viewings without captains, escalated tickets, and expiring leases are not pulled in.

Fix the layout shell (1 component change), regroup the nav (1 file), expand the action inbox (1 query bundle). Consolidating Money is a separate, larger lift.

---

## B. Current Flow Map per Pain-Point Objective

### B-1. Manage Viewings + Leads

**Today's flow** (lead-to-conversion):
1. Prospect books via `/book/...` → row inserted into `property_viewings` table.
2. Admin opens `/portal/admin/viewings` → sees Calendar tab by default (`AdminViewingsPage.jsx:962`).
3. To see the lead, admin clicks "Leads" tab (`AdminViewingsPage.jsx:969`) — which is rendered inside the same component but as a tab, so the URL doesn't change. **Cannot bookmark or share a leads-only view.**
4. Click a viewing → `/portal/admin/viewings/:id` → `AdminViewingDetailPage` (728 LOC). To assign a captain, pick from dropdown. To convert to member, admin must navigate to `/portal/admin/onboarding` and click "Invite" wizard (`AdminOnboardingPage.jsx:65-82` — separate state, no prefill from the viewing).
5. After invite, admin returns to viewings page → must mark lead status manually.

**Click count for "lead → onboarded member":** ~9 clicks across 3 pages, with a context loss step (re-typing prospect name into invite wizard).

**Proposed flow:**
- Split Calendar and Leads into two real routes: `/portal/admin/viewings/calendar` and `/portal/admin/viewings/leads` (the existing Tab component already separates the data — just lift to React Router).
- Add "Convert to Member" button on `AdminViewingDetailPage` (line 533+) that opens the existing invite wizard (`AdminOnboardingPage` invite state, lines 65-82) **prefilled** with prospect name + WhatsApp + property + room.
- Add a "Pending follow-up" filter at top of Leads tab — shows leads that are `viewed` but stale > 3 days with no status change.

**Code changes needed:**
- `App.jsx:264` — add two route entries; lift tab state to URL param.
- `AdminViewingDetailPage.jsx:` — extract the invite wizard from `AdminOnboardingPage.jsx:65-310` into a reusable `<InviteMemberSheet/>` component in `src/components/portal/`, then mount it on the viewing detail page with prefilled props.

### B-2. Handle Money

**Today's flow** (close out a month):
1. Open `/portal/admin/expenses/import` → fetch Aspire transactions → tag each row → finalize. (`AdminExpenseImportPage.jsx`, 1,749 LOC)
2. Open `/portal/admin/rent` → click "Generate This Month" (`AdminRentPage.jsx:611`) → review pending → mark paid via modal.
3. Open `/portal/admin/invoices` → filter by month → reconcile invoices vs rent (`AdminInvoicesPage.jsx:38-43`). **This duplicates payment-marking logic from rent page** (same `markAsPaid` concept, different hook).
4. Open `/portal/admin/expenses` → log any manual ad-hoc expenses (`AdminExpensesPage.jsx`, separate from the import flow).
5. Open `/portal/admin/financials` → see P&L. (`AdminFinancialsPage.jsx`)

**Click count for "close out April":** ~5 page hops, 4 different month-pickers (each page has its own `selectedMonth` state — `AdminRentPage.jsx:79`, `AdminInvoicesPage.jsx:24`, `AdminExpensesPage.jsx:55`, `AdminFinancialsPage.jsx:74`). Pick April four times.

**Proposed flow** — one Finance area with shared month context:
- Single route `/portal/admin/finance` with sub-tabs: `Rent` · `Invoices` · `Expenses` · `Reconcile` · `P&L`.
- One persistent `<MonthSelector/>` in the page header that survives across tabs (URL param `?month=2026-04`).
- Mark a payment "paid" once; it propagates across rent + invoice tables (currently rent_payments and invoices are separate tables — verify with Supabase, but the UI should hide that).
- Surface a single "this month: 3 unpaid, 1 overdue, P&L pending reconciliation" banner at the top of every Finance tab.

**Code changes needed:**
- New parent `AdminFinancePage.jsx` that mounts the sub-tab components.
- Extract each existing page's body into a `<RentTab/>`, `<InvoicesTab/>`, `<ExpensesTab/>`, `<ReconcileTab/>`, `<PLTab/>` component under `src/components/portal/finance/`.
- Hoist month state to a `FinanceContext` provider.
- Decision needed from Mark first: do we KEEP `AdminRentPage` + `AdminInvoicesPage` as separate concepts, or are these actually one ledger? See bigger refactor H-1.

### B-3. Daily Ops

**Today's flow** (morning: "what's broken?"):
1. `/portal/admin` shows 4 stat cards (rooms, members, open tickets, devices) and `pendingActions` list, but the action list only covers: counter-sign TAs, deposit verification, pending docs, overdue rent (`AdminDashboardPage.jsx:114-198`).
2. To check tickets → click "Open Tickets" stat → goes to `/portal/property/tickets` (the *captain* tickets page, `PortalLayout.jsx:41`). No admin-specific filter.
3. To check tasks → `/portal/admin/tasks` (separate page, completely different layout — `AdminTasksPage.jsx:246` uses `text-2xl` not `text-3xl`).
4. To check announcements expiring → `/portal/admin/announcements`.
5. To check locks/codes → `/portal/admin/locks` (different layout again, listed under "Manage" dropdown but conceptually part of "what needs attention" only when broken).

**Click count for morning sweep:** 5 page hops minimum, no aggregation.

**Proposed flow:** the dashboard `pendingActions` becomes a real "Action Inbox" with everything overdue or escalated — see Section D.

**Code changes needed:** see Section D.

---

## C. Information Architecture Proposal

**Current sidebar** (`PortalLayout.jsx:36-55`):

```
Admin Console
Manage ▼
  Tasks · Tickets · Members · Onboarding · Rent · Documents ·
  Announcements · Viewings · Locks · Devices · Investors ·
  Expenses · Import · Financials
```

13 leaves under one dropdown, no visual grouping, `Import` is a child of Expenses but listed as a sibling, `Tickets` routes to the captain page.

**Proposed sidebar:**

```
Admin Console (overview + Action Inbox)
─ Today
   Inbox            (was: dashboard "Needs Your Attention")
   Tasks
   Announcements
─ People
   Members
   Onboarding
   Investors
─ Money
   Rent & Invoices  (merged — see H-1)
   Expenses
   Reconcile        (was: Expenses → Import)
   P&L              (was: Financials)
─ Ops
   Viewings & Leads
   Tickets          (admin-scoped, not the captain page)
   Locks & Access
   Devices
   Documents
```

5 sections × 2-4 leaves = scannable in one glance.
"Today" is the new home for the Action Inbox. Mark lands there 90% of mornings; it pre-empts the "where do I start" friction.

**Implementation:** `PortalLayout.jsx:36-55` already supports `children:` arrays (see `AdminDropdown` at line 101). Just nest one more level — render section labels as non-clickable headers (`<div className="text-[10px] uppercase tracking-widest text-[#6c7a77] px-4 py-2">Money</div>`) above each group.

---

## D. The Missing "Action Inbox"

**Spec:** a single page at `/portal/admin/inbox` (also embedded as the top section of `/portal/admin`). Aggregates everything that needs admin attention in priority order. **No filters, no tabs — just a sorted list of clickable cards.**

**Data sources** (extend `AdminDashboardPage.jsx:114-201`):

| Source query | Existing? | Risk level |
|---|---|---|
| `rent_payments` where `status = OVERDUE` | ✅ already in dashboard (line 181) | RED |
| `onboarding_progress` where `ta_signed_url` set & countersigned null | ✅ line 118 | AMBER |
| `onboarding_progress` where step = DEPOSIT & `deposit_verified = false` | ✅ line 139 | AMBER |
| `document_signing_sessions` where `status = PENDING` & created > 48h ago | ✅ line 160 | AMBER |
| `maintenance_tickets` where `status = ESCALATED` | ❌ NEW | RED |
| `property_viewings` where `slot_start` upcoming < 24h & `captain_id IS NULL` | ❌ NEW | RED |
| `property_viewings` where `status = viewed` & updated > 3 days ago | ❌ NEW | AMBER |
| `tenant_profiles` where `lease_end_date` < now() + 60 days & no renewal | ❌ NEW | AMBER |
| `announcements` where `expires_at` < now() & `is_active = true` | ❌ NEW | INFO |
| `device_status` where `last_heartbeat` < now() - 24h | ❌ NEW | INFO |

**Wireframe (mockup):**

```
┌─ Admin Inbox ───────────────────── 12 items · 3 urgent ─┐
│ ━━ URGENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 🔴 Overdue rent — Sarah L. (TG-02)            S$1,200 → │
│ 🔴 Viewing tomorrow 2pm has no captain (CP)         → │
│ 🔴 Ticket #482 escalated — broken AC (IH-04)        → │
│ ━━ THIS WEEK ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 🟠 Counter-sign TA — David K. (CP-03)               → │
│ 🟠 Verify deposit — David K. (CP-03)  S$2,400        → │
│ 🟠 Lead stale 4d — Priya M. (viewed CP-05)          → │
│ 🟠 Lease expiring 32d — James W. (TG-04)            → │
│ ━━ INFO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ ⚪ Announcement expired: "Fire drill May 1"          → │
│ ⚪ Device offline 2d — IH-04 AC controller           → │
└──────────────────────────────────────────────────────────┘
```

Each row is a `<Link>` to the page where the action gets resolved, with the existing icon-circle pattern from `AdminDashboardPage.jsx:317-346`. Add a 1-line "snooze" affordance per row (writes to a `dismissed_until` table — out of scope, but reserve the slot in the design).

**Implementation:**
- New file: `src/hooks/useAdminInbox.js` — runs all 10 queries in parallel, merges, sorts by severity then time.
- Refactor `AdminDashboardPage.jsx:114-201` to consume that hook instead of inline queries.
- New route `/portal/admin/inbox` mounting an `<AdminInbox/>` component that's the same hook + a wider layout.

---

## E. UI Consistency Findings

| Property | # variants | Pages | Recommendation |
|---|---|---|---|
| **Page H1** | 4 | `text-3xl font-extrabold` (Dashboard, Devices, Rent, Expenses, Locks, Onboarding, Investors, Announcements, Financials, Documents) · `text-2xl font-extrabold` (Viewings, Invoices, ExpenseImport, Investors-detail) · `text-2xl font-bold` (Tasks, OnboardingDetail) · `text-2xl font-semibold` (Members) | Standardize on the first variant. Move H1 + subtitle into a `<PageHeader title subtitle action />` slot in `PortalLayout`. Saves ~6 lines per page × 17 pages. |
| **Page max-width** | 4 | None on most pages (full bleed inside `md:ml-64`) · `max-w-6xl mx-auto` (Members, line 36) · `max-w-7xl mx-auto` (Investors, line 430) · `max-w-3xl` (modals only) | Pick one (recommend `max-w-7xl`) and apply in `PortalLayout.jsx:366`. Currently the layout shell decides nothing about content width. |
| **Primary button** | 3 | `bg-[#006b5f] ... rounded-xl` (most), `bg-[#006b5f] ... rounded-lg` (Tasks, OnboardingDetail signature save), `border-blue-600 text-blue-700` (Members tab active state — wrong colour entirely!) | Replace with the existing `Button` from `src/components/ui/button.jsx` everywhere. Members is the worst offender: line 60 uses `border-blue-600 text-blue-700` which is not a Lazybee brand colour. |
| **Tabs** | 3 | `TabButton` component in `AdminViewingsPage.jsx:74` (pill style) · `MODES` in `AdminMembersPage.jsx:55` (underline style) · ad-hoc in `AdminExpenseImportPage.jsx:982` (rounded-lg in pill rail) | Use shadcn `tabs.jsx` (already in `src/components/ui/`). Three different tab idioms = the user has to relearn each page. |
| **Empty state** | mostly absent | `AdminTasksPage` shows nothing when no tasks · `AdminLocksPage` renders blank rows · `AdminAnnouncementsPage` skips rendering · `AdminFinancialsPage` shows "Loading…" | Add `<EmptyState icon msg cta />` component in `src/components/portal/`. |
| **Loading state** | 3 | `bg-[#eff4ff] animate-pulse` skeletons (Dashboard, Rent) · `progress_activity` spinner (Viewings line 980) · "Loading…" text (Financials, Tasks) | Adopt the skeleton pattern everywhere — it's the most polished. shadcn `skeleton.jsx` is already imported. |
| **Modal/dialog** | 2 | Custom `bg-white rounded-2xl shadow-2xl max-w-3xl` overlay (Documents, Invoices) · `window.confirm()` (Tasks, Announcements, Invoices line 64) | Replace `window.confirm` with shadcn `alert-dialog.jsx`. Browser confirm dialogs in 2026 = "this app is not finished". |
| **Status badge palette** | 6 | Each page redefines its own `STATUS_BADGE` map. Rent uses `bg-[#ffdad6] text-[#ba1a1a]`, Invoices uses `bg-red-100 text-red-800`, Onboarding uses `bg-[#ffdad6] text-[#ba1a1a]` again, Tasks uses `text-red-600` only. | Move to a shared `getStatusBadge(status, kind)` util in `src/lib/badges.js`. Same for category badges (Expenses + Tasks both define their own). |

---

## F. Per-Page Scorecard (0-10)

| Page | Visual Consistency | Task Efficiency | Data Density | Mobile | Total | Biggest Issue |
|---|---|---|---|---|---|---|
| AdminDashboard | 8 | 7 | 7 | 7 | **29/40** | Pending actions list only covers 4 of ~10 things that need attention |
| AdminViewings | 7 | 6 | 8 | 5 | **26/40** | Tabs are component-state not URL — can't bookmark "leads" view |
| AdminViewingDetail | 6 | 4 | 7 | 5 | **22/40** | No "convert to member" button; admin must re-type prospect into onboarding wizard |
| AdminOnboarding | 7 | 7 | 8 | 6 | **28/40** | Invite wizard (244 lines of state) lives inline in this page — can't reuse from viewings |
| AdminOnboardingDetail | 5 | 5 | 7 | 4 | **21/40** | 1,779 LOC, mixes shadcn `text-foreground` tokens with brand `#121c2a` hex — inconsistent palette |
| AdminMembers | 4 | 7 | 7 | 7 | **25/40** | Off-brand: uses Tailwind blue, `max-w-6xl`, `font-semibold` H1, underline tabs — looks like a different app |
| AdminRent | 7 | 5 | 8 | 6 | **26/40** | 1,152 LOC mixes rent generation + Aspire reconciliation + ad-hoc charges into one page; should be 3 tabs |
| AdminInvoices | 7 | 6 | 7 | 6 | **26/40** | Duplicates rent's "mark as paid" UX. No deep link from rent row to invoice |
| AdminExpenses | 8 | 6 | 6 | 6 | **26/40** | "Manually logged expenses" subtitle (line 196) suggests this is the *wrong* page — most expenses come from import. Confusing |
| AdminExpenseImport | 6 | 5 | 9 | 4 | **24/40** | 1,749 LOC. Different H1 size from rest. Buried under "Manage > Import" — really the primary money workflow |
| AdminFinancials | 7 | 7 | 8 | 5 | **27/40** | No drill-down: clicking a category total doesn't reveal the line items. Read-only |
| AdminInvestors | 7 | 6 | 7 | 5 | **25/40** | Investor sign-up flow is here but also at `/portal/investor/signup` — two different invite paths |
| AdminDocuments | 6 | 5 | 6 | 5 | **22/40** | Three modals (generate / template / send) all custom-built; each is its own 80+ line block |
| AdminLocks | 7 | 8 | 7 | 7 | **29/40** | Stores codes as JSON in `property_guides.content` — fragile but UI is fine |
| AdminDevices | 8 | 7 | 7 | 6 | **28/40** | Solid. Good realtime subscription. Could fold into "Today" |
| AdminAnnouncements | 8 | 7 | 6 | 7 | **28/40** | No way to schedule (publish-now only); expired ones don't auto-deactivate |
| AdminTasks | 6 | 6 | 7 | 7 | **26/40** | Different H1 size; emoji-driven priority (`🔴🟠🟡⚪` line 49) breaks brand |

---

## G. Quick Wins (sub-30-min fixes, vettable)

1. **Add `<PageHeader title subtitle action />` slot to `PortalLayout.jsx:366`.** Then delete the per-page H1 blocks. Fixes 14 inconsistent headers in one PR.
2. **Set a content max-width in `PortalLayout.jsx:366`** — change `<div className="px-6 py-8 lg:px-12 lg:py-10 pb-24 md:pb-10">` to add `max-w-7xl mx-auto`. Currently Dashboard is full-bleed but Members is 6xl-constrained — they look unrelated.
3. **Fix Members page brand** — `AdminMembersPage.jsx:38,60,67`. Replace `text-2xl font-semibold` → match dashboard h1. Replace `border-blue-600 text-blue-700` → `border-[#006b5f] text-[#006b5f]`. Same file, ~5 lines.
4. **Group nav with section headers** — `PortalLayout.jsx:36-55`. Wrap the 13 children in 4 sub-arrays with labels, render section captions in `AdminDropdown`. ~30 LOC.
5. **Lift Viewings tab to URL** — `AdminViewingsPage.jsx:962-981`. Read `useSearchParams("tab")` instead of `useState`. Now shareable + bookmarkable.
6. **Replace `window.confirm` with `<AlertDialog>`** — 6 call sites: `AdminInvoicesPage.jsx:64`, `AdminAnnouncementsPage.jsx:73`, `AdminTasksPage.jsx` (status change), `AdminLocksPage.jsx`, `AdminMembersPage.jsx`, `AdminViewingsPage.jsx`. shadcn component already imported.
7. **Auto-deactivate expired announcements** — add a `useEffect` in `AdminAnnouncementsPage.jsx` that updates `is_active = false` for any rows where `expires_at < now()`. Or better: a Supabase cron, but the UI fix is one-liner.
8. **Add "Pending follow-up" filter to Leads tab** — viewings where `status = 'viewed'` and `updated_at < now() - 3 days`. ~10 LOC in the existing LeadsTab.
9. **Wire "Open Tickets" stat card to admin-scoped tickets** — `AdminDashboardPage.jsx:234` currently routes to `/portal/property/tickets` (the captain page). Either build an admin tickets view or scope the captain page when `profile.role === 'ADMIN'`.
10. **Standardize loading state** — replace `progress_activity` spinner (`AdminViewingsPage.jsx:980`) and `"Loading…"` text (`AdminTasksPage.jsx`, `AdminFinancialsPage.jsx`) with the skeleton pattern from Dashboard. shadcn `skeleton.jsx` is already in the repo.

---

## H. Bigger Refactors (need Mark's call before implementation)

### H-1. Merge Rent + Invoices into a single Billing page

**Why:** They're conceptually one ledger ("what does this member owe / has paid"). The split exists because rent_payments and invoices are separate tables, but the user shouldn't care. Right now Mark can mark a payment paid in Rent and forget the invoice still says "Issued".

**Spec:** `AdminBillingPage.jsx` with tabs `Rent` · `Invoices` · `Ad-hoc charges` · `Reconcile (Aspire)`. ~2,000 LOC dedup. Single month selector. Mark paid → cascades to both tables via a single edge function.

**Question for Mark:** are rent_payments + invoices truly two views of the same money, or do they represent different objects? (If invoices are sometimes issued WITHOUT a rent_payment row — e.g. ad-hoc charges only — they're separate. If every rent row generates an invoice, they're one.)

### H-2. Build the Action Inbox as a real page

**Spec:** see Section D. ~250 LOC for `useAdminInbox.js` hook + `<AdminInbox/>` component. Two routes: `/portal/admin` (overview + top 5 inbox items) and `/portal/admin/inbox` (full list).

**Question for Mark:** do you want a snooze/dismiss mechanic? (Adds a `dismissed_until` column to several tables. Skip in v1 if uncertain.)

### H-3. Extract Invite Member wizard into a reusable component

**Why:** the wizard at `AdminOnboardingPage.jsx:65-310` is the entry point for converting a viewed lead → tenant. Right now it's locked inside the Onboarding page. Mark wants to convert from `AdminViewingDetailPage` directly.

**Spec:** new `src/components/portal/InviteMemberSheet.jsx` (shadcn `sheet.jsx` slide-over). Accepts `defaultValues={{ name, whatsapp, propertyCode, roomId }}`. Mounted on Onboarding page (button: "Invite Member") AND on Viewing Detail page (button: "Convert to Member" — prefilled from viewing record).

**Question for Mark:** any objection to the invite flow being a side-sheet instead of an inline section? (Side-sheet is nicer for context — admin keeps the viewing visible while inviting.)

### H-4. Consolidate Expenses + ExpenseImport into one Reconcile flow

**Why:** Mark has two ways to log an expense (manual on `/expenses`, automatic on `/expenses/import`). The Aspire import is the primary path — manual is for cash receipts only. Today Mark has to remember which page handles which case.

**Spec:** make Expenses page a tab inside the new Finance area (see B-2). Make Aspire import the default landing tab; manual logging is a "+ Add manual expense" button inside the same tab.

**Question for Mark:** is manual expense entry common (>5/month) or rare (<1/month)? If rare, demote to a small drawer. If common, keep as a real tab.

### H-5. Drop the captain-tickets-as-admin-tickets shortcut

**Why:** `PortalLayout.jsx:41` routes admin "Tickets" to `/portal/property/tickets`, which is the captain's per-property scope. Admins want to see all tickets across all properties, filterable. This is a deceptive nav.

**Spec:** new `AdminTicketsPage.jsx` showing all `maintenance_tickets` with property + room columns, status filter, escalation badge. Reuse `TicketCard` component.

---

## Files Audited

`src/App.jsx` (438 lines) ·
`src/components/portal/PortalLayout.jsx` (375) ·
`src/pages/portal/AdminDashboardPage.jsx` (455) ·
`src/pages/portal/AdminViewingsPage.jsx` (1,049) ·
`src/pages/portal/AdminViewingDetailPage.jsx` (728) ·
`src/pages/portal/AdminOnboardingPage.jsx` (941) ·
`src/pages/portal/AdminOnboardingDetailPage.jsx` (1,779) ·
`src/pages/portal/AdminMembersPage.jsx` (97) ·
`src/pages/portal/AdminRentPage.jsx` (1,152) ·
`src/pages/portal/AdminInvoicesPage.jsx` (245) ·
`src/pages/portal/AdminExpensesPage.jsx` (424) ·
`src/pages/portal/AdminExpenseImportPage.jsx` (1,749) ·
`src/pages/portal/AdminFinancialsPage.jsx` (668) ·
`src/pages/portal/AdminInvestorsPage.jsx` (1,164) ·
`src/pages/portal/AdminDocumentsPage.jsx` (621) ·
`src/pages/portal/AdminLocksPage.jsx` (308) ·
`src/pages/portal/AdminDevicesPage.jsx` (260) ·
`src/pages/portal/AdminAnnouncementsPage.jsx` (364) ·
`src/pages/portal/AdminTasksPage.jsx` (323).

**Screenshots:** not captured — no Playwright in repo, no dev server, live admin requires SSO. Audit is code-only. The findings are structural (route layout, component reuse, nav grouping, missing aggregation) and don't depend on visual evidence; pixel-level findings (spacing, colour contrast) would benefit from screenshots and should be re-run once a dev server is up.
