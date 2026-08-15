# P8 Redundancy Ring Implementation Plan

> superpowers:executing-plans, inline, no subagents (Mark's rule).

**Mark's three pillars (15 Aug):** 1) redundancy, 2) cannot fail silently, 3) actionable trigger to unfuck plus simple updates.

**Builds on:** `docs/superpowers/specs/2026-08-13-redundancy-and-fail-loud-design.md` (branch `docs/redundancy-fail-loud-spec`): the watch ring (Supabase + mini + laptop watch each other), outcome heartbeats not process heartbeats, tiered alerting, Tier B/C cannot duplicate and must say so. New in P8 beyond that spec: every alert carries its own fix line (`fix_hint` lives in the schema, a RUNBOOK map lives in the watchdog), and the alert channel itself is redundant (Telegram falls back to WhatsApp).

### Task 1: heartbeat spine

`job_heartbeats` table per spec schema plus `fix_hint text`. `hb.py` helper on the mini (`hb.beat(job_key, outcome)` upserts via the existing db helper, never throws). Wire into the end of: watchdog, morning_report, decision_card, viewings_runner, maintenance_runner, beeper_inbound_worker sweep, lazybee_sweeps. Register rows with cadence + grace + fix_hint for those seven plus `laptop:watcher` and `supabase:heartbeat-checker`.

### Task 2: the dead-man checker, off both machines

Function `fn_heartbeat_check()` + pg_cron every 5 min: rows where `now() > last_beat_at + interval + grace` and state not RETIRED page Telegram via pg_net (bot token in vault), message = one line + `fix: <fix_hint>`. Dedupe in `alert_state` (re-alert 6h). The checker stamps its own row first, so a checker that dies is itself detectable. Controlled test: one deliberately overdue test row pages once, then is retired.

### Task 3: close the ring + pager redundancy

Mini watchdog check `ring:checker`: the checker row must have advanced within 15 min, else CRITICAL (pages from the mini side, covering a dead checker). Laptop watcher gets the mirror check. `notify.py` on the mini: `send(text)` tries Telegram, on failure sends WhatsApp to Mark via the Beeper REST (Lazybee line), used by watchdog, morning report and decision card, so the pager cannot fail silently either. Watchdog alerts gain fix lines from a RUNBOOK prefix map.

### Task 4: verify recovery redundancy + wrap

Read hyve-iot backup/PITR posture from the Management API and report it (enabling anything paid is Mark's call, Cheap AF). Commit docs, loops board, TODO.

## Out of scope (unchanged from the spec)

Second Beeper/platform sessions (physically blocked), paid services, rewriting the mini watchdog, fixing the 13 broken jobs list (step-6 triage, evidence-driven, next session).
