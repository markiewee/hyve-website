# Ops Machine P1: Stabilise Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (Mark: no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the machine's active harm and false alarms: calm the pager, unstick the flapping crons, repair Julia's account, guard the inbound worker, triage the ticket queue, and bring the maintenance runner back with send-once discipline.

**Architecture:** All changes are repairs to existing components: watchdog.py and beeper_inbound_worker.py and maintenance_runner.py in ~/agent-link on the mini (local git repo, no remote), plus SQL against hyve-iot (project diiilqpfmlxjwiaeophb) via the Supabase Management API. No new services.

**Tech Stack:** Python 3 stdlib (agent-link house rule), pg_cron, Supabase Management API, launchd.

**Conventions:** No em or en dashes and no emoji in any output, message, or code comment (house rule). All mini work over `ssh mini`. All hyve-iot SQL through the Management API query endpoint with the account PAT from ~/.chudbrain/secrets.env.

---

### Task 1: Watchdog stops paging CRITICAL for flapping pg_cron jobs

**Files:**
- Modify: `~/agent-link/watchdog.py` (the `check_scheduled_money_jobs` classification, around line 395)
- Create: `~/agent-link/test_watchdog.py`

- [ ] **Step 1: Extract the classification into a pure function and write the failing test**

Create `~/agent-link/test_watchdog.py`:

```python
#!/usr/bin/env python3
"""Tests for the pgcron row classifier. Run: python3 -m pytest test_watchdog.py -q"""
import watchdog


def test_dead_job_pages_critical():
    key, ok, detail, sev = watchdog.classify_pgcron(
        "partner-outbound-worker", age=3600.0, recent_fails=0,
        tol=1800, sev=watchdog.CRITICAL)
    assert not ok and sev == watchdog.CRITICAL


def test_flapping_job_rides_the_digest():
    # Fresh success, some failed runs: report it, but never page.
    key, ok, detail, sev = watchdog.classify_pgcron(
        "partner-outbound-worker", age=120.0, recent_fails=352,
        tol=1800, sev=watchdog.CRITICAL)
    assert not ok and sev == watchdog.BACKGROUND
    assert "flapping" in detail


def test_healthy_job_is_green():
    key, ok, detail, sev = watchdog.classify_pgcron(
        "verify-rent-halfhourly", age=600.0, recent_fails=0,
        tol=3 * 3600, sev=watchdog.CRITICAL)
    assert ok
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `ssh mini "cd ~/agent-link && /usr/bin/python3 -m pytest test_watchdog.py -q"`
Expected: FAIL with "watchdog has no attribute classify_pgcron" (if pytest missing on the mini, run `/usr/bin/python3 -m pip install --user pytest` first).

- [ ] **Step 3: Implement classify_pgcron and rewire the check**

In `watchdog.py`, add above `check_scheduled_money_jobs`:

```python
def classify_pgcron(name, age, recent_fails, tol, sev):
    """Classify one pg_cron job. Pure so it is testable.

    The rule that matters: a job with a FRESH success and some failed runs is
    flapping (pg_cron "job startup timeout" under worker saturation), not
    down. Real outages are the age branch. Flapping is reported at BACKGROUND
    so it rides the digest instead of re-paging Mark every 6 hours, which is
    what buried the one alert that mattered."""
    key = "pgcron:%s" % name
    if age > tol:
        return (key, False, "last success %.1f h ago, tolerance %.1f h"
                % (age / 3600, tol / 3600), sev)
    if int(recent_fails or 0) > 0:
        return (key, False, "flapping: %s failed run(s) in the last day, last success %.1f h ago"
                % (recent_fails, age / 3600), BACKGROUND)
    return (key, True, "last success %.1f h ago" % (age / 3600), sev)
```

Then inside `check_scheduled_money_jobs`, replace the `elif float(age) > tol: ... elif int(r.get("recent_fails") ...` block (keep the `age is None` branch as is) with:

```python
        else:
            out.append(classify_pgcron(name, float(age),
                                       int(r.get("recent_fails") or 0), tol, sev))
```

- [ ] **Step 4: Run the tests and one live cycle**

Run: `ssh mini "cd ~/agent-link && /usr/bin/python3 -m pytest test_watchdog.py -q && /usr/bin/python3 watchdog.py"`
Expected: 3 passed. Live output shows the three flapping pgcron jobs move from `DOWN(critical)` to `down(background)`; remaining CRITICAL reds are only pgnet:http:500 (Aspire) and pgnet:http:none.

- [ ] **Step 5: Commit**

```bash
ssh mini "cd ~/agent-link && git add watchdog.py test_watchdog.py && git commit -m 'fix(watchdog): flapping pg_cron jobs ride the digest instead of paging'"
```

---

### Task 2: Stagger the per-minute pg_cron pumps to stop the startup timeouts

**Files:** none (hyve-iot database change, recorded here)

- [ ] **Step 1: Stagger the two every-minute jobs onto alternating minutes**

```bash
source ~/.chudbrain/secrets.env && curl -s -X POST "https://api.supabase.com/v1/projects/diiilqpfmlxjwiaeophb/database/query" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d '{"query":"SELECT cron.alter_job(jobid, schedule => CASE jobname WHEN '\''partner-outbound-worker'\'' THEN '\''*/2 * * * *'\'' ELSE '\''1-59/2 * * * *'\'' END) FROM cron.job WHERE jobname IN ('\''partner-outbound-worker'\'','\''partner-webhook-dispatch'\'');"}'
```

Worst-case added latency is 2 minutes on bridge delivery and webhook dispatch, which nothing downstream notices.

- [ ] **Step 2: Verify the schedules took**

Query `SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'partner-%';` the same way.
Expected: `*/2 * * * *` and `1-59/2 * * * *`.

- [ ] **Step 3: Verify the flapping stops (next day)**

Query `cron.job_run_details` failures for the last 6 hours after a few hours of running. Expected: startup-timeout failures drop to near zero. If they persist, the fallback is raising the pg_cron concurrency setting, a separate decision.

---

### Task 3: Repair Julia's account

**Files:** none (hyve-iot data change, recorded here)

- [ ] **Step 1: Check the duplicate profile for financial children before deleting**

```sql
SELECT 'rent' src, count(*) FROM rent_payments WHERE tenant_profile_id = '4804aa3a-fc56-4551-87b5-1fe7b9e7bf86'
UNION ALL SELECT 'invoices', count(*) FROM invoices WHERE tenant_profile_id = '4804aa3a-fc56-4551-87b5-1fe7b9e7bf86'
UNION ALL SELECT 'documents', count(*) FROM tenant_documents WHERE tenant_profile_id = '4804aa3a-fc56-4551-87b5-1fe7b9e7bf86';
```

Expected: all zero. If any are nonzero, STOP and re-point those rows at profile 7785384a before deleting.

- [ ] **Step 2: Delete the archived duplicate, activate the live profile**

```sql
BEGIN;
DELETE FROM onboarding_progress WHERE tenant_profile_id = '4804aa3a-fc56-4551-87b5-1fe7b9e7bf86';
DELETE FROM tenant_profiles WHERE id = '4804aa3a-fc56-4551-87b5-1fe7b9e7bf86';
UPDATE tenant_profiles SET is_active = true WHERE id = '7785384a-91c5-46a0-82ea-5f92ef5d3792';
COMMIT;
```

- [ ] **Step 3: Verify her rent and dates are on the surviving row**

```sql
SELECT tp.monthly_rent, op.tenancy_start_date, op.tenancy_end_date, r.unit_code
FROM tenant_profiles tp
JOIN onboarding_progress op ON op.tenant_profile_id = tp.id
JOIN rooms r ON r.id = tp.room_id
WHERE tp.id = '7785384a-91c5-46a0-82ea-5f92ef5d3792';
```

Expected: CP-PR1, 2026-09-08 to 2026-12-19. If monthly_rent is null, set it to the amount agreed in her WhatsApp thread (verify in chat 1293 before writing; CP-PR1 lists at 1500).

- [ ] **Step 4: Verify login end to end (the same repro that proved the bug)**

Run the Node repro from hyve-website (signInWithPassword as her, then the profile query). Expected: profile query returns a row instead of PGRST116.

- [ ] **Step 5: Tell Julia, and close the loop**

Send via Beeper chat 1293 (follow-up on our own promise, auto-send rule applies), humanised, no dashes:

"hi julia, portal login is fixed on our side. same link lazybee.sg/portal/login, same email and password. if the button still hangs on your phone, open it once in a private window and it will clear. it walks you through the onboarding steps from there. deposit receipt is still with me, will confirm it separately"

Then log the loop closed (loops_db) and mark the chat handled.

---

### Task 4: Aspire credentials for verify-rent (BLOCKED on Mark)

**Files:** none (Supabase edge function secrets)

- [ ] **Step 1: Mark provides ASPIRE_CLIENT_ID and ASPIRE_API_KEY** (from the Aspire dashboard, API section). This is a decision-card item; nothing else in this task can start without it.

- [ ] **Step 2: Set the secrets and verify**

```bash
supabase secrets set ASPIRE_CLIENT_ID=... ASPIRE_API_KEY=... --project-ref diiilqpfmlxjwiaeophb
```

Then after the next half-hour tick, query `net._http_response` for the newest verify-rent response. Expected: status 200 and credits_seen greater than 0. Then check whether Julia's deposit and any pending rent match automatically, and send her the receipt.

---

### Task 5: Inbound worker survives raw transport errors

**Files:**
- Modify: `~/agent-link/beeper_inbound_worker.py` (main loop, two guards, around lines 508 and 545)

- [ ] **Step 1: Broaden the two bus-call guards**

Change:

```python
        try:
            agent_link.poll_and_handle(AGENT_ID, {"run_now": run_now})
        except agent_link.AgentLinkError:
            pass  # bus blips must not stop the sweep schedule
```

to:

```python
        try:
            agent_link.poll_and_handle(AGENT_ID, {"run_now": run_now})
        except Exception:  # noqa: BLE001 raw socket timeouts killed the worker on 15 Aug
            pass  # bus blips must not stop the sweep schedule
```

and the closing heartbeat block's `except agent_link.AgentLinkError:` to `except Exception:  # noqa: BLE001` with the same one-line reason comment.

- [ ] **Step 2: Restart and verify a sweep completes**

```bash
ssh mini "launchctl kickstart -k gui/501/com.markwee.beeper-inbound-worker && sleep 90 && tail -3 ~/.agent-runner/logs/beeper-inbound.log"
```

Expected: a fresh sweep line, no traceback in /tmp/beeper-inbound-worker.err.

- [ ] **Step 3: Commit**

```bash
ssh mini "cd ~/agent-link && git add beeper_inbound_worker.py && git commit -m 'fix(worker): beeper-inbound survives raw transport errors from the bus'"
```

---

### Task 6: Triage the ticket queue before the runner comes back

**Files:** none (hyve-iot data change via Partner API or SQL, recorded here)

- [ ] **Step 1: Resolve the two tickets MOPS cancelled in June**

Find them: `SELECT id, listing_code, left(description, 60), status, due_at FROM maintenance_tickets WHERE status NOT IN ('RESOLVED') AND (listing_code = 'IH-PR2' AND description ILIKE '%mold%' OR listing_code = 'CP-PR1' AND description ILIKE '%door%');`

Then: `UPDATE maintenance_tickets SET status = 'RESOLVED', resolution_note = 'Cancelled in MOPS in June; enum gains CANCELLED in P2 and this becomes CANCELLED then' WHERE id IN (...);` (adjust the note column name to the real schema, check with a `SELECT * ... LIMIT 1` first).

- [ ] **Step 2: Refresh every stale due date so no dispatch carries a June clock**

```sql
UPDATE maintenance_tickets
SET due_at = now() + CASE upper(severity)
    WHEN 'URGENT' THEN interval '1 day'
    WHEN 'HIGH' THEN interval '3 days'
    ELSE interval '14 days' END
WHERE status NOT IN ('RESOLVED') AND due_at < now();
```

- [ ] **Step 3: Verify** with `SELECT count(*) FROM maintenance_tickets WHERE status NOT IN ('RESOLVED') AND due_at < now();` Expected: 0.

---

### Task 7: Maintenance runner sends once, then comes back to life

**Files:**
- Modify: `~/agent-link/maintenance_runner.py`
- Modify: `~/agent-link/test_maintenance_runner.py`
- Modify: `~/agent-link/watchdog.py` (remove the RETIRED entry)

- [ ] **Step 1: Write the failing tests for the send-once ledger**

Append to `test_maintenance_runner.py`:

```python
def test_ledger_sends_once_per_period(tmp_path):
    import maintenance_runner as mr
    mr.SENT_LEDGER = str(tmp_path / "sent.json")
    led = mr.ledger_load()
    assert not mr.already_sent(led, "t1", "kavi", "2026-08-15")
    mr.mark_sent(led, "t1", "kavi", "2026-08-15", dry_run=False)
    led = mr.ledger_load()
    assert mr.already_sent(led, "t1", "kavi", "2026-08-15")
    assert not mr.already_sent(led, "t1", "kavi", "2026-08-16")


def test_dry_run_never_writes_ledger(tmp_path):
    import maintenance_runner as mr
    mr.SENT_LEDGER = str(tmp_path / "sent.json")
    led = mr.ledger_load()
    mr.mark_sent(led, "t1", "kavi", "2026-08-15", dry_run=True)
    assert not mr.already_sent(mr.ledger_load(), "t1", "kavi", "2026-08-15")
```

Run: `ssh mini "cd ~/agent-link && /usr/bin/python3 -m pytest test_maintenance_runner.py -q"`  Expected: the two new tests FAIL (no ledger functions).

- [ ] **Step 2: Implement the ledger**

Add to `maintenance_runner.py` near the other constants:

```python
SENT_LEDGER = os.path.expanduser("~/.agent-runner/maintenance-sent.json")


def ledger_load():
    try:
        with open(SENT_LEDGER) as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {}


def already_sent(led, ticket_id, kind, period):
    return led.get("%s:%s" % (ticket_id, kind)) == period


def mark_sent(led, ticket_id, kind, period, dry_run):
    """Record a send. Dry runs never write: a rehearsal must not eat the
    real send's one shot."""
    led["%s:%s" % (ticket_id, kind)] = period
    if dry_run:
        return
    os.makedirs(os.path.dirname(SENT_LEDGER), exist_ok=True)
    tmp = SENT_LEDGER + ".tmp"
    with open(tmp, "w") as fh:
        json.dump(led, fh, indent=1, sort_keys=True)
    os.replace(tmp, SENT_LEDGER)
```

- [ ] **Step 3: Guard the three unguarded sends in execute()**

`execute(plan, ticket, dry_run=True)` becomes `execute(plan, ticket, led, dry_run=True)` (update the call in `main`: load `led = ledger_load()` once before the loop). Wrap the captain, kavi, and mark sends:

```python
    period = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
    if plan["assign_to"] and (plan["ack"] or plan["chase"]):
        if not already_sent(led, plan["ticket_id"], "captain", period):
            send_whatsapp(plan["assign_to"]["phone"], captain_text(ticket, plan["assign_to"]), dry_run)
            mark_sent(led, plan["ticket_id"], "captain", period, dry_run)
            did.append("assigned %s" % plan["assign_to"]["name"])
    if plan["chase"]:
        mark_chased(plan["ticket_id"], dry_run)
        did.append("chased")
    if "kavi" in plan["notify"] and not already_sent(led, plan["ticket_id"], "kavi", period):
        send_whatsapp(KAVI["phone"], kavi_text(plan, ticket), dry_run)
        mark_sent(led, plan["ticket_id"], "kavi", period, dry_run)
        did.append("told Kavi")
    if "mark" in plan["notify"] and not already_sent(led, plan["ticket_id"], "mark", period):
        why = "URGENT" if plan["severity"] == "URGENT" else "quote needed"
        send_telegram("%s: %s %s. %s" % (why, scrub(plan.get("listing_code")),
                                         scrub(ticket.get("description")),
                                         "Approve the spend?" if plan["needs_quote"] else ""),
                      dry_run)
        mark_sent(led, plan["ticket_id"], "mark", period, dry_run)
        did.append("told Mark")
```

The ack path keeps its existing API-persisted guard (ack_should_send plus mark_acknowledged) untouched.

- [ ] **Step 4: Run all runner tests, then one manual dry run**

Run: `ssh mini "cd ~/agent-link && /usr/bin/python3 -m pytest test_maintenance_runner.py -q && /usr/bin/python3 maintenance_runner.py"`
Expected: tests pass; dry-run JSON shows a sane plan against the triaged queue (Task 6 done first), nothing addressed to stale June work.

- [ ] **Step 5: Un-retire and reload**

Remove the `"com.markwee.maintenance-runner"` line from RETIRED in `watchdog.py`. Reload the launchd job (it invokes the runner with --send on its existing 15 minute schedule):

```bash
ssh mini "launchctl bootstrap gui/501 ~/Library/LaunchAgents/com.markwee.maintenance-runner.plist 2>/dev/null || launchctl kickstart gui/501/com.markwee.maintenance-runner"
```

Watch one live cycle in the log and confirm exactly one message per (ticket, recipient) fires, then nothing repeats on the following cycle.

- [ ] **Step 6: Commit**

```bash
ssh mini "cd ~/agent-link && git add maintenance_runner.py test_maintenance_runner.py watchdog.py && git commit -m 'feat(runner): send-once ledger for captain, kavi and mark notifies; un-retire'"
```

---

## Acceptance for P1 as a whole

1. Watchdog page volume: only genuine reds page; flapping rides the digest.
2. partner pumps: startup-timeout failures near zero over a day.
3. Julia logs in and lands in onboarding; she has been told.
4. verify-rent returns 200 with credits_seen > 0 (once Mark supplies Aspire keys).
5. beeper-inbound uptime unbroken across a bus outage (no tracebacks in err log).
6. Maintenance runner live again, zero duplicate sends across two consecutive cycles.
