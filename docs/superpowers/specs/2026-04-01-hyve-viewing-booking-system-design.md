# Hyve Viewing Booking System — Design Spec

## Goal

Replace the manual WhatsApp-based viewing coordination with a self-service booking system that automatically schedules viewings across 4 parties (prospect, admin, house captain, resident) using a When2Meet-style availability polling mechanism.

## Principles

- **No AI, just smart logic** — time-grid matching + automated notifications
- **No middleman for the happy path** — system handles scheduling, reminders, door codes
- **Respectful to residents** — they get the poll as courtesy, but can't block bookings
- **Email is the official channel** — all confirmations, reminders, door codes via email
- **Portal notifications for internal parties** — captain + resident see everything in their portal

## Parties Involved

| Party | Role | Poll Required | Can Block |
|-------|------|--------------|-----------|
| Prospect | Picks available slots + viewing type | Yes | Yes |
| House Captain | Picks available slots, shows the property | Yes | Yes |
| Resident | Picks available slots (courtesy) | Yes | No |
| Admin (Mark) | Always available, virtual presence | No | Override only |

## Entry Points

### 1. Website Form (public)

"Schedule a Viewing" button on each property listing page. Collects:

- **Name** (required)
- **Email** (required)
- **WhatsApp number** (required)
- **Preferred move-in date**
- **Room type preference** (Master / Premium / Standard)
- **Budget range**
- **Source** (Roomies / Carousell / Airbnb / Friend / Other)

On submit: creates viewing request in DB, sends email to prospect with poll link, notifies captain + resident via portal + email.

### 2. Admin Creates Manually

For prospects from WhatsApp, Roomies, Carousell, etc. Mark or Claudine enters prospect details in the admin portal → same flow kicks off.

## Core Flow

```
1. Prospect fills website form OR admin creates request manually
2. Viewing request created in DB (status: REQUESTED)
3. System generates unique poll tokens for prospect, captain, and resident
4. Notifications sent:
   - Prospect: email with poll link
   - Captain: portal notification + email with poll link
   - Resident: portal notification + email with poll link
5. All 3 fill in 30-min availability grid (7 days, 10am-8pm)
6. System finds overlap:
   a. PREFER: prospect + captain + resident all free
   b. FALLBACK: prospect + captain overlap (book anyway)
7. Auto-confirm:
   - Prospect: email with confirmation + door code + address + viewing type
   - Captain: portal notification + email confirmation
   - Resident: portal notification + email ("your room will be viewed")
   - Mark: Google Calendar invite for virtual presence
8. Status: CONFIRMED
9. Reminders (email + WhatsApp to prospect, portal + email to captain):
   - Afternoon viewing (12pm+): 9am same day
   - Morning viewing (before 12pm): 9pm night before
   - Content: "Your viewing is [today/tomorrow] at [time] — still coming?"
   - Includes confirm/reschedule link
10. Viewing happens
11. Status: COMPLETED
12. Claudine follows up with prospect via WhatsApp
```

## Poll Mechanics

### Grid Specification

- **Duration:** 7 days from request creation
- **Hours:** 10am to 8pm daily
- **Resolution:** 30-minute slots (20 slots per day, 140 total)
- **Viewing type selection:** Virtual / In-Person (prospect chooses at top of poll)

### Matching Algorithm

1. Collect all slots marked as available by each respondent
2. Find intersection of captain + prospect available slots
3. Among those, prefer slots where resident is also available
4. If multiple overlaps exist, pick the earliest one
5. Auto-book and confirm

### Expiry Rules

- Poll expires **48 hours** after creation if no overlap is found
- If one party hasn't responded after **24 hours**, send a nudge (email + portal)
- If poll expires with no match, notify admin to handle manually

### No Captain Fallback

If a property has no house captain assigned:
- Poll goes to prospect + resident only
- Viewing defaults to virtual (Mark does the video call)
- System checks Mark's Google Calendar for conflicts before confirming

## Reminder Rules

| Viewing Time | Reminder Time | Channels |
|-------------|--------------|----------|
| Morning (before 12pm) | 9pm night before | Email + WhatsApp (prospect), Portal + Email (captain) |
| Afternoon (12pm+) | 9am same day | Email + WhatsApp (prospect), Portal + Email (captain) |

Reminder includes a "Confirm / Reschedule" link. If prospect doesn't confirm, captain gets a heads-up that it might be a no-show.

## Data Model

### Extend `property_viewings` table

Add columns:
- `viewing_type` TEXT — 'virtual' or 'in_person'
- `room_id` UUID FK → rooms — which room is being viewed
- `prospect_whatsapp` TEXT
- `preferred_move_in` DATE
- `room_preference` TEXT — 'master', 'premium', 'standard', or null
- `budget` TEXT
- `source` TEXT — 'website', 'roomies', 'carousell', 'airbnb', 'friend', 'manual', 'other'
- `reminder_sent` BOOLEAN DEFAULT false
- `prospect_confirmed_attending` BOOLEAN — null = not yet, true = confirmed, false = cancelled
- `captain_id` UUID FK → tenant_profiles — house captain assigned
- `resident_id` UUID FK → tenant_profiles — current room occupant
- `calendar_event_id` TEXT — Google Calendar event ID
- `completed_at` TIMESTAMPTZ
- `notes` TEXT

### New `viewing_polls` table

```sql
CREATE TABLE viewing_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewing_id UUID REFERENCES property_viewings(id) NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'matched', 'confirmed', 'expired', 'cancelled')),
  poll_start DATE NOT NULL,
  poll_end DATE NOT NULL,
  viewing_type TEXT CHECK (viewing_type IN ('virtual', 'in_person')),
  matched_slot TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  nudge_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### New `viewing_poll_responses` table

```sql
CREATE TABLE viewing_poll_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES viewing_polls(id) NOT NULL,
  respondent_type TEXT NOT NULL CHECK (respondent_type IN ('prospect', 'captain', 'resident')),
  respondent_token TEXT NOT NULL,
  respondent_email TEXT,
  slot_start TIMESTAMPTZ NOT NULL,
  available BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMPTZ DEFAULT now()
);
```

Each respondent gets a unique token. When they fill in the grid, one row per slot they mark as available. Index on `(poll_id, slot_start, available)` for fast overlap queries.

### Overlap Query

```sql
-- Find slots where captain + prospect are both free
-- Prefer slots where resident is also free
SELECT 
  c.slot_start,
  CASE WHEN r.slot_start IS NOT NULL THEN true ELSE false END as resident_available
FROM viewing_poll_responses c
JOIN viewing_poll_responses p 
  ON p.poll_id = c.poll_id 
  AND p.slot_start = c.slot_start 
  AND p.respondent_type = 'prospect' 
  AND p.available = true
LEFT JOIN viewing_poll_responses r 
  ON r.poll_id = c.poll_id 
  AND r.slot_start = c.slot_start 
  AND r.respondent_type = 'resident' 
  AND r.available = true
WHERE c.poll_id = $1
  AND c.respondent_type = 'captain'
  AND c.available = true
ORDER BY resident_available DESC, c.slot_start ASC
LIMIT 1;
```

## Resident Notification

Resident notifications use the existing portal notification system (bell icon). No dedicated page or card.

- **When poll is created:** Notification: "A prospective tenant would like to view your room. Mark when you're free (optional)." — links to availability grid. Urgency: normal.
- **When viewing is confirmed:** Notification: "Viewing confirmed for your room on [date] at [time]. Please ensure your room is tidy." Urgency: high.
- **Reminder:** Notification: "Viewing reminder: [today/tomorrow] at [time]." Urgency: high.

All also sent via email.

## Interfaces

### A) Website "Schedule a Viewing" Form

Location: each property listing page (public website)

- "Schedule a Viewing" CTA button
- Opens modal or dedicated page with form fields (see Entry Points above)
- On submit: "Thanks! Check your email to pick your available times."
- Form data creates viewing request + triggers poll creation

### B) Prospect Poll Page

Route: `/view/poll/:token` (public, no login, unique token)

- Mobile-first responsive design
- **Header:** "Pick times you're available for a viewing at [Property Name]"
- **Viewing type toggle:** Virtual / In-Person
- **7-day grid:** columns = days, rows = 30-min slots (10am-8pm)
- Tap to toggle green (available) / grey (unavailable)
- "Submit" button
- After submit: "We'll match you with the host and confirm within 24 hours."
- If captain already submitted and there's an overlap → instant confirmation on screen

### C) Captain Portal View

Location: tenant portal, visible to HOUSE_CAPTAIN role only

New "Viewings" nav item with sub-sections:

**Incoming Requests:**
- Card per pending request: prospect name, room, date requested
- "Mark Your Availability" button → opens 7-day grid (same as prospect but inline in portal)
- Badge count on nav item for unresponded requests

**Upcoming Viewings:**
- List of confirmed viewings: date, time, prospect name, room, viewing type (virtual/in-person)
- "Cancel" option

**Past Viewings:**
- History list with dates and prospect names

### D) Admin Portal View

Location: admin portal, new "Viewings" section under Manage dropdown

**Pipeline view:**
- Columns: Requested → Polling → Confirmed → Completed → Cancelled
- Cards move through pipeline as status changes
- Each card shows: prospect name, property, room preference, viewing type, poll status

**Create Viewing:**
- Manual form with same fields as website form
- For prospects from non-website channels (WhatsApp, Roomies, Carousell)

**Viewing Detail:**
- See poll responses (who's responded, who hasn't)
- Override: force-book a slot, cancel, reassign captain
- Prospect contact info (email, WhatsApp)

### E) Resident Notifications

When a viewing is confirmed for their room:
- **Portal notification:** "Your room (IH-PR2) will be viewed on [date] at [time]. Please ensure the room is tidy."
- **Email:** Same content + viewing type + address

Resident also receives the poll link to mark courtesy availability, but their response is nice-to-have, not required.

## Email Templates

All emails sent from `hello@hyve.sg` (or `noreply@hyve.sg`), branded with Hyve logo.

### 1. Poll Invitation (Prospect)
Subject: "Pick your viewing times — [Property Name]"
Body: Brief intro + link to poll page + property address + photo

### 2. Poll Invitation (Captain)
Subject: "New viewing request — [Property Name]"
Body: Prospect name + room + link to portal + "Mark your availability"

### 3. Poll Invitation (Resident)
Subject: "Upcoming viewing for your room"
Body: "A prospective tenant wants to view your room. Mark your preferred times (optional)" + poll link

### 4. Viewing Confirmed (Prospect)
Subject: "Viewing confirmed — [Property Name] on [Date]"
Body: Date/time + address + door code + viewing type + what to expect + captain name

### 5. Viewing Confirmed (Captain)
Subject: "Viewing confirmed — [Prospect Name] on [Date]"
Body: Date/time + prospect name + room + viewing type

### 6. Viewing Confirmed (Resident)
Subject: "Room viewing scheduled — [Date]"
Body: Date/time + "Please ensure your room is tidy" + viewing type

### 7. Reminder (Prospect)
Subject: "Viewing reminder — [tomorrow/today] at [time]"
Body: Confirmation details + "Still coming?" confirm/reschedule link + door code

### 8. Reminder (Captain)
Subject: "Viewing reminder — [Prospect] [tomorrow/today] at [time]"
Body: Prospect name + time + room + viewing type

## Virtual Viewings

When viewing type is "virtual":
- System auto-creates a Google Meet link via Google Calendar API when the viewing is confirmed
- Confirmation email includes "Join Google Meet" button with the link
- Reminder email also includes the Meet link
- Captain receives the Meet link in their confirmation
- Address + door code are still included (prospect may want to visit the area)

## Door Codes

Stored per-property in the DB. Sent to prospect only in the confirmation email and reminder email. Not shown on the poll page.

| Property | Door Code |
|----------|-----------|
| Ivory Heights | 808855 |
| Thomson Grove | 808856 |
| Chiltern Park | 112233# |

Room-specific door codes to be added later when available.

## Viewing Hours & Constraints

- **Viewing window:** 10am — 8pm daily
- **Slot duration:** 30 minutes
- **Minimum lead time:** 2 working days from request
- **Poll expiry:** 48 hours after creation
- **Nudge:** 24 hours after poll creation if a party hasn't responded
- **No double-booking:** only one viewing per property per 30-min slot

## Tech Stack

- **Frontend:** React (existing hyve-website codebase) + Tailwind + shadcn/ui
- **Backend:** Supabase (IoT project `diiilqpfmlxjwiaeophb`)
- **Email:** Supabase Edge Function + Resend (or similar free-tier email service)
- **Calendar:** Google Calendar API (existing MCP integration for Mark's calendar)
- **WhatsApp reminders:** Claudine sends via Beeper/WhatsApp MCP (not automated in the system — Claudine handles this)

## RLS Policies

- Prospect poll pages: accessed via unique token, no auth required
- Captain: can see viewings for their own property only
- Resident: can see viewing notifications for their own room only
- Admin: can see all viewings across all properties

## Out of Scope (v1)

- Automated WhatsApp messaging (Claudine handles follow-up manually)
- Prospect accounts / login
- Video call integration (captain/Mark use WhatsApp video directly)
- Analytics / conversion tracking dashboard
- Multi-room viewing in single session
- Recurring availability (captain sets per-viewing, not standing hours)
