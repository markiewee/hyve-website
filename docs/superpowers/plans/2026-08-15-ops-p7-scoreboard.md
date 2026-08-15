# P7 Scoreboard Implementation Plan

> superpowers:executing-plans, inline, no subagents (Mark's rule).

**Goal:** The 07:30 morning report becomes the machine's scoreboard: promises past 24h, decisions pending with age, ticket SLA breaches, worker heartbeats, upcoming viewings, and onboardings stuck on a step. One message, everything the machine owes an answer on.

**Context:** P4 already added overdue promises to the report; heartbeats and connectors were already there. This adds three sections (SLA breaches, viewings, onboardings) and folds in open decisions. The nightly 21:30 sweeps message stays the chaser; the 07:30 report is the state of the board. The full 8-step onboarding automation stays future work: sweeps chases onboardings nightly already, and the scoreboard now shows who is stuck where, which is the operational half Mark asked for.

### Task 1: data readers (morning_report.py)

`sla_breaches()`: open tickets past due_at (not terminal), unit + hours over.
`upcoming_viewings()`: next 48h from property_viewings with captain/reminder state.
`stuck_onboardings()`: active tenant profiles not on a complete step, with days on the current step (onboarding_progress.updated_at).
Reuse `open_decisions()` from decision_card.

### Task 2: render sections

After connectors: "scoreboard" block with one line per item, counts first, oldest named. Empty sections omitted. unittest: each section renders when present, omitted when empty, and a breach can never render as quiet.

### Task 3: live dry run, commit, log.
