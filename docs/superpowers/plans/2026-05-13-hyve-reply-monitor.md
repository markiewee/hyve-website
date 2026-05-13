# Hyve Reply Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an end-to-end sales pipeline for Hyve SG WhatsApp prospects — a skill that sweeps Beeper, drafts room-specific sales replies for one-by-one approval, and a Kanban portal page (`/portal/admin/leads`) for monitoring.

**Architecture:** Three independent components communicating via Supabase as the shared store. Skill (`~/.claude/skills/hyve-reply-monitor/`) is the orchestrator. Supabase `leads` table is the source of truth. `/portal/admin/leads` React page subscribes to Realtime updates. Skill delegates viewings to existing `hyve-viewing-coordinator`.

**Tech Stack:** Node.js scripts (skill helpers), Supabase Postgres + Realtime, React + Vite + Tailwind + shadcn (portal), `@dnd-kit/core` (drag-drop), Beeper MCP, Claude-as-LLM for intent extraction.

**Spec:** `docs/superpowers/specs/2026-05-13-hyve-reply-monitor-design.md`

**Worktree:** `/Users/mark/Desktop/hyve-reply-monitor` (branch `feat/hyve-reply-monitor`)

**Supabase project:** `diiilqpfmlxjwiaeophb` (PAT at `.secrets/supabase-pat.txt`, chmod 600, gitignored)

---

## File Structure

### New files

```
~/.claude/skills/hyve-reply-monitor/
├── Skill.md                              # Main orchestrator + activation phrases
├── README.md                             # Quickstart for Mark
├── prompts/
│   ├── classify-chat.md                  # Classification prompt template
│   ├── extract-intent.md                 # Intent extraction prompt template
│   └── draft-reply.md                    # Sales reply prompt template
└── lib/
    ├── query-rooms.js                    # Supabase room+tenancy query helper
    ├── upsert-lead.js                    # Idempotent UPSERT helper
    ├── classify-helpers.js               # Phone/regex helpers for classification
    └── __tests__/
        ├── query-rooms.test.js
        ├── upsert-lead.test.js
        └── classify-helpers.test.js
```

In repo (`/Users/mark/Desktop/hyve-reply-monitor`):

```
supabase/migrations/
└── 20260513000000_leads.sql              # Table + types + RLS + Realtime

src/pages/portal/
└── AdminLeadsPage.jsx                    # Main Kanban page

src/components/portal/leads/
├── LeadColumn.jsx                        # One Kanban column
├── LeadCard.jsx                          # Card UI
└── LeadDrawer.jsx                        # Click-card drawer with edit fields

src/hooks/
└── useLeads.js                           # Realtime-backed leads hook

scripts/
└── seed-leads.mjs                        # Insert ~10 fake leads for portal dev

docs/superpowers/specs/
└── 2026-05-13-hyve-reply-monitor-design.md  # (already exists)

docs/superpowers/plans/
└── 2026-05-13-hyve-reply-monitor.md      # (this file)
```

### Modified files

```
src/App.jsx                                # Register /portal/admin/leads route
src/components/portal/PortalLayout.jsx     # Add "Leads" sidebar entry under People
```

Boundaries: skill helpers under `lib/` are pure functions, easily unit-tested with fixtures. Portal components are split by responsibility (column / card / drawer). The hook owns realtime + caching. `AdminLeadsPage` only composes — no logic.

---

## Task 1: Supabase migration — `leads` table

**Files:**
- Create: `supabase/migrations/20260513000000_leads.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/migrations/20260513000000_leads.sql

create type lead_source as enum (
  'airbnb', 'propertyguru', 'carousell', 'roomies',
  'whatsapp_direct', 'agent_referral', 'other'
);

create type lead_status as enum (
  'new', 'qualified', 'viewing_booked', 'viewing_done',
  'agreement_sent', 'signed', 'lost', 'cold'
);

create table public.leads (
  id           uuid primary key default gen_random_uuid(),
  chat_id      text unique not null,
  name         text,
  phone        text,
  source       lead_source not null default 'other',
  intent       jsonb not null default '{}'::jsonb,
  matched_room_codes text[] not null default '{}',
  status       lead_status not null default 'new',
  status_changed_at timestamptz not null default now(),
  last_message_at timestamptz,
  last_reply_at timestamptz,
  last_message_excerpt text,
  owner        text not null default 'mark',
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index leads_status_idx on public.leads (status);
create index leads_last_message_at_idx on public.leads (last_message_at desc);
create index leads_chat_id_idx on public.leads (chat_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if new.status is distinct from old.status then
    new.status_changed_at = now();
  end if;
  return new;
end;
$$;

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

alter table public.leads enable row level security;

create policy "admin full access" on public.leads
  for all using (
    auth.jwt() ->> 'role' in ('admin', 'service_role')
  );

alter publication supabase_realtime add table public.leads;
```

- [ ] **Step 2: Apply migration to Supabase via Management API**

Run:
```bash
cd /Users/mark/Desktop/hyve-reply-monitor
PAT=$(cat .secrets/supabase-pat.txt)
SQL=$(cat supabase/migrations/20260513000000_leads.sql | jq -Rs .)
curl -sS -X POST \
  -H "Authorization: Bearer $PAT" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $SQL}" \
  https://api.supabase.com/v1/projects/diiilqpfmlxjwiaeophb/database/query
```

Expected: `[]` (empty result set, no error)

- [ ] **Step 3: Verify schema with a SELECT**

Run:
```bash
PAT=$(cat .secrets/supabase-pat.txt)
curl -sS -X POST \
  -H "Authorization: Bearer $PAT" \
  -H "Content-Type: application/json" \
  -d '{"query": "select column_name, data_type from information_schema.columns where table_schema=\"public\" and table_name=\"leads\" order by ordinal_position;"}' \
  https://api.supabase.com/v1/projects/diiilqpfmlxjwiaeophb/database/query
```

Expected: 15 rows including `id`, `chat_id`, `intent`, `status`, etc.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260513000000_leads.sql
git commit -m "feat(db): leads table for hyve-reply-monitor pipeline"
```

---

## Task 2: Seed script

**Files:**
- Create: `scripts/seed-leads.mjs`

- [ ] **Step 1: Write the seed script**

```js
// scripts/seed-leads.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const PAT = readFileSync(".secrets/supabase-pat.txt", "utf8").trim();
const SUPABASE_URL = "https://diiilqpfmlxjwiaeophb.supabase.co";

// service role key required for inserts under RLS — read from env
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY before running");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const seeds = [
  { chat_id: "seed-001", name: "Alex Chen", phone: "+6591234567", source: "airbnb",
    intent: { room_type: "standard", budget_max: 1200, move_in_date: "2026-06-15", profile_notes: "Singaporean, working at Grab" },
    matched_room_codes: ["IH-STD2"], status: "new",
    last_message_at: new Date().toISOString(),
    last_message_excerpt: "Hi! Saw your listing — any std rooms in IH for June?" },
  { chat_id: "seed-002", name: "Priya N", phone: "+6598887766", source: "propertyguru",
    intent: { room_type: "premium", budget_max: 1500, move_in_date: "2026-06-01" },
    matched_room_codes: ["CHP-PR2"], status: "qualified",
    last_message_at: new Date(Date.now() - 86400000).toISOString(),
    last_message_excerpt: "OK budget is 1500 max — any premium rooms?" },
  { chat_id: "seed-003", name: "Marcus L", phone: "+6582223333", source: "carousell",
    intent: { room_type: "master", budget_max: 2500 },
    matched_room_codes: ["TG-MBR1"], status: "viewing_booked",
    last_message_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    last_message_excerpt: "Confirmed viewing Friday 7pm" },
  { chat_id: "seed-004", name: "Anna K", phone: "+6595556677", source: "roomies",
    intent: { room_type: "standard", budget_max: 1000 },
    matched_room_codes: ["IH-STD3"], status: "viewing_done",
    last_message_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    last_message_excerpt: "Thanks for the viewing today!" },
  { chat_id: "seed-005", name: "Raj P", phone: "+6593334444", source: "agent_referral",
    intent: { room_type: "premium", budget_max: 1400 },
    matched_room_codes: ["CHP-PR1"], status: "agreement_sent",
    last_message_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    last_message_excerpt: "Got the TA, reviewing with my wife" },
  { chat_id: "seed-006", name: "Stale lead", phone: "+6500000000", source: "other",
    intent: { room_type: "standard", budget_max: 900 },
    matched_room_codes: [], status: "qualified",
    last_message_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    last_message_excerpt: "Will let you know soon" },
];

const { data, error } = await sb.from("leads").upsert(seeds, { onConflict: "chat_id" }).select();
if (error) { console.error(error); process.exit(1); }
console.log(`Seeded ${data.length} leads`);
```

- [ ] **Step 2: Get the service role key from Supabase + add to gitignored env**

Manual: Mark sets `SUPABASE_SERVICE_ROLE_KEY` in his shell or in `.env.local` (already gitignored). Then runs:

```bash
cd /Users/mark/Desktop/hyve-reply-monitor
SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/seed-leads.mjs
```

Expected output: `Seeded 6 leads`

- [ ] **Step 3: Verify in DB**

```bash
PAT=$(cat .secrets/supabase-pat.txt)
curl -sS -X POST \
  -H "Authorization: Bearer $PAT" \
  -H "Content-Type: application/json" \
  -d '{"query": "select chat_id, name, status from public.leads order by created_at;"}' \
  https://api.supabase.com/v1/projects/diiilqpfmlxjwiaeophb/database/query
```

Expected: 6 rows with chat_ids seed-001 through seed-006.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-leads.mjs
git commit -m "chore(seed): leads seed script for portal dev"
```

---

## Task 3: Realtime hook — `useLeads`

**Files:**
- Create: `src/hooks/useLeads.js`

- [ ] **Step 1: Write the hook**

```js
// src/hooks/useLeads.js
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export function useLeads({ includeArchived = false } = {}) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("leads").select("*").order("last_message_at", { ascending: false });
    if (!includeArchived) {
      query = query.not("status", "in", "(signed,lost,cold)");
    }
    const { data, error } = await query;
    if (error) setError(error);
    else setLeads(data);
    setLoading(false);
  }, [includeArchived]);

  useEffect(() => {
    fetchLeads();
    const channel = supabase
      .channel("leads_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        fetchLeads();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLeads]);

  const updateStatus = useCallback(async (id, status) => {
    const { error } = await supabase.from("leads").update({ status }).eq("id", id);
    if (error) throw error;
  }, []);

  const updateLead = useCallback(async (id, patch) => {
    const { error } = await supabase.from("leads").update(patch).eq("id", id);
    if (error) throw error;
  }, []);

  return { leads, loading, error, updateStatus, updateLead, refresh: fetchLeads };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useLeads.js
git commit -m "feat(hooks): useLeads with realtime + status/patch mutations"
```

---

## Task 4: `LeadCard` component

**Files:**
- Create: `src/components/portal/leads/LeadCard.jsx`

- [ ] **Step 1: Write the card component**

```jsx
// src/components/portal/leads/LeadCard.jsx
import { useDraggable } from "@dnd-kit/core";

const SOURCE_BADGES = {
  airbnb: "bg-rose-100 text-rose-700",
  propertyguru: "bg-orange-100 text-orange-700",
  carousell: "bg-red-100 text-red-700",
  roomies: "bg-blue-100 text-blue-700",
  whatsapp_direct: "bg-green-100 text-green-700",
  agent_referral: "bg-purple-100 text-purple-700",
  other: "bg-slate-100 text-slate-700",
};

const STALE_WINDOWS = {
  qualified: 14,
  viewing_done: 7,
  agreement_sent: 7,
};

function isStale(lead) {
  const days = STALE_WINDOWS[lead.status];
  if (!days || !lead.last_message_at) return false;
  const ageMs = Date.now() - new Date(lead.last_message_at).getTime();
  return ageMs > days * 86400000;
}

function timeAgo(iso) {
  if (!iso) return "—";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export function LeadCard({ lead, onClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const stale = isStale(lead);

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.5 : 1 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onClick(lead)}
      className={`bg-white rounded-md shadow-sm p-3 mb-2 cursor-grab active:cursor-grabbing
        border-2 ${stale ? "border-yellow-400" : "border-transparent"}
        hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="font-medium text-sm">{lead.name || "(no name)"}</div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${SOURCE_BADGES[lead.source] || SOURCE_BADGES.other}`}>
          {lead.source}
        </span>
      </div>
      {lead.last_message_excerpt && (
        <div className="text-xs text-slate-600 line-clamp-2 mb-2">{lead.last_message_excerpt}</div>
      )}
      {lead.matched_room_codes?.length > 0 && (
        <div className="text-[11px] text-slate-500 mb-1">
          {lead.matched_room_codes.join(", ")}
        </div>
      )}
      <div className="text-[10px] text-slate-400">⏱ {timeAgo(lead.last_message_at)} ago</div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/portal/leads/LeadCard.jsx
git commit -m "feat(leads): LeadCard with source badge + stale highlight + drag-handle"
```

---

## Task 5: `LeadColumn` component

**Files:**
- Create: `src/components/portal/leads/LeadColumn.jsx`

- [ ] **Step 1: Write the column component**

```jsx
// src/components/portal/leads/LeadColumn.jsx
import { useDroppable } from "@dnd-kit/core";
import { LeadCard } from "./LeadCard";

const COLUMN_LABELS = {
  new: "New",
  qualified: "Qualified",
  viewing_booked: "Viewing Booked",
  viewing_done: "Viewing Done",
  agreement_sent: "Agreement Sent",
  signed: "Signed",
  lost: "Lost",
  cold: "Cold",
};

export function LeadColumn({ status, leads, onCardClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col min-w-[260px] w-[260px] bg-slate-50 rounded-lg p-2">
      <div className="px-1 pb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{COLUMN_LABELS[status]}</h3>
        <span className="text-xs text-slate-500">{leads.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] rounded transition-colors ${isOver ? "bg-slate-200" : ""}`}
      >
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onClick={onCardClick} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/portal/leads/LeadColumn.jsx
git commit -m "feat(leads): LeadColumn drop-target with count"
```

---

## Task 6: `LeadDrawer` component

**Files:**
- Create: `src/components/portal/leads/LeadDrawer.jsx`

- [ ] **Step 1: Write the drawer**

```jsx
// src/components/portal/leads/LeadDrawer.jsx
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const STATUSES = [
  "new", "qualified", "viewing_booked", "viewing_done",
  "agreement_sent", "signed", "lost", "cold",
];

export function LeadDrawer({ lead, open, onOpenChange, onSave }) {
  const [draft, setDraft] = useState(lead || {});

  useEffect(() => { if (lead) setDraft(lead); }, [lead]);
  if (!lead) return null;

  const beeperLink = `/open/${encodeURIComponent(lead.chat_id)}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{lead.name || "(no name)"} — {lead.phone || ""}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-xs text-slate-500">Status</label>
            <select
              className="w-full mt-1 border rounded px-2 py-1 text-sm"
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Matched rooms (comma-separated)</label>
            <input
              className="w-full mt-1 border rounded px-2 py-1 text-sm"
              value={(draft.matched_room_codes || []).join(", ")}
              onChange={(e) => setDraft({
                ...draft,
                matched_room_codes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              })}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Intent (JSON)</label>
            <Textarea
              rows={6}
              value={JSON.stringify(draft.intent || {}, null, 2)}
              onChange={(e) => {
                try { setDraft({ ...draft, intent: JSON.parse(e.target.value) }); } catch {}
              }}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Notes</label>
            <Textarea
              rows={4}
              value={draft.notes || ""}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>
          <div className="text-xs text-slate-500">
            Last message: <span className="text-slate-700">{lead.last_message_excerpt || "—"}</span>
          </div>
          <div className="flex gap-2 pt-4">
            <Button onClick={() => onSave(draft).then(() => onOpenChange(false))}>Save</Button>
            <Button variant="outline" asChild>
              <a href={beeperLink} target="_blank" rel="noreferrer">Open in Beeper</a>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Verify shadcn `Sheet` exists; if not, install**

Run:
```bash
cd /Users/mark/Desktop/hyve-reply-monitor
ls src/components/ui/sheet.* 2>/dev/null || npx shadcn@latest add sheet
```

- [ ] **Step 3: Commit**

```bash
git add src/components/portal/leads/LeadDrawer.jsx
git commit -m "feat(leads): LeadDrawer with editable intent/status/notes + Beeper deeplink"
```

---

## Task 7: `AdminLeadsPage` — Kanban composition

**Files:**
- Create: `src/pages/portal/AdminLeadsPage.jsx`
- Modify: `src/App.jsx` (add route + import)

- [ ] **Step 1: Write the page**

```jsx
// src/pages/portal/AdminLeadsPage.jsx
import { useState } from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { useLeads } from "@/hooks/useLeads";
import { LeadColumn } from "@/components/portal/leads/LeadColumn";
import { LeadDrawer } from "@/components/portal/leads/LeadDrawer";
import { PageHeader } from "@/components/portal/PageHeader";
import { Button } from "@/components/ui/button";

const ACTIVE_STATUSES = ["new", "qualified", "viewing_booked", "viewing_done", "agreement_sent"];
const ARCHIVED_STATUSES = ["signed", "lost", "cold"];

export default function AdminLeadsPage() {
  const [showArchived, setShowArchived] = useState(false);
  const { leads, loading, updateStatus, updateLead } = useLeads({ includeArchived: showArchived });
  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const columns = showArchived ? [...ACTIVE_STATUSES, ...ARCHIVED_STATUSES] : ACTIVE_STATUSES;

  const byStatus = Object.fromEntries(columns.map((s) => [s, []]));
  for (const lead of leads) if (byStatus[lead.status]) byStatus[lead.status].push(lead);

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || !columns.includes(over.id)) return;
    const lead = leads.find((l) => l.id === active.id);
    if (lead && lead.status !== over.id) {
      updateStatus(lead.id, over.id);
    }
  }

  function handleCardClick(lead) {
    setSelected(lead);
    setDrawerOpen(true);
  }

  return (
    <div className="p-4 max-w-[1800px]">
      <PageHeader title="Leads" subtitle={`${leads.length} active`}>
        <Button variant="outline" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? "Hide archived" : "Show archived"}
        </Button>
      </PageHeader>
      {loading && <div className="text-slate-500 mt-4">Loading…</div>}
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {columns.map((status) => (
            <LeadColumn
              key={status}
              status={status}
              leads={byStatus[status]}
              onCardClick={handleCardClick}
            />
          ))}
        </div>
      </DndContext>
      <LeadDrawer
        lead={selected}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSave={(draft) => updateLead(draft.id, draft)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Register route in `src/App.jsx`**

Find the admin routes section and add:

```jsx
// Add import near other admin imports
import AdminLeadsPage from './pages/portal/AdminLeadsPage';
```

Then add the route after `/portal/admin/inbox`:

```jsx
<Route
  path="/portal/admin/leads"
  element={<AuthGuard><AdminLeadsPage /></AuthGuard>}
/>
```

- [ ] **Step 3: Add sidebar entry under People**

Modify `src/components/portal/PortalLayout.jsx`. Locate the "People" section (around line 49). Add an item:

```jsx
{ label: "Leads", path: "/portal/admin/leads", icon: /* same icon style as siblings */ },
```

(Match the existing icon library + pattern used by neighboring entries in the People group.)

- [ ] **Step 4: Run dev server + smoke test**

```bash
cd /Users/mark/Desktop/hyve-reply-monitor
pnpm dev
```

Open `localhost:5173/portal/admin/leads`. Expected: 5 cards in 5 columns (seeds 001–005). Seed 006 (`Stale lead`) sits in `qualified` with a yellow border because `last_message_at` is 20 days old (>14d window).

Drag a card to a different column. Expected: card moves, DB updates (verify with SELECT query).

Click a card. Expected: drawer opens with editable fields.

- [ ] **Step 5: Commit**

```bash
git add src/pages/portal/AdminLeadsPage.jsx src/App.jsx src/components/portal/PortalLayout.jsx
git commit -m "feat(portal): /portal/admin/leads Kanban with drag-drop status + drawer edit"
```

---

## Task 8: Skill scaffold

**Files:**
- Create: `~/.claude/skills/hyve-reply-monitor/Skill.md`
- Create: `~/.claude/skills/hyve-reply-monitor/README.md`

- [ ] **Step 1: Write Skill.md**

```markdown
---
name: hyve-reply-monitor
description: Sweep Beeper Hyve SG inbox, classify prospects, query Supabase for matching rooms, draft sales-pitch replies for one-by-one approval. Upserts to leads table. Activates on "check Hyve prospects", "hyve sweep", "process WhatsApp leads", or via /loop.
version: 1.0.0
---

# Hyve Reply Monitor

End-to-end sales pipeline for Hyve SG WhatsApp prospects. Sweeps Beeper inbox, identifies prospects vs other contact types, drafts room-specific sales replies, and tracks the pipeline in Supabase `leads` (visible at `/portal/admin/leads`).

**Spec:** `/Users/mark/Desktop/hyve-website/docs/superpowers/specs/2026-05-13-hyve-reply-monitor-design.md`

**Account:** Hyve SG WhatsApp (`accountIDs=["whatsapp"]`)

## Activation Phrases

- "check Hyve prospects"
- "hyve sweep"
- "process WhatsApp leads"
- "/hyve-reply-monitor"
- Cron: `/loop 30m /hyve-reply-monitor`

## Flags

- `--dry` — draft + match + present, but no Beeper sends, no DB writes. Use for first 3+ runs.
- `--since=<duration>` — override default 7d sweep window (e.g. `--since=24h`)

## Workflow

### Step 1 — Sweep

Use `mcp__beeper__search_chats`:
- `accountIDs=["whatsapp"]`
- `lastActivityAfter=now-7d` (or `--since` value)
- `inbox="primary"`
- `limit=100`

For each chat, call `mcp__beeper__list_messages` to get the last ~15 messages.

### Step 2 — Classify

For each chat, decide one of: `prospect | tenant | agent | internal`.

Use `lib/classify-helpers.js`:
- **Tenant**: phone match against active rows in `tenant_profiles` (Supabase query)
- **Internal**: phone match against staff list (Mark, Liv, captains)
- **Agent**: latest message matches the PropertyGuru intro pattern (`/I'm .* received your enquiry from PropertyGuru/`) OR contains `"PropNex"`, `"Huttons"`, `"OrangeTee"`, `"ERA"`, `"my PA reached out"`
- **Prospect**: default

Only prospects continue to Step 3. Tenants / agents / internal go into the end-of-run summary as "flagged for manual handling".

### Step 3 — Extract intent (per prospect)

Read `prompts/extract-intent.md`. Pass the last 10 messages. Produce intent JSONB:

```json
{
  "room_type": "premium" | "standard" | "master" | null,
  "budget_min": null | number,
  "budget_max": null | number,
  "move_in_date": "YYYY-MM-DD" | null,
  "lease_months": null | number,
  "location_prefs": [],
  "pets": null | boolean,
  "cooking": null | boolean,
  "profile_notes": "free text — nationality, occupation, household composition",
  "extracted_at": "<ISO>",
  "extraction_confidence": "high" | "medium" | "low"
}
```

### Step 4 — Query rooms (per prospect)

Use `node lib/query-rooms.js --intent=<json>` to find matching available + soon-to-be-free rooms (cross-checks `tenant_profiles.lease_end` against `intent.move_in_date`).

Returns top 3 rooms with `{ room_code, property_code, monthly_rent, available_from, match_reason }`.

### Step 5 — Draft reply

Read `prompts/draft-reply.md`. Pass:
- Prospect's last message
- Their name (if known)
- Top 1 matched room (or top 3 if move_in is flexible)
- Intent profile

Generate humanised reply in Mark's voice (apply style guide from `feedback_mark_writing_style.md`).

### Step 6 — Infer status + viewing intent

Suggested status mapping:
- If new chat with no existing lead: `new`
- If intent has budget + move_in + room_type: → `qualified`
- If last message contains viewing intent keywords ("view", "viewing", "see the room", "book a slot", "tour"): flag `viewing_intent=true`

### Step 7 — Present one-by-one to Mark

For each prospect, print to chat:

```
{i}/{total} — {name} ({source}) — last msg {time_ago}
"{last_message_excerpt}"

Matched: {room_code} — ${monthly_rent}/mo — avail {date}
Reason: {match_reason}

Draft reply:
"{draft}"

Status: {current} → {suggested} (confirm? y/n)
Viewing intent: {yes/no} → delegate to hyve-viewing-coordinator? (y/n)

(a)pprove  (e)dit  (s)kip  (r)oom-adjust
```

Wait for Mark's choice. Edit and adjust loop until Mark approves.

### Step 8 — On approve

1. `mcp__beeper__send_message(chatID=..., text=approved_draft)`
2. UPSERT into `leads` via `node lib/upsert-lead.js` (idempotent on `chat_id`)
3. If `viewing_intent=true` AND Mark confirmed delegation:
   - Invoke `hyve-viewing-coordinator` skill with `{name, phone, chat_id, property_code, matched_room}`
   - On its successful return → set `leads.status = 'viewing_booked'`
4. Otherwise → set `leads.status = approved_next_status`

### Step 9 — Stale sweep

Before ending the run, decay stale leads:

```sql
update public.leads
set status='cold'
where status='qualified' and last_message_at < now() - interval '14 days';

update public.leads
set status='cold'
where status in ('viewing_done','agreement_sent') and last_message_at < now() - interval '7 days';
```

### Step 10 — Telegram summary

Send Mark a summary via Telegram:

```
✓ Hyve sweep done
• {X} replies sent
• {Y} new leads
• {Z} status moves
• {V} auto-decayed to cold
• {W} flagged for manual: <count> tenants, <count> agents, <count> internal
```

## --dry mode

Same flow, but:
- Step 7 prints "DRY: would send" prefix
- Steps 8 + 9 do NOT execute mutations (no Beeper send, no DB writes)
- Step 10 still fires Telegram summary with "[DRY RUN]" prefix

## Errors

| Failure | Behavior |
|---|---|
| Beeper sweep fails | Abort run, error to Mark via Telegram, no DB writes |
| Intent extraction fails | Skip auto-match, present raw chat to Mark for that prospect |
| Supabase write fails | Retry once with 2s backoff; second fail → log + skip card |
| Send message fails | Catch, surface in summary, don't update DB |
| viewing-coordinator delegation fails | Surface, lead stays in `qualified`, Mark handles manually |

## Dependencies

- `mcp__beeper__*` (sweep + send)
- `humanise-responses` skill (style polish on drafts)
- `hyve-viewing-coordinator` skill (viewing handoff)
- Supabase project `diiilqpfmlxjwiaeophb`, service key at `~/Desktop/hyve-website/.env` (or env var)
- Mark's writing style guide: `~/.claude/projects/-Users-mark-Desktop-claudine/memory/feedback_mark_writing_style.md`
```

- [ ] **Step 2: Write README.md (Mark's quickstart)**

```markdown
# hyve-reply-monitor — Quickstart

## First-run dry mode

```
> hyve sweep --dry
```

Drafts everything, no sends, no DB writes. Eyeball the matches + drafts. Iterate prompts in `prompts/*.md` until matches feel right.

## Going live

Once dry-run quality is good, run without the flag:

```
> hyve sweep
```

Each prospect is presented one-by-one for approval.

## Monitor pipeline

Open: https://lazybee.sg/portal/admin/leads

## Common operations

- Sweep only the last 24h: `hyve sweep --since=24h`
- Cron: `/loop 30m /hyve-reply-monitor` — runs every 30 min and Telegrams the summary
- Force re-classify a chat: open `/portal/admin/leads`, click the card, edit status/intent manually
```

- [ ] **Step 3: Commit**

```bash
cd /Users/mark/Desktop/hyve-reply-monitor
mkdir -p ~/.claude/skills/hyve-reply-monitor
cp <skill files into the dir>
# track outside repo — copy the files into ~/.claude/skills/ but ALSO add a copy at .claude-skills/hyve-reply-monitor/ in the repo for review/PR purposes
mkdir -p .claude-skills/hyve-reply-monitor
cp ~/.claude/skills/hyve-reply-monitor/Skill.md .claude-skills/hyve-reply-monitor/Skill.md
cp ~/.claude/skills/hyve-reply-monitor/README.md .claude-skills/hyve-reply-monitor/README.md
git add .claude-skills/hyve-reply-monitor/
git commit -m "feat(skill): hyve-reply-monitor scaffold (Skill.md + README)"
```

(Note: the actual skill loaded by Claude lives at `~/.claude/skills/hyve-reply-monitor/`. The repo copy is for review/PR purposes only.)

---

## Task 9: Prompts — classify, extract-intent, draft-reply

**Files:**
- Create: `~/.claude/skills/hyve-reply-monitor/prompts/classify-chat.md`
- Create: `~/.claude/skills/hyve-reply-monitor/prompts/extract-intent.md`
- Create: `~/.claude/skills/hyve-reply-monitor/prompts/draft-reply.md`

- [ ] **Step 1: Write classify-chat.md**

```markdown
# Classify Chat

Decide whether the chat is a `prospect`, `tenant`, `agent`, or `internal`.

## Signals

**Tenant**: phone matches an active row in `tenant_profiles` table.
**Internal**: phone matches Mark (81333757), Liv (Liv's number), or a captain.
**Agent** (one or more must hold):
- Latest message matches: `/I'?m .{2,40} received your enquiry from PropertyGuru/i`
- Message mentions: `PropNex`, `Huttons`, `OrangeTee`, `ERA`, `co.living`, `my PA reached out`, `marketing your unit`, `my pool of tenants`
- Sender name on WhatsApp profile contains: `Real Estate`, `Property`, `RE`, `Realty`

**Prospect**: default if none of the above.

## Output

Return one word: `prospect`, `tenant`, `agent`, or `internal`.
```

- [ ] **Step 2: Write extract-intent.md**

```markdown
# Extract Intent

Given the last 10 messages of a Hyve prospect chat, extract structured intent.

## Schema

```json
{
  "room_type": "premium" | "standard" | "master" | null,
  "budget_min": null | number,
  "budget_max": null | number,
  "move_in_date": "YYYY-MM-DD" | null,
  "lease_months": null | number,
  "location_prefs": ["jurong east", "lentor", ...],
  "pets": null | boolean,
  "cooking": null | boolean,
  "profile_notes": "short free text — nationality, profession, household composition",
  "extraction_confidence": "high" | "medium" | "low"
}
```

## Rules

- Use `null` for any field not mentioned. Do NOT guess.
- Budget in SGD per month. If only one number is given, set `budget_max` and leave `budget_min` null.
- `room_type`: "master" = master bedroom (MBR), "premium" = premium room (PR) with attached bath, "standard" = standard room (STD) with shared bath. If unclear, null.
- `move_in_date` format: ISO date. If "next month", compute relative to today. If "ASAP", use today's date.
- `lease_months`: convert phrases like "1 year" → 12, "6 months" → 6, "as long as possible" → null.
- `location_prefs`: lowercase, free-form (e.g. "lorong chuan", "near MRT").
- `pets`: true if they mention cat/dog/pet; false if they explicitly say no pets; null otherwise.
- `extraction_confidence`:
  - **high**: budget + move_in + room_type all present and unambiguous
  - **medium**: 1-2 fields present
  - **low**: minimal info, e.g. first contact "hi! still available?"

## Output

Return only the JSON object, no surrounding text.
```

- [ ] **Step 3: Write draft-reply.md**

```markdown
# Draft Sales-Pitch Reply

## Inputs

- Prospect's latest message
- Their name (if known, else empty)
- Top matched room: `{ room_code, property_code, monthly_rent, available_from, match_reason }`
- Their intent profile
- Recent chat snippet (last 3 messages)

## Output

A WhatsApp reply in Mark's voice. Style rules:

- Short, direct, no emojis
- Singlish touches OK ("ah", "pls", "lmk")
- No formal greetings ("Hi [Name],") or closings ("Best regards")
- Lowercase tolerated for casual flow
- Multiple short messages preferred over one long block — but for THIS prompt, output a single message (the orchestrator splits if needed)
- Mention the specific room (e.g. "IH-PR3 at ivory heights, $1.3k/mo all-in")
- If `available_from > today`, mention the date naturally ("opens up 1 june")
- Push toward viewing (`lazybee.sg/book` or "can do a viewing")
- DO NOT list features in bullet form
- DO NOT say "I am Mark from Hyve"
- Reference 1 detail from the chat to show it was read (e.g. their budget, move-in date)

## Examples

**Prospect:** "Hi! Saw your IH listing — std rooms for june?"
**Match:** IH-STD2, $1.1k/mo, avail now
**Reply:** "yes IH-STD2 is open — $1.1k/mo all-in. can move in anytime june. wanna see it? lazybee.sg/book"

**Prospect:** "What's the budget for premium? Need attached bath."
**Match:** CHP-PR1, $1.4k/mo, avail 15 jun
**Reply:** "CHP-PR1 has attached bath, $1.4k/mo. opens 15 june — works for ur timing?"

## Output

Return only the reply text. No markdown, no quotes, no commentary.
```

- [ ] **Step 4: Commit**

```bash
mkdir -p ~/.claude/skills/hyve-reply-monitor/prompts
# write the 3 files into that dir
mkdir -p .claude-skills/hyve-reply-monitor/prompts
cp ~/.claude/skills/hyve-reply-monitor/prompts/*.md .claude-skills/hyve-reply-monitor/prompts/
git add .claude-skills/hyve-reply-monitor/prompts/
git commit -m "feat(skill): classify/extract-intent/draft-reply prompts"
```

---

## Task 10: `query-rooms.js` helper

**Files:**
- Create: `~/.claude/skills/hyve-reply-monitor/lib/query-rooms.js`
- Create: `~/.claude/skills/hyve-reply-monitor/lib/__tests__/query-rooms.test.js`
- Mirror in repo: `.claude-skills/hyve-reply-monitor/lib/`

- [ ] **Step 1: Write the failing test**

```js
// __tests__/query-rooms.test.js
import { describe, it, expect, vi } from "vitest";
import { matchRooms } from "../query-rooms.js";

describe("matchRooms", () => {
  const rooms = [
    { room_code: "IH-PR1", property_code: "IH", monthly_rent: 1300, room_type: "premium", available_from: "2026-05-01" },
    { room_code: "IH-STD2", property_code: "IH", monthly_rent: 1000, room_type: "standard", available_from: "2026-06-15" },
    { room_code: "TG-MBR1", property_code: "TG", monthly_rent: 2200, room_type: "master", available_from: "2026-05-01" },
  ];

  it("filters by room_type", () => {
    const r = matchRooms(rooms, { room_type: "premium", budget_max: 1500, move_in_date: "2026-05-15" });
    expect(r.map(x => x.room_code)).toEqual(["IH-PR1"]);
  });

  it("filters by budget_max", () => {
    const r = matchRooms(rooms, { budget_max: 1200, move_in_date: "2026-06-20" });
    expect(r.map(x => x.room_code)).toContain("IH-STD2");
    expect(r.map(x => x.room_code)).not.toContain("TG-MBR1");
  });

  it("excludes rooms not available by move_in_date", () => {
    const r = matchRooms(rooms, { budget_max: 2500, move_in_date: "2026-05-15" });
    expect(r.map(x => x.room_code)).not.toContain("IH-STD2");
  });

  it("returns empty when no match", () => {
    expect(matchRooms(rooms, { budget_max: 500 })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/mark/Desktop/hyve-reply-monitor
# Set up vitest in .claude-skills dir for these tests
cd .claude-skills/hyve-reply-monitor
# ensure vitest available — install if needed
npx vitest run lib/__tests__/query-rooms.test.js
```

Expected: FAIL with "Cannot find module ../query-rooms.js"

- [ ] **Step 3: Write `query-rooms.js`**

```js
// lib/query-rooms.js
import { createClient } from "@supabase/supabase-js";

export function matchRooms(rooms, intent) {
  return rooms.filter((room) => {
    if (intent.room_type && room.room_type !== intent.room_type) return false;
    if (intent.budget_max != null && room.monthly_rent > intent.budget_max) return false;
    if (intent.budget_min != null && room.monthly_rent < intent.budget_min) return false;
    if (intent.move_in_date && room.available_from && new Date(room.available_from) > new Date(intent.move_in_date)) return false;
    return true;
  }).slice(0, 3);
}

export async function fetchAndMatch(intent, { supabaseUrl, supabaseKey }) {
  const sb = createClient(supabaseUrl, supabaseKey);
  // Pull active rooms with their next-available date computed from tenancies
  const { data: rooms, error } = await sb.rpc("rooms_with_availability");
  if (error) throw error;
  return matchRooms(rooms || [], intent);
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const intentArg = process.argv.find((a) => a.startsWith("--intent="));
  if (!intentArg) { console.error("Usage: --intent=<json>"); process.exit(1); }
  const intent = JSON.parse(intentArg.slice("--intent=".length));
  const url = process.env.SUPABASE_URL || "https://diiilqpfmlxjwiaeophb.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error("Set SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
  fetchAndMatch(intent, { supabaseUrl: url, supabaseKey: key })
    .then((rows) => { console.log(JSON.stringify(rows, null, 2)); })
    .catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 4: Add `rooms_with_availability` view to Supabase**

This RPC needs to exist. Add a migration:

`supabase/migrations/20260513000001_rooms_with_availability.sql`:

```sql
create or replace function public.rooms_with_availability()
returns table (
  room_code text,
  property_code text,
  monthly_rent numeric,
  room_type text,
  available_from date
) language sql stable as $$
  select
    r.room_code,
    r.property_code,
    r.monthly_rent,
    r.room_type,
    coalesce(
      (
        select max(tp.lease_end) + interval '1 day'
        from public.tenant_profiles tp
        where tp.room_code = r.room_code
          and tp.lease_end is not null
          and tp.lease_end >= current_date
      )::date,
      current_date
    ) as available_from
  from public.rooms r
  where coalesce(r.is_active, true) = true;
$$;

grant execute on function public.rooms_with_availability() to anon, authenticated, service_role;
```

Apply via Management API (same pattern as Task 1).

Note: column names (`r.room_code`, `r.monthly_rent`, `r.room_type`, `r.is_active`, `tp.room_code`, `tp.lease_end`) MUST match the actual `rooms` and `tenant_profiles` schema. Before writing this migration, run:

```bash
PAT=$(cat .secrets/supabase-pat.txt)
curl -sS -X POST -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \
  -d '{"query": "select column_name from information_schema.columns where table_schema=\"public\" and table_name in (\"rooms\",\"tenant_profiles\") order by table_name, ordinal_position;"}' \
  https://api.supabase.com/v1/projects/diiilqpfmlxjwiaeophb/database/query
```

Adjust the function body to match real column names.

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /Users/mark/Desktop/hyve-reply-monitor/.claude-skills/hyve-reply-monitor
npx vitest run lib/__tests__/query-rooms.test.js
```

Expected: PASS (4/4)

- [ ] **Step 6: Commit**

```bash
cd /Users/mark/Desktop/hyve-reply-monitor
git add supabase/migrations/20260513000001_rooms_with_availability.sql .claude-skills/hyve-reply-monitor/lib/
# also copy lib files to ~/.claude/skills/ for actual use
cp .claude-skills/hyve-reply-monitor/lib/*.js ~/.claude/skills/hyve-reply-monitor/lib/
git commit -m "feat(skill): query-rooms helper + rooms_with_availability RPC"
```

---

## Task 11: `upsert-lead.js` helper

**Files:**
- Create: `~/.claude/skills/hyve-reply-monitor/lib/upsert-lead.js`
- Create: `~/.claude/skills/hyve-reply-monitor/lib/__tests__/upsert-lead.test.js`

- [ ] **Step 1: Write the failing test**

```js
// __tests__/upsert-lead.test.js
import { describe, it, expect, vi } from "vitest";
import { buildUpsertPayload } from "../upsert-lead.js";

describe("buildUpsertPayload", () => {
  it("includes required fields", () => {
    const p = buildUpsertPayload({
      chat_id: "abc",
      name: "Alex",
      phone: "+6591234567",
      source: "airbnb",
      intent: { room_type: "standard", budget_max: 1200 },
      matched_room_codes: ["IH-STD2"],
      status: "new",
      last_message_excerpt: "hello",
      last_message_at: "2026-05-13T08:00:00Z",
    });
    expect(p.chat_id).toBe("abc");
    expect(p.intent).toEqual({ room_type: "standard", budget_max: 1200 });
    expect(p.matched_room_codes).toEqual(["IH-STD2"]);
  });

  it("drops undefined fields", () => {
    const p = buildUpsertPayload({ chat_id: "abc" });
    expect(Object.keys(p)).toEqual(["chat_id"]);
  });

  it("rejects without chat_id", () => {
    expect(() => buildUpsertPayload({})).toThrow(/chat_id required/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/mark/Desktop/hyve-reply-monitor/.claude-skills/hyve-reply-monitor
npx vitest run lib/__tests__/upsert-lead.test.js
```

Expected: FAIL (module not found)

- [ ] **Step 3: Write `upsert-lead.js`**

```js
// lib/upsert-lead.js
import { createClient } from "@supabase/supabase-js";

const FIELDS = [
  "chat_id", "name", "phone", "source", "intent",
  "matched_room_codes", "status", "last_message_at",
  "last_reply_at", "last_message_excerpt", "notes",
];

export function buildUpsertPayload(input) {
  if (!input.chat_id) throw new Error("chat_id required");
  const payload = {};
  for (const f of FIELDS) {
    if (input[f] !== undefined) payload[f] = input[f];
  }
  return payload;
}

export async function upsertLead(input, { supabaseUrl, supabaseKey }) {
  const payload = buildUpsertPayload(input);
  const sb = createClient(supabaseUrl, supabaseKey);
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await sb.from("leads").upsert(payload, { onConflict: "chat_id" }).select().single();
    if (!error) return data;
    if (attempt === 1) throw error;
    await new Promise((r) => setTimeout(r, 2000));
  }
}

// CLI entry — accept --payload=<json>
if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv.find((a) => a.startsWith("--payload="));
  if (!arg) { console.error("Usage: --payload=<json>"); process.exit(1); }
  const input = JSON.parse(arg.slice("--payload=".length));
  const url = process.env.SUPABASE_URL || "https://diiilqpfmlxjwiaeophb.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error("Set SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
  upsertLead(input, { supabaseUrl: url, supabaseKey: key })
    .then((row) => { console.log(JSON.stringify(row, null, 2)); })
    .catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run lib/__tests__/upsert-lead.test.js
```

Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
git add .claude-skills/hyve-reply-monitor/lib/upsert-lead.js .claude-skills/hyve-reply-monitor/lib/__tests__/upsert-lead.test.js
cp .claude-skills/hyve-reply-monitor/lib/upsert-lead.js ~/.claude/skills/hyve-reply-monitor/lib/
git commit -m "feat(skill): upsert-lead helper with retry"
```

---

## Task 12: `classify-helpers.js`

**Files:**
- Create: `~/.claude/skills/hyve-reply-monitor/lib/classify-helpers.js`
- Create: `~/.claude/skills/hyve-reply-monitor/lib/__tests__/classify-helpers.test.js`

- [ ] **Step 1: Write the failing test**

```js
// __tests__/classify-helpers.test.js
import { describe, it, expect } from "vitest";
import { isAgentMessage } from "../classify-helpers.js";

describe("isAgentMessage", () => {
  it("matches PropertyGuru intro", () => {
    expect(isAgentMessage("Hi, I'm Larry Lee. I received your enquiry from PropertyGuru on...")).toBe(true);
  });

  it("matches PropNex / Huttons / ERA mentions", () => {
    expect(isAgentMessage("I'm from PropNex and my PA reached out")).toBe(true);
    expect(isAgentMessage("Huttons agent here")).toBe(true);
    expect(isAgentMessage("ERA Realty")).toBe(true);
  });

  it("matches 'my pool of tenants'", () => {
    expect(isAgentMessage("I have a pool of tenants. Pls send details")).toBe(true);
  });

  it("does not match a normal prospect message", () => {
    expect(isAgentMessage("Hi! Saw your listing — std rooms for june?")).toBe(false);
    expect(isAgentMessage("can i view the room?")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

```bash
npx vitest run lib/__tests__/classify-helpers.test.js
```

- [ ] **Step 3: Write `classify-helpers.js`**

```js
// lib/classify-helpers.js
const AGENT_PATTERNS = [
  /I'?m .{2,40} received your enquiry from PropertyGuru/i,
  /\bPropNex\b/i,
  /\bHuttons\b/i,
  /\bOrangeTee\b/i,
  /\bERA\b/i,
  /\bmy PA reached out\b/i,
  /\bmarketing your unit\b/i,
  /\bpool of tenants\b/i,
];

export function isAgentMessage(text) {
  if (!text) return false;
  return AGENT_PATTERNS.some((re) => re.test(text));
}

const INTERNAL_PHONES = new Set([
  "+6581333757", // Mark
]);

export function isInternalPhone(phone) {
  return INTERNAL_PHONES.has(phone);
}

export function normaliseE164(raw) {
  const digits = (raw || "").replace(/[^0-9+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits;
  // bare digits assumed SG → prepend +65 if length 8
  if (digits.length === 8) return `+65${digits}`;
  return `+${digits}`;
}
```

- [ ] **Step 4: Run test, expect PASS**

```bash
npx vitest run lib/__tests__/classify-helpers.test.js
```

Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add .claude-skills/hyve-reply-monitor/lib/classify-helpers.js .claude-skills/hyve-reply-monitor/lib/__tests__/classify-helpers.test.js
cp .claude-skills/hyve-reply-monitor/lib/classify-helpers.js ~/.claude/skills/hyve-reply-monitor/lib/
git commit -m "feat(skill): classify-helpers (agent regex + phone normalisation)"
```

---

## Task 13: End-to-end dry-run smoke test

**Files:** none new — exercise the skill against the live inbox in `--dry` mode.

- [ ] **Step 1: Open a fresh Claude session, invoke the skill**

In the Claude Code terminal, type:

```
hyve sweep --dry
```

Expected:
- Skill activates (you see "Launching skill: hyve-reply-monitor")
- It calls `mcp__beeper__search_chats` for the past 7 days
- For each chat, it classifies + (if prospect) extracts intent + matches rooms + drafts a reply
- Prints one prospect at a time with "DRY:" prefix
- Telegram summary at the end with "[DRY RUN]" prefix
- NO Beeper messages sent, NO DB writes

- [ ] **Step 2: Verify no DB writes**

```bash
PAT=$(cat .secrets/supabase-pat.txt)
curl -sS -X POST -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \
  -d '{"query": "select count(*) from public.leads where chat_id not like \"seed-%\";"}' \
  https://api.supabase.com/v1/projects/diiilqpfmlxjwiaeophb/database/query
```

Expected: `0`

- [ ] **Step 3: Iterate prompts**

Eyeball each draft against the prospect's actual message. If matches are weak or replies sound off, edit `~/.claude/skills/hyve-reply-monitor/prompts/*.md` and re-run `hyve sweep --dry`. Loop until quality feels right.

- [ ] **Step 4: Commit any prompt iterations**

```bash
cp ~/.claude/skills/hyve-reply-monitor/prompts/*.md .claude-skills/hyve-reply-monitor/prompts/
cd /Users/mark/Desktop/hyve-reply-monitor
git add .claude-skills/hyve-reply-monitor/prompts/
git commit -m "tweak(skill): prompt refinements from dry-run iteration"
```

(Skip this step if no edits were needed.)

---

## Task 14: First live run

**Files:** none — exercise the skill with DB writes + sends.

- [ ] **Step 1: Run the skill without --dry**

```
hyve sweep
```

For the first 2-3 prospects:
- Choose `(a)pprove` only on drafts you'd really send
- Choose `(e)dit` if a draft is close but off
- Choose `(s)kip` for chats that don't need a reply

- [ ] **Step 2: Verify DB writes**

```bash
PAT=$(cat .secrets/supabase-pat.txt)
curl -sS -X POST -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \
  -d '{"query": "select chat_id, name, status, matched_room_codes from public.leads where chat_id not like \"seed-%\" order by created_at desc;"}' \
  https://api.supabase.com/v1/projects/diiilqpfmlxjwiaeophb/database/query
```

Expected: Rows matching the prospects you approved.

- [ ] **Step 3: Verify portal shows new cards**

Open `https://lazybee.sg/portal/admin/leads` (or local dev). New cards visible in `new` / `qualified` columns within ~1 second of approval (Realtime).

- [ ] **Step 4: Test viewing-coordinator delegation**

If any prospect had viewing intent and you confirmed delegation, verify the `hyve-viewing-coordinator` skill fired:
- A WhatsApp message went to the captain
- The lead's status moved to `viewing_booked`

- [ ] **Step 5: Test drag-drop**

In the portal, drag a card from `qualified` to `viewing_booked`. Refresh — card stays in the new column (DB persisted).

---

## Task 15: Cron — `/loop 30m /hyve-reply-monitor`

**Files:** none — uses the `loop` skill harness.

- [ ] **Step 1: Start the loop in a separate Claude session**

```
/loop 30m /hyve-reply-monitor --since=30m
```

This runs the skill every 30 min, sweeping only chats from the last 30 min. Each run still pauses for one-by-one approval — so Mark gets a Telegram ping when there are prospects to handle.

- [ ] **Step 2: Verify a tick fires**

After 30 min, Telegram should receive:
```
✓ Hyve sweep done
• 0 replies sent (or N if you approved any)
• 0 new leads
• ...
```

If nothing happened (no new messages in the window), the summary still fires.

- [ ] **Step 3: Document the cron in TODO.md**

Append to `/Users/mark/Desktop/claudine/TODO.md` under today's done bucket:

```
[x] hyve-reply-monitor live with /loop 30m cron — first tick at <HH:MM>
```

---

## Task 16: PR + merge

- [ ] **Step 1: Push the branch**

```bash
cd /Users/mark/Desktop/hyve-reply-monitor
git push -u origin feat/hyve-reply-monitor
```

- [ ] **Step 2: Create PR**

```bash
gh pr create --title "feat: hyve-reply-monitor — sales pipeline + Kanban" --body "$(cat <<'EOF'
## Summary
- New `leads` table + `rooms_with_availability` RPC
- `/portal/admin/leads` Kanban page with drag-drop + Realtime
- `hyve-reply-monitor` skill (scaffold + prompts + lib helpers + tests)
- Mirror copy of skill files at `.claude-skills/hyve-reply-monitor/` for review

## Test plan
- [x] Migration applied to Supabase, table + indexes verified
- [x] Seed script populated 6 fake leads
- [x] Portal Kanban renders, drag-drop persists, Realtime fires
- [x] Skill `--dry` mode produced sensible drafts on real inbox
- [x] Skill live run approved 2-3 sends, DB rows match
- [x] viewing-coordinator delegation tested end-to-end
- [x] `/loop 30m` cron tick fires Telegram summary

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for review, merge**

After approval, squash-merge to master. Vercel auto-deploys.

- [ ] **Step 4: Clean up worktree**

```bash
cd /Users/mark/Desktop/hyve-website
git worktree remove /Users/mark/Desktop/hyve-reply-monitor
git branch -d feat/hyve-reply-monitor  # already merged
```

---

## Self-Review Notes

**Spec coverage check:**

| Spec section | Task |
|---|---|
| `leads` table schema | Task 1 |
| Seed data | Task 2 |
| Realtime hook | Task 3 |
| Kanban UI (card, column, drawer, page) | Tasks 4–7 |
| Sidebar entry | Task 7 step 3 |
| Skill scaffold (Skill.md + README) | Task 8 |
| Classify / extract / draft prompts | Task 9 |
| Room matching helper | Task 10 |
| Lead upsert helper | Task 11 |
| Classification helpers | Task 12 |
| `--dry` smoke test | Task 13 |
| Live run + viewing-coordinator handoff | Task 14 |
| Stale-decay logic | Task 8 step 1 (Step 9 of Skill.md) |
| Telegram summary | Task 8 step 1 (Step 10 of Skill.md) |
| Cron (`/loop`) | Task 15 |
| PR + merge | Task 16 |

**Placeholder scan:** No TBDs. Each step has actual code or commands.

**Type consistency:** `intent` schema is the same across `extract-intent.md`, `upsert-lead.js`, and the `leads` table JSONB column. `matched_room_codes` is `text[]` in DB, `string[]` in JS, comma-separated in the drawer input — conversion is explicit. Status enum matches across DB, hook, UI columns, and skill.

**Open from spec, deferred to runtime decision:**
- LLM choice (Task 8/9 use Claude directly since the skill runs inside Claude)
- Adam Halid root-cause investigation is a parallel TODO — not blocking
