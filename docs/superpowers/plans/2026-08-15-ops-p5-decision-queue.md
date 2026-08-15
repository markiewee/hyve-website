# P5 Decision Queue Implementation Plan

> **For agentic workers:** superpowers:executing-plans, inline, no subagents (Mark's rule).

**Goal:** Everything waiting on Mark's judgment appears on one Telegram card at 9:00 and 19:00 SGT with its age, and keeps reappearing until each line is answered. Approval items stop dying in scrollback.

**Design decisions (Mark, 15 Aug):** cadence twice daily 9:00/19:00 SGT; card covers money-gate drafts, quotes, parked your-calls.

### Task 1: decisions table (hyve-iot)

```sql
CREATE TABLE decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  source_ref text,
  question text NOT NULL,
  context text,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','ANSWERED','DROPPED')),
  answer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz
);
CREATE INDEX decisions_open_idx ON decisions (status, created_at);
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
```

### Task 2: decision_card.py on the mini

Pure `render(decisions, drafts, commitments, when)` + `main()` that reads decisions (db.run), held drafts dir, overdue commitments (reuse morning_report helpers), and sends via the same telegram() path. Empty card sends nothing. Each decision line: short id (first 8 of uuid), question, age in hours/days. Footer explains how to answer (tell Claudine "decision <shortid>: <answer>"). unittest for render: an open decision renders with age, an empty state sends nothing, drafts and promises fold in.

### Task 3: the runner files its money asks as decisions

At the mark-notify send in maintenance_runner (the money/URGENT gate), also INSERT a decisions row keyed source='maintenance-runner', source_ref=ticket id, guarded by WHERE NOT EXISTS an OPEN row for the same source_ref. The Telegram ping stays (immediate); the decision row is what persists on the card until answered.

### Task 4: schedule + watch

launchd `com.markwee.decision-card` at 09:00 and 19:00 SGT on the mini; register in watchdog PERIODIC as BACKGROUND. Live-run once with a seeded test decision, then drop it.

## Non-goals

Auto-parsing Mark's answers (Claudine closes rows in session); pulling loops-board items onto the card (loops stay on the loops board); inline Telegram buttons.
