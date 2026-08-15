# P4 Promise Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans, inline, no subagents (Mark's rule).

**Goal:** A promise made in chat becomes a row that gets audited nightly, and a maintenance report from a known tenant lands on the right room instead of "room unknown".

**Live findings (15 Aug):** The reply brain ALREADY files leads (28 in 14 days, working) and has a POST /tickets instruction, but the only WhatsApp-source ticket in 14 days was filed by hand: the ticket lane exists and never fires, partly because the brain has no way to resolve a sender's phone to their room. Promises ("we'll confirm timing for someone to come by asap", 12 Aug, tiff, never happened) create no row anywhere. No commitments/promises/decisions table exists. The Partner API is one catch-all Vercel function, so new routes are free.

### Task 1: commitments table (hyve-iot)

```sql
CREATE TABLE commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id text,
  counterparty text,
  promise text NOT NULL,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','KEPT','DROPPED')),
  source text,
  channel_id uuid,
  idempotency_key text,
  made_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  close_note text
);
CREATE INDEX commitments_open_idx ON commitments (status, made_at);
ALTER TABLE commitments ENABLE ROW LEVEL SECURITY;
```

### Task 2: pure lib + tests

`src/lib/partnerCommitments.js`: `validateCommitment` (promise required and non-trivial, chat_id or counterparty required, due_at must parse if given), `commitmentView`, `isOverdue(row, nowIso)` (due_at passed, or no due_at and made_at older than 24h). `src/lib/partnerCommitments.test.js` with node --test. TDD: tests first.

### Task 3: catch-all routes

POST /commitments (any key scope; idempotency same contract as leads), GET /commitments?status= (internal scope), POST or PATCH /commitments/{id} with {status, close_note} to close (internal scope). Handlers follow handleCreateTicket's shape.

### Task 4: phone-to-room resolver

GET /resolve?phone= (internal scope): normalise, look up tenant_details.phone joined to active tenant_profiles and rooms, fall back to leads by phone. Returns {kind: "tenant"|"lead"|"unknown", name, listing_code, property}. Reason: the brain cannot ground listing_code today, which is one reason zero real tickets got filed.

### Task 5: reply-brain prompt wiring (mini)

Step 6 additions: (c) if the outbox reply promises a future action by us (confirm, check, send, chase, get back to you), POST /commitments with the promise verbatim and a due hint (explicit time in the text, else 24h). (d) before filing a ticket, GET /resolve?phone= and use the listing_code it returns. OUTCOME filed values extended with "commitment".

### Task 6: nightly promise audit (mini morning report)

`morning_report.py` new section: OPEN commitments that are overdue (per isOverdue semantics, computed in SQL) with age, capped at 10 lines plus a count. Data straight from hyve-iot via the existing db helper.

### Task 7: verify end to end

Node tests green; push; live POST a canary commitment via the brain's key, list it, close it; prompt deployed on the mini; morning report dry run shows the section. Log to loops + TODO.

## Non-goals

The decision queue and twice-daily card (P5). Backfilling historical promises. NLP promise extraction beyond the brain's own judgment.
