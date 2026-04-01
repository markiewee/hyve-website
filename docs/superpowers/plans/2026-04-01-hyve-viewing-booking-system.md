# Hyve Viewing Booking System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-service viewing booking system with When2Meet-style availability polling across prospect, house captain, and resident.

**Architecture:** Supabase tables for viewing requests + polls + responses. Public token-based poll pages (no auth). Portal pages for captain and admin. Matching algorithm runs client-side after each poll submission. Email skipped for v1 — Claudine handles notifications via WhatsApp.

**Tech Stack:** React 19 + Vite + Tailwind v4 + shadcn/ui, Supabase (IoT project `diiilqpfmlxjwiaeophb`), existing portal patterns (PortalLayout, useAuth, AuthGuard).

**Key constraint:** 2-day minimum lead time — availability grid starts from today + 2 days.

**Stitch HTML templates:** `/Users/mark/Desktop/hyve-viewing-screens/` — use these as visual reference for component styling.

---

## File Structure

### New Files
| File | Purpose |
|------|---------|
| `src/hooks/useViewings.js` | Hook to fetch/create/update viewings + polls |
| `src/hooks/useViewingPoll.js` | Hook for poll page — fetch poll by token, submit responses, run matching |
| `src/components/viewing/AvailabilityGrid.jsx` | Shared When2Meet-style grid component (used by prospect poll, captain portal, admin force-book) |
| `src/components/viewing/ViewingCard.jsx` | Shared card component for viewing requests |
| `src/components/viewing/StatusBadge.jsx` | Pill badges for viewing/poll status |
| `src/pages/viewing/ViewingPollPage.jsx` | Public prospect poll page (`/view/poll/:token`) |
| `src/pages/viewing/ViewingConfirmPage.jsx` | Public "still coming?" confirmation page (`/view/confirm/:token`) |
| `src/pages/viewing/ScheduleViewingPage.jsx` | Public booking form page (`/view/schedule/:propertySlug/:roomSlug?`) |
| `src/pages/portal/CaptainViewingsPage.jsx` | Captain's Viewings tab in portal |
| `src/pages/portal/AdminViewingsPageV2.jsx` | Replaces existing AdminViewingsPage with pipeline view |
| `src/pages/portal/AdminViewingDetailPage.jsx` | Admin viewing detail with poll status + timeline |

### Modified Files
| File | Change |
|------|--------|
| `src/App.jsx` | Add routes for new pages |
| `src/components/portal/PortalLayout.jsx` | Add "Viewings" nav item for HOUSE_CAPTAIN |
| `src/components/PropertyDetailPageWithSanity.jsx` | Add "Schedule a Viewing" button linking to form |

---

## Task 1: Database Migration — Extend property_viewings + Create poll tables

**Files:**
- Create: Migration via Supabase MCP `apply_migration`

- [ ] **Step 1: Run migration to extend property_viewings and create poll tables**

```sql
-- Extend property_viewings with new columns
ALTER TABLE property_viewings
  ADD COLUMN IF NOT EXISTS viewing_type TEXT DEFAULT 'in_person' CHECK (viewing_type IN ('virtual', 'in_person')),
  ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id),
  ADD COLUMN IF NOT EXISTS prospect_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS preferred_move_in DATE,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' CHECK (source IN ('website', 'roomies', 'carousell', 'airbnb', 'friend', 'manual', 'other')),
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS prospect_confirmed_attending BOOLEAN,
  ADD COLUMN IF NOT EXISTS captain_id UUID REFERENCES tenant_profiles(id),
  ADD COLUMN IF NOT EXISTS resident_id UUID REFERENCES tenant_profiles(id),
  ADD COLUMN IF NOT EXISTS calendar_event_id TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create viewing_polls table
CREATE TABLE IF NOT EXISTS viewing_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewing_id UUID REFERENCES property_viewings(id) NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'matched', 'confirmed', 'expired', 'cancelled')),
  poll_start DATE NOT NULL,
  poll_end DATE NOT NULL,
  viewing_type TEXT CHECK (viewing_type IN ('virtual', 'in_person')),
  matched_slot TIMESTAMPTZ,
  prospect_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  captain_token TEXT DEFAULT encode(gen_random_bytes(16), 'hex'),
  resident_token TEXT DEFAULT encode(gen_random_bytes(16), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL,
  nudge_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create viewing_poll_responses table
CREATE TABLE IF NOT EXISTS viewing_poll_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES viewing_polls(id) NOT NULL,
  respondent_type TEXT NOT NULL CHECK (respondent_type IN ('prospect', 'captain', 'resident')),
  slot_start TIMESTAMPTZ NOT NULL,
  available BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_poll_responses_overlap 
  ON viewing_poll_responses(poll_id, slot_start, available) 
  WHERE available = true;

CREATE INDEX IF NOT EXISTS idx_polls_viewing 
  ON viewing_polls(viewing_id);

CREATE INDEX IF NOT EXISTS idx_polls_tokens 
  ON viewing_polls(prospect_token);

CREATE INDEX IF NOT EXISTS idx_viewings_status 
  ON property_viewings(status);

-- RLS policies
ALTER TABLE viewing_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE viewing_poll_responses ENABLE ROW LEVEL SECURITY;

-- Public read for poll pages (token-based access)
CREATE POLICY "Anyone can read polls by token" ON viewing_polls
  FOR SELECT USING (true);

CREATE POLICY "Anyone can read poll responses" ON viewing_poll_responses
  FOR SELECT USING (true);

-- Anyone can insert poll responses (public poll pages)
CREATE POLICY "Anyone can submit poll responses" ON viewing_poll_responses
  FOR INSERT WITH CHECK (true);

-- Authenticated users can manage viewings
CREATE POLICY "Authenticated users can read viewings" ON property_viewings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert viewings" ON property_viewings
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update viewings" ON property_viewings
  FOR UPDATE TO authenticated USING (true);

-- Public can insert viewings (website form)
CREATE POLICY "Public can create viewing requests" ON property_viewings
  FOR INSERT TO anon WITH CHECK (true);

-- Public can read own viewing by token
CREATE POLICY "Public can read viewings by token" ON property_viewings
  FOR SELECT TO anon USING (true);

-- Authenticated can manage polls
CREATE POLICY "Authenticated users can manage polls" ON viewing_polls
  FOR ALL TO authenticated USING (true);

-- Public can update poll status (for matching after response submission)
CREATE POLICY "Anyone can update polls" ON viewing_polls
  FOR UPDATE USING (true);
```

- [ ] **Step 2: Verify tables created**

Query `SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'viewing%'` — should return `viewing_polls` and `viewing_poll_responses`.

- [ ] **Step 3: Commit**

```
feat: add viewing booking system DB schema — polls + responses tables
```

---

## Task 2: useViewings Hook

**Files:**
- Create: `src/hooks/useViewings.js`

- [ ] **Step 1: Create the hook**

```javascript
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

export function useViewings(filters = {}) {
  const [viewings, setViewings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchViewings = useCallback(async () => {
    let query = supabase
      .from("property_viewings")
      .select("*, properties(name, code), rooms(name, unit_code), viewing_polls(*)")
      .order("created_at", { ascending: false });

    if (filters.propertyId) query = query.eq("property_id", filters.propertyId);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.captainId) query = query.eq("captain_id", filters.captainId);

    const { data, error } = await query;
    if (error) console.error("Error fetching viewings:", error);
    setViewings(data ?? []);
    setLoading(false);
  }, [filters.propertyId, filters.status, filters.captainId]);

  useEffect(() => { fetchViewings(); }, [fetchViewings]);

  async function createViewing(viewingData) {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(36)).join("").slice(0, 8);
    
    // Find captain for property
    const { data: captain } = await supabase
      .from("tenant_profiles")
      .select("id")
      .eq("property_id", viewingData.property_id)
      .eq("role", "HOUSE_CAPTAIN")
      .eq("is_active", true)
      .maybeSingle();

    // Find resident for room
    let resident = null;
    if (viewingData.room_id) {
      const { data: res } = await supabase
        .from("tenant_profiles")
        .select("id")
        .eq("room_id", viewingData.room_id)
        .eq("role", "TENANT")
        .eq("is_active", true)
        .maybeSingle();
      resident = res;
    }

    const { data: viewing, error } = await supabase
      .from("property_viewings")
      .insert({
        ...viewingData,
        token,
        status: "REQUESTED",
        captain_id: captain?.id ?? null,
        resident_id: resident?.id ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    // Create poll
    const now = new Date();
    const pollStart = new Date(now);
    pollStart.setDate(pollStart.getDate() + 2); // 2-day lead time
    const pollEnd = new Date(pollStart);
    pollEnd.setDate(pollEnd.getDate() + 7);
    const expiresAt = new Date(now);
    expiresAt.setHours(expiresAt.getHours() + 48);

    const { data: poll, error: pollError } = await supabase
      .from("viewing_polls")
      .insert({
        viewing_id: viewing.id,
        poll_start: pollStart.toISOString().split("T")[0],
        poll_end: pollEnd.toISOString().split("T")[0],
        viewing_type: viewingData.viewing_type ?? "in_person",
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (pollError) throw pollError;

    // Update viewing status to POLLING
    await supabase
      .from("property_viewings")
      .update({ status: "POLLING" })
      .eq("id", viewing.id);

    await fetchViewings();
    return { viewing, poll };
  }

  async function updateViewing(id, updates) {
    const { error } = await supabase
      .from("property_viewings")
      .update(updates)
      .eq("id", id);
    if (error) throw error;
    await fetchViewings();
  }

  async function cancelViewing(id) {
    await supabase.from("property_viewings").update({ status: "CANCELLED" }).eq("id", id);
    // Also cancel associated poll
    await supabase.from("viewing_polls").update({ status: "cancelled" }).eq("viewing_id", id);
    await fetchViewings();
  }

  async function forceBook(viewingId, slot) {
    await supabase.from("property_viewings").update({
      status: "CONFIRMED",
      viewing_date: slot.toISOString().split("T")[0],
      viewing_time: slot.toTimeString().slice(0, 5),
    }).eq("id", viewingId);

    await supabase.from("viewing_polls").update({
      status: "confirmed",
      matched_slot: slot.toISOString(),
    }).eq("viewing_id", viewingId);

    await fetchViewings();
  }

  return { viewings, loading, createViewing, updateViewing, cancelViewing, forceBook, refetch: fetchViewings };
}
```

- [ ] **Step 2: Commit**

```
feat: add useViewings hook for viewing CRUD + poll creation
```

---

## Task 3: useViewingPoll Hook

**Files:**
- Create: `src/hooks/useViewingPoll.js`

- [ ] **Step 1: Create the hook**

```javascript
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useViewingPoll(token, respondentType) {
  const [poll, setPoll] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [property, setProperty] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [matchedSlot, setMatchedSlot] = useState(null);

  useEffect(() => {
    if (!token) return;
    fetchPoll();
  }, [token]);

  async function fetchPoll() {
    // Find poll by token (could be prospect, captain, or resident token)
    const tokenField = respondentType === "captain" ? "captain_token"
      : respondentType === "resident" ? "resident_token"
      : "prospect_token";

    const { data: pollData, error } = await supabase
      .from("viewing_polls")
      .select("*, property_viewings(*, properties(name, code), rooms(name, unit_code))")
      .eq(tokenField, token)
      .single();

    if (error || !pollData) {
      setLoading(false);
      return;
    }

    setPoll(pollData);
    setViewing(pollData.property_viewings);
    setProperty(pollData.property_viewings?.properties);

    // Check if this respondent already submitted
    const { data: existing } = await supabase
      .from("viewing_poll_responses")
      .select("*")
      .eq("poll_id", pollData.id)
      .eq("respondent_type", respondentType);

    if (existing && existing.length > 0) {
      setSubmitted(true);
      setResponses(existing);
    }

    if (pollData.matched_slot) {
      setMatchedSlot(new Date(pollData.matched_slot));
    }

    setLoading(false);
  }

  async function submitAvailability(selectedSlots, viewingType) {
    if (!poll) return;

    // Delete any previous responses for this respondent
    await supabase
      .from("viewing_poll_responses")
      .delete()
      .eq("poll_id", poll.id)
      .eq("respondent_type", respondentType);

    // Insert new responses
    const rows = selectedSlots.map(slot => ({
      poll_id: poll.id,
      respondent_type: respondentType,
      slot_start: slot.toISOString(),
      available: true,
    }));

    const { error } = await supabase
      .from("viewing_poll_responses")
      .insert(rows);

    if (error) throw error;

    // Update viewing_type if prospect is submitting
    if (respondentType === "prospect" && viewingType) {
      await supabase
        .from("viewing_polls")
        .update({ viewing_type: viewingType })
        .eq("id", poll.id);
    }

    setSubmitted(true);

    // Try to find a match
    const match = await findMatch(poll.id);
    if (match) {
      setMatchedSlot(match);
      return { matched: true, slot: match };
    }

    return { matched: false };
  }

  async function findMatch(pollId) {
    // Get all responses grouped by type
    const { data: allResponses } = await supabase
      .from("viewing_poll_responses")
      .select("*")
      .eq("poll_id", pollId)
      .eq("available", true);

    if (!allResponses) return null;

    const byType = {};
    allResponses.forEach(r => {
      if (!byType[r.respondent_type]) byType[r.respondent_type] = new Set();
      byType[r.respondent_type].add(r.slot_start);
    });

    // Need both captain and prospect
    if (!byType.captain || !byType.prospect) return null;

    // Find overlap: captain ∩ prospect
    const captainSlots = [...byType.captain];
    const prospectSlots = byType.prospect;
    const overlap = captainSlots.filter(s => prospectSlots.has(s));

    if (overlap.length === 0) return null;

    // Prefer slots where resident also available
    const residentSlots = byType.resident ?? new Set();
    const withResident = overlap.filter(s => residentSlots.has(s));
    
    // Pick earliest — prefer with-resident, fallback to any overlap
    const candidates = withResident.length > 0 ? withResident : overlap;
    candidates.sort((a, b) => new Date(a) - new Date(b));
    const matchedSlot = new Date(candidates[0]);

    // Update poll and viewing
    await supabase.from("viewing_polls").update({
      status: "matched",
      matched_slot: matchedSlot.toISOString(),
    }).eq("id", pollId);

    // Get viewing_id from poll
    const { data: pollData } = await supabase
      .from("viewing_polls")
      .select("viewing_id")
      .eq("id", pollId)
      .single();

    if (pollData) {
      await supabase.from("property_viewings").update({
        status: "CONFIRMED",
        viewing_date: matchedSlot.toISOString().split("T")[0],
        viewing_time: matchedSlot.toTimeString().slice(0, 5),
      }).eq("id", pollData.viewing_id);
    }

    return matchedSlot;
  }

  const isExpired = poll?.expires_at && new Date(poll.expires_at) < new Date();
  const pollStatus = isExpired && poll?.status === "open" ? "expired" : poll?.status;

  return {
    poll, viewing, property, responses,
    loading, submitted, matchedSlot,
    pollStatus, isExpired,
    submitAvailability, refetch: fetchPoll,
  };
}
```

- [ ] **Step 2: Commit**

```
feat: add useViewingPoll hook with matching algorithm
```

---

## Task 4: AvailabilityGrid Component

**Files:**
- Create: `src/components/viewing/AvailabilityGrid.jsx`

**Reference:** Stitch template at `/Users/mark/Desktop/hyve-viewing-screens/prospect_availability_poll/code.html`

- [ ] **Step 1: Create the shared grid component**

This is the When2Meet-style grid used by prospect poll page, captain portal, and admin force-book. It generates 30-min slots from 10am-8pm for 7 days starting from `startDate` (which should be today + 2 days minimum).

```jsx
import { useState, useMemo } from "react";

function generateSlots(startDate, days = 7, startHour = 10, endHour = 20) {
  const slots = [];
  for (let d = 0; d < days; d++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + d);
    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += 30) {
        const slot = new Date(date);
        slot.setHours(h, m, 0, 0);
        slots.push(slot);
      }
    }
  }
  return slots;
}

function formatDay(date) {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function formatDate(date) {
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

function formatTime(date) {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function AvailabilityGrid({
  startDate,
  days = 7,
  selectedSlots = [],
  onSlotsChange,
  readOnly = false,
  highlightSlot = null,
}) {
  const allSlots = useMemo(() => generateSlots(startDate, days), [startDate, days]);

  // Group by day
  const dayColumns = useMemo(() => {
    const groups = {};
    allSlots.forEach(slot => {
      const key = slot.toDateString();
      if (!groups[key]) groups[key] = [];
      groups[key].push(slot);
    });
    return Object.entries(groups).map(([key, slots]) => ({ date: new Date(key), slots }));
  }, [allSlots]);

  // Time labels (from first day)
  const timeLabels = dayColumns[0]?.slots ?? [];

  const selectedSet = useMemo(
    () => new Set(selectedSlots.map(s => s.toISOString())),
    [selectedSlots]
  );

  function toggleSlot(slot) {
    if (readOnly) return;
    const iso = slot.toISOString();
    if (selectedSet.has(iso)) {
      onSlotsChange(selectedSlots.filter(s => s.toISOString() !== iso));
    } else {
      onSlotsChange([...selectedSlots, slot]);
    }
  }

  const isHighlighted = (slot) =>
    highlightSlot && slot.toISOString() === highlightSlot.toISOString();

  return (
    <div className="bg-white border border-[#bbcac6]/15 rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[640px] p-4">
          {/* Day headers */}
          <div className="grid gap-2" style={{ gridTemplateColumns: `60px repeat(${days}, 1fr)` }}>
            <div className="text-[10px] font-bold text-[#6c7a77] uppercase tracking-wider flex items-end pb-2">Time</div>
            {dayColumns.map(({ date }) => (
              <div key={date.toISOString()} className="text-center pb-2">
                <span className="block text-[10px] font-bold text-[#6c7a77] uppercase">{formatDay(date)}</span>
                <span className="block text-sm font-extrabold text-[#121c2a]">{date.getDate()}</span>
                <span className="block text-[10px] text-[#6c7a77]">{date.toLocaleDateString("en-US", { month: "short" })}</span>
              </div>
            ))}
          </div>

          {/* Time rows */}
          <div className="space-y-1.5">
            {timeLabels.map((timeSlot, rowIdx) => (
              <div
                key={rowIdx}
                className="grid gap-2"
                style={{ gridTemplateColumns: `60px repeat(${days}, 1fr)` }}
              >
                <div className="text-[11px] font-medium text-[#6c7a77] flex items-center">
                  {formatTime(timeSlot)}
                </div>
                {dayColumns.map(({ slots }, colIdx) => {
                  const slot = slots[rowIdx];
                  if (!slot) return <div key={colIdx} />;
                  const isSelected = selectedSet.has(slot.toISOString());
                  const isMatch = isHighlighted(slot);
                  return (
                    <button
                      key={colIdx}
                      onClick={() => toggleSlot(slot)}
                      disabled={readOnly}
                      className={`h-9 rounded-lg transition-all text-xs font-bold ${
                        isMatch
                          ? "bg-green-500 text-white ring-2 ring-green-300"
                          : isSelected
                          ? "bg-[#006b5f] text-white shadow-sm"
                          : readOnly
                          ? "bg-gray-50 cursor-default"
                          : "bg-[#f1f3f5] hover:bg-[#e6e8ea] cursor-pointer"
                      }`}
                    >
                      {isSelected && !isMatch && "✓"}
                      {isMatch && "★"}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
feat: add AvailabilityGrid shared component for When2Meet-style polling
```

---

## Task 5: Public Schedule Viewing Form Page

**Files:**
- Create: `src/pages/viewing/ScheduleViewingPage.jsx`
- Modify: `src/App.jsx` — add route

**Reference:** Stitch template at `/Users/mark/Desktop/hyve-viewing-screens/schedule_a_viewing_form/code.html`

- [ ] **Step 1: Create the page**

Public form page at `/view/schedule/:propertySlug/:roomSlug?`. No auth. Collects prospect details, creates viewing request + poll, shows success state.

The form shows the room context card at top (auto-filled from URL params). Fields: name, email, WhatsApp, preferred move-in, how found us, notes. No budget or room type (known from the room listing).

After submit → show "Check your email!" success state with poll link.

See the Stitch HTML template for exact styling. Convert to React component using existing Hyve patterns (Plus Jakarta Sans headings, Manrope body, #006b5f teal, rounded-2xl cards).

Key details:
- Property/room info fetched from Supabase using slug params
- Creates viewing via `useViewings.createViewing()`
- On success, shows the prospect poll token link so they can immediately go fill in availability
- WhatsApp field has +65 prefix

- [ ] **Step 2: Add route to App.jsx**

Add to public routes section (no auth, no Navbar):
```jsx
import ScheduleViewingPage from './pages/viewing/ScheduleViewingPage';

<Route path="/view/schedule/:propertySlug/:roomSlug?" element={<ScheduleViewingPage />} />
```

- [ ] **Step 3: Commit**

```
feat: add public Schedule a Viewing form page
```

---

## Task 6: Public Prospect Availability Poll Page

**Files:**
- Create: `src/pages/viewing/ViewingPollPage.jsx`
- Modify: `src/App.jsx` — add route

**Reference:** Stitch template at `/Users/mark/Desktop/hyve-viewing-screens/prospect_availability_poll/code.html`

- [ ] **Step 1: Create the poll page**

Public page at `/view/poll/:token`. No auth. Shows:
1. Property name + address + thumbnail
2. Viewing type toggle (In Person / Virtual)
3. AvailabilityGrid component (7 days starting from poll_start date)
4. Sticky bottom bar with slot count + Submit button
5. After submit: waiting state or instant match confirmation with door code

Uses `useViewingPoll(token, "prospect")` hook.

Three states:
- **Active poll:** Grid + submit button
- **Already submitted:** "Thanks! Waiting for match" with option to edit
- **Matched/confirmed:** Show date, time, address, door code, "Add to Calendar" link
- **Expired:** "This link has expired" with contact info

Door codes by property:
- Ivory Heights: 808855
- Thomson Grove: 808856
- Chiltern Park: 112233#

- [ ] **Step 2: Add route to App.jsx**

```jsx
import ViewingPollPage from './pages/viewing/ViewingPollPage';

<Route path="/view/poll/:token" element={<ViewingPollPage />} />
```

- [ ] **Step 3: Commit**

```
feat: add public prospect availability poll page with When2Meet grid
```

---

## Task 7: Public Viewing Confirmation Page

**Files:**
- Create: `src/pages/viewing/ViewingConfirmPage.jsx`
- Modify: `src/App.jsx` — add route

**Reference:** Stitch template at `/Users/mark/Desktop/hyve-viewing-screens/viewing_confirmation_page/code.html`

- [ ] **Step 1: Create the page**

Simple page at `/view/confirm/:token`. Shows viewing details (property, date, time) and two buttons:
- "Yes, I'm coming!" → updates `prospect_confirmed_attending = true`, shows "See you there!"
- "I need to reschedule" → shows "WhatsApp us at +65 8088 5410"

Uses a simple Supabase query to find the viewing by token and update it.

- [ ] **Step 2: Add route**

```jsx
import ViewingConfirmPage from './pages/viewing/ViewingConfirmPage';

<Route path="/view/confirm/:token" element={<ViewingConfirmPage />} />
```

- [ ] **Step 3: Commit**

```
feat: add viewing confirmation page (still coming? yes/reschedule)
```

---

## Task 8: Captain Viewings Portal Page

**Files:**
- Create: `src/pages/portal/CaptainViewingsPage.jsx`
- Modify: `src/App.jsx` — add route
- Modify: `src/components/portal/PortalLayout.jsx` — add nav item

**Reference:** Stitch template at `/Users/mark/Desktop/hyve-viewing-screens/captain_portal_viewings/code.html`

- [ ] **Step 1: Create the page**

Portal page at `/portal/viewings` wrapped in `<PortalLayout>`. Three tabs:

**Incoming tab (default):**
- Fetch viewings where `captain_id = profile.id` AND `status IN ('REQUESTED', 'POLLING')`
- Each card shows: prospect initials avatar, name, room, viewing type badge, time since request, status pill
- "Mark Your Availability" button → expands inline AvailabilityGrid
- Captain submits availability via `useViewingPoll(poll.captain_token, "captain")`

**Upcoming tab:**
- Fetch viewings where `captain_id = profile.id` AND `status = 'CONFIRMED'` AND `viewing_date >= today`
- Card: date+time large, prospect name, room, viewing type, relative time ("Tomorrow", "In 3 days")

**Past tab:**
- Fetch viewings where `captain_id = profile.id` AND (`status = 'COMPLETED'` OR `viewing_date < today`)
- Muted card with status badge

All cards use initials avatars (no profile pics).

- [ ] **Step 2: Add route to App.jsx**

```jsx
import CaptainViewingsPage from './pages/portal/CaptainViewingsPage';

<Route
  path="/portal/viewings"
  element={
    <AuthGuard requiredRole="HOUSE_CAPTAIN">
      <CaptainViewingsPage />
    </AuthGuard>
  }
/>
```

- [ ] **Step 3: Add "Viewings" to HOUSE_CAPTAIN nav in PortalLayout.jsx**

Add after "My Property" in the HOUSE_CAPTAIN_NAV array:
```javascript
{ label: "Viewings", to: "/portal/viewings", icon: "visibility" },
```

- [ ] **Step 4: Commit**

```
feat: add captain Viewings portal page with inline availability grid
```

---

## Task 9: Admin Viewings Pipeline Page (replace existing)

**Files:**
- Create: `src/pages/portal/AdminViewingsPageV2.jsx`
- Modify: `src/App.jsx` — update route to use V2

**Reference:** Stitch template at `/Users/mark/Desktop/hyve-viewing-screens/admin_viewings_management/code.html`

- [ ] **Step 1: Create the pipeline page**

Replace existing simple AdminViewingsPage with Kanban-style pipeline view. Columns: Requested → Polling → Confirmed → Completed → Cancelled.

Features:
- Filter bar: Property dropdown (All/TG/IH/CP) + Status dropdown
- "Create Viewing" button → opens modal with form (same fields as public form + property selector + captain auto-assign)
- Pipeline cards: property badge (color-coded), prospect name, room, viewing type icon, poll progress ("Captain: ✓ | Prospect: waiting | Resident: ✓")
- Click card → navigate to `/portal/admin/viewings/:id` detail page

Uses `useViewings()` hook with filters.

- [ ] **Step 2: Update route in App.jsx**

Change the import from AdminViewingsPage to AdminViewingsPageV2:
```jsx
import AdminViewingsPageV2 from './pages/portal/AdminViewingsPageV2';

// Replace existing admin viewings route
<Route path="/portal/admin/viewings" element={<AuthGuard requiredRole="ADMIN"><AdminViewingsPageV2 /></AuthGuard>} />
```

- [ ] **Step 3: Commit**

```
feat: replace admin viewings page with Kanban pipeline view
```

---

## Task 10: Admin Viewing Detail Page

**Files:**
- Create: `src/pages/portal/AdminViewingDetailPage.jsx`
- Modify: `src/App.jsx` — add route

**Reference:** Stitch template at `/Users/mark/Desktop/hyve-viewing-screens/admin_viewing_detail/code.html`

- [ ] **Step 1: Create the detail page**

Two-column layout (desktop), stacked (mobile):

**Left column — Prospect Info:**
- Initials avatar + name (no photo)
- Email (mailto link), WhatsApp (wa.me link)
- Move-in date, source
- Editable notes textarea

**Right column — Poll Status:**
- Status progress bar: Requested → Polling → Confirmed → Completed
- 3 respondent cards: Captain (name, status), Prospect (name, status), Resident (name, status + "(courtesy)" label)
- Matched slot card (green, large date/time) if matched
- No match warning if poll expired

**Actions bar:**
- Force Book → opens AvailabilityGrid in read-only mode to pick a slot
- Cancel → cancels viewing + notifies
- Resend Poll → regenerates tokens
- Send Reminder → placeholder for v1

**Timeline:**
- Activity log from poll responses + status changes

- [ ] **Step 2: Add route**

```jsx
import AdminViewingDetailPage from './pages/portal/AdminViewingDetailPage';

<Route path="/portal/admin/viewings/:id" element={<AuthGuard requiredRole="ADMIN"><AdminViewingDetailPage /></AuthGuard>} />
```

- [ ] **Step 3: Commit**

```
feat: add admin viewing detail page with poll status + timeline
```

---

## Task 11: Add "Schedule a Viewing" Button to Property Listing Pages

**Files:**
- Modify: `src/components/PropertyDetailPageWithSanity.jsx`

- [ ] **Step 1: Add button to the "Book a Viewing" sidebar section**

In the existing sticky sidebar that already has "Book a Viewing" heading, add a button that links to the schedule form:

```jsx
<Link
  to={`/view/schedule/${property.slug}`}
  className="w-full py-3 px-4 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
>
  <span className="material-symbols-outlined text-[18px]">calendar_month</span>
  Schedule a Viewing
</Link>
```

Also add per-room "View Room" buttons that link to `/view/schedule/${property.slug}/${room.slug}`.

- [ ] **Step 2: Commit**

```
feat: add Schedule a Viewing buttons to property listing pages
```

---

## Task 12: Seed Property Guide Data for TG and CP

**Files:**
- Migration via Supabase MCP

- [ ] **Step 1: Seed property_guides for Thomson Grove and Chiltern Park**

Same structure as IH guides — wifi, property_info, building_guide, nearby, faq, welcome sections.

TG WiFi: network "hyve", password "Thehyve2027@"
CP WiFi: need from Mark (use placeholder)

Door codes: TG 808856, CP 112233#

- [ ] **Step 2: Commit**

```
feat: seed property guides for Thomson Grove and Chiltern Park
```

---

## Summary

| Task | What | Priority |
|------|------|----------|
| 1 | DB Migration (tables + RLS) | Must |
| 2 | useViewings hook | Must |
| 3 | useViewingPoll hook + matching | Must |
| 4 | AvailabilityGrid component | Must |
| 5 | Public schedule form page | Must |
| 6 | Public prospect poll page | Must |
| 7 | Public confirmation page | Nice |
| 8 | Captain viewings portal | Must |
| 9 | Admin pipeline page (V2) | Must |
| 10 | Admin viewing detail | Must |
| 11 | Property listing buttons | Nice |
| 12 | Seed TG/CP guides | Nice |

**Critical path:** Tasks 1 → 2 → 3 → 4 → 5+6 (parallel) → 8+9 (parallel) → 10
