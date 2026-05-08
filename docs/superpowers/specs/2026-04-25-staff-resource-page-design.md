# Staff Resource Page — Design Spec

**Date:** 2026-04-25
**Author:** Mark Wee + Claudine
**Status:** Approved

## Purpose

An unlisted internal page on lazybee.sg where remote sales staff can quickly look up unit details, facilities, amenities, availability, and policies to answer prospect questions accurately during conversations — without needing to ask Mark.

## Target Users

Remote sales staff handling inquiries on WhatsApp, Roomies, Carousell, and other platforms.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Access model | Unlisted public page (no auth, not in navbar) | No login friction — staff just bookmarks the URL |
| Data source | Supabase (lazybee-iot) | Moving away from Sanity; Supabase is source of truth |
| Navigation | Property tabs (CP / IH / TG) | Staff knows which property the prospect is asking about |
| Availability | Derived from `next_available` + `available_until` fields, synced from Millia | Always accurate, no manual updates |

---

## Part 1: Database Migration

### 1.1 `rooms` table — new columns

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `room_type` | text | — | `master` / `premium` / `standard` |
| `price_monthly` | numeric | — | Monthly rent in SGD |
| `size_sqm` | numeric | — | Room size in square metres |
| `description` | text | — | Short room description for sales context |
| `floor` | integer | — | Floor number |
| `has_private_bathroom` | boolean | false | Attached bathroom? |
| `has_aircon` | boolean | true | Air conditioning included? |
| `furnishing_level` | text | `'fully_furnished'` | `fully_furnished` / `partially_furnished` / `unfurnished` |
| `amenities` | jsonb | `'[]'` | Room items: `["wardrobe", "desk", "mirror", "curtains"]` |
| `facilities` | jsonb | `'[]'` | Room facilities: `["attached bath", "window", "balcony"]` |
| `photos` | jsonb | `'[]'` | Array of image URLs (Supabase Storage or external) |
| `deposit_months` | integer | 1 | Number of months deposit |
| `min_stay_months` | integer | 6 | Minimum lease duration |
| `next_available` | date | — | When room opens up. NULL = available now. Synced from Millia. |
| `available_until` | date | — | When next future booking starts. NULL = no upcoming booking. Synced from Millia. |

### 1.2 `properties` table — new columns

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `description` | text | — | Property overview paragraph |
| `slug` | text | — | URL-friendly identifier (e.g. `chiltern-park`) |
| `latitude` | numeric | — | Map coordinate |
| `longitude` | numeric | — | Map coordinate |
| `amenities` | jsonb | `'[]'` | Property-level amenities: `["gym", "pool", "BBQ pit"]` |
| `facilities` | jsonb | `'[]'` | Property-level facilities: `["parking", "laundry", "lift"]` |
| `nearby_mrt` | jsonb | `'[]'` | `[{"station": "Serangoon", "line": "NEL/CCL", "walking_minutes": 8}]` |
| `nearby_amenities` | jsonb | `'[]'` | `[{"name": "NEX Mall", "type": "mall", "walking_minutes": 10}]` |
| `images` | jsonb | `'[]'` | Array of property image URLs |
| `house_rules` | jsonb | `'[]'` | Array of rule strings |
| `status` | text | `'available'` | `available` / `coming_soon` / `full` |

### 1.3 Seed data

After migration, seed all 3 properties and 19 rooms with real data. Source from:
- Existing Sanity CMS content
- Room photos from `/Users/mark/Desktop/claudine/lazybee-photos/`
- Pricing from current listings (Roomies, Carousell, lazybee-ops.json)
- Availability from tenant_profiles + Millia

### 1.4 RLS

The `rooms` and `properties` tables already allow anon reads (the public ScheduleViewingPage uses them). Verify the new columns are covered by the same SELECT policy. No new RLS rules needed.

---

## Part 2: Staff Resource Page

### 2.1 Route & File

- **Route:** `/staff` (added to `App.jsx` inside the public layout block, with Navbar/Footer)
- **Component:** `/src/components/StaffResourcePage.jsx`
- **Not linked** in Navbar, Footer, or any public navigation — access via direct URL only

### 2.2 Page Structure

```
┌─────────────────────────────────────────┐
│  Lazybee Staff Resource Guide              │
│  "Quick reference for sales & ops"      │
├────────┬────────┬───────────────────────┤
│  CP    │  IH    │  TG                   │  ← property tabs
├────────┴────────┴───────────────────────┤
│                                         │
│  PROPERTY OVERVIEW SECTION              │
│  - Address                              │
│  - Description                          │
│  - Facilities (tag chips)               │
│  - Nearest MRT (station + walk time)    │
│  - Nearby amenities (name + walk time)  │
│  - House rules (bullet list)            │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  ROOMS GRID (responsive)               │
│  Desktop: 3 columns | Mobile: 1 column  │
│                                         │
│  Each room card (collapsed):            │
│  ┌──────────────────────────────┐       │
│  │  CP-MR — Master Room         │       │
│  │  $1,400/mo  •  15 sqm        │       │
│  │  🟢 Available now             │       │
│  │  [tap to expand]             │       │
│  └──────────────────────────────┘       │
│                                         │
│  Each room card (expanded):             │
│  ┌──────────────────────────────┐       │
│  │  CP-MR — Master Room         │       │
│  │  $1,400/mo  •  15 sqm        │       │
│  │  🟢 Available now             │       │
│  │  ─────────────────────────── │       │
│  │  Photos: [scrollable row]    │       │
│  │  Type: Master                │       │
│  │  Floor: 3                    │       │
│  │  Bathroom: Private           │       │
│  │  Aircon: Yes                 │       │
│  │  Furnishing: Fully furnished │       │
│  │  Amenities: wardrobe, desk,  │       │
│  │    mirror, curtains          │       │
│  │  Facilities: attached bath,  │       │
│  │    window, balcony           │       │
│  │  Deposit: 1 month            │       │
│  │  Min stay: 6 months          │       │
│  │  Description: "Spacious..."  │       │
│  └──────────────────────────────┘       │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  GLOBAL SECTIONS (static content)       │
│                                         │
│  Lease Terms                            │
│  - Min stay: 6 months                   │
│  - Deposit: 1 month (refundable)        │
│  - Notice period: 1 month               │
│  - Includes: WiFi, utilities, weekly    │
│    common area cleaning, furnished room │
│  - Excludes: personal AC usage over     │
│    allowance                            │
│                                         │
│  Move-in Process                        │
│  1. Schedule a viewing                  │
│  2. Sign licence agreement              │
│  3. Pay deposit + first month rent      │
│  4. Collect keys / door code            │
│  5. Move in                             │
│                                         │
│  FAQ                                    │
│  - Can I have guests?                   │
│  - What's the WiFi speed?              │
│  - Is cooking allowed?                  │
│  - How do I report maintenance?         │
│  - Can I end my lease early?            │
│  - What happens to my deposit?          │
│  (Expandable accordion)                 │
│                                         │
└─────────────────────────────────────────┘
```

### 2.3 Availability Display Logic

| Condition | Display | Colour |
|-----------|---------|--------|
| `next_available` is NULL and `available_until` is NULL | "Available now" | Green |
| `next_available` is NULL and `available_until` is set | "Available now — until [date]" | Amber |
| `next_available` is set and `next_available` ≤ 30 days from now | "Available from [date]" | Amber |
| `next_available` is set and `next_available` > 30 days from now | "Available from [date]" | Red |

### 2.4 Data Fetching

On page load:
```js
// Fetch all properties with their rooms
const { data: properties } = await supabase
  .from('properties')
  .select('*, rooms(*)')
  .order('name');
```

Single query, no auth required (anon key + existing RLS).

### 2.5 Mobile-First

- Cards stack single-column on mobile
- Property tabs scroll horizontally if needed
- Tap-to-expand cards (not hover)
- Photos in a horizontal scroll row within expanded cards
- FAQ as accordion (Radix UI Accordion — already in the project)

### 2.6 Styling

Follow existing site patterns:
- Tailwind CSS
- `max-w-7xl mx-auto` container
- `bg-[#f8f9ff]` page background
- Radix UI Tabs for property navigation
- Radix UI Accordion for FAQ
- `framer-motion` for card expand/collapse animation
- Material Symbols Outlined icons for amenity/facility chips
- `SEO` component with `noindex` meta tag (don't want Google indexing this)

### 2.7 i18n

Use `useLanguage()` hook for any static text labels, consistent with the rest of the site. Content data (descriptions, amenities) stays in English only.

---

## Part 3: Static Content

The following content is hardcoded in the component (same across all properties). Mark to review and adjust after initial build.

### Lease Terms
- Minimum stay: 6 months
- Deposit: 1 month rent (refundable)
- Notice period: 1 month
- Rent includes: WiFi, utilities (water, electricity with AC allowance), weekly common area cleaning, fully furnished room
- Rent excludes: Personal AC overage charges

### Move-in Process
1. Browse available rooms online or schedule a viewing
2. Choose your room and sign the licence agreement (digital)
3. Pay security deposit + first month's rent via bank transfer
4. Receive door code and move-in instructions
5. Move in on your start date

### FAQ (to be fleshed out)
- Can I have guests overnight?
- What's the WiFi speed?
- Is cooking allowed?
- How do I report a maintenance issue?
- Can I end my lease early?
- What happens to my deposit?
- Are utilities included?
- Is there parking?
- What's the AC usage policy?

---

## Implementation Order

1. **Database migration** — add columns to `rooms` and `properties`
2. **Seed data** — populate all 19 rooms and 3 properties with real details
3. **Build page** — StaffResourcePage component with tabs, cards, static sections
4. **Add route** — wire up `/staff` in App.jsx
5. **Test** — verify on mobile, check data renders correctly
