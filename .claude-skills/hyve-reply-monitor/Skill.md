---
name: hyve-reply-monitor
description: Sweep Beeper Hyve SG inbox, classify prospects, query Supabase for matching rooms, draft sales-pitch replies for one-by-one approval. Upserts to leads table. Activates on "check Hyve prospects", "hyve sweep", "process WhatsApp leads", or via /loop.
version: 1.0.0
---

# Hyve Reply Monitor

End-to-end sales pipeline for Hyve SG WhatsApp prospects. Sweeps Beeper inbox, identifies prospects vs other contact types, drafts room-specific sales replies, tracks the pipeline in Supabase `leads` (visible at `/portal/admin/leads`).

**Spec:** `/Users/mark/Desktop/hyve-website/docs/superpowers/specs/2026-05-13-hyve-reply-monitor-design.md`

**Account:** Hyve SG WhatsApp (`accountIDs=["whatsapp"]`)

## Activation Phrases

- "check Hyve prospects"
- "hyve sweep"
- "process WhatsApp leads"
- "/hyve-reply-monitor"
- Cron: `/loop 30m /hyve-reply-monitor`

## Flags

- `--dry` — draft + match + present, but no Beeper sends, no DB writes
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

Decide one of: `prospect | tenant | agent | internal`.

Use `lib/classify-helpers.js`:
- **Tenant**: phone match against active `tenant_profiles` rows
- **Internal**: phone match against staff list (Mark, Liv, captains)
- **Agent**: see `isAgentMessage()` in classify-helpers (PropertyGuru patterns + agency name regexes)
- **Prospect**: default

Only prospects continue to Step 3.

### Step 3 — Extract intent (per prospect)

Apply prompt at `prompts/extract-intent.md` to last 10 messages. Output intent JSONB.

### Step 4 — Query rooms (per prospect)

Use `lib/query-rooms.js` `fetchAndMatch(intent, supabaseConfig)`. Cross-references active tenancies via `rooms_with_availability` RPC (migration `20260513000001_rooms_with_availability.sql`). Returns top 3 matches with `{ room_code, property_code, monthly_rent, available_from, match_reason }`.

### Step 5 — Draft reply

Apply prompt at `prompts/draft-reply.md` with prospect message + intent + top matched room. Output: humanised reply in Mark's voice.

### Step 6 — Infer status + viewing intent

Status mapping:
- New chat, no existing lead → `new`
- Intent has budget + move_in + room_type → `qualified`
- Keywords "view", "viewing", "see the room", "book a slot" in last message → `viewing_intent=true`

### Step 7 — Present one-by-one

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

### Step 8 — On approve

1. `mcp__beeper__send_message(chatID=..., text=approved_draft)`
2. UPSERT into `leads` via `lib/upsert-lead.js`
3. If `viewing_intent=true` AND Mark confirmed delegation:
   - Invoke `hyve-viewing-coordinator` skill with `{name, phone, chat_id, property_code, matched_room}`
   - On its successful return → set `leads.status = 'viewing_booked'`
4. Otherwise → set `leads.status = approved_next_status`

### Step 9 — Stale sweep

```sql
update public.leads
   set status='cold'
 where status='qualified' and last_message_at < now() - interval '14 days';

update public.leads
   set status='cold'
 where status in ('viewing_done','agreement_sent')
   and last_message_at < now() - interval '7 days';
```

### Step 10 — Telegram summary

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
- Steps 8 + 9 do NOT execute mutations
- Step 10 still fires Telegram summary with "[DRY RUN]" prefix

## Errors

| Failure | Behavior |
|---|---|
| Beeper sweep fails | Abort run, error to Mark, no DB writes |
| Intent extraction fails | Skip auto-match, present raw chat to Mark |
| Supabase write fails | Retry once with 2s backoff; second fail → skip card |
| Send message fails | Catch, surface in summary, don't update DB |
| viewing-coordinator delegation fails | Surface, lead stays in `qualified`, Mark handles manually |

## Dependencies

- `mcp__beeper__*` (sweep + send)
- `humanise-responses` skill (style polish on drafts)
- `hyve-viewing-coordinator` skill (viewing handoff)
- Supabase project `diiilqpfmlxjwiaeophb` (PAT at `/Users/mark/Desktop/claudine/.secrets/supabase-pat.txt`)
- Mark's writing style guide: `~/.claude/projects/-Users-mark-Desktop-claudine/memory/feedback_mark_writing_style.md`
