# Tenant Onboarding Rollout + Property Guides

**Date:** 2026-04-01
**Status:** Draft
**Domain:** hyve-website.vercel.app (switching to lazybee.sg on April 4)

---

## Problem

16 active tenants across 3 Hyve properties have never logged into the tenant portal. Most were bulk-seeded into the IoT DB with incomplete data. Tenants are already asking for documents (signed TAs) and there's no self-service way to access property info, submit issues, or find condo-specific guides (e.g. IH access card replacement). Mark is handling everything manually over WhatsApp.

## Goals

1. Get all active tenants onboarded through the full 7-step portal flow
2. Add a persistent Property Guide page tenants can access anytime after onboarding
3. Establish a self-service hierarchy: FAQ → Ticket → Contact Hyve (calling Mark is last resort)
4. Assign Edward Jeremy Lo as IH house captain with appropriate permissions
5. Send invite messages to all IH tenants via Beeper (Claudine sends after Mark approves template)

## Out of Scope

- Viewing booking system (Spec B — separate)
- Stripe/payment configuration
- AC monitoring hardware setup
- New features in the ticketing system itself
- TG and CP onboarding messages (IH first, others follow same pattern)

### Future Enhancements (Approach 3 — revisit later)

- Admin UI for editing property guide content
- Announcements system (push notifications for rule changes, maintenance windows)
- Improved document management (categorised docs, expiry tracking)
- Tenant FAQ chatbot
- House rules versioning UI with re-acknowledgement prompts
- Video/multimedia support in guides
- Tenant-to-tenant messaging or community board

---

## Part 1: Database Sync + Reset

### 1.1 Sync IoT DB with Millia DB

The IoT Supabase (`diiilqpfmlxjwiaeophb`) tenant_profiles table is out of sync with the Millia Supabase (`jxexqzempkyjgbdwrpyl`) reservations table. Update IoT DB to match reality.

**IH tenant roster (from Millia DB — source of truth):**

| Room | Tenant | Phone | Email | Checkout | Action |
|------|--------|-------|-------|----------|--------|
| IH-PR1 | Dev | +6580892946 | aganguli.me@gmail.com | May 5 | Update profile |
| IH-PR2 | Edward Jeremy Lo | +6583654765 | edwardjeremylo@gmail.com | Jul 12 | Set as HOUSE_CAPTAIN |
| IH-PR3 | Siti Syafiqah | +6593479923 | sitisyafiqahrazali@gmail.com | Feb 2028 | Update profile |
| IH-STD1 | Newtron | +6591977675 | johnnewton0000@gmail.com | Sep 30 | Update profile (name was "Nattakan" in IoT DB) |
| IH-STD2 | Paul | +6591296671 | pp.2017tg@gmail.com | Sep 30 | Update profile |
| IH-STD3 | Jessi Dang | +6590979001 | nganorjessi.dang@gmail.com | Jun 20 | Update profile |
| IH-STD4 | Ciara | +6580574663 | adriifaell@outlook.com | Apr 20 | Update profile (leaving soon) |

**TG tenant roster:**

| Room | Tenant | Phone | Email | Checkout | Action |
|------|--------|-------|-------|----------|--------|
| TG-MR | Rhea Sale Canlas | — | — | Mar 2027 | New profile (moves in Apr 1) |
| TG-PR1 | Karina | — | kasadew10@gmail.com | Oct 1 | Update profile |
| TG-PR2 | Winsten | +6583816608 | pankusya@gmail.com | Oct 31 | Update profile |
| TG-PR3 | Sophia | +6580899420 | sophialiannec@gmail.com | Aug 14 | Update profile |
| TG-PR3 | Rebekah Fung Pei Ern | +6582232248 | livespages@gmail.com | Apr 2028 | New profile (moves in Apr 1) |
| TG-STD1 | Md Abidul | — | — | Jun 14 | New profile |

**CP tenant roster:**

| Room | Tenant | Phone | Email | Checkout | Action |
|------|--------|-------|-------|----------|--------|
| CP-PR1 | Heckman David John & Lindsey Riese | +6588407929 | david.heckmaniii@ehl.ch | Aug 11 | Update profile |
| CP-PR2 | Toh Ling Shuang | — | t.lingshuang@gmail.com | Jun 1 | Update profile |
| CP-PR3 | Polina | +14376061314 | polinalih22@gmail.com | Jul 31 | Update profile |
| CP-PR4 | Anuskha | +6584212565 | anushkagoyal004@gmail.com | Dec 31 | Update profile |

**Cleanup:**
- Delete duplicate/stale profiles (e.g. empty profiles stuck at PERSONAL_DETAILS with no name)
- Set `is_active: false` for moved-out tenants: Zhang Jiahao (CP-MR), Larry (TG-STD1), Firdaus (TG-STD2)
- CP-MR Zhang Jiahao: checkout was Mar 23 — skip onboarding entirely

### 1.2 Reset Onboarding

For all active tenants:
1. Reset `onboarding_progress.current_step` to `PERSONAL_DETAILS`
2. Reset `onboarding_progress.status` to `ONBOARDING`
3. Generate fresh `invite_token` in `tenant_profiles`
4. Clear any stale onboarding data (unsigned TAs, unverified deposits) so they start clean

### 1.3 House Captain Setup

Set Edward Jeremy Lo (IH-PR2) to `role: 'HOUSE_CAPTAIN'` in tenant_profiles.

**House captain permissions (already implemented in portal):**
- `/portal/property` — see all rooms in their property (occupancy, status)
- `/portal/property/tickets` — triage maintenance tickets, assign to vendors
- `/portal/property/tenants` — see tenant list for their property

**House captain does NOT have access to:**
- Billing amounts / rent for other tenants
- Admin controls (announcements, onboarding management, devices, financials)
- Other properties

---

## Part 2: Property Guide Page

### 2.1 Overview

A new portal page at `/portal/guide` accessible from the sidebar navigation. Shows property-specific information for the tenant's assigned property. Visual style matches the existing viewing brief page (`/view/:id`) — clean card sections with Material icons.

### 2.2 Page Sections

Rendered as card sections, ordered top to bottom:

| Order | Section | Icon | Content | Source |
|-------|---------|------|---------|--------|
| 1 | WiFi | wifi | Network name + password | `property_guides` table (seeded from known values: Network "Hyve", Password "Thehyve2027@") |
| 2 | Your Property | home | Address, unit number, building info | Property data |
| 3 | House Captain | person | Name, phone, role description | Auto-populated from HOUSE_CAPTAIN role in tenant_profiles |
| 4 | Building Guide | badge | Property-specific instructions (IH: access card replacement + stamping service) | `property_guides` table |
| 5 | Nearby | restaurant | MRT stations, food, supermarket, amenities | `property_guides` table |
| 6 | House Rules | gavel | Re-read the rules they acknowledged during onboarding | Existing `house_rules` table |
| 7 | FAQ | help | Common questions — AC billing, rent payment, noise policy, guest policy, etc. | `property_guides` table |
| 8 | Submit an Issue | build | CTA linking to `/portal/issues/new` — for maintenance, repairs, complaints | Static link |
| 9 | Contact Hyve | support | WhatsApp +65 8088 5410 — with note: "Checked the FAQ and tickets first?" | Static |

### 2.3 IH Building Guide Content

**Access Card Replacement:**
1. Download your signed Tenancy Agreement from the portal (Dashboard → Documents)
2. Get it stamped at IRAS (you can do this yourself, or we can handle it for $30 — takes 2 working days)
3. To request our stamping service: submit a ticket under "Admin / Documents" category
4. Once you have your stamped TA + stamp certificate, bring both documents to the Ivory Heights management office
5. The management office will issue your new access card

### 2.4 IH FAQ Content (initial set)

- **How do I pay rent?** — Bank transfer details are in your Tenancy Agreement. Pay by the 1st of each month.
- **What's included in rent?** — Utilities, WiFi, weekly common area cleaning, maintenance.
- **How does AC billing work?** — 300 free hours/month. Overage charged at $0.30/hour. Check your usage on the Dashboard.
- **Can I have guests stay over?** — Overnight guests allowed up to 2 nights/week. Inform your house captain.
- **What about noise?** — Quiet hours after 10pm. Use headphones for music/calls.
- **How do I report a maintenance issue?** — Submit a ticket via the portal (Issues → New Issue). Select category and attach photos.
- **How do I get a replacement access card?** — See Building Guide above.
- **What's the stamping service?** — We handle IRAS stamping of your TA for $30. Submit a ticket to request it. Takes 2 working days.

### 2.5 Data Model

New table in IoT Supabase: `property_guides`

```sql
CREATE TABLE property_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) NOT NULL,
  section TEXT NOT NULL,          -- 'wifi', 'building_guide', 'nearby', 'faq', 'property_info'
  title TEXT NOT NULL,
  content TEXT NOT NULL,           -- Markdown or plain text
  icon TEXT DEFAULT 'info',        -- Material icon name
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

FAQ entries stored as JSON array within the `faq` section content:
```json
[
  {"question": "How do I pay rent?", "answer": "Bank transfer to..."},
  {"question": "How does AC billing work?", "answer": "300 free hours..."}
]
```

RLS: Tenants can read guides for their own property only. Admins can read/write all.

### 2.6 Pre-Move-In Guide (Onboarding Welcome Page)

Shown as the first thing tenants see after creating their account, before step 1 (Personal Details). A "Welcome aboard" splash page styled like the viewing brief — clean, visual, practical.

**Sections:**

| Order | Section | Icon | Content |
|-------|---------|------|---------|
| 1 | Welcome | celebration | "Welcome to Hyve at [Property Name]!" — brief intro |
| 2 | What to Bring | luggage | Bedding (optional — provided?), personal toiletries, any personal items |
| 3 | What's Provided | inventory_2 | Furnished room, WiFi, kitchen appliances, washing machine, cleaning supplies |
| 4 | Check-In Instructions | door_front | Address, how to get there, door code / key collection, security gate instructions |
| 5 | Documents You'll Need | description | IC/Passport (for ID verification step), bank details (for deposit), emergency contact info |
| 6 | House Rules Preview | gavel | Brief summary — quiet hours, guest policy, cleanliness expectations |
| 7 | Your House Captain | person | Name + contact — your first point of contact for day-to-day questions |
| 8 | Nearby Essentials | map | Closest MRT, supermarket, pharmacy, food |
| 9 | Let's Get Started | arrow_forward | CTA button → proceeds to step 1 (Personal Details) |

**Implementation:**
- New step `WELCOME` inserted before `PERSONAL_DETAILS` in the onboarding flow
- No data entry required — just a "Continue" button
- Content pulled from `property_guides` table (section type `welcome_*`)
- Does NOT count as a formal onboarding step in the progress tracker — it's a read-only splash

### 2.7 Navigation

Add "My Property" link to the portal sidebar (`PortalLayout.jsx`) for all roles:
- Icon: `home`
- Label: "My Property"
- Route: `/portal/guide`
- Position: after Dashboard, before Billing

---

## Part 3: Invite Messages via Beeper

### 3.1 Message Template (IH)

Sent from Claudine via Beeper to each tenant's WhatsApp number. Five messages per tenant:

**Message 1:**
> Hey [Name]! This is Claudine from Hyve. We've just launched our tenant portal — it's where you'll manage everything for your stay.

**Message 2:**
> Here's your invite link to set up your account: https://hyve-website.vercel.app/portal/signup?token=[token]

**Message 3:**
> Once you're in you can:
> - Download your signed Tenancy Agreement
> - Submit maintenance issues (gets assigned to vendors directly)
> - Track your AC usage and billing
> - Access your property guide (WiFi, building info, etc.)

**Message 4 (IH only):**
> Quick heads up — if you need a replacement access card, the process is: download your TA from the portal, get it stamped at IRAS (or we can do it for $30, takes 2 working days), then bring both docs to the management office.

**Message 5:**
> Any questions just ping me here. Edward is also your house captain so he can help with day-to-day stuff at the apartment.

**Note:** After April 4, all invite links switch to `lazybee.sg` domain.

### 3.2 Edward's Message (IH-PR2)

Edward gets a slightly different message since he's house captain:

**Message 1:**
> Hey Edward! This is Claudine from Hyve. We've just launched our tenant portal and you've been set up as the house captain for Ivory Heights.

**Message 2:**
> Here's your invite link: https://hyve-website.vercel.app/portal/signup?token=[token]

**Message 3:**
> As house captain you can:
> - See all rooms and tenants in the apartment
> - Triage maintenance tickets and assign to vendors
> - Access the full property guide
> - Plus everything regular tenants get (TA download, AC usage, billing)

**Message 4:**
> The other tenants will also be getting their invite links today. They'll be told you're the house captain for day-to-day stuff.

**Message 5:**
> Any questions just ping me here!

### 3.3 Delivery Order

1. Send Edward's messages first (so he's aware before others mention him)
2. Then remaining IH tenants in room order: Dev, Siti Syafiqah, Newtron, Paul, Jessi Dang, Ciara

### 3.4 Beeper Send Flow

For each tenant:
1. Look up their WhatsApp chat by phone number via `mcp__beeper__get_direct_chat_by_contact` or `mcp__beeper__search_contacts`
2. Send each message sequentially via `mcp__beeper__send_message`
3. Short pause between messages for natural pacing

---

## Part 4: Viewing Booking System (Spec B — Future)

Parked for a separate spec. Key requirements captured:
- Self-service booking on the portal/public site
- Three-way availability matching: Mark + house captain + prospect
- House captains set their available times (in-person / virtual)
- Syncs with Mark's Google Calendar
- Auto follow-up to all parties (confirmation, reminders, post-viewing)
- Email reminders

---

## Technical Notes

- **Vercel serverless limit:** 12/12 functions used. The property guide page is client-side only (reads from Supabase directly via existing client). No new API routes needed.
- **No new dependencies required.** Uses existing Supabase client, shadcn/ui components, Material icons.
- **Portal route addition:** One new route in App.jsx (`/portal/guide` → PropertyGuidePage), one new page component, one new sidebar link.
- **DB migration:** One new table (`property_guides`) + seed data for IH. Applied via `mcp__supabase__apply_migration`.
- **Domain:** Links use `hyve-website.vercel.app` until April 4, then `lazybee.sg`.
