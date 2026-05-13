# Hyve Reply Monitor — Design Spec

**Date:** 2026-05-13
**Owner:** Mark
**Branch:** `feat/hyve-reply-monitor`
**Status:** Design — awaiting implementation plan

---

## Problem

Hyve SG WhatsApp inbox accumulates 30–40 chats/week across prospects, tenants, agents, and noise. Today, replying requires:

1. Manual Beeper sweep
2. Manual classification (who is this person, what do they want?)
3. Manual room matching against memory of what's available
4. Manual draft + humanise
5. No persistent pipeline view — Mark can't see "where is each prospect right now"
6. Manual handoff to viewing-coordinator for viewings

Result: prospects fall through the cracks (e.g. Adam Halid — viewing booked, door code never sent, no reminder, prospect arrived to a locked door, threatened bad review). Lost revenue from unanswered or slow-replied leads. No board-level visibility into the sales funnel.

## Goal

A single skill (`hyve-reply-monitor`) that, on each invocation:

1. Sweeps Beeper Hyve SG inbox
2. Classifies chats into prospect / tenant / agent / internal
3. For prospects: extracts intent, queries Supabase for available + soon-to-be-free rooms (cross-checking active tenancies), drafts a sales-pitch reply with a specific room recommendation
4. Presents each draft one-by-one to Mark with the matched room, suggested next pipeline status, and a viewing-coordinator handoff flag
5. On approval: sends the reply, upserts a row in the new `leads` Supabase table, optionally triggers `hyve-viewing-coordinator`
6. Mark monitors the full pipeline at `/portal/admin/leads` — a Kanban board backed by `leads` with drag-drop status changes, real-time updates, and stale-lead auto-decay

Non-goals:
- Replacing `claudine-filter` (general inbox triage stays separate)
- Handling tenant maintenance or agent intros automatically (skill flags them; Mark replies manually for now)
- Pureloft MY chats (out of scope — separate skill if needed later)

## Architecture

Three independent components communicating via Supabase as the shared store:

```
┌──────────────────────┐
│ hyve-reply-monitor   │  (skill — interactive, run by Mark)
│ ~/.claude/skills/    │
└──────────┬───────────┘
           │ writes
           ↓
┌──────────────────────┐
│  Supabase `leads`    │  (source of truth for pipeline)
│  + Realtime channel  │
└──────────┬───────────┘
           │ reads (live)
           ↓
┌──────────────────────┐
│ /portal/admin/leads  │  (Kanban UI in lazybee.sg portal)
└──────────────────────┘
```

**Why this split:** skill is conversational and stateless. Portal is reactive UI. DB is the only persistent state. No leads.json. No file-based intermediate state. Realtime keeps the board live without polling.

### External dependencies (reused)

| Dependency | Used for |
|---|---|
| `mcp__beeper__*` | Sweep chats, send replies |
| `humanise-responses` skill | Voice transform on drafts |
| `hyve-viewing-coordinator` skill | Captain liaison, door code, 2hr reminder (called when viewing intent confirmed) |
| `mcp__hyve-ops__*` or direct Supabase | Room availability + tenancy queries |
| Mark's writing style memory (`feedback_mark_writing_style.md`) | Style guide for drafts |

## Data Model

### New table: `leads`

```sql
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
  chat_id      text unique not null,                    -- Beeper chatID
  name         text,
  phone        text,                                    -- E.164 if known
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

alter table public.leads enable row level security;

-- admin role can read/write everything
create policy "admin full access" on public.leads
  for all using (
    auth.jwt() ->> 'role' in ('admin', 'service_role')
  );

-- enable realtime
alter publication supabase_realtime add table public.leads;
```

### `intent` JSONB shape

```json
{
  "room_type": "premium" | "standard" | "master" | null,
  "budget_min": 800,
  "budget_max": 1500,
  "move_in_date": "2026-06-01" | null,
  "lease_months": 12 | null,
  "location_prefs": ["jurong east", "lentor"],
  "pets": true | false | null,
  "cooking": true | false | null,
  "profile_notes": "indian WP holder, facility engineer, single pax",
  "extracted_at": "2026-05-13T08:31:00Z",
  "extraction_confidence": "high" | "medium" | "low"
}
```

Loose schema on purpose — intent extraction is LLM-based and may miss fields. Always include `extracted_at` and `extraction_confidence`.

### Migrations

- `supabase/migrations/20260513000000_leads.sql` — table + types + indexes + RLS + realtime
- Apply via Supabase Management API to project `diiilqpfmlxjwiaeophb` (PAT in `.secrets/supabase-pat.txt`)
- Test against a Supabase preview branch first; promote to prod once portal page renders successfully against seed data

## Pipeline Stages

| Stage | Entry trigger | Exit / decay |
|---|---|---|
| **new** | First inbound message, no card exists | → qualified when intent has budget + move_in + room_type |
| **qualified** | Intent fields populated | → viewing_booked, or → cold after 14d no activity |
| **viewing_booked** | viewing-coordinator confirms slot scheduled | → viewing_done after the slot time passes |
| **viewing_done** | Captain confirms viewing happened (manual or webhook later) | → agreement_sent if they say yes, or → cold after 7d no reply |
| **agreement_sent** | TA sent via `hyve-agreement-generator` | → signed when deposit confirmed, or → cold after 7d unsigned |
| **signed** | Tenant signs + deposit paid (manual confirm by Mark) | Terminal — Mark manually promotes to tenancies table outside this skill |
| **lost** | Manual: prospect said no | Terminal |
| **cold** | Auto-decay or manual | Reactivatable if they message again — skill flips back to `new` |

## Skill Flow

```
START
  │
  ├─ 1. Sweep: mcp__beeper__search_chats
  │     accountIDs=['whatsapp'], lastActivityAfter=now-7d, inbox=primary
  │
  ├─ 2. For each chat:
  │     a. Lookup leads.chat_id → exists (returning) or new
  │     b. Read last N messages via mcp__beeper__list_messages
  │     c. Classify type (prospect / tenant / agent / internal)
  │        - tenants: phone match against tenant_profiles
  │        - agents: messages contain "I'm <name> from <agency>" or PropertyGuru pattern
  │        - internal: phone match against staff list
  │        - else: prospect (default)
  │     d. Skip non-prospects (flag in summary, no draft)
  │     e. Extract intent via internal LLM call:
  │        - Input: last 10 messages
  │        - Output: intent JSONB + confidence
  │     f. Query Supabase rooms:
  │        - WHERE current available OR tenancy ends ≤ move_in_date
  │        - filtered by intent (budget, room_type, location, pets)
  │        - LIMIT 3
  │     g. Generate sales-pitch reply (humanised to Mark's voice)
  │     h. Infer suggested next status from latest message + intent completeness
  │     i. Detect viewing intent ("can I view", "book a viewing", "this week"?)
  │
  ├─ 3. Present batch one-by-one to Mark in chat:
  │     For each prospect:
  │     ┌─ Header: "{N}/{total} — {name} ({source}) — last msg {timestamp}"
  │     ├─ Their last message (excerpt)
  │     ├─ Matched rooms: 1-3 cards w/ code, price, availability, why-match
  │     ├─ Draft reply (humanised)
  │     ├─ Suggested status: new → qualified (confirm? y/n)
  │     ├─ Viewing intent detected? → delegate to hyve-viewing-coordinator?
  │     └─ Options: Approve / Edit / Skip / Adjust matched room
  │
  ├─ 4. On approve:
  │     a. mcp__beeper__send_message
  │     b. UPSERT leads ON CONFLICT (chat_id) DO UPDATE
  │        - update intent, matched_room_codes, status, last_*, notes
  │     c. If viewing intent confirmed:
  │        - Invoke hyve-viewing-coordinator with prospect details
  │        - On its return → status=viewing_booked
  │
  ├─ 5. Stale sweep:
  │     - SELECT leads WHERE status IN ('qualified', 'viewing_done', 'agreement_sent')
  │       AND last_message_at < now() - {decay window}
  │     - UPDATE status='cold' for matches
  │
  └─ 6. End-of-run summary via Telegram:
        - {X} replies sent
        - {Y} new leads created
        - {Z} status moves
        - {W} chats flagged for manual handling (tenants/agents/etc.)
        - {V} leads auto-decayed to cold

END
```

### Reactivation logic

If a chat exists in `leads` with status `cold` or `lost` and a NEW message arrives, the skill resurfaces it with status candidate `new` (Mark confirms). Don't auto-flip — Mark sees the context first.

## Portal: `/portal/admin/leads`

### Layout

Kanban board with one column per non-terminal status. Default visible columns:
`new | qualified | viewing_booked | viewing_done | agreement_sent`

Terminal/archived (`signed`, `lost`, `cold`) hidden by default behind a "Show archived" toggle.

### Card content

```
┌─────────────────────────────┐
│ Name + source badge         │
│ Last msg excerpt (2 lines)  │
│ Matched rooms: IH-PR3, TG-S1│
│ ⏱ 2h ago    💬 (8 msgs)     │
└─────────────────────────────┘
```

Click card → drawer/modal with:
- Full chat history (read-only excerpt from Beeper)
- Intent fields editable
- Matched rooms editable
- Status dropdown
- Notes textarea
- "Open in Beeper" button (deeplink)

### Interactions

- **Drag-drop:** move card between columns → updates `status` + `status_changed_at`
- **Real-time:** Supabase Realtime subscription on `leads` table; new cards appear without refresh
- **Filter chips:** by source, by matched property (TG/IH/CP), by owner
- **Stale highlight:** cards get a yellow border when `last_message_at` exceeds the column's decay window (7d for viewing_done/agreement_sent, 14d for qualified)

### Tech

- React component at `src/pages/admin/AdminLeadsPage.jsx`
- Uses `@dnd-kit/core` (or existing drag library if already in deps — check `package.json` first; fallback to native HTML5 drag if no good lib)
- Subscribe to `leads` Realtime channel via existing supabase client
- Read-only Beeper chat preview rendered from cached `last_message_excerpt` + Beeper deeplink
- New route registered in `src/App.jsx` under admin section, sidebar entry under "People" group

## Skill File Layout

```
~/.claude/skills/hyve-reply-monitor/
├── Skill.md                # main orchestrator + activation phrases
├── prompts/
│   ├── classify-chat.md    # classification prompt template
│   ├── extract-intent.md   # intent extraction prompt
│   └── draft-reply.md      # sales reply prompt
├── lib/
│   ├── query-rooms.js      # Supabase query for available + soon-free rooms
│   └── upsert-lead.js      # idempotent UPSERT helper
└── README.md               # quickstart for Mark
```

## Error Handling

| Failure | Behavior |
|---|---|
| Beeper sweep fails | Abort run, error to Mark, no DB writes |
| LLM intent extraction fails | Skip auto-match, present raw chat to Mark |
| Supabase write fails | Retry once with 2s backoff; on second fail, log + skip card, continue run |
| Send message fails | Catch, mark draft as "send failed", surface in summary, don't update DB |
| viewing-coordinator delegation fails | Surface error, lead stays in `qualified`, Mark handles viewing manually |
| Realtime subscription drops in portal | Page shows banner "live updates paused, refresh to resync" |

## Testing Approach

### Sandbox

- All work in worktree `/Users/mark/Desktop/hyve-reply-monitor` on branch `feat/hyve-reply-monitor`
- Open in VS Code: `code /Users/mark/Desktop/hyve-reply-monitor`
- Migration applied to Supabase preview branch first, NOT prod

### Skill testing

- `--dry` flag: drafts everything, prints to console, no Beeper sends, no DB writes. Use this for first 2-3 runs.
- Seed test data: 5-10 fake leads inserted via SQL for portal UI testing
- Manual integration test: run on real inbox with `--dry`, eyeball drafts and matches

### Portal testing

- `pnpm dev` on local dev server
- Navigate to `localhost:5173/portal/admin/leads`
- Verify: seeded leads visible, drag-drop updates DB, Realtime fires on inserts
- Mobile responsive check (Mark monitors on phone)

### Production rollout

- Skill installed but disabled by default
- Portal page deployed but only visible to admin role
- Mark runs `/hyve-reply-monitor --dry` for 1 week, refines prompts
- Flip to live sends + DB writes once intent extraction quality is acceptable (>80% correct matches per Mark's eye)

## Open Questions for Implementation Phase

1. **LLM choice for intent extraction:** inline Claude call vs separate prompt chain? Cost vs latency tradeoff.
2. **Room matching ranking:** strict filter vs scored ranking? When 3 rooms match, which is recommended?
3. **Auto-decay window:** 14d feels right for qualified but might be too long for new — refine after data.
4. **Realtime auth:** confirm portal admin role can subscribe to leads channel via RLS.
5. **Adam Halid root cause:** parallel investigation — was viewing-coordinator invoked? Was its reminder cron alive? Fix may need to ship before / alongside this build.

## Out of Scope (this spec)

- Pureloft MY inbox handling
- Tenant maintenance auto-replies (kept manual; `claudine-filter` covers basic triage)
- Agent intro auto-replies (kept manual; existing pitch templates work)
- Tenancy onboarding automation post-`signed` (separate workflow)
- LLM-based status inference beyond simple keyword detection (defer to v2 if simple heuristics don't fail)
- Cross-platform sync (Carousell / Roomies inbox merge — those have their own skills)

## Migration / Rollout Order

1. Commit this spec
2. Write implementation plan via writing-plans skill
3. Phase A: Supabase migration + seed data
4. Phase B: Skill scaffold + classify/extract/match (run in `--dry`)
5. Phase C: Portal `/admin/leads` Kanban
6. Phase D: Wire skill → DB upserts → portal sees them live
7. Phase E: viewing-coordinator delegation hookup
8. Phase F: Stale-decay cron + Telegram summary
9. Internal usage week → refine prompts → flip to live sends

---
