# Hyve Viewing Booking System — Page-by-Page Stitch Brief

Brand: Hyve co-living Singapore
Colors: Primary #006b5f (teal), Text #121c2a, Secondary text #6c7a77, Background #f8f9ff, Card bg white, Accent bg #eff4ff
Fonts: Plus Jakarta Sans (headings), Manrope (body), Inter (labels/small)
Icons: Material Symbols (filled)
Style: Clean, minimal, rounded-2xl cards, soft shadows, lots of whitespace. Mobile-first.

---

## Page 1: Schedule a Viewing — Website Form

**Location:** Modal or section on each property listing page (public website)
**URL:** hyve.sg/property/[slug] (button opens modal) OR hyve.sg/view/schedule/[property-slug]
**Auth:** None (public)

**Layout:**
- Full-width modal (mobile) or centered card (desktop, max-w-lg)
- Property photo banner at top (16:9, rounded top corners)
- Property name + address below photo
- Form fields stacked vertically
- Submit button at bottom, full-width

**Form Fields:**
1. **Full Name** — text input, required, placeholder "Your full name"
2. **Email** — email input, required, placeholder "your@email.com"
3. **WhatsApp Number** — tel input with +65 country prefix, required, placeholder "8XXX XXXX"
4. **Preferred Move-in Date** — date picker, optional, min = today + 14 days
5. **Room Type Preference** — select dropdown: "No preference", "Master Room", "Premium Room", "Standard Room"
6. **Monthly Budget** — select dropdown: "$800-1000", "$1000-1200", "$1200-1500", "$1500+"
7. **How did you find us?** — select dropdown: "Roomies", "Carousell", "Airbnb", "Facebook", "Friend/Referral", "Google", "Other"
8. **Anything else we should know?** — textarea, optional, 2 rows, placeholder "e.g. I have a pet, I need parking..."

**Submit Button:** "Request a Viewing" with calendar icon
**Loading state:** Button shows spinner, disabled

**Success State (replaces form):**
- Checkmark icon (circle with check, teal)
- "You're all set!"
- "Check your email to pick your available viewing times."
- "We'll match you with the house host and confirm within 24 hours."
- Small text: "Didn't get the email? Check spam or WhatsApp us at +65 8088 5410"

---

## Page 2: Prospect Availability Poll

**URL:** /view/poll/[token]
**Auth:** None (unique token access)
**Device:** Optimised for mobile, works on desktop

**Layout — Mobile:**
- Top: Hyve logo + property name
- Viewing type toggle
- Horizontally scrollable 7-day grid
- Sticky bottom bar with submit button

**Layout — Desktop:**
- Centered card (max-w-3xl)
- Full 7-day grid visible without scrolling

**Header Section:**
- Hyve logo (small, top-left)
- "Pick times you're free for a viewing"
- Property name + address in smaller text
- Small property photo (thumbnail)

**Viewing Type Toggle:**
- Two pill buttons side by side: "In Person" (icon: person) | "Virtual Tour" (icon: videocam)
- Default: In Person selected (teal fill)
- Unselected: white fill, teal border

**Availability Grid:**
- **Column headers:** 7 days starting from tomorrow, format "Mon 7 Apr"
- **Row headers:** 30-min slots from 10:00am to 7:30pm (20 rows)
- **Cells:** Tappable squares
  - Default: light grey (#f1f3f5)
  - Selected/available: teal (#006b5f) with white checkmark
  - Tap to toggle
- **Mobile:** Days scroll horizontally, time slots scroll vertically. Show 3 days at a time. Sticky time column on left.
- **Desktop:** Full 7-column grid visible

**Tip text below grid:** "Tap the times you're available. We'll find a slot that works for everyone."

**Bottom Bar (sticky on mobile):**
- Slot count: "5 slots selected"
- "Submit" button (full-width, teal, disabled until at least 1 slot selected)

**After Submit — Waiting State:**
- Replace grid with status card
- Clock icon
- "Thanks! We're matching your schedule with the host."
- "You'll get an email confirmation within 24 hours."
- "Need to change your times?" link → reopens grid

**After Submit — Instant Match State (if overlap found immediately):**
- Replace grid with confirmation card
- Party popper icon
- "Your viewing is confirmed!"
- Date + time in large text
- Viewing type badge (In Person / Virtual)
- Property address
- Door code in a copy-able box (tap to copy)
- "Added to your calendar" link (generates .ics file)
- Small text: "You'll also receive a confirmation email."

**Expired/Invalid Token State:**
- Sad face icon
- "This viewing link has expired."
- "Contact us at hello@hyve.sg or WhatsApp +65 8088 5410 to reschedule."

---

## Page 3: Captain Portal — Viewings Tab

**URL:** /portal/viewings (inside tenant portal, PortalLayout wrapper)
**Auth:** HOUSE_CAPTAIN role only
**Nav:** New "Viewings" item in sidebar with badge count for pending requests

**Layout:**
- Page title: "Viewings" with subtitle "Manage viewing requests for [Property Name]"
- Three tabs: "Incoming" | "Upcoming" | "Past"

### Tab: Incoming (default)

Shows viewing requests waiting for captain's availability.

**Empty state:** Illustration + "No viewing requests right now"

**Request Card:**
- Left: prospect avatar placeholder (initials circle, like portal profile)
- Right content:
  - Prospect name (bold)
  - Room: "Premium Room 2" or "No preference"
  - Viewing type badge: "In Person" (teal) or "Virtual" (blue)
  - Requested: "2 hours ago"
  - Move-in: "May 2026"
- Action button: "Mark Your Availability" (teal, full-width on mobile)
- Status pills: "Waiting for you" (amber) | "Waiting for prospect" (grey) | "Both submitted" (green)

**When "Mark Your Availability" is tapped:**
- Expands or navigates to availability grid (same 7-day grid as prospect page but inline in portal)
- Grid pre-filled if captain already submitted (can edit)
- Submit button: "Submit Availability"
- After submit: card moves to "waiting for match" state

### Tab: Upcoming

**Viewing Card:**
- Date + time (large, left side)
- Prospect name
- Room being viewed
- Viewing type badge
- "In 3 days" or "Tomorrow" or "Today" relative time
- If today: highlighted border (teal)

**Empty state:** "No upcoming viewings"

### Tab: Past

**Viewing Card (muted colors):**
- Date + time
- Prospect name
- Status badge: "Completed" (green) | "Cancelled" (red) | "No-show" (grey)

---

## Page 4: Captain Portal — Availability Grid (inline)

**Location:** Expands within the Incoming request card OR separate sub-page
**Same grid component as prospect poll page but:**
- Styled to match portal design (white card, portal fonts)
- No viewing type toggle (prospect already chose)
- Shows which type prospect selected at the top: "In Person viewing requested"
- Header: "When can you show [Prospect Name] around?"

---

## Page 5: Admin Portal — Viewings Management

**URL:** /portal/admin/viewings (inside admin portal)
**Auth:** ADMIN role only
**Nav:** Under "Manage" dropdown, new "Viewings" item with icon "visibility"

**Layout:**
- Page title: "Viewings" with subtitle "All viewing requests across properties"
- Filter bar: Property dropdown (All / TG / IH / CP) + Status dropdown (All / Requested / Polling / Confirmed / Completed / Cancelled)
- "Create Viewing" button (top-right, teal)
- Pipeline or list view toggle

### Pipeline View (default)

Kanban-style columns:
- **Requested** — new, no poll sent yet
- **Polling** — poll links sent, waiting for responses
- **Confirmed** — matched and booked
- **Completed** — viewing happened
- **Cancelled** — cancelled by any party

**Cards in pipeline:**
- Property badge (TG/IH/CP color-coded)
- Prospect name (bold)
- Room preference
- Viewing type icon
- Time since created / viewing date
- Poll progress: "Captain: responded | Prospect: waiting | Resident: responded"

Cards are draggable (for manual override).

### List View (toggle)

Table with columns: Date, Prospect, Property, Room, Type, Status, Poll Status, Actions

### Create Viewing Button → Opens Modal

Same fields as website form PLUS:
- Property selector (required — TG/IH/CP)
- Assign captain (auto-filled based on property, but overridable)
- "Send poll links" checkbox (default: checked)

---

## Page 6: Admin Portal — Viewing Detail

**URL:** /portal/admin/viewings/[id]
**Accessed by:** Clicking a card in the pipeline

**Layout:**
- Back arrow + "Viewing Detail"
- Two-column on desktop, stacked on mobile

**Left Column — Prospect Info:**
- Name, email, WhatsApp (clickable links)
- Preferred move-in, room preference, budget, source
- Notes field (editable)

**Right Column — Poll Status:**
- Visual status bar: Requested → Polling → Confirmed → Completed
- **Respondent cards (3):**
  - Captain: name, status (Responded ✓ / Waiting...), slots selected count
  - Prospect: name, status, slots selected count
  - Resident: name, status, slots selected count, "(courtesy)" label
- **Matched slot** (if found): Date + time in large text, green highlight
- **No match warning** (if poll expired): "No overlapping times found" with amber alert

**Actions bar:**
- "Force Book" — admin picks a specific slot and books it regardless of poll
- "Cancel Viewing" — cancels and notifies all parties
- "Resend Poll" — regenerates poll links and sends again
- "Send Reminder" — manual nudge to non-responders

**Timeline (bottom):**
- Activity log: "Poll created", "Captain responded", "Prospect responded", "Matched at 3:00pm Sat", "Confirmation emails sent", "Reminder sent"

---

## Page 7: Resident — Viewing Notification + Courtesy Poll

**Location:** Existing portal dashboard notification OR dedicated notification card

**Notification Card (on dashboard):**
- Icon: visibility (teal)
- "A prospective tenant would like to view your room"
- "Help us find a good time — mark when you're free (optional)"
- "Mark Availability" button → opens same 7-day grid
- If viewing already confirmed: shows date + time instead, with "Please ensure your room is tidy"

**In portal notifications bell:**
- "Viewing request for your room — mark your availability"
- "Viewing confirmed: [date] at [time]"
- "Viewing reminder: tomorrow at [time]"

---

## Page 8: Reminder Confirmation Page

**URL:** /view/confirm/[token]
**Auth:** None (unique token)
**Accessed from:** "Still coming?" link in reminder email

**Layout:** Simple centered card

**Content:**
- Hyve logo
- "Your viewing at [Property Name]"
- Date + time (large)
- Two buttons side by side:
  - "Yes, I'm coming!" (teal, filled) → updates DB, shows "See you there!" with confetti
  - "I need to reschedule" (white, outlined) → shows message: "Please WhatsApp us at +65 8088 5410 or email hello@hyve.sg to reschedule." (v1 — no self-service reschedule)

---

## Page 9: Email Templates (for reference, not portal pages)

All emails: Hyve logo header, teal accent, clean minimal layout, mobile-optimised.

### Email 1: Poll Invitation (to Prospect)
- Subject: "Pick your viewing times — [Property Name]"
- Hero: property photo
- Body: "Hi [Name], thanks for your interest in [Property Name]! Pick the times you're available and we'll match you with our house host."
- CTA button: "Choose Your Times" (teal)
- Footer: Property address + Hyve contact info

### Email 2: Poll Invitation (to Captain)
- Subject: "New viewing request — [Prospect Name]"
- Body: "[Prospect Name] wants to view [Room] at [Property]. Mark your available times so we can schedule."
- CTA button: "Mark Availability" → links to portal
- Prospect details: name, viewing type, preferred move-in

### Email 3: Poll Invitation (to Resident)
- Subject: "Someone wants to view your room"
- Body: "A prospective tenant is interested in your room at [Property]. If you'd like, mark times that work best for you (optional)."
- CTA button: "Mark Preferred Times" → links to portal
- Smaller text: "This is optional — we'll let you know once the viewing is confirmed."

### Email 4: Viewing Confirmed (to Prospect)
- Subject: "Viewing confirmed — [Date] at [Time]"
- Hero: property photo
- Body: confirmation details
- Info blocks: Date/Time | Address | Door Code (highlighted box) | Viewing Type | What to Bring (just yourself!)
- CTA: "Add to Calendar" (.ics download)
- Map embed or static map image of property location

### Email 5: Viewing Confirmed (to Captain)
- Subject: "Viewing confirmed — [Prospect] on [Date]"
- Body: Date/time + prospect name + room + viewing type
- "This viewing is [in person / virtual]. [You'll be showing the property / Join the video call]."

### Email 6: Viewing Confirmed (to Resident)
- Subject: "Room viewing on [Date] at [Time]"
- Body: "Your room will be viewed on [date] at [time]. Please ensure your room is tidy beforehand."
- Viewing type info

### Email 7: Reminder (to Prospect)
- Subject: "Viewing reminder — [today/tomorrow] at [Time]"
- Body: Recap of all details + door code
- Two CTA buttons: "I'm Coming!" (teal) | "Need to Reschedule" (outline)
- Address + door code repeated

### Email 8: Reminder (to Captain)
- Subject: "Viewing reminder — [Prospect] [today/tomorrow] at [Time]"
- Body: Prospect name + time + room + viewing type

---

## Shared Components

### Availability Grid Component
Used in: Prospect poll page, Captain portal, Resident portal, Admin force-book

**Props:**
- days: number of days to show (default 7)
- startDate: first day
- startHour / endHour: viewing window (default 10-20)
- slotMinutes: resolution (default 30)
- selectedSlots: pre-selected slots (for editing)
- readOnly: boolean (for viewing confirmed slot)
- onSubmit: callback

**Responsive behavior:**
- Mobile: horizontal scroll for days (3 visible), vertical scroll for times, sticky time column
- Desktop: all 7 days visible, compact grid

### Status Badge Component
Pill-shaped badges used across all views:
- Requested (grey)
- Polling (amber)
- Confirmed (teal)
- Completed (green)
- Cancelled (red)
- In Person (teal outline)
- Virtual (blue outline)

### Viewing Card Component
Used in: Captain portal, Admin pipeline, Dashboard notifications

**Props:**
- prospect name, property, room, viewing type, status, date, time
- Compact mode (for lists) vs expanded mode (for detail)
