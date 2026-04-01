# Tenant Onboarding + Property Guides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Onboard all IH tenants to the portal, build a persistent Property Guide page, and send invite messages via Beeper.

**Architecture:** Three-phase approach: (1) DB cleanup + reset via Supabase SQL, (2) new PropertyGuidePage + WelcomeSplash components in the React portal, (3) Beeper messages to IH tenants. No new API routes — all reads via existing Supabase client. One new DB table (`property_guides`) for guide content.

**Tech Stack:** React 19, Supabase (IoT project `diiilqpfmlxjwiaeophb`), shadcn/ui, Tailwind CSS, Beeper MCP.

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/useOnboarding.js` | Modify | Add `WELCOME` step before `PERSONAL_DETAILS` |
| `src/pages/portal/OnboardingPage.jsx` | Modify | Add WelcomeSplash to step rendering |
| `src/components/portal/WelcomeSplash.jsx` | Create | Pre-move-in guide splash page |
| `src/pages/portal/PropertyGuidePage.jsx` | Create | My Property guide page |
| `src/components/portal/PortalLayout.jsx` | Modify | Add "My Property" nav link |
| `src/App.jsx` | Modify | Add `/portal/guide` route |
| `src/hooks/usePropertyGuides.js` | Create | Hook to fetch property_guides from Supabase |

---

### Task 1: DB Cleanup — Delete Stale Profiles and Auth Users

**Context:** The IoT DB has duplicate/orphan profiles that need cleanup before reset. IH-STD3 has an empty duplicate profile. Edward (IH-PR2) has no profile at all.

- [ ] **Step 1: Delete the empty duplicate IH-STD3 profile**

```sql
-- Profile 758ece8c has no name, stuck at PERSONAL_DETAILS, duplicate on IH-STD3
-- First delete its onboarding_progress row
DELETE FROM onboarding_progress WHERE tenant_profile_id = '758ece8c-be2a-489c-b1d1-83a475443478';
-- Then delete the profile itself
DELETE FROM tenant_profiles WHERE id = '758ece8c-be2a-489c-b1d1-83a475443478';
```

Run via: `mcp__supabase__execute_sql` with project_id `diiilqpfmlxjwiaeophb`

- [ ] **Step 2: Delete old Supabase Auth users for all IH tenants**

The existing profiles have `user_id` values pointing to bulk-seeded auth users. Delete these so tenants can sign up fresh with the invite flow.

```sql
-- Get the user_ids to delete
SELECT id, user_id, room_id FROM tenant_profiles 
WHERE property_id = '358c5333-00fd-4efb-b330-3d6e131e9b10' AND is_active = true;
```

Then for each user_id, delete from auth.users:
```sql
DELETE FROM auth.users WHERE id IN (
  SELECT user_id FROM tenant_profiles 
  WHERE property_id = '358c5333-00fd-4efb-b330-3d6e131e9b10' 
  AND is_active = true 
  AND user_id IS NOT NULL
);
```

- [ ] **Step 3: Clear user_id on all IH profiles**

```sql
UPDATE tenant_profiles 
SET user_id = NULL 
WHERE property_id = '358c5333-00fd-4efb-b330-3d6e131e9b10' AND is_active = true;
```

- [ ] **Step 4: Verify cleanup**

```sql
SELECT tp.id, td.full_name, r.unit_code, tp.user_id, tp.role
FROM tenant_profiles tp
LEFT JOIN tenant_details td ON td.tenant_profile_id = tp.id
LEFT JOIN rooms r ON r.id = tp.room_id
WHERE tp.property_id = '358c5333-00fd-4efb-b330-3d6e131e9b10'
ORDER BY r.unit_code;
```

Expected: 6 profiles (IH-PR1, IH-PR3, IH-STD1–4), all with `user_id = null`. No IH-PR2 yet, no duplicate on IH-STD3.

---

### Task 2: Create Edward's Profile (IH-PR2)

**Context:** Edward Jeremy Lo is the IH house captain. He has no profile in the IoT DB. Room IH-PR2 ID is `48296d89-aaa2-4f4a-a6a8-d70fe019c93f`.

- [ ] **Step 1: Create tenant_profile for Edward**

```sql
INSERT INTO tenant_profiles (id, room_id, property_id, role, is_active, monthly_rent, invite_token)
VALUES (
  gen_random_uuid(),
  '48296d89-aaa2-4f4a-a6a8-d70fe019c93f',
  '358c5333-00fd-4efb-b330-3d6e131e9b10',
  'HOUSE_CAPTAIN',
  true,
  1200,
  encode(gen_random_bytes(16), 'hex')
)
RETURNING id, invite_token;
```

Save the returned `id` and `invite_token` — needed for steps below.

- [ ] **Step 2: Create tenant_details for Edward**

```sql
INSERT INTO tenant_details (tenant_profile_id, full_name, phone)
VALUES ('<edward_profile_id>', 'Edward Jeremy Lo', '+6583654765');
```

- [ ] **Step 3: Create onboarding_progress for Edward**

```sql
INSERT INTO onboarding_progress (tenant_profile_id, current_step, status)
VALUES ('<edward_profile_id>', 'PERSONAL_DETAILS', 'ONBOARDING');
```

- [ ] **Step 4: Verify Edward's profile**

```sql
SELECT tp.id, tp.role, tp.invite_token, td.full_name, r.unit_code, op.current_step
FROM tenant_profiles tp
LEFT JOIN tenant_details td ON td.tenant_profile_id = tp.id
LEFT JOIN rooms r ON r.id = tp.room_id
LEFT JOIN onboarding_progress op ON op.tenant_profile_id = tp.id
WHERE r.unit_code = 'IH-PR2';
```

Expected: Edward, HOUSE_CAPTAIN role, invite_token set, PERSONAL_DETAILS step.

---

### Task 3: Reset Onboarding + Generate Invite Tokens for Existing IH Tenants

**Context:** 6 existing IH profiles need: onboarding reset, fresh invite tokens, updated contact info from Millia DB.

- [ ] **Step 1: Generate invite tokens and reset onboarding for all existing IH tenants**

```sql
-- Set invite tokens and clear user_id
UPDATE tenant_profiles 
SET invite_token = encode(gen_random_bytes(16), 'hex'),
    user_id = NULL
WHERE property_id = '358c5333-00fd-4efb-b330-3d6e131e9b10' 
AND is_active = true 
AND invite_token IS NULL;

-- Reset onboarding progress
UPDATE onboarding_progress 
SET current_step = 'PERSONAL_DETAILS',
    status = 'ONBOARDING',
    personal_details_completed_at = NULL,
    id_verification_completed_at = NULL,
    ta_signed_at = NULL,
    ta_document_url = NULL,
    ta_signed_url = NULL,
    deposit_completed_at = NULL,
    deposit_amount = NULL,
    deposit_method = NULL,
    deposit_proof_url = NULL,
    deposit_verified = false,
    house_rules_acknowledged_at = NULL,
    house_rules_version_id = NULL,
    move_in_checklist_completed_at = NULL,
    updated_at = now()
WHERE tenant_profile_id IN (
  SELECT id FROM tenant_profiles 
  WHERE property_id = '358c5333-00fd-4efb-b330-3d6e131e9b10' AND is_active = true
);
```

- [ ] **Step 2: Update tenant_details with correct info from Millia DB**

```sql
-- Dev (IH-PR1): id = 9ed4e300-6556-4d83-a168-ba0f5e60dad2
UPDATE tenant_details SET full_name = 'Dev', phone = '+6580892946' WHERE tenant_profile_id = '9ed4e300-6556-4d83-a168-ba0f5e60dad2';

-- Siti Syafiqah (IH-PR3): id = 21b10606-9c6f-4d08-b4b8-a6e4c352bfbd
UPDATE tenant_details SET full_name = 'Siti Syafiqah', phone = '+6593479923' WHERE tenant_profile_id = '21b10606-9c6f-4d08-b4b8-a6e4c352bfbd';

-- Newtron (IH-STD1): id = f4a0647c-c60e-4a1e-9fba-9ff7d5ba56ee — name was "Nattakan Srisuksai"
UPDATE tenant_details SET full_name = 'Newtron', phone = '+6591977675' WHERE tenant_profile_id = 'f4a0647c-c60e-4a1e-9fba-9ff7d5ba56ee';

-- Paul (IH-STD2): id = a66dcf2c-428d-4ac1-8c84-6f3fda4be355
UPDATE tenant_details SET full_name = 'Paul', phone = '+6591296671' WHERE tenant_profile_id = 'a66dcf2c-428d-4ac1-8c84-6f3fda4be355';

-- Jessi Dang (IH-STD3): id = 3a642ccf-b121-4eab-a719-49a0a088c531
UPDATE tenant_details SET full_name = 'Jessi Dang', phone = '+6590979001' WHERE tenant_profile_id = '3a642ccf-b121-4eab-a719-49a0a088c531';

-- Ciara (IH-STD4): id = 04aeb440-b75b-43c0-a634-ae7fe9040011
UPDATE tenant_details SET full_name = 'Ciara', phone = '+6580574663' WHERE tenant_profile_id = '04aeb440-b75b-43c0-a634-ae7fe9040011';
```

- [ ] **Step 3: Verify all IH tenants ready for invite**

```sql
SELECT tp.id, td.full_name, td.phone, r.unit_code, tp.role, tp.invite_token, tp.user_id, op.current_step
FROM tenant_profiles tp
LEFT JOIN tenant_details td ON td.tenant_profile_id = tp.id
LEFT JOIN rooms r ON r.id = tp.room_id
LEFT JOIN onboarding_progress op ON op.tenant_profile_id = tp.id
WHERE tp.property_id = '358c5333-00fd-4efb-b330-3d6e131e9b10' AND tp.is_active = true
ORDER BY r.unit_code;
```

Expected: 7 tenants, all with invite_token set, user_id null, current_step PERSONAL_DETAILS. Edward has HOUSE_CAPTAIN role.

---

### Task 4: Create property_guides Table + Seed IH Data

- [ ] **Step 1: Create the property_guides table**

Run via `mcp__supabase__apply_migration` with project_id `diiilqpfmlxjwiaeophb`:

```sql
CREATE TABLE property_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) NOT NULL,
  section TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  icon TEXT DEFAULT 'info',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: tenants read own property, admins read/write all
ALTER TABLE property_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can read own property guides" ON property_guides
  FOR SELECT USING (
    property_id IN (
      SELECT property_id FROM tenant_profiles WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Admins can manage all guides" ON property_guides
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_profiles WHERE user_id = auth.uid() AND role = 'ADMIN'
    )
  );
```

- [ ] **Step 2: Seed IH guide data**

Run via `mcp__supabase__execute_sql`:

```sql
INSERT INTO property_guides (property_id, section, title, content, icon, sort_order) VALUES
-- WiFi
('358c5333-00fd-4efb-b330-3d6e131e9b10', 'wifi', 'WiFi', '{"network": "Hyve", "password": "Thehyve2027@"}', 'wifi', 1),

-- Property Info
('358c5333-00fd-4efb-b330-3d6e131e9b10', 'property_info', 'Your Property', 'Ivory Heights, 122 Jurong East Street 21, Singapore', 'home', 2),

-- Building Guide
('358c5333-00fd-4efb-b330-3d6e131e9b10', 'building_guide', 'Building Guide', E'## Access Card Replacement\n\n1. Download your signed Tenancy Agreement from the portal (Dashboard → Documents)\n2. Get it stamped at IRAS (you can do this yourself, or we can handle it for $30 — takes 2 working days)\n3. To request our stamping service: submit a ticket under "Admin / Documents" category\n4. Once you have your stamped TA + stamp certificate, bring both documents to the Ivory Heights management office\n5. The management office will issue your new access card', 'badge', 4),

-- Nearby
('358c5333-00fd-4efb-b330-3d6e131e9b10', 'nearby', 'Nearby', E'**MRT:** Jurong East MRT (NS1/EW24) — 5 min walk\n**Supermarket:** FairPrice at JCube / Giant at Westgate\n**Food:** JCube food court, Jurong East hawker centre, Jem food hall\n**Mall:** Westgate, JCube, IMM\n**Clinic:** Jurong East area has several GP clinics along Jurong East Ave 1', 'restaurant', 5),

-- FAQ
('358c5333-00fd-4efb-b330-3d6e131e9b10', 'faq', 'FAQ', '[{"question":"How do I pay rent?","answer":"Bank transfer details are in your Tenancy Agreement. Pay by the 1st of each month."},{"question":"What''s included in rent?","answer":"Utilities, WiFi, weekly common area cleaning, maintenance."},{"question":"How does AC billing work?","answer":"300 free hours/month. Overage charged at $0.30/hour. Check your usage on the Dashboard."},{"question":"Can I have guests stay over?","answer":"Overnight guests allowed up to 2 nights/week. Inform your house captain."},{"question":"What about noise?","answer":"Quiet hours after 10pm. Use headphones for music/calls."},{"question":"How do I report a maintenance issue?","answer":"Submit a ticket via the portal (Issues → New Issue). Select category and attach photos."},{"question":"How do I get a replacement access card?","answer":"Download your TA from the portal, get it stamped at IRAS (or we handle it for $30 via ticket), then bring both docs to the management office."},{"question":"What''s the stamping service?","answer":"We handle IRAS stamping of your TA for $30. Submit a ticket to request it. Takes 2 working days."}]', 'help', 7),

-- Welcome content (for pre-move-in splash)
('358c5333-00fd-4efb-b330-3d6e131e9b10', 'welcome_bring', 'What to Bring', E'**Essentials:** Personal toiletries, clothes, laptop/charger\n**Optional:** Your own pillow/bedding if you prefer (bedding is provided)\n**Not needed:** Kitchen appliances, cleaning supplies — all provided', 'luggage', 10),

('358c5333-00fd-4efb-b330-3d6e131e9b10', 'welcome_provided', 'What''s Provided', E'**Your Room:** Bed frame, mattress, wardrobe, desk, chair, bedding set\n**Kitchen:** Fridge, stove, microwave, rice cooker, pots & pans, utensils\n**Bathroom:** Washing machine, drying rack\n**Common:** WiFi, cleaning supplies, vacuum, iron', 'inventory_2', 11),

('358c5333-00fd-4efb-b330-3d6e131e9b10', 'welcome_checkin', 'Check-In Instructions', E'**Address:** 122 Jurong East Street 21, Ivory Heights\n**Access:** You''ll receive your access card after completing the TA stamping process\n**Door:** Unit door code will be shared by your house captain, Edward', 'door_front', 12),

('358c5333-00fd-4efb-b330-3d6e131e9b10', 'welcome_documents', 'Documents You''ll Need', E'Have these ready for onboarding:\n- **IC or Passport** — for identity verification\n- **Emergency contact** — name and phone number\n- **Bank details** — for deposit payment reference', 'description', 13);
```

- [ ] **Step 3: Verify seed data**

```sql
SELECT section, title, sort_order FROM property_guides 
WHERE property_id = '358c5333-00fd-4efb-b330-3d6e131e9b10' 
ORDER BY sort_order;
```

Expected: 9 rows covering wifi, property_info, building_guide, nearby, faq, and 4 welcome_* sections.

---

### Task 5: Create usePropertyGuides Hook

**Files:**
- Create: `src/hooks/usePropertyGuides.js`

- [ ] **Step 1: Create the hook**

```jsx
// src/hooks/usePropertyGuides.js
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function usePropertyGuides(propertyId) {
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!propertyId) {
      setLoading(false);
      return;
    }

    async function fetch() {
      const { data, error } = await supabase
        .from("property_guides")
        .select("*")
        .eq("property_id", propertyId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("Error fetching property guides:", error);
      } else {
        setGuides(data ?? []);
      }
      setLoading(false);
    }

    fetch();
  }, [propertyId]);

  const getSection = (section) => guides.find((g) => g.section === section);
  const getSections = (prefix) => guides.filter((g) => g.section.startsWith(prefix));

  return { guides, loading, getSection, getSections };
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mark/Desktop/hyve-website
git add src/hooks/usePropertyGuides.js
git commit -m "feat: add usePropertyGuides hook for property guide data"
```

---

### Task 6: Create WelcomeSplash Component

**Files:**
- Create: `src/components/portal/WelcomeSplash.jsx`

- [ ] **Step 1: Create the welcome splash component**

```jsx
// src/components/portal/WelcomeSplash.jsx
import { useAuth } from "../../hooks/useAuth";
import { usePropertyGuides } from "../../hooks/usePropertyGuides";
import { Button } from "../ui/button";

function GuideCard({ icon, title, content }) {
  return (
    <div className="bg-white border border-[#bbcac6]/15 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#006b5f]/10 flex items-center justify-center shrink-0">
          <span
            className="material-symbols-outlined text-[#006b5f] text-[20px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {icon}
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#121c2a] mb-2">
            {title}
          </h3>
          <div className="font-['Manrope'] text-sm text-[#555f6f] leading-relaxed whitespace-pre-wrap">
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WelcomeSplash({ onContinue }) {
  const { profile } = useAuth();
  const propertyId = profile?.rooms?.property_id ?? profile?.property_id;
  const propertyName = profile?.properties?.name ?? "Hyve";
  const { getSections, getSection, loading } = usePropertyGuides(propertyId);

  const welcomeGuides = getSections("welcome_");
  const houseRulesPreview = "Quiet hours after 10pm. Clean up shared spaces after use. Overnight guests allowed up to 2 nights/week — inform your house captain.";

  // Get house captain info
  const captainSection = getSection("house_captain");

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="text-center py-4">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#006b5f]/10 flex items-center justify-center">
          <span
            className="material-symbols-outlined text-[#006b5f] text-[36px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            celebration
          </span>
        </div>
        <h2 className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-[#121c2a] mb-2">
          Welcome to {propertyName}!
        </h2>
        <p className="font-['Manrope'] text-sm text-[#555f6f] max-w-md mx-auto leading-relaxed">
          Here's everything you need to know before moving in. Take a moment to review, then we'll get you set up.
        </p>
      </div>

      {/* Guide cards from DB */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {welcomeGuides.map((guide) => (
          <GuideCard
            key={guide.id}
            icon={guide.icon}
            title={guide.title}
            content={guide.content}
          />
        ))}

        {/* House rules preview — always shown */}
        <GuideCard
          icon="gavel"
          title="House Rules Preview"
          content={houseRulesPreview}
        />

        {/* Nearby essentials from DB */}
        {getSection("nearby") && (
          <GuideCard
            icon={getSection("nearby").icon}
            title={getSection("nearby").title}
            content={getSection("nearby").content}
          />
        )}
      </div>

      {/* CTA */}
      <div className="text-center pt-4">
        <Button
          onClick={onContinue}
          className="bg-[#006b5f] hover:bg-[#005a50] text-white font-['Manrope'] font-bold px-8 py-3 rounded-xl text-sm"
        >
          <span className="material-symbols-outlined text-[18px] mr-2">arrow_forward</span>
          Let's Get Started
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mark/Desktop/hyve-website
git add src/components/portal/WelcomeSplash.jsx
git commit -m "feat: add WelcomeSplash pre-move-in guide component"
```

---

### Task 7: Add WELCOME Step to Onboarding Flow

**Files:**
- Modify: `src/hooks/useOnboarding.js`
- Modify: `src/pages/portal/OnboardingPage.jsx`

- [ ] **Step 1: Add WELCOME to the steps array in useOnboarding.js**

In `src/hooks/useOnboarding.js`, update the STEPS and STEP_LABELS:

Replace:
```js
export const STEPS = [
  "PERSONAL_DETAILS",
```

With:
```js
export const STEPS = [
  "WELCOME",
  "PERSONAL_DETAILS",
```

Replace:
```js
export const STEP_LABELS = {
  PERSONAL_DETAILS: "Personal Details",
```

With:
```js
export const STEP_LABELS = {
  WELCOME: "Welcome Guide",
  PERSONAL_DETAILS: "Personal Details",
```

- [ ] **Step 2: Update OnboardingPage.jsx to render WelcomeSplash**

In `src/pages/portal/OnboardingPage.jsx`, add the import at the top:

```jsx
import WelcomeSplash from "../../components/portal/WelcomeSplash";
```

Add to STEP_DESCRIPTIONS:
```js
WELCOME:
  "Review your pre-move-in guide before we get started with onboarding.",
```

Add to STEP_ICONS:
```js
WELCOME: "celebration",
```

Add to STEP_ORDER (before PERSONAL_DETAILS):
```js
"WELCOME",
```

Add the WELCOME case in the `StepContent` switch, before PERSONAL_DETAILS:
```jsx
case "WELCOME":
  return (
    <WelcomeSplash
      onContinue={() => advanceStep(null)}
    />
  );
```

- [ ] **Step 3: Verify the onboarding flow still renders correctly**

Run: `cd /Users/mark/Desktop/hyve-website && npm run dev`

Navigate to `/portal/onboarding` — should show WELCOME as first step with the splash content, then Personal Details as step 2.

- [ ] **Step 4: Commit**

```bash
cd /Users/mark/Desktop/hyve-website
git add src/hooks/useOnboarding.js src/pages/portal/OnboardingPage.jsx
git commit -m "feat: add WELCOME pre-move-in guide as first onboarding step"
```

---

### Task 8: Create PropertyGuidePage

**Files:**
- Create: `src/pages/portal/PropertyGuidePage.jsx`

- [ ] **Step 1: Create the Property Guide page**

```jsx
// src/pages/portal/PropertyGuidePage.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { usePropertyGuides } from "../../hooks/usePropertyGuides";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";

function WiFiCard({ guide }) {
  const [copied, setCopied] = useState(false);
  let network = "", password = "";
  try {
    const parsed = JSON.parse(guide.content);
    network = parsed.network;
    password = parsed.password;
  } catch { 
    return null; 
  }

  function copyPassword() {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white border border-[#bbcac6]/15 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#006b5f]/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[#006b5f] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>wifi</span>
        </div>
        <div>
          <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#121c2a] mb-3">WiFi</h3>
          <div className="space-y-2">
            <div>
              <span className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">Network</span>
              <p className="font-['Manrope'] text-sm font-semibold text-[#121c2a]">{network}</p>
            </div>
            <div>
              <span className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">Password</span>
              <div className="flex items-center gap-2">
                <p className="font-['Manrope'] text-sm font-semibold text-[#121c2a] font-mono">{password}</p>
                <button onClick={copyPassword} className="text-[#006b5f] hover:text-[#005a50]">
                  <span className="material-symbols-outlined text-[16px]">{copied ? "check" : "content_copy"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FAQCard({ guide }) {
  const [openIndex, setOpenIndex] = useState(null);
  let faqs = [];
  try { faqs = JSON.parse(guide.content); } catch { return null; }

  return (
    <div className="bg-white border border-[#bbcac6]/15 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#006b5f]/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[#006b5f] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>help</span>
        </div>
        <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#121c2a] pt-2">FAQ</h3>
      </div>
      <div className="space-y-1 ml-14">
        {faqs.map((faq, idx) => (
          <div key={idx} className="border-b border-[#bbcac6]/10 last:border-0">
            <button
              onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
              className="w-full flex items-center justify-between py-3 text-left"
            >
              <span className="font-['Manrope'] text-sm font-semibold text-[#121c2a]">{faq.question}</span>
              <span className="material-symbols-outlined text-[16px] text-[#6c7a77] transition-transform" style={{ transform: openIndex === idx ? "rotate(180deg)" : "rotate(0)" }}>expand_more</span>
            </button>
            {openIndex === idx && (
              <p className="font-['Manrope'] text-sm text-[#555f6f] pb-3 leading-relaxed">{faq.answer}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function GuideCard({ guide }) {
  return (
    <div className="bg-white border border-[#bbcac6]/15 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#006b5f]/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[#006b5f] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>{guide.icon}</span>
        </div>
        <div className="min-w-0">
          <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#121c2a] mb-2">{guide.title}</h3>
          <div className="font-['Manrope'] text-sm text-[#555f6f] leading-relaxed whitespace-pre-wrap">{guide.content}</div>
        </div>
      </div>
    </div>
  );
}

function HouseCaptainCard({ propertyId }) {
  const [captain, setCaptain] = useState(null);

  useEffect(() => {
    async function fetchCaptain() {
      const { data } = await supabase
        .from("tenant_profiles")
        .select("*, rooms(name, unit_code), tenant_details:tenant_details(full_name, phone)")
        .eq("property_id", propertyId)
        .eq("role", "HOUSE_CAPTAIN")
        .eq("is_active", true)
        .maybeSingle();
      setCaptain(data);
    }
    if (propertyId) fetchCaptain();
  }, [propertyId]);

  if (!captain) return null;

  const name = captain.tenant_details?.[0]?.full_name ?? captain.tenant_details?.full_name ?? "House Captain";
  const phone = captain.tenant_details?.[0]?.phone ?? captain.tenant_details?.phone ?? "";

  return (
    <div className="bg-white border border-[#bbcac6]/15 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#006b5f]/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[#006b5f] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
        </div>
        <div>
          <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#121c2a] mb-1">House Captain</h3>
          <p className="font-['Manrope'] text-sm font-semibold text-[#121c2a]">{name}</p>
          {phone && (
            <a href={`https://wa.me/${phone.replace(/[^0-9]/g, "")}`} className="font-['Manrope'] text-sm text-[#006b5f] hover:underline">{phone}</a>
          )}
          <p className="font-['Manrope'] text-xs text-[#6c7a77] mt-1">Your first point of contact for day-to-day questions at the apartment.</p>
        </div>
      </div>
    </div>
  );
}

function HouseRulesCard({ propertyId }) {
  const [rules, setRules] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchRules() {
      const { data } = await supabase
        .from("house_rules")
        .select("*")
        .eq("property_id", propertyId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) {
        const { data: global } = await supabase
          .from("house_rules")
          .select("*")
          .is("property_id", null)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setRules(global);
      } else {
        setRules(data);
      }
    }
    if (propertyId) fetchRules();
  }, [propertyId]);

  if (!rules) return null;

  return (
    <div className="bg-white border border-[#bbcac6]/15 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#006b5f]/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[#006b5f] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>gavel</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#121c2a]">House Rules</h3>
            <button onClick={() => setExpanded(!expanded)} className="text-[#006b5f] font-['Manrope'] text-xs font-semibold hover:underline">
              {expanded ? "Collapse" : "View All"}
            </button>
          </div>
          {expanded ? (
            <div className="font-['Manrope'] text-sm text-[#555f6f] whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">{rules.content}</div>
          ) : (
            <p className="font-['Manrope'] text-sm text-[#555f6f]">
              {rules.title ?? "Community guidelines for shared living"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PropertyGuidePage() {
  const { profile } = useAuth();
  const propertyId = profile?.rooms?.property_id ?? profile?.property_id;
  const propertyName = profile?.properties?.name ?? "Hyve";
  const { guides, loading, getSection } = usePropertyGuides(propertyId);

  const wifi = getSection("wifi");
  const propertyInfo = getSection("property_info");
  const buildingGuide = getSection("building_guide");
  const nearby = getSection("nearby");
  const faq = getSection("faq");

  return (
    <PortalLayout>
      <div className="max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
            My Property
          </h1>
          <p className="font-['Manrope'] text-[#6c7a77] font-medium mt-1">
            Everything you need to know about living at {propertyName}
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {wifi && <WiFiCard guide={wifi} />}
            {propertyInfo && <GuideCard guide={propertyInfo} />}
            <HouseCaptainCard propertyId={propertyId} />
            {buildingGuide && <GuideCard guide={buildingGuide} />}
            {nearby && <GuideCard guide={nearby} />}
            <HouseRulesCard propertyId={propertyId} />
            {faq && <FAQCard guide={faq} />}

            {/* Submit an Issue CTA */}
            <div className="bg-white border border-[#bbcac6]/15 rounded-2xl p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#006b5f]/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#006b5f] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>build</span>
                </div>
                <div>
                  <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#121c2a] mb-1">Submit an Issue</h3>
                  <p className="font-['Manrope'] text-sm text-[#555f6f] mb-3">Maintenance, repairs, or complaints — we'll assign it to a vendor.</p>
                  <Link to="/portal/issues/new" className="inline-flex items-center gap-2 bg-[#006b5f] text-white rounded-xl px-5 py-2.5 font-['Manrope'] font-bold text-sm hover:bg-[#005a50] transition-colors">
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    New Issue
                  </Link>
                </div>
              </div>
            </div>

            {/* Contact Hyve — last resort */}
            <div className="bg-[#eff4ff] border border-[#bbcac6]/10 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#006b5f] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>support</span>
                </div>
                <div>
                  <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#121c2a] mb-1">Contact Hyve</h3>
                  <p className="font-['Manrope'] text-xs text-[#6c7a77] mb-2">Checked the FAQ and submitted a ticket first?</p>
                  <a
                    href="https://wa.me/6580885410"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-['Manrope'] text-sm font-semibold text-[#006b5f] hover:underline"
                  >
                    <span className="material-symbols-outlined text-[16px]">chat</span>
                    WhatsApp +65 8088 5410
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mark/Desktop/hyve-website
git add src/pages/portal/PropertyGuidePage.jsx
git commit -m "feat: add PropertyGuidePage with WiFi, building guide, FAQ, house captain, and escalation hierarchy"
```

---

### Task 9: Add Route + Nav Link

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/portal/PortalLayout.jsx`

- [ ] **Step 1: Add PropertyGuidePage import and route to App.jsx**

In `src/App.jsx`, add the import after the other portal page imports:

```jsx
import PropertyGuidePage from './pages/portal/PropertyGuidePage';
```

Add the route after the `/portal/billing` route block:

```jsx
<Route
  path="/portal/guide"
  element={
    <AuthGuard>
      <PropertyGuidePage />
    </AuthGuard>
  }
/>
```

- [ ] **Step 2: Add "My Property" nav link to PortalLayout.jsx**

In `src/components/portal/PortalLayout.jsx`, update all three nav arrays to include the guide link after Dashboard:

Update `TENANT_NAV`:
```js
const TENANT_NAV = [
  { label: "Dashboard", to: "/portal/dashboard", icon: "dashboard" },
  { label: "My Property", to: "/portal/guide", icon: "home" },
  { label: "Billing", to: "/portal/billing", icon: "payments" },
  { label: "Issues", to: "/portal/issues", icon: "build" },
];
```

Update `HOUSE_CAPTAIN_NAV`:
```js
const HOUSE_CAPTAIN_NAV = [
  { label: "Dashboard", to: "/portal/dashboard", icon: "dashboard" },
  { label: "My Property", to: "/portal/guide", icon: "home" },
  { label: "Billing", to: "/portal/billing", icon: "payments" },
  { label: "Issues", to: "/portal/issues", icon: "build" },
  { label: "Property Overview", to: "/portal/property", icon: "apartment" },
  { label: "Tickets", to: "/portal/property/tickets", icon: "confirmation_number" },
  { label: "Tenants", to: "/portal/property/tenants", icon: "group" },
];
```

Update `ADMIN_NAV`:
```js
const ADMIN_NAV = [
  { label: "Dashboard", to: "/portal/dashboard", icon: "dashboard" },
  { label: "My Property", to: "/portal/guide", icon: "home" },
  { label: "Billing", to: "/portal/billing", icon: "payments" },
  { label: "Issues", to: "/portal/issues", icon: "build" },
  { label: "Admin", to: "/portal/admin", icon: "admin_panel_settings" },
  // ... rest unchanged
```

- [ ] **Step 3: Verify**

Run: `cd /Users/mark/Desktop/hyve-website && npm run dev`

Check that "My Property" appears in the sidebar for all roles, and navigating to `/portal/guide` shows the guide page.

- [ ] **Step 4: Commit**

```bash
cd /Users/mark/Desktop/hyve-website
git add src/App.jsx src/components/portal/PortalLayout.jsx
git commit -m "feat: add /portal/guide route and My Property nav link for all roles"
```

---

### Task 10: QA — End-to-End Verification

**Context:** Before touching live tenant data or sending messages, verify the entire flow works.

- [ ] **Step 1: Run dev server and verify Property Guide page**

Run: `cd /Users/mark/Desktop/hyve-website && npm run dev`

Check `/portal/guide`:
- WiFi card shows network "Hyve" and password "Thehyve2027@" with copy button
- Property info card shows Ivory Heights address
- House captain card shows Edward with WhatsApp link
- Building Guide shows access card replacement steps
- Nearby shows MRT, food, malls
- House Rules card shows with expand/collapse
- FAQ accordion works — all 8 questions expand correctly
- "Submit an Issue" button links to `/portal/issues/new`
- "Contact Hyve" WhatsApp link works
- Correct escalation order: FAQ → Ticket → Contact

- [ ] **Step 2: Verify Welcome Splash in onboarding**

Navigate to `/portal/onboarding`:
- WELCOME shows as first step in timeline
- WelcomeSplash renders with "Welcome to Ivory Heights 122!" header
- All guide cards render (What to Bring, What's Provided, Check-In, Documents)
- House rules preview shows
- Nearby section shows
- "Let's Get Started" button advances to PERSONAL_DETAILS
- Step counter shows correct total (7 steps including WELCOME)
- Back button from PERSONAL_DETAILS returns to WELCOME

- [ ] **Step 3: Verify nav link appears for all roles**

Check PortalLayout sidebar:
- TENANT nav: Dashboard → My Property → Billing → Issues
- HOUSE_CAPTAIN nav: Dashboard → My Property → Billing → Issues → Property Overview → Tickets → Tenants
- ADMIN nav: Dashboard → My Property → Billing → Issues → Admin → Manage dropdown

- [ ] **Step 4: Verify mobile layout**

Resize browser to mobile width:
- Property Guide page renders correctly on small screens
- Cards stack vertically
- FAQ accordion works on mobile
- Bottom nav shows correctly

- [ ] **Step 5: Report QA results to Mark**

Summarise what passed, what failed, any issues found. Fix any issues before proceeding to Task 11.

---

### Task 11: DB Reset — Onboarding Reset for IH Tenants

**Context:** QA passed. Now reset real tenant data. Run Tasks 1-3 SQL against live IoT DB.

- [ ] **Step 1: Execute Task 1 SQL (cleanup stale profiles + auth users)**
- [ ] **Step 2: Execute Task 2 SQL (create Edward's profile)**
- [ ] **Step 3: Execute Task 3 SQL (reset onboarding + invite tokens + update details)**
- [ ] **Step 4: Run verification query to confirm all 7 IH tenants are ready**

---

### Task 12: Send Invite Messages via Beeper (BLOCKED — waiting for Mark's new Beeper skill)

**Context:** Mark is writing a new Beeper skill. This task is on hold until that's ready.

- [ ] **Step 1: Fetch all IH invite tokens**

```sql
SELECT td.full_name, td.phone, tp.invite_token, tp.role, r.unit_code
FROM tenant_profiles tp
JOIN tenant_details td ON td.tenant_profile_id = tp.id
JOIN rooms r ON r.id = tp.room_id
WHERE tp.property_id = '358c5333-00fd-4efb-b330-3d6e131e9b10' AND tp.is_active = true
ORDER BY r.unit_code;
```

Record each tenant's name, phone, token, and role.

- [ ] **Step 2: Send Edward's messages first (HOUSE_CAPTAIN)**

Look up Edward's WhatsApp chat by phone `+6583654765`.

Send 5 messages sequentially:

1. `Hey Edward! This is Claudine from Hyve. We've just launched our tenant portal and you've been set up as the house captain for Ivory Heights.`
2. `Here's your invite link: https://hyve-website.vercel.app/portal/signup?token=[EDWARD_TOKEN]`
3. `As house captain you can:\n- See all rooms and tenants in the apartment\n- Triage maintenance tickets and assign to vendors\n- Access the full property guide\n- Plus everything regular tenants get (TA download, AC usage, billing)`
4. `The other tenants will also be getting their invite links today. They'll be told you're the house captain for day-to-day stuff.`
5. `Any questions just ping me here!`

- [ ] **Step 3: Send messages to remaining IH tenants**

For each of: Dev, Siti Syafiqah, Newtron, Paul, Jessi Dang, Ciara — look up WhatsApp by phone and send 5 messages:

1. `Hey [Name]! This is Claudine from Hyve. We've just launched our tenant portal — it's where you'll manage everything for your stay.`
2. `Here's your invite link to set up your account: https://hyve-website.vercel.app/portal/signup?token=[TOKEN]`
3. `Once you're in you can:\n- Download your signed Tenancy Agreement\n- Submit maintenance issues (gets assigned to vendors directly)\n- Track your AC usage and billing\n- Access your property guide (WiFi, building info, etc.)`
4. `Quick heads up — if you need a replacement access card, the process is: download your TA from the portal, get it stamped at IRAS (or we can do it for $30, takes 2 working days), then bring both docs to the management office.`
5. `Any questions just ping me here. Edward is also your house captain so he can help with day-to-day stuff at the apartment.`

- [ ] **Step 4: Verify all messages sent**

Check Beeper to confirm all 7 conversations have the invite messages.

---

### Task 13: Push to GitHub and Deploy

- [ ] **Step 1: Push all changes**

```bash
cd /Users/mark/Desktop/hyve-website
git push origin master
```

Vercel auto-deploys from master. Wait for deployment to complete.

- [ ] **Step 2: Verify deployment**

Navigate to `https://hyve-website.vercel.app/portal/guide` — should show the Property Guide page (will show login prompt since not authenticated).

Test one invite link by navigating to `https://hyve-website.vercel.app/portal/signup?token=[ANY_TOKEN]` — should show the signup form.
