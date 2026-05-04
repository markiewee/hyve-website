# House Captain Claims + Admin Members Dashboard — Design

**Date:** 2026-05-04
**Status:** Draft → for implementation planning
**Codebase:** `/Users/mark/Desktop/hyve-website`

---

## 1. Goal

Three changes to the Hyve portal, all reinforcing the house captain role:

1. **Captains can submit expense reimbursement claims** — receipt + item photo + category + amount.
2. **Admin "Members Dashboard"** — single screen showing all tenants by property with mode toggle (Roster / Alerts / Captains / Claims) and property filter.
3. **House Captain tag** — a reusable badge surfaced wherever a captain appears in the portal.

## 2. Non-goals

- Auto-payout / PayNow integration — admin marks claims paid manually.
- Linking claims to maintenance tickets — out of scope for v1.
- Captain self-service onboarding — captains assigned manually via DB / admin tooling.
- Editing a submitted claim — re-submission creates a new row.
- Multi-property captains — one captain per property is the assumption.
- Push/email notifications on claim status — visible on next portal load is sufficient.

## 3. Data model

### 3.1 New table: `claims`

| column | type | notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` default |
| `captain_id` | `uuid` FK → `tenant_profiles(id)` | submitter |
| `property_id` | `uuid` FK → `properties(id)` | denormalised from captain's profile for filterability |
| `category` | enum | `PLUMBING`, `ELECTRICAL`, `CLEANING_SUPPLIES`, `FURNITURE`, `TRANSPORT`, `OTHER` |
| `amount_sgd` | `numeric(10,2)` | claim amount |
| `description` | `text` | short context, 1–2 sentences |
| `receipt_url` | `text` | storage path to receipt photo |
| `item_url` | `text` | storage path to item photo |
| `status` | enum | `SUBMITTED`, `APPROVED`, `REJECTED`, `PAID` — default `SUBMITTED` |
| `admin_comment` | `text` nullable | admin's note on review |
| `payment_reference` | `text` nullable | PayNow ref / bank transfer note when marked paid |
| `created_at` | `timestamptz` | default `now()` |
| `reviewed_at` | `timestamptz` nullable | set when status moves out of `SUBMITTED` |
| `reviewed_by` | `uuid` nullable FK → `tenant_profiles(id)` | admin who reviewed |
| `paid_at` | `timestamptz` nullable | set when status → `PAID` |

Indexes: `(captain_id)`, `(property_id, status)`, `(status, created_at desc)`.

### 3.2 New storage bucket: `claims`

Path convention: `{property_id}/{claim_id}/receipt.{ext}` and `.../item.{ext}`. Both photos required at submit time.

### 3.3 RLS policies

- **Captain SELECT own claims:** `captain_id = (SELECT id FROM tenant_profiles WHERE user_id = auth.uid() AND role = 'HOUSE_CAPTAIN' AND is_active = true)`
- **Captain INSERT own claims:** same predicate, plus `status = 'SUBMITTED'` enforced.
- **Captain UPDATE:** denied. Re-submission = new row.
- **Admin SELECT/UPDATE all claims:** `EXISTS (SELECT 1 FROM tenant_profiles WHERE user_id = auth.uid() AND role = 'ADMIN' AND is_active = true)`.
- **Tenant (non-captain) access:** none.

Storage bucket policies for `claims`:
- **Captain INSERT** to path `{property_id}/{claim_id}/*` only if a `claims` row exists with that `claim_id` and `captain_id` matching the user's profile. (Or alternatively: write to `staging/{user_id}/*` first, move after row insert — simpler RLS, see §4.3.)
- **Captain SELECT** files where the corresponding `claims` row's `captain_id` matches.
- **Admin SELECT** all files in the bucket.
- **No public read.**

### 3.4 No changes to `tenant_profiles`

`role = 'HOUSE_CAPTAIN'` already exists in the schema and is the single source of truth for captain assignment.

## 4. Captain claims UI

### 4.1 Routes

- `/portal/captain/claims` — list of own claims + "Submit new claim" button.
- `/portal/captain/claims/new` — claim form.

Both gated behind `AuthGuard` with `role === 'HOUSE_CAPTAIN'`. Sidebar nav item "Claims" only renders for captains.

### 4.2 `CaptainClaimsPage` (list)

- Header: "My Claims" + primary CTA "Submit new claim".
- Filter chips: `All` (default) / `Pending` / `Approved` / `Paid` / `Rejected`.
- Card per claim, newest first:
  - Item photo thumbnail (left)
  - Category icon + label
  - Amount in SGD
  - Status pill (colors: SUBMITTED yellow, APPROVED blue, PAID green, REJECTED red)
  - Submitted date
  - Last admin comment (if present, truncated)
  - On REJECTED: secondary "Re-submit" button that pre-fills the form with rejected claim's data.

### 4.3 `ClaimFormPage`

Fields:
- **Property** — read-only, auto-filled from captain's profile.
- **Category** — dropdown (6 enum values).
- **Amount (SGD)** — numeric input, 2dp.
- **Description** — textarea, soft 200-char hint.
- **Receipt photo** — single image upload, required, accepts JPG/PNG/HEIC.
- **Item photo** — single image upload, required, same accept list.

Submit flow:
1. Upload both photos to `claims` bucket under a temporary `staging/{user_id}/` prefix.
2. INSERT `claims` row with `status = 'SUBMITTED'`.
3. Move uploaded files to `{property_id}/{claim_id}/` (final path).
4. Redirect to `/portal/captain/claims` with success toast.

If step 2 or 3 fails, surface error and keep form populated so the captain can retry.

### 4.4 Status flow

```
SUBMITTED ──admin approve──> APPROVED ──admin marks paid──> PAID
    │
    └──admin reject──> REJECTED ──captain re-submits──> new SUBMITTED row
```

## 5. Admin Members Dashboard

### 5.1 Route

`/portal/admin/members` (new). Linked from admin sidebar as "Members".

### 5.2 Page chrome

```
┌─────────────────────────────────────────────────────────────┐
│ Members                                          [+ Invite] │
│ ┌────────┬─────────┬──────────┬─────────┐ ┌──────────────┐ │
│ │ Roster │ Alerts ●│ Captains │ Claims ●│ │ All Props  ▾ │ │
│ └────────┴─────────┴──────────┴─────────┘ └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

- Mode tabs: `Roster` (default) / `Alerts` / `Captains` / `Claims`. Tabs show a dot with count when items need attention (Alerts: count of overdue/expiring/etc.; Claims: count of `SUBMITTED`).
- Property filter: `All Properties` (default) / Thomson Grove / Ivory Heights / Chiltern Park. Applies to all 4 modes.
- "+ Invite" CTA in the page header is a link to the existing onboarding flow (`/portal/admin/onboarding/new` or equivalent) — no new logic required, just placement on this page.

### 5.3 Roster mode (default)

- 3-column grid when filter = All; 1 column when single property selected.
- Per-column header: property name + occupancy ratio (`5/6 rooms filled`).
- House captain card pinned to top of column with `<CaptainBadge />`, name, contact (WA + email).
- Below: room cards in `unit_code` order:
  - Room name + unit code
  - Tenant name (or "Vacant" placeholder)
  - Lease end date
  - Rent status pill (Paid / Due / Overdue)
  - Open ticket count chip (if > 0)
- Click a tenant row → side drawer with full profile (reuse `TenantProfileCard`), lease, payment history.

### 5.4 Alerts mode

Single-column list grouped by severity:
- 🔴 **Overdue rent** — any tenant with rent past due
- 🟠 **Lease ending in next 30 days**
- 🟡 **Lease ending 30–60 days**
- 🟡 **Open tickets >7 days old**
- ⚪ **Vacant rooms**

Each row: property tag + tenant/room identifier + alert reason + "Action" button routing to existing page (`AdminRentPage`, `AdminOnboardingDetailPage`, `IssuesPage`).

Empty state: "All quiet 🐝".

### 5.5 Captains mode

One row per captain (currently 3):
- Avatar, name, property, contact (WA + email)
- Claims-this-month: count + total SGD
- "View claims" button → switches to Claims mode pre-filtered to that captain
- "Edit" button — assign/unassign role (updates `tenant_profiles.role`)

### 5.6 Claims mode (admin approval queue)

- Filter chips: `Pending` (default) / `Approved` / `Paid` / `Rejected` / `All`.
- Claim card layout:
  ```
  ┌──────────────────────────────────────────────────────┐
  │ [item photo]  [receipt photo]                         │
  │ Megan · Thomson Grove · Plumbing · S$45.00            │
  │ "Replaced kitchen sink trap, was leaking"             │
  │ Submitted 2 days ago                  [▾ Comment]    │
  │                            [Reject]  [Approve]       │
  └──────────────────────────────────────────────────────┘
  ```
- Photos open in a lightbox on click.
- Comment textarea inline, collapsed by default; saved with the action (approve/reject) into `admin_comment`.
- After **Approve**: action buttons replaced with "Mark paid" + payment-reference input.
- After **Mark paid**: row collapses to summary; visible under "Paid" filter.
- On any action, set `reviewed_at = now()`, `reviewed_by = (admin's tenant_profiles.id)`. On paid, also `paid_at = now()`. (`reviewed_by` FK is to `tenant_profiles(id)`, not `auth.users(id)` — resolve via `tenant_profiles.user_id = auth.uid()` lookup.)

### 5.7 Permissions

ADMIN-only page. `AuthGuard` with admin role check; RLS provides defense in depth.

## 6. Tenant page refresh + global captain tag

### 6.1 `PropertyTenantsPage` redesign

Single column, mobile-first:
- Header: `{property name} · {n} housemates`
- **Captain card** pinned at top with distinct styling (coloured border, 🏠 icon):
  - Name, room, `<CaptainBadge size="md" />`
  - "Message Captain" button → `https://wa.me/{e164}` deep link if captain has a phone number on file
  - Helper: "Your house captain handles maintenance + house issues."
- **Housemates list** below:
  - Avatar, name, room, moved-in date
  - No role pill on regular tenants (captain is the only role worth surfacing here)

Vacant rooms are not shown — this view is "who else lives here", not inventory.

### 6.2 Global `<CaptainBadge />` component

`src/components/portal/CaptainBadge.jsx`

- Props: `size: "sm" | "md"` (default `md`)
- Styling: pale blue pill matching existing `ROLE_BADGE.HOUSE_CAPTAIN` (`bg-blue-100 text-blue-700`)
- Content: `🏠 House Captain` (md) or `🏠 Captain` (sm)
- Used in:
  - `PropertyTenantsPage` — captain card
  - `AdminMembersPage` — Roster columns + Captains mode rows
  - `TicketCard` — beside the creator's name when their `tenant_profiles.role = 'HOUSE_CAPTAIN'` (so you can scan tickets and see captain-originated ones at a glance)

No DB change — component reads `tenant_profiles.role`.

## 7. Component / file plan

**New files:**
- `supabase/migrations/{ts}_claims.sql` — table, enums, RLS policies, storage bucket policies
- `src/pages/portal/CaptainClaimsPage.jsx`
- `src/pages/portal/CaptainClaimFormPage.jsx`
- `src/pages/portal/AdminMembersPage.jsx`
- `src/components/portal/CaptainBadge.jsx`
- `src/components/portal/ClaimCard.jsx` (shared between captain list + admin queue)
- `src/components/portal/MembersRoster.jsx` (Roster mode)
- `src/components/portal/MembersAlerts.jsx` (Alerts mode)
- `src/components/portal/MembersCaptains.jsx` (Captains mode)
- `src/components/portal/MembersClaimsQueue.jsx` (Claims mode)
- `src/hooks/useClaims.js` — fetch/insert/update claims
- `src/hooks/useMembersData.js` — combined query for tenants/rooms/rent/tickets per property

**Modified files:**
- `src/App.jsx` — add 3 new routes
- `src/components/portal/PortalLayout.jsx` — add "Claims" sidebar item (captain-only) + "Members" sidebar item (admin-only)
- `src/pages/portal/PropertyTenantsPage.jsx` — full layout rewrite
- `src/components/portal/TicketCard.jsx` — show `<CaptainBadge size="sm" />` next to creator if captain
- `src/i18n/en.json` — copy strings for new screens

## 8. Testing

- RLS smoke tests: captain cannot read other captain's claims; tenant cannot read any claim; admin reads all.
- Form submission: claim row created with status `SUBMITTED`, both photo URLs populated, files exist at expected storage paths.
- Status transitions: SUBMITTED → APPROVED → PAID; SUBMITTED → REJECTED → re-submit creates new row, original stays as REJECTED.
- Re-submission pre-fill: rejected claim's category/amount/description pre-populate the new form.
- Members dashboard: switching property filter scopes Roster, Alerts, Captains, and Claims correctly.
- Claims attention dot: Claims tab shows count = number of `SUBMITTED` claims (admin view).
- `CaptainBadge` renders only when `role === 'HOUSE_CAPTAIN'`.

## 9. Open questions

None at time of writing — design ratified through brainstorming session 2026-05-04.
