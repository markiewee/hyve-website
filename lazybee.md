# Lazybee — Feature Map

Co-living platform (formerly Hyve). Operates 3 Singapore properties / 19 rooms under Makery Pte. Ltd. The codebase covers the **public marketing site**, a **multi-role tenant portal**, a **self-serve viewing booking system**, an **investor reporting portal**, and the **operational backend** that ties it all together (Supabase + Vercel API routes + edge functions + 3rd-party integrations).

> **Stack:** Vite + React 18, React Router 6, Tailwind 4, Radix UI, Supabase (Postgres + Auth + Storage + Edge Functions), Vercel (hosting + serverless API), Sanity (legacy CMS — being migrated out), Stripe, Google Calendar API, Aspire (banking), Resend (email), Nodemailer.

---

## 1. Public Marketing Site

| Route | Component | Notes |
|-------|-----------|-------|
| `/` | `HomePageWithSanity` | Hero + benefits + featured properties + community + CTA. Search bar drives `/properties` filter. |
| `/properties` | `PropertiesPageWithSanity` | All 3 properties, filterable by location/price/availability/room type. |
| `/property/:id` | `PropertyDetailPageWithSanity` (1,198 LOC, largest file) | Property gallery, room list, amenities, neighborhood, MRT, deep-link to `/book`. |
| `/locations` | `LocationsPageWithSanity` | 7 neighborhoods (Lentor, Serangoon, Jurong East, Tampines, Marina Bay, Chinatown, Tiong Bahru) — descriptions, transport, demographics, price range. |
| `/about` | `AboutPage` | Static company info. |
| `/blog` + `/blog/:slug` | `BlogPage` / `BlogPostPage` | Currently no blog posts in CMS — page renders empty state. |
| `/faqs` | `FAQsPageWithSanity` | Sectioned Q&A from CMS. |
| `/contact` | `ContactPage` | Contact form → `api/send-room-request`. |
| `/residents` | `ResidentGuidePage` | Static resident-facing guide (rules, etiquette). |
| `/staff` | `StaffResourcePage` | Public-but-unlisted staff playbook. |
| `/privacy-policy`, `/terms-of-service`, `/cookie-policy` | Static legal pages. |

**Shared chrome:** `Navbar`, `Footer`, `FloatingWhatsApp` (one-click WA contact).
**Internationalization:** `src/i18n/` with English + Chinese (`en.json`, `zh.json`) via `LanguageContext`.
**SEO:** `react-helmet-async`, schema.org JSON-LD in `index.html`, canonical to `https://www.lazybee.sg`.

---

## 2. Self-Serve Viewing Booking — V2 (live)

The flagship recent build. Replaces an older invite-link / poll workflow with a fully self-serve booking page backed by Google Calendar as source of truth.

### Public flow
| Route | Component | What it does |
|-------|-----------|--------------|
| `/book` | `BookLandingPage` | 3 property cards (CHP, IH, TG). |
| `/book/:property` | `BookPropertyPage` | Date picker + slot list. 48-hour booking lead time enforced. Weekday vs weekend slot bands. |
| `/book/:property/:room` | `BookRoomPage` | Same as above, room pre-selected (deep link). |
| `/book/confirmed/:viewing_id` | `BookConfirmedPage` | Shows confirmation + cancel link. |
| `/book/cancel` | `BookCancelPage` | Cancel a booking (token-protected). |

### Backend (`api/booking/[...path].js`, 575 LOC catch-all)
- `GET /api/booking/slots?property=<code>&date=<YYYY-MM-DD>` — returns available 30-min slots, reading busy ranges from Google Calendar via service-account OAuth (`googleapis` + refresh token).
- `POST /api/booking/create` — creates `property_viewings` row in Supabase, creates Google Cal event, returns viewing ID + cancel URL.
- `GET /api/booking/cancel?token=<x>` — fetches viewing by signed token.
- `POST /api/booking/cancel` — flips status to `cancelled`, removes Google Cal event.
- `GET /api/booking/auth-callback` — OAuth bootstrap (one-time, stores refresh token).

### Reminders (`viewing-notify` edge function, daily cron)
- Sends 24h-before email reminders to prospects.
- Sends 2h-before reminder (mode-dependent).
- Resend or Nodemailer for delivery.

### Legacy V1 (kept for cutover safety)
| Route | Component | Status |
|-------|-----------|--------|
| `/view/schedule/:propertySlug/:roomSlug?` | `ScheduleViewingPage` | Legacy poll-based scheduling. |
| `/view/confirm/:token` | `ViewingConfirmPage` | Legacy confirm page. |
| `/view/:token` | `ViewingPage` | Legacy single-link viewing. |

V1 will be deleted once V2 is observed stable.

---

## 3. Tenant / Member Portal (`/portal/*`)

Authenticated via Supabase Auth (`AuthProvider` + `useAuth`). All routes wrapped in `<AuthGuard>`, with role-based sub-guards (`HOUSE_CAPTAIN`, `ADMIN`, default `MEMBER`).

### Auth + Onboarding
| Route | Component | Purpose |
|-------|-----------|---------|
| `/portal/login` | `LoginPage` | Magic-link login. |
| `/portal/signup` | `SignupPage` | Email + password. Triggered from `api/portal/signup` invite flow. |
| `/portal/onboarding` | `OnboardingPage` (604 LOC) | Stepper UI — personal details, ID scan, room checklist, agreement signing, deposit payment. Backed by `useOnboarding`. |
| `/portal/onboarding/signed` | `SigningConfirmationPage` | Post-signing landing. |

Onboarding pieces (in `src/components/portal/`): `PersonalDetailsForm`, `IdScanForm` (593 LOC, OCR via `api/portal/ocr.js`), `RoomChecklistForm`, `AgreementViewer` (with `DraggableSignaturePlacer` + `SignatureCanvas` + `PdfFieldPlacer`), `DepositPayment` (Stripe checkout via `api/portal/deposit-checkout.js`), `MoveInInstructions`, `OnboardingTimeline`, `WelcomeSplash`.

### Member home
| Route | Component | Purpose |
|-------|-----------|---------|
| `/portal/dashboard` | `DashboardPage` | Tenant home — current invoice, recent tickets, AC usage, announcement banner. |
| `/portal/billing` | `BillingPage` | Invoices list, rent payment history, late fees, deposit status. |
| `/portal/billing/:invoiceId` | `InvoiceDetailPage` | Single invoice view + Stripe pay link. |
| `/portal/issues` | `IssuesPage` | Maintenance ticket list. |
| `/portal/issues/new` | `NewIssuePage` | New ticket form (photo upload via Supabase Storage). |
| `/portal/maintenance` | `MaintenanceSchedulePage` | Upcoming scheduled maintenance per unit. |
| `/portal/documents` | `TenantDocumentsPage` | Tenant's signed agreements, ID copies, etc. |
| `/portal/guide` | `PropertyGuidePage` | Property-specific welcome guide (Wi-Fi, house rules, access codes). |
| `/portal/settings` | `MemberSettingsPage` | Profile, language, notification prefs. |
| `/portal/help` | `HelpPage` | FAQ + contact. |

### House Captain (sub-role of MEMBER)
| Route | Component | Purpose |
|-------|-----------|---------|
| `/portal/property` | `PropertyOverviewPage` | Captain's property dashboard. |
| `/portal/property/tickets` | `PropertyTicketsPage` | Manage all tickets for the unit. |
| `/portal/property/tenants` | `PropertyTenantsPage` | Roster + contact info for housemates. |
| `/portal/captain/claims` | `CaptainClaimsPage` (696 LOC) | Captain reimbursement claims (e.g. paid for cleaning supplies). |
| `/portal/captain/claims/new` | `CaptainClaimFormPage` | Submit new claim with receipt upload. |

---

## 4. Admin Portal (`/portal/admin/*`)

Operations control panel. Role-gated to `ADMIN`. The largest part of the codebase by far — 9 of the 10 biggest files in the repo are here.

| Route | Component | LOC | Purpose |
|-------|-----------|-----|---------|
| `/portal/admin` | `AdminDashboardPage` | — | Overview KPIs. |
| `/portal/admin/viewings` | `AdminViewingsPage` | 1,049 | All viewings — Calendar tab, Leads tab, deep-link copier. |
| `/portal/admin/viewings/:id` | `AdminViewingDetailPage` | 728 | Single viewing — assign captain, send reminders. |
| `/portal/admin/onboarding` | `AdminOnboardingPage` | 941 | Onboarding kanban for all incoming tenants. |
| `/portal/admin/onboarding/:id` | `AdminOnboardingDetailPage` | **1,779** (largest file) | Tenant onboarding deep-detail — review IDs, countersign agreement, set room. |
| `/portal/admin/rent` | `AdminRentPage` | 1,152 | Rent roll — payments, arrears, reminders. |
| `/portal/admin/expenses` | `AdminExpensesPage` | — | Expenses per property. |
| `/portal/admin/expenses/import` | `AdminExpenseImportPage` | **1,749** | Bulk CSV import + AI auto-tagging via `tagging.js`. |
| `/portal/admin/financials` | `AdminFinancialsPage` | 668 | P&L per property + portfolio. |
| `/portal/admin/investors` | `AdminInvestorsPage` | 1,164 | Investor list + cap table + distributions. |
| `/portal/admin/documents` | `AdminDocumentsPage` | 621 | Document templates + storage. |
| `/portal/admin/locks` | `AdminLocksPage` | — | Smart lock passcode management. |
| `/portal/admin/devices` | `AdminDevicesPage` | — | IoT device fleet (AC sensors). |
| `/portal/admin/announcements` | `AdminAnnouncementsPage` | — | Property-wide announcements (banner on tenant dashboard). |
| `/portal/admin/tasks` | `AdminTasksPage` | — | Internal task list. |
| `/portal/admin/invoices` | `AdminInvoicesPage` | — | Invoice management (line items, send, regenerate). |
| `/portal/admin/members` | `AdminMembersPage` | — | All tenants + captains + roster view. |

**Cross-cutting components:** `PortalLayout`, `PortalTour`, `MembersAlerts`, `MembersCaptains`, `MembersRoster`, `MembersClaimsQueue`, `TransactionReviewBoard`, `CsvUploader`, `DistributionTable`.

---

## 5. Investor Portal (`/portal/investor/*`)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/portal/investor/signup` | `InvestorSignupPage` | Public investor onboarding form. |
| `/portal/investor/dashboard` | `InvestorDashboardPage` | Portfolio summary, distributions, performance per property. |
| `/portal/investor/reports` | `InvestorReportsPage` (757 LOC) | Detailed monthly reports — financials, occupancy, expenses, distributions. |

Backed by `InvestorLayout`, `PortfolioSummary`, `PropertyPerformanceCard`, `DistributionTable`.

---

## 6. API Routes (Vercel serverless)

Located in `/api`. Vite-served in dev; Vercel functions in prod.

| Route | Purpose |
|-------|---------|
| `api/properties.js` | Public list of properties (used by marketing site fallback). |
| `api/rooms.js` | Public list of available rooms. |
| `api/send-room-request.js` | Contact-form submissions → email via Resend. |
| `api/booking/[...path].js` | All V2 booking endpoints (slots / create / cancel / auth-callback). 575 LOC catch-all. |
| `api/portal/signup.js` | Invite a tenant — generates magic link, creates onboarding shell row. |
| `api/portal/invite.js` | Admin invite captain or member. |
| `api/portal/sign-ta.js` | Submit signed tenancy agreement (PDF stamping via `pdf-lib` + `pdfStamp.js`). |
| `api/portal/counter-sign.js` | Admin counter-sign and finalize agreement. |
| `api/portal/deposit-checkout.js` | Create Stripe checkout session for deposit. |
| `api/portal/admin-actions.js` | Privileged admin actions (force-close ticket, override rent, etc.). |
| `api/portal/ocr.js` | ID document OCR (called from `IdScanForm`). |
| `api/webhooks/stripe.js` | Stripe webhook receiver — payment success → mark deposit paid. |

---

## 7. Supabase Edge Functions (cron + integrations)

Located in `supabase/functions/`.

| Function | Trigger | Purpose |
|----------|---------|---------|
| `calculate-usage` | Cron | Aggregate daily AC usage from raw events into `ac_monthly_usage`. |
| `check-late-fees` | Cron daily | Apply late fees to overdue invoices. |
| `data-archival` | Cron weekly | Archive old IoT events. |
| `device-monitor` | Cron | Heartbeat / offline detection for AC sensors. |
| `generate-invoices` | Cron monthly (1st) | Generate next month's rent invoices. |
| `ingest-ac-event` | HTTP (devices POST) | Receive AC on/off / temperature events. |
| `monthly-billing` | Cron monthly | Run rent + utility billing batch. |
| `notify-tenant` | Triggered by app | Email/WA tenant on ticket status change. |
| `sync-rooms` | Cron | Sync room state with external sources. |
| `ticket-escalation` | Cron | Escalate stale tickets to admin. |
| `viewing-notify` | Cron daily | 24h + 2h viewing reminders. |

---

## 8. Database Schema (Supabase project `diiilqpfmlxjwiaeophb`)

42 tables in `public`. Roughly grouped:

**Properties + rooms (source of truth, replacing Sanity)**
`properties`, `rooms`

**Tenants + onboarding**
`tenant_profiles`, `tenant_details`, `tenant_documents`, `onboarding_progress`, `room_checklists`, `document_templates`

**Billing + finance**
`invoices`, `invoice_line_items`, `rent_payments`, `member_charges`, `monthly_financials`, `property_expenses`, `import_batches`, `bank_transactions`, `tagging_rules`

**Maintenance + operations**
`maintenance_tickets`, `ticket_photos`, `claims`, `admin_tasks`, `house_rules`, `property_guides`

**IoT + utilities (AC sensors, smart locks)**
`device_status`, `device_keys`, `ac_events`, `ac_monthly_usage`, `energy_readings`, `lock_passcodes`

**Investors**
`investors`, `investments`, `distributions`, `investor_reports`

**Viewings (V1 + V2)**
`leads`, `property_viewings`, `viewing_polls`, `viewing_poll_responses`

**Comms + system**
`announcements`, `email_templates`, `pending_notifications`, `audit_log`, `account_nicknames`, `checkout_status`

**CMS (new — replacing Sanity)**
`cms_content` (added 2026-05-08, type/slug/JSONB) — empty at time of writing.

---

## 9. Hooks Layer (`src/hooks/`)

Thin React Query / Supabase hooks — one per domain:

`useAuth` (auth context) · `useTenantDashboard` · `useOnboarding` · `useTickets` · `useClaims` · `useInvoices` / `useAdminInvoices` · `useRentPayments` · `useViewings` / `useViewingPoll` · `useMembersData` · `useInvestor` / `useInvestorDashboard` / `useInvestorReports` · `useAcStatus` / `useAcUsage` / `useDailyUsage` / `useMonthlyUsage` / `useUsageData` / `useEnergyReadings` · `useTransactionImport` / `useTransactionReview` · `usePropertyGuides` · `use-mobile`.

---

## 10. Library Layer (`src/lib/`)

| File | Purpose |
|------|---------|
| `supabase.js` | Supabase client (anon key, browser). |
| `sanity.js` | **(legacy)** Sanity client + GROQ queries. To be replaced by `cms.js`. |
| `aspire.js` | Aspire banking API client (token lifecycle, transactions). |
| `googleCalendar.js` | Google Cal busy-ranges + event create/delete (booking V2). |
| `stripe.js` | Stripe publishable key + checkout helpers. |
| `notify.js` | Tenant ticket notification orchestrator. |
| `bookingHelpers.js` | Slot generation, lead-time math, weekday/weekend bands. |
| `feeSchedule.js` | Late fee calculation. |
| `invoiceCode.js` | Invoice numbering. |
| `pdfStamp.js` | PDF signature stamping using `pdf-lib`. |
| `tagging.js` | Auto-tag bank transactions by description rules. |
| `utils.js` | Generic helpers (`cn` for class merging, etc.). |

---

## 11. 3rd-Party Integrations

| Service | Used for | Status |
|---------|----------|--------|
| **Supabase** | DB + Auth + Storage + Edge Functions (project `diiilqpfmlxjwiaeophb`) | Source of truth ✅ |
| **Sanity** | Marketing CMS — pages, neighborhoods, FAQs, blog (project `ydn0o1zt`) | Being migrated out ⚠️ |
| **Stripe** | Deposit payments, invoice pay-links | Live ✅ |
| **Google Calendar API** | Viewing slot busy-ranges (V2 booking) | Live ✅ |
| **Aspire** | Bank transaction import for expense reconciliation | Live ✅ |
| **Resend** | Transactional email (booking confirmations, reminders) | Live ✅ |
| **Nodemailer** | Some legacy email paths | Live ✅ |
| **Calendly** (`react-calendly`) | One legacy embed | Mostly unused |
| **Leaflet** (`react-leaflet`) | Property maps | Live ✅ |
| **OCR (in-house, via `/api/portal/ocr.js`)** | NRIC / passport extraction | Live ✅ |

---

## 12. UI Stack

- **Tailwind 4** + **Radix UI primitives** (~30 imported) wrapped in `src/components/ui/` (46 files — `button`, `dialog`, `select`, `table`, `sidebar`, `command`, etc., generated by shadcn/ui).
- **Lucide React** for icons.
- **Framer Motion** for animations.
- **Recharts** for investor dashboards.
- **react-hook-form** + **zod** for form validation.
- **react-pdf** + **pdf-lib** + **html2pdf.js** for agreement rendering and signing.
- **react-signature-canvas** for in-portal signing.
- **dnd-kit** for drag-drop signature placement on PDFs.
- **embla-carousel-react** for property image carousels.
- **next-themes** for dark mode (not yet exposed in UI).
- **sonner** for toast notifications.
- **vaul** for mobile drawer modals.

---

## 13. Deployment

- **Hosting:** Vercel. Two environments — `staging` and `production`. Production domain: `lazybee.sg`.
- **Branch strategy:** `master` is production. `staging` exists but currently empty of unique commits (just fetched). Feature branches like `rename/lazybee-cleanup` for current work.
- **Env files:** `.env.vercel` (preview), `.env.vercel.prod` (production). Never committed.
- **Studio:** Sanity Studio in `studio-hello-world/` (will be deleted after Sanity migration completes).

---

## 14. Code Health Snapshot (as of 2026-05-08)

- **Total source:** 215 JS/JSX files, ~52,000 LOC after recent dead-code cleanup.
- **Build:** Vite, ~4s. Single bundle ~3.27MB (962KB gzipped). Worth code-splitting later but not critical.
- **Dead code removed in this branch:** 6 files / 2,388 LOC (orphaned non-Sanity page variants + `AdminViewingsPageV2`).
- **Largest files (refactor candidates):**
  - `AdminOnboardingDetailPage.jsx` — 1,779 LOC
  - `AdminExpenseImportPage.jsx` — 1,749 LOC
  - `PropertyDetailPageWithSanity.jsx` — 1,198 LOC
  - `AdminInvestorsPage.jsx` — 1,164 LOC
  - `AdminRentPage.jsx` — 1,152 LOC
  - `AdminViewingsPage.jsx` — 1,049 LOC
- **Build warnings:** Mixed static + dynamic imports of `supabase.js` and `sampleData.js` (chunking is suboptimal but not breaking).

## 15. Known Issues / In-Flight Work

- **Sanity → Supabase migration** in progress on `rename/lazybee-cleanup` branch. `cms_content` table created (empty); export script + frontend cutover pending.
- **Hyve → Lazybee rename** completed in same branch (487 changes across 96 files). Domain, email, env var, brand strings, and 9 file/asset names all switched to Lazybee. Build green.
- **Vercel todo:** add `LAZYBEE_VIEWINGS_CAL_ID` env var (mirroring old `HYVE_VIEWINGS_CAL_ID`) before merging to master, otherwise booking calendar breaks on deploy.
- **V1 viewing routes (`/view/*`)** still present — delete after V2 cutover stability is observed.
- **Bundle size** > 500KB warning — defer split until any page becomes painfully slow.

---

*Generated from a static read of the repo on 2026-05-08. Source of truth = the code — when this file disagrees, trust `src/App.jsx`, the migrations folder, and the live Supabase schema.*
