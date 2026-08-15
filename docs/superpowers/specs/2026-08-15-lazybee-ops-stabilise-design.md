# Lazybee Ops Machine: Stabilise and Finish (Design)

Date: 2026-08-15. Approved by Mark in chat, 15 Aug (spine, CP lane, ping cadence decisions recorded below).

## Corrected findings, all verified live on 15 Aug

1. The watchdog on the mini is ALIVE and runs hourly. Exit code 1 means "revenue path red", by design. The earlier "watchdog dead" reading was wrong. Current state: revenue path 2 of 7 green.
2. The maintenance runner was RETIRED on 14 Aug (watchdog RETIRED map: "spammed Mark every 15 min") after it re-sent the same two CP ticket events to Kavi every 15 minutes for over 2 hours. Ticket acks and chases are currently OFF entirely.
3. Four pg_cron jobs in hyve-iot flap with "job startup timeout" (worker saturation): partner-outbound-worker 352 fails/day, partner-webhook-dispatch 343, sweep-stale-room-holds 33, verify-rent-halfhourly 16. All ALSO succeed many times per day (latest successes current). The watchdog's pgcron check marks any job with recent_fails > 0 as red at CRITICAL severity even when the last success is fresh, so it re-pages Mark every 6 hours about jobs that are flapping, not down. This is the "backed up stuff" alert fatigue.
4. The verify-rent edge function returns 500 every 30 minutes with "Aspire not configured: set ASPIRE_CLIENT_ID and ASPIRE_API_KEY". Zero bank credits have EVER been seen (window from 1 Jul shows credits_seen 0). Rent and deposit auto-verification has never worked. Downstream symptoms: Julia's deposit stuck "tracing", all rent matching manual.
5. The beeper-inbound-worker's sweep body is exception-guarded, but its two bus calls (poll_and_handle, report_status) only catch AgentLinkError. A raw socket.timeout from urllib kills the process (happened 15 Aug 07:05 UTC). launchd restarts it silently.
6. MOPS bridge (v-mops on the fleet map): local ticket enum lacks CANCELLED and CLOSED so a MOPS cancel folds to RESOLVED; 19 of 35 tickets predate the bridge and never crossed; 16 inbound events from May/Jun sit unmapped; 71 MOPS tasks on Lazybee units have no local ticket; the chaser chased 2 tickets MOPS cancelled in June (IH-PR2 mold, CP-PR1 door).
7. Portal login, Julia case: her credentials authenticate (HTTP 200 in 0.47s). She has TWO tenant_profiles rows (created 12 Aug, manual custom-dates provisioning ran twice), both is_active = false, no tenant_details. fetchProfile requires is_active = true, returns null, AuthGuard silently bounces to login. Separately, the auth-lock stall (patched for page load on 13 May and 30 May) is unguarded on the sign-in click, giving her an eternal "SIGNING IN..." spinner on her iPhone. No timeout, no error surfacing, no login canary.
8. Promises made in chat create no row anywhere (reply brain has no CRM write, no ticket POST). Approval items die on Mark with no re-ping. CP contractor lane unbuilt. Viewings bookings and parked leads have no consumer. Onboarding ops lane (8 steps) unbuilt.

## Decisions (Mark, 15 Aug)

- Execution spine: hyve-iot tickets. Loops board mirrors, never a second source of truth.
- CP lane: rides the MOPS bridge (ticket becomes MOPS task, Kavi side executes, quotes ride the /send money gate).
- Decision card ping cadence: twice daily, 9:00 and 19:00 SGT, re-sent until every line answered.
- Process: serial work packages, no subagents. Each package: plan, PRD, PR draft, Mark approves inline, then implement (Rule 19).

## Work packages

- P1 Stabilise (planned now, see plans/2026-08-15-ops-p1-stabilise.md): watchdog flap severity fix, pg_cron stagger, Julia account repair, Aspire secrets (blocked on Mark), inbound worker transport guards, ticket queue triage, runner send-once ledger and re-enable.
- P2 Bridge repair: status enum CANCELLED/CLOSED, re-apply the two June cancels, backfill 19 outbound, replay 16 unmapped inbound, reconcile the 71 MOPS-only tasks.
- P3 Portal login hardening: sign-in timeout plus error surfacing, AuthGuard inactive-account screen, same-state tenant sweep, synthetic login canary.
- P4 Promise capture: CRM lead upsert per handled thread, ticket POST on maintenance intent, chat-to-room resolver, commitment gate, nightly promise audit.
- P5 Decision queue: decisions table plus twice-daily Telegram card with age, covering money gate drafts, quotes, and parked "your calls".
- P6 Lanes: CP via MOPS end to end, viewings consumer (alert, captain assign, prospect confirm, reminders), CRM arming (STORED conditions live, park requires follow-up date).
- P7 Onboarding ops lane (8 API steps) plus scoreboard in the morning report (promises past 24h, decisions pending with age, SLA breaches, heartbeats, viewings).

## Non-goals

No rebuild of working components (outbound bridge delivery is 48/48, carousell bot, roomies bot, reply brain flow). No new platforms. No paid services.
