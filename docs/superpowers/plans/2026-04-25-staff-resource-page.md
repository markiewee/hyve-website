# Staff Resource Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an unlisted internal page at `/staff` where remote sales staff can look up room details, facilities, amenities, availability, and policies from Supabase.

**Architecture:** Supabase migration adds detail columns to `rooms` and `properties` tables. A new React component fetches all data in one query (`properties` with nested `rooms`) and renders property tabs with expandable room cards. Static policy sections (lease terms, move-in process, FAQ) are hardcoded. Page is public but unlisted and noindexed.

**Tech Stack:** React 19, Vite, Tailwind CSS, Supabase (hyve-iot, project `diiilqpfmlxjwiaeophb`), Radix UI Tabs + Accordion, Framer Motion, existing `ui/` component library.

**Spec:** `docs/superpowers/specs/2026-04-25-staff-resource-page-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| Supabase migration (via MCP) | Create | Add columns to `rooms` and `properties` tables |
| Supabase seed (via MCP) | Create | Populate 3 properties and 19 rooms with real data |
| `src/components/StaffResourcePage.jsx` | Create | Main page component — tabs, property overview, room grid, static sections |
| `src/App.jsx` | Modify (line ~110) | Add `/staff` route |

---

## Task 1: Database Migration — rooms table

**Files:**
- Modify: Supabase `rooms` table via `mcp__supabase__apply_migration`

- [ ] **Step 1: Run the migration to add columns to rooms**

```sql
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS room_type text,
  ADD COLUMN IF NOT EXISTS price_monthly numeric,
  ADD COLUMN IF NOT EXISTS size_sqm numeric,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS floor integer,
  ADD COLUMN IF NOT EXISTS has_private_bathroom boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_aircon boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS furnishing_level text DEFAULT 'fully_furnished',
  ADD COLUMN IF NOT EXISTS amenities jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS facilities jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS photos jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS deposit_months integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS min_stay_months integer DEFAULT 6,
  ADD COLUMN IF NOT EXISTS next_available date,
  ADD COLUMN IF NOT EXISTS available_until date;
```

Use `mcp__supabase__apply_migration` with project_id `diiilqpfmlxjwiaeophb` and name `add_room_detail_columns`.

- [ ] **Step 2: Verify migration**

Run via `mcp__supabase__execute_sql`:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'rooms' AND table_schema = 'public'
ORDER BY ordinal_position;
```

Expected: all 19 columns present (original 4 + 15 new).

- [ ] **Step 3: Add check constraint for room_type**

```sql
ALTER TABLE rooms
  ADD CONSTRAINT rooms_room_type_check
  CHECK (room_type IS NULL OR room_type IN ('master', 'premium', 'standard'));
```

- [ ] **Step 4: Add check constraint for furnishing_level**

```sql
ALTER TABLE rooms
  ADD CONSTRAINT rooms_furnishing_level_check
  CHECK (furnishing_level IS NULL OR furnishing_level IN ('fully_furnished', 'partially_furnished', 'unfurnished'));
```

---

## Task 2: Database Migration — properties table

**Files:**
- Modify: Supabase `properties` table via `mcp__supabase__apply_migration`

- [ ] **Step 1: Run the migration to add columns to properties**

```sql
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS amenities jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS facilities jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS nearby_mrt jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS nearby_amenities jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS house_rules jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'available';
```

Use `mcp__supabase__apply_migration` with project_id `diiilqpfmlxjwiaeophb` and name `add_property_detail_columns`.

- [ ] **Step 2: Verify migration**

Run via `mcp__supabase__execute_sql`:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'properties' AND table_schema = 'public'
ORDER BY ordinal_position;
```

Expected: all 16 columns present (original 5 + 11 new).

- [ ] **Step 3: Add check constraint for status**

```sql
ALTER TABLE properties
  ADD CONSTRAINT properties_status_check
  CHECK (status IS NULL OR status IN ('available', 'coming_soon', 'full'));
```

- [ ] **Step 4: Add unique constraint on slug**

```sql
ALTER TABLE properties
  ADD CONSTRAINT properties_slug_unique UNIQUE (slug);
```

---

## Task 3: Seed Property Data

**Files:**
- Modify: Supabase `properties` table data via `mcp__supabase__execute_sql`

Before seeding, check the existing Sanity CMS data and hyve-ops.json for accurate details. Also check `/Users/mark/Desktop/claudine/hyve-photos/` for photo inventory.

- [ ] **Step 1: Seed Chiltern Park (CP)**

```sql
UPDATE properties SET
  description = 'Spacious 4-bedroom apartment in the quiet Serangoon neighborhood. Walking distance to NEX Mall and Serangoon MRT. Perfect for professionals working in the city centre.',
  slug = 'chiltern-park',
  latitude = 1.3535,
  longitude = 103.8718,
  amenities = '["fully furnished rooms", "high-speed WiFi", "weekly cleaning", "washing machine", "dryer", "shared kitchen", "shared living room"]',
  facilities = '["covered parking", "playground", "BBQ pit", "swimming pool", "gym", "lift access"]',
  nearby_mrt = '[{"station": "Serangoon", "line": "NEL/CCL", "walking_minutes": 10}, {"station": "Lorong Chuan", "line": "CCL", "walking_minutes": 8}]',
  nearby_amenities = '[{"name": "NEX Mall", "type": "mall", "walking_minutes": 10}, {"name": "Serangoon Garden Market", "type": "grocery", "walking_minutes": 12}]',
  house_rules = '["No smoking indoors", "Quiet hours 10pm-8am", "Guests allowed with notice", "No pets", "Keep common areas clean after use", "No cooking with strong spices without ventilation"]',
  status = 'available'
WHERE code = 'CP';
```

- [ ] **Step 2: Seed Ivory Heights (IH)**

```sql
UPDATE properties SET
  description = 'Modern HDB apartment in Jurong East, close to JEM and Westgate malls. Well-connected via Jurong East MRT (NSL/EWL). Great for professionals working in the Jurong business district.',
  slug = 'ivory-heights',
  latitude = 1.3440,
  longitude = 103.7290,
  amenities = '["fully furnished rooms", "high-speed WiFi", "weekly cleaning", "washing machine", "shared kitchen", "shared living room"]',
  facilities = '["covered parking", "playground", "lift access", "nearby hawker centre"]',
  nearby_mrt = '[{"station": "Jurong East", "line": "NSL/EWL", "walking_minutes": 12}]',
  nearby_amenities = '[{"name": "JEM", "type": "mall", "walking_minutes": 12}, {"name": "Westgate", "type": "mall", "walking_minutes": 13}, {"name": "Jurong East Hawker Centre", "type": "restaurant", "walking_minutes": 5}]',
  house_rules = '["No smoking indoors", "Quiet hours 10pm-8am", "Guests allowed with notice", "No pets", "Keep common areas clean after use", "No cooking with strong spices without ventilation"]',
  status = 'available'
WHERE code = 'IH';
```

- [ ] **Step 3: Seed Thomson Grove (TG)**

```sql
UPDATE properties SET
  description = 'Landed property in the leafy Upper Thomson area. Quiet residential neighborhood with easy access to Thomson-East Coast Line. Close to MacRitchie Reservoir for nature lovers.',
  slug = 'thomson-grove',
  latitude = 1.3780,
  longitude = 103.8350,
  amenities = '["fully furnished rooms", "high-speed WiFi", "weekly cleaning", "washing machine", "dryer", "shared kitchen", "shared living room", "garden"]',
  facilities = '["private garden", "covered porch", "bicycle storage"]',
  nearby_mrt = '[{"station": "Upper Thomson", "line": "TEL", "walking_minutes": 10}]',
  nearby_amenities = '[{"name": "Thomson Plaza", "type": "mall", "walking_minutes": 8}, {"name": "MacRitchie Reservoir", "type": "other", "walking_minutes": 15}, {"name": "Shunfu Market", "type": "grocery", "walking_minutes": 10}]',
  house_rules = '["No smoking indoors", "Quiet hours 10pm-8am", "Guests allowed with notice", "No pets", "Keep common areas clean after use", "No cooking with strong spices without ventilation"]',
  status = 'available'
WHERE code = 'TG';
```

- [ ] **Step 4: Verify property data**

```sql
SELECT code, slug, status, jsonb_array_length(amenities) as amenity_count, jsonb_array_length(nearby_mrt) as mrt_count
FROM properties ORDER BY code;
```

Expected: 3 rows, all with populated counts.

---

## Task 4: Seed Room Data

**Files:**
- Modify: Supabase `rooms` table data via `mcp__supabase__execute_sql`

Before seeding, cross-reference pricing from Sanity CMS data, hyve-ops.json, and current listings. Check tenant_profiles for current occupancy to set `next_available`. Room types are derived from unit_code naming: MR = master, PR = premium, STD = standard.

- [ ] **Step 1: Seed Chiltern Park rooms**

Query current Sanity/listing data for accurate pricing, then run the UPDATE. Example structure (adjust prices/sizes to real data):

```sql
UPDATE rooms SET
  room_type = 'master', price_monthly = 1500, size_sqm = 18,
  description = 'Spacious master room with attached private bathroom and queen bed.',
  floor = 1, has_private_bathroom = true, has_aircon = true,
  furnishing_level = 'fully_furnished',
  amenities = '["queen bed", "wardrobe", "desk", "chair", "mirror", "curtains", "bedside table"]',
  facilities = '["attached bathroom", "window", "door lock"]',
  deposit_months = 1, min_stay_months = 6
WHERE unit_code = 'CP-MR';

UPDATE rooms SET
  room_type = 'premium', price_monthly = 1300, size_sqm = 14,
  description = 'Well-sized premium room with natural light.',
  floor = 1, has_private_bathroom = false, has_aircon = true,
  furnishing_level = 'fully_furnished',
  amenities = '["queen bed", "wardrobe", "desk", "chair", "mirror", "curtains"]',
  facilities = '["window", "door lock"]',
  deposit_months = 1, min_stay_months = 6
WHERE unit_code = 'CP-PR1';

UPDATE rooms SET
  room_type = 'premium', price_monthly = 1300, size_sqm = 14,
  description = 'Comfortable premium room with wardrobe and desk.',
  floor = 1, has_private_bathroom = false, has_aircon = true,
  furnishing_level = 'fully_furnished',
  amenities = '["queen bed", "wardrobe", "desk", "chair", "mirror", "curtains"]',
  facilities = '["window", "door lock"]',
  deposit_months = 1, min_stay_months = 6
WHERE unit_code = 'CP-PR2';

UPDATE rooms SET
  room_type = 'premium', price_monthly = 1300, size_sqm = 13,
  description = 'Cosy premium room near shared bathroom.',
  floor = 1, has_private_bathroom = false, has_aircon = true,
  furnishing_level = 'fully_furnished',
  amenities = '["queen bed", "wardrobe", "desk", "chair", "curtains"]',
  facilities = '["window", "door lock"]',
  deposit_months = 1, min_stay_months = 6
WHERE unit_code = 'CP-PR3';

UPDATE rooms SET
  room_type = 'premium', price_monthly = 1250, size_sqm = 12,
  description = 'Bright premium room with good ventilation.',
  floor = 1, has_private_bathroom = false, has_aircon = true,
  furnishing_level = 'fully_furnished',
  amenities = '["queen bed", "wardrobe", "desk", "chair", "curtains"]',
  facilities = '["window", "door lock"]',
  deposit_months = 1, min_stay_months = 6
WHERE unit_code = 'CP-PR4';

UPDATE rooms SET
  room_type = 'standard', price_monthly = 1050, size_sqm = 9,
  description = 'Compact standard room, great value.',
  floor = 1, has_private_bathroom = false, has_aircon = true,
  furnishing_level = 'fully_furnished',
  amenities = '["single bed", "wardrobe", "desk", "chair", "curtains"]',
  facilities = '["window", "door lock"]',
  deposit_months = 1, min_stay_months = 6
WHERE unit_code = 'CP-STD1';
```

**Important:** Before running, verify actual prices and room sizes from current listings or hyve-ops.json. The prices above are placeholders — replace with real numbers.

- [ ] **Step 2: Seed Ivory Heights rooms (7 rooms)**

Same pattern as Step 1. IH has no master room — 3 premium (IH-PR1..3) and 4 standard (IH-STD1..4). Query real data first.

```sql
-- IH-PR1
UPDATE rooms SET
  room_type = 'premium', price_monthly = 1200, size_sqm = 13,
  description = 'Premium room in Jurong East, close to amenities.',
  floor = 1, has_private_bathroom = false, has_aircon = true,
  furnishing_level = 'fully_furnished',
  amenities = '["queen bed", "wardrobe", "desk", "chair", "mirror", "curtains"]',
  facilities = '["window", "door lock"]',
  deposit_months = 1, min_stay_months = 6
WHERE unit_code = 'IH-PR1';

-- IH-PR2
UPDATE rooms SET
  room_type = 'premium', price_monthly = 1200, size_sqm = 13,
  description = 'Well-lit premium room with desk workspace.',
  floor = 1, has_private_bathroom = false, has_aircon = true,
  furnishing_level = 'fully_furnished',
  amenities = '["queen bed", "wardrobe", "desk", "chair", "mirror", "curtains"]',
  facilities = '["window", "door lock"]',
  deposit_months = 1, min_stay_months = 6
WHERE unit_code = 'IH-PR2';

-- IH-PR3
UPDATE rooms SET
  room_type = 'premium', price_monthly = 1200, size_sqm = 12,
  description = 'Comfortable premium room near shared spaces.',
  floor = 1, has_private_bathroom = false, has_aircon = true,
  furnishing_level = 'fully_furnished',
  amenities = '["queen bed", "wardrobe", "desk", "chair", "curtains"]',
  facilities = '["window", "door lock"]',
  deposit_months = 1, min_stay_months = 6
WHERE unit_code = 'IH-PR3';

-- IH-STD1 through IH-STD4
UPDATE rooms SET
  room_type = 'standard', price_monthly = 950, size_sqm = 9,
  description = 'Compact standard room, great value in Jurong East.',
  floor = 1, has_private_bathroom = false, has_aircon = true,
  furnishing_level = 'fully_furnished',
  amenities = '["single bed", "wardrobe", "desk", "chair", "curtains"]',
  facilities = '["window", "door lock"]',
  deposit_months = 1, min_stay_months = 6
WHERE unit_code IN ('IH-STD1', 'IH-STD2', 'IH-STD3', 'IH-STD4');
```

**Important:** Verify real prices before running.

- [ ] **Step 3: Seed Thomson Grove rooms (6 rooms)**

TG has 1 master, 3 premium, 2 standard.

```sql
UPDATE rooms SET
  room_type = 'master', price_monthly = 1600, size_sqm = 20,
  description = 'Large master room with attached bathroom in quiet landed house.',
  floor = 1, has_private_bathroom = true, has_aircon = true,
  furnishing_level = 'fully_furnished',
  amenities = '["queen bed", "wardrobe", "desk", "chair", "mirror", "curtains", "bedside table"]',
  facilities = '["attached bathroom", "window", "door lock", "garden view"]',
  deposit_months = 1, min_stay_months = 6
WHERE unit_code = 'TG-MR';

UPDATE rooms SET
  room_type = 'premium', price_monthly = 1350, size_sqm = 14,
  description = 'Premium room in landed property with garden access.',
  floor = 1, has_private_bathroom = false, has_aircon = true,
  furnishing_level = 'fully_furnished',
  amenities = '["queen bed", "wardrobe", "desk", "chair", "mirror", "curtains"]',
  facilities = '["window", "door lock"]',
  deposit_months = 1, min_stay_months = 6
WHERE unit_code IN ('TG-PR1', 'TG-PR2', 'TG-PR3');

UPDATE rooms SET
  room_type = 'standard', price_monthly = 1100, size_sqm = 10,
  description = 'Cosy standard room in quiet Thomson neighborhood.',
  floor = 1, has_private_bathroom = false, has_aircon = true,
  furnishing_level = 'fully_furnished',
  amenities = '["single bed", "wardrobe", "desk", "chair", "curtains"]',
  facilities = '["window", "door lock"]',
  deposit_months = 1, min_stay_months = 6
WHERE unit_code IN ('TG-STD1', 'TG-STD2');
```

**Important:** Verify real prices before running.

- [ ] **Step 4: Set availability from tenant data**

Query active tenants and set `next_available` for occupied rooms:

```sql
UPDATE rooms r SET
  next_available = tp.lease_end
FROM tenant_profiles tp
WHERE tp.room_id = r.id
  AND tp.is_active = true
  AND tp.lease_end IS NOT NULL;
```

Rooms without active tenants keep `next_available = NULL` (meaning available now).

- [ ] **Step 5: Verify all room data**

```sql
SELECT r.unit_code, r.room_type, r.price_monthly, r.size_sqm,
       r.has_private_bathroom, r.next_available, r.available_until,
       p.code as property
FROM rooms r
JOIN properties p ON r.property_id = p.id
ORDER BY p.code, r.unit_code;
```

Expected: 19 rows, all with room_type and price_monthly populated.

---

## Task 5: Build StaffResourcePage Component

**Files:**
- Create: `src/components/StaffResourcePage.jsx`

- [ ] **Step 1: Create the component file with imports and data fetching**

```jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './ui/accordion';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SEO from './SEO';

const PROPERTY_ORDER = ['CP', 'IH', 'TG'];

function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getAvailabilityStatus(room) {
  const now = new Date();
  if (!room.next_available) {
    if (room.available_until) {
      return { label: `Available now — until ${formatDate(room.available_until)}`, color: 'amber' };
    }
    return { label: 'Available now', color: 'green' };
  }
  const availDate = new Date(room.next_available);
  const daysUntil = Math.ceil((availDate - now) / (1000 * 60 * 60 * 24));
  if (daysUntil <= 30) {
    return { label: `Available from ${formatDate(room.next_available)}`, color: 'amber' };
  }
  return { label: `Available from ${formatDate(room.next_available)}`, color: 'red' };
}

const STATUS_COLORS = {
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
};

export default function StaffResourcePage() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      const { data, error: fetchError } = await supabase
        .from('properties')
        .select('*, rooms(*)')
        .order('name');
      if (fetchError) {
        setError(fetchError.message);
      } else {
        // Sort properties by PROPERTY_ORDER
        const sorted = PROPERTY_ORDER.map(code => data.find(p => p.code === code)).filter(Boolean);
        // Sort rooms within each property by unit_code
        sorted.forEach(p => {
          if (p.rooms) p.rooms.sort((a, b) => a.unit_code.localeCompare(b.unit_code));
        });
        setProperties(sorted);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] pt-24 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#006b5f]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] pt-24 px-6">
        <div className="max-w-7xl mx-auto text-center py-20">
          <p className="text-red-600">Failed to load data: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff] pt-24">
      <SEO
        title="Staff Resource Guide"
        description="Internal reference for Hyve sales and operations staff."
        noindex={true}
      />

      {/* Header */}
      <section className="px-6 md:px-8 py-12 max-w-7xl mx-auto">
        <h1 className="font-['Plus_Jakarta_Sans'] text-3xl sm:text-4xl font-extrabold tracking-tight text-[#121c2a] mb-2">
          Staff Resource Guide
        </h1>
        <p className="text-[#3c4947] text-lg font-['Manrope']">
          Quick reference for sales &amp; ops — room details, availability, and policies.
        </p>
      </section>

      {/* Property Tabs */}
      <section className="px-6 md:px-8 max-w-7xl mx-auto pb-16">
        {properties.length > 0 && (
          <Tabs defaultValue={properties[0].code}>
            <TabsList className="mb-8 w-full sm:w-auto">
              {properties.map(p => (
                <TabsTrigger key={p.code} value={p.code} className="px-6 py-2.5 text-sm font-semibold">
                  {p.code} — {p.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {properties.map(p => (
              <TabsContent key={p.code} value={p.code}>
                <PropertySection property={p} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </section>

      {/* Global Sections */}
      <LeaseTermsSection />
      <MoveInProcessSection />
      <FAQSection />
    </div>
  );
}
```

- [ ] **Step 2: Add the PropertySection component**

Append to the same file, above the default export (or below — single file is fine for this page):

```jsx
function PropertySection({ property }) {
  const p = property;
  return (
    <div className="space-y-8">
      {/* Property Overview */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100">
        <h2 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#121c2a] mb-1">{p.name}</h2>
        <p className="text-[#3c4947] text-sm mb-4">{p.address}</p>
        {p.description && <p className="text-[#3c4947] mb-6 font-['Manrope']">{p.description}</p>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Facilities */}
          {p.facilities?.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#006b5f] mb-2">Facilities</h3>
              <div className="flex flex-wrap gap-1.5">
                {p.facilities.map((f, i) => (
                  <span key={i} className="inline-block px-2.5 py-1 bg-[#eff4ff] text-[#121c2a] text-xs rounded-full">{f}</span>
                ))}
              </div>
            </div>
          )}

          {/* Nearest MRT */}
          {p.nearby_mrt?.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#006b5f] mb-2">Nearest MRT</h3>
              <ul className="space-y-1">
                {p.nearby_mrt.map((m, i) => (
                  <li key={i} className="text-sm text-[#3c4947]">
                    <span className="font-medium">{m.station}</span> ({m.line}) — {m.walking_minutes} min walk
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Nearby Amenities */}
          {p.nearby_amenities?.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#006b5f] mb-2">Nearby</h3>
              <ul className="space-y-1">
                {p.nearby_amenities.map((a, i) => (
                  <li key={i} className="text-sm text-[#3c4947]">
                    <span className="font-medium">{a.name}</span> — {a.walking_minutes} min walk
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* House Rules */}
        {p.house_rules?.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#006b5f] mb-2">House Rules</h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {p.house_rules.map((rule, i) => (
                <li key={i} className="text-sm text-[#3c4947] flex items-start gap-2">
                  <span className="text-[#006b5f] mt-0.5">•</span> {rule}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Rooms Grid */}
      <div>
        <h2 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#121c2a] mb-4">
          Rooms ({p.rooms?.length || 0})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {p.rooms?.map(room => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add the RoomCard component**

```jsx
function RoomCard({ room }) {
  const [expanded, setExpanded] = useState(false);
  const status = getAvailabilityStatus(room);
  const roomTypeLabel = room.room_type
    ? room.room_type.charAt(0).toUpperCase() + room.room_type.slice(1)
    : '—';

  return (
    <div
      className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Collapsed view — always visible */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] text-base">{room.unit_code}</h3>
            <p className="text-sm text-[#3c4947]">{room.name}</p>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
        <div className="flex items-center gap-3 text-sm mb-2">
          {room.price_monthly && (
            <span className="font-semibold text-[#121c2a]">${room.price_monthly.toLocaleString()}/mo</span>
          )}
          {room.size_sqm && (
            <span className="text-[#3c4947]">{room.size_sqm} sqm</span>
          )}
          <span className="text-[#3c4947]">{roomTypeLabel}</span>
        </div>
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status.color]}`}>
          {status.label}
        </span>
      </div>

      {/* Expanded view */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-3">
              {/* Photos */}
              {room.photos?.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                  {room.photos.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`${room.unit_code} photo ${i + 1}`}
                      className="w-32 h-24 rounded-lg object-cover flex-shrink-0"
                      loading="lazy"
                    />
                  ))}
                </div>
              )}

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <Detail label="Floor" value={room.floor} />
                <Detail label="Bathroom" value={room.has_private_bathroom ? 'Private' : 'Shared'} />
                <Detail label="Aircon" value={room.has_aircon ? 'Yes' : 'No'} />
                <Detail label="Furnishing" value={room.furnishing_level?.replace(/_/g, ' ')} />
                <Detail label="Deposit" value={room.deposit_months ? `${room.deposit_months} month${room.deposit_months > 1 ? 's' : ''}` : null} />
                <Detail label="Min stay" value={room.min_stay_months ? `${room.min_stay_months} months` : null} />
              </div>

              {/* Amenities */}
              {room.amenities?.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#006b5f] mb-1">Amenities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {room.amenities.map((a, i) => (
                      <span key={i} className="px-2 py-0.5 bg-[#eff4ff] text-[#121c2a] text-xs rounded-full">{a}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Facilities */}
              {room.facilities?.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#006b5f] mb-1">Facilities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {room.facilities.map((f, i) => (
                      <span key={i} className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-xs rounded-full">{f}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {room.description && (
                <p className="text-sm text-[#3c4947] italic">{room.description}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Detail({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between">
      <span className="text-[#3c4947]">{label}</span>
      <span className="text-[#121c2a] font-medium capitalize">{value}</span>
    </div>
  );
}
```

- [ ] **Step 4: Add the static sections (LeaseTerms, MoveInProcess, FAQ)**

```jsx
function LeaseTermsSection() {
  return (
    <section className="bg-white py-16">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <h2 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#121c2a] mb-6">Lease Terms</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <TermCard title="Minimum Stay" value="6 months" />
          <TermCard title="Deposit" value="1 month rent" subtitle="Fully refundable" />
          <TermCard title="Notice Period" value="1 month" />
          <TermCard title="Payment" value="Bank transfer" subtitle="Due 1st of each month" />
        </div>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#006b5f] mb-2">Rent Includes</h3>
            <ul className="space-y-1.5 text-sm text-[#3c4947]">
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> High-speed WiFi</li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> Utilities (water, electricity with AC allowance)</li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> Weekly common area cleaning</li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> Fully furnished room</li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> Cooking facilities</li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> Washing machine &amp; dryer access</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-red-600 mb-2">Not Included</h3>
            <ul className="space-y-1.5 text-sm text-[#3c4947]">
              <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">✗</span> Personal AC usage over monthly allowance</li>
              <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">✗</span> Personal toiletries &amp; bedroom cleaning</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function TermCard({ title, value, subtitle }) {
  return (
    <div className="bg-[#f8f9ff] rounded-xl p-5 text-center">
      <p className="text-xs font-bold uppercase tracking-wider text-[#006b5f] mb-1">{title}</p>
      <p className="text-xl font-bold text-[#121c2a] font-['Plus_Jakarta_Sans']">{value}</p>
      {subtitle && <p className="text-xs text-[#3c4947] mt-1">{subtitle}</p>}
    </div>
  );
}

function MoveInProcessSection() {
  const steps = [
    { num: '1', title: 'Browse & Schedule', desc: 'Browse available rooms online or schedule a viewing at the property.' },
    { num: '2', title: 'Sign Agreement', desc: 'Choose your room and sign the digital licence agreement.' },
    { num: '3', title: 'Pay Deposit', desc: 'Pay security deposit + first month\'s rent via bank transfer.' },
    { num: '4', title: 'Get Access', desc: 'Receive your door code and move-in instructions.' },
    { num: '5', title: 'Move In', desc: 'Move in on your start date. Welcome to Hyve!' },
  ];

  return (
    <section className="py-16 bg-[#f8f9ff]">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <h2 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#121c2a] mb-8">Move-in Process</h2>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          {steps.map(step => (
            <div key={step.num} className="bg-white rounded-xl p-5 text-center shadow-sm border border-gray-100">
              <div className="w-8 h-8 rounded-full bg-[#006b5f] text-white font-bold text-sm flex items-center justify-center mx-auto mb-3">
                {step.num}
              </div>
              <p className="font-semibold text-[#121c2a] text-sm mb-1">{step.title}</p>
              <p className="text-xs text-[#3c4947]">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const faqs = [
    { q: 'Can I have guests overnight?', a: 'Yes, overnight guests are allowed with advance notice to your housemates. Extended stays (3+ nights) require approval.' },
    { q: "What's the WiFi speed?", a: 'All properties have high-speed fibre broadband (300Mbps+). Each room has strong coverage.' },
    { q: 'Is cooking allowed?', a: 'Yes, the shared kitchen is fully equipped. Please clean up after cooking and use the exhaust fan when cooking with strong spices.' },
    { q: 'How do I report a maintenance issue?', a: 'Submit a ticket through the Hyve tenant portal, or message us on WhatsApp. We aim to respond within 24 hours.' },
    { q: 'Can I end my lease early?', a: 'Early termination requires 1 month written notice. The security deposit may be forfeited depending on circumstances.' },
    { q: 'What happens to my deposit?', a: 'Your deposit is fully refundable within 14 days of move-out, subject to a room condition inspection. Deductions apply for damages beyond normal wear and tear.' },
    { q: 'Are utilities included?', a: 'Yes — water, electricity (with a monthly AC allowance), WiFi, and weekly common area cleaning are all included in rent. AC usage above the allowance is charged separately.' },
    { q: 'Is there parking?', a: 'Chiltern Park and Ivory Heights have nearby HDB parking. Thomson Grove has limited porch parking. Check with us for availability.' },
    { q: "What's the AC usage policy?", a: 'Each room has a monthly AC allowance included in rent. Usage is tracked via smart plugs. Overage is billed monthly at the prevailing electricity rate.' },
  ];

  return (
    <section className="py-16 bg-white">
      <div className="max-w-3xl mx-auto px-6 md:px-8">
        <h2 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#121c2a] mb-6">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible>
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-[#121c2a] font-medium">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-[#3c4947]">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Verify the file compiles**

Run from `/Users/mark/Desktop/hyve-website`:
```bash
npx vite build --mode development 2>&1 | head -20
```

Expected: no import errors or syntax issues.

- [ ] **Step 6: Commit**

```bash
git add src/components/StaffResourcePage.jsx
git commit -m "feat: add StaffResourcePage component with tabs, room cards, and static sections"
```

---

## Task 6: Wire Up Route

**Files:**
- Modify: `src/App.jsx` (line ~110, after cookie-policy route)

- [ ] **Step 1: Add import at top of App.jsx**

After line 19 (`import CookiePolicy from './components/CookiePolicy';`), add:

```jsx
import StaffResourcePage from './components/StaffResourcePage';
```

- [ ] **Step 2: Add route**

After line 110 (`<Route path="/cookie-policy" element={<CookiePolicy />} />`), add:

```jsx
<Route path="/staff" element={<StaffResourcePage />} />
```

- [ ] **Step 3: Start dev server and verify**

```bash
cd /Users/mark/Desktop/hyve-website && npm run dev
```

Open `http://localhost:5173/staff` in browser. Verify:
- Page loads without errors
- Tabs switch between CP, IH, TG
- Room cards expand/collapse on click
- Availability badges show correct colours
- Static sections (lease terms, move-in, FAQ) render at bottom
- `noindex` meta tag is present (check page source)
- Page is NOT linked in navbar or footer

- [ ] **Step 4: Test mobile layout**

Resize browser to mobile width (375px). Verify:
- Room cards stack single-column
- Tabs are usable (scroll if needed)
- Expanded card content is readable
- Move-in process steps stack vertically

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add /staff route for internal resource page"
```
