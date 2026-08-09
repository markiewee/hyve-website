# Channel Worker Contract, v1

**Status:** SPEC. Not yet implemented. Roomies is the reference channel.
**Owner:** Mark. **Author:** Claudine, 2026-08-09.
**Database:** hyve-iot `diiilqpfmlxjwiaeophb`. **Schema version:** `1`.

The database is the hub. Workers conform to this contract; the database does not
bend to worker-specific shapes. Read this before writing any tool that puts our
rooms on an outside platform, whether that tool is a browser robot on the Mac
mini, an API client on Fly, or a script on a laptop.

If you only read one thing: **a worker is never told what to do. It is told what
should be true, and it makes it true.**

---

## 1. Why it is shaped this way

The obvious design is a job queue. The portal writes "turn CP-PR2 off", a worker
picks it up, does it, marks it done. That design breaks in four ordinary ways:
the message is lost and the intent vanishes; the message is delivered twice and
the work happens twice; the room's date changes while the job sits in the queue
so the job is now wrong; two workers take the same job.

This contract removes all four by never sending an instruction. The database
holds **desired state**, derived from the room calendar. A worker's standing
order never changes: make the platform match desired, then report what the
platform actually says. Running it twice is harmless. Missing a run is harmless.
There is no message to lose because there is no message.

This is the same posture as `millia-handshake-v1.md`, which ships a full ticket
replay rather than a delta, for the same reason.

## 2. Vocabulary

| Term | Meaning |
| --- | --- |
| **Channel** | An outside platform. One row in `listing_channels`. Roomies, uhomes, Coliving.com. |
| **Placement** | One room on one channel. One row in `listing_placements`. The unit of work. |
| **Desired state** | What the placement *should* look like, derived from `room_calendar`. Never hand-set. |
| **Observed state** | What the platform *actually* showed, last time a worker looked. Never inferred. |
| **Drift** | Desired and observed disagree. This is the only definition of "work to do". |
| **Worker** | Any process that reconciles one channel. Identified by a stable `worker_id`. |
| **Lazybee ref** | `LZB-<UNIT CODE>`, e.g. `LZB-CP-PR1`. Printed on every external listing so a room is identifiable from the listing alone. |

## 3. The three doors

A worker touches the database in exactly three ways. Base tables are not one of
them, and no worker is ever granted access to one.

| Door | Mechanism | Rule |
| --- | --- | --- |
| **Read** | Views, e.g. `v_roomies_listing_state` | A client that reads tables must know the schema. Change a column and every client breaks at once. |
| **Write** | Three functions, section 4 | The whole write API. Tables underneath can be rebuilt without touching a client. |
| **Nothing else** | No table grants, ever | Broad access leaks silently. `v_roomies_listing_state` joins an admin-only table, and a Postgres view runs as its owner, so it exposed everything in that table to `anon` until `security_invoker` was set on 2026-08-09. Assume the same mistake is always one join away. |

**Corollary: a worker never gets its own database.** If it needs storage of its
own (cookies, run logs, screenshots) it gets a schema inside this same Postgres,
for example `roomies.runs`. Two databases have to be kept in step, and keeping
two copies in step is the exact failure this design exists to remove. The only
thing that earns a separate store is a cache you would not mind losing.

## 4. The worker API

Three calls. A worker needs nothing else to exist.

### 4.1 Claim work

```sql
fn_claim_listing_work(
  p_channel_slug text,
  p_worker_id    text,
  p_limit        integer default 25
) returns setof jsonb
```

Returns only placements that are drifting **and** cleared to act on. Each item:

```jsonc
{
  "placement_id":  "uuid",
  "lazybee_ref":   "LZB-CP-PR1",
  "unit_code":     "CP-PR1",
  "external_id":   "roomies listing id",
  "url":           "https://roomies.sg/...",
  "desired":       { "on": true, "headline": "Available from 12 Aug 2026", ... },
  "observed":      { "on": false, "headline": null, "observed_at": "..." },
  "claim_token":   "uuid",
  "claim_expires_at": "timestamptz"
}
```

The call is a claim, not a read. It stamps `claimed_by`, `claim_token` and
`claim_expires_at` inside one transaction using `for update skip locked`, so two
workers running at once cannot receive the same placement. An expired claim is
returned to the pool automatically; there is no unlock call and no lock to leak.

**It returns nothing at all when** the channel is disabled, the placement has no
`external_id`, a change needs approval and has not got it (section 6), the
placement is frozen after repeated failure (section 7), the daily push cap is
reached (section 7), or the room's stored and derived availability disagree
(section 8). Every one of those is a deliberate refusal, and every refusal is
visible on the Availability tab with its reason. An empty result means "nothing
to do", never "something went wrong".

### 4.2 Report the result

```sql
fn_report_listing_result(
  p_placement_id uuid,
  p_claim_token  uuid,
  p_observed     jsonb,
  p_error        text default null
) returns jsonb
```

**`p_observed` is what the worker SAW, never what it intended.** After editing a
listing the worker must reload the page and read it back. This is not optional
and it is the single most important rule in this document. A worker that clicks
save, gets a silent failure, and reports success has corrupted the only record we
have. "After saving, the listing still shows live" is a useful truth. "I set it
to off" is a guess.

The function writes `observed_state` and `observed_at`, recomputes `last_drift`,
sets `last_pushed_at` when an edit was attempted, records `last_error`, adjusts
`consecutive_failures` and the daily push counter, appends a row to
`listing_push_log`, and releases the claim. A wrong or expired `claim_token` is
rejected, so a worker that stalled past its claim cannot report late over a newer
worker's result.

### 4.3 Heartbeat

```sql
fn_worker_heartbeat(
  p_worker_id    text,
  p_channel_slug text,
  p_note         jsonb default null
) returns void
```

Called every run, and on a timer whether or not there was work. Upserts
`channel_workers.last_seen_at`.

**This exists because silence and success look identical.** A worker that is
asleep, unplugged, or crashed produces exactly the same database as a worker with
nothing to do. Without a heartbeat we would discover a dead mini by noticing a
listing was wrong for three weeks. Alert when `last_seen_at` is older than one
hour.

## 5. State shapes

**Desired** is produced by `fn_listing_desired_state(room_id, currently_on)` and
is the same shape for every channel:

```jsonc
{ "on": true,
  "headline": "Available from 12 Aug 2026",   // null when off
  "free_from": "2026-08-12",                  // null when never free
  "days_out": 3,
  "reason": "opens in 3 days, inside the window" }
```

**Observed** mirrors it so the two can be compared field by field:

```jsonc
{ "on": false, "headline": null, "observed_at": "2026-08-09T14:00:00Z" }
```

Drift is `desired.on <> observed.on` or `desired.headline <> observed.headline`.
Nothing else counts, and no worker gets to define its own idea of drift.

Channels that carry availability differently still use this shape. The
`headline` is what the platform gets *some* way: on Roomies it is the listing
title because there is no availability field at all; on a channel with real
dates, the worker maps `free_from` into that field and reports back a headline it
synthesises the same way each time. The comparison logic never changes.

## 6. Approval

Policy, decided by Mark on 2026-08-09:

| Change | Needs approval |
| --- | --- |
| Off to on | No. Upside, and instantly reversible. |
| Headline or date edit | No. Same reasoning. |
| **On to off** | **Yes.** |

Turning a listing off is the only move we cannot cleanly undo: we do not yet
know whether Roomies resets a listing's ranking or loses its message history on
re-listing. Until that is answered, off costs a tap.

**Approval is a column, not a message.** `fn_claim_listing_work` withholds an
off-change until `approved_at` is set. It is set by a human through
`fn_approve_listing_change(placement_id, approve boolean)`, exposed as a button
on the portal Availability tab. Telegram, when it works, only sends the nudge
that tells you to go and press it.

That split is deliberate and load-bearing: as of 2026-08-09 the Telegram bot
token is absent from `~/.chudlife/secrets.env` on this Mac and the file does not
exist at all on the mini, so the router is running with no token and automated
sends fail. If approval rode on Telegram, the whole loop would already be broken.
Riding on a column, it merely goes quiet.

## 7. Failure semantics

No worker invents its own retry policy. All of it is enforced by the claim
function, so a badly written worker cannot escape it.

| Failure | Detected by | Behaviour |
| --- | --- | --- |
| Worker offline or asleep | `channel_workers.last_seen_at` stale | Alert after 1 hour. Nothing else changes; drift simply persists. |
| Platform session expired | Read-back shows a login page | Worker reports the error and **stops the entire run**. Never retry a login, never thrash credentials. Alert immediately. |
| Selector or page changed | Element not found | That placement fails, the rest of the run continues. Alert at 2 consecutive failures on the same placement. |
| Save appeared to work but did not | Read-back shows the old value | Recorded as drift, not as success. Retried once on the next tick, then alert. Only caught because of the read-back rule in 4.2. |
| Worker dies mid-run | Claim expires | Nothing to clean up. The remaining drift is picked up next tick. |
| Bug causes a push loop | Daily push counter per placement | Frozen past 5 pushes in one day, alert. Protects the platform account from looking like an attack. |
| Repeated failure | `consecutive_failures` | Frozen at 5. Requires a human to clear. |
| Everything is wrong | Human judgement | Set `listing_channels.enabled = false`. One field, no deploy, works from a phone. Reporting continues, writing stops. |

## 8. Refusing to act on data we do not trust

A worker must never push a room whose stored `rooms.next_available` disagrees
with the derived `fn_room_next_available()`. Measured on 2026-08-09 across the 19
lettable rooms: 16 agree, 3 do not.

| Room | Stored, shown on the site | Derived from the calendar |
| --- | --- | --- |
| IH-PR1 | 2026-09-19 | none, tenancy has no agreed end date |
| IH-STD2 | 2026-12-07 | 2026-12-21 |
| TG-PR3 | 2028-05-01 | 2028-03-31 |

Acting on a wrong date either advertises a room that is already let or hides one
we could be selling. Both are worse than doing nothing. These are skipped and
surfaced as needing a human.

**This guard is a symptom, not a cure.** The real defect is that one fact lives
in two places: `hyve-booking/lib/rooms.ts` reads the stored column while this
contract reads the function. Pointing the booking site at the function removes
the entire class. That is a separate change and it needs its own approval.

## 9. Auth and isolation

Each worker gets its own credential, never a shared service key. The three
functions are `security definer` and each begins by checking the caller's
`worker_id` is registered in `channel_workers` for the channel it named. A worker
therefore cannot read or write another channel's placements even if it asks.

Consequences that matter in practice: a stolen Mac mini costs you one revoked
worker row, not the database. A buggy new connector cannot corrupt a working one.
And every write is attributable to a named worker in `listing_push_log`, so "who
turned that listing off" always has an answer.

## 10. Adding a channel

The point of this document. To put our rooms on a new platform:

1. Insert a row in `listing_channels`: `slug`, `name`, `mechanism`
   (`browser` / `api` / `feed`), `enabled` **false**.
2. Insert `listing_placements` rows carrying that platform's own listing id in
   `external_id`. A placement with no `external_id` is never claimed.
3. Register the worker in `channel_workers` and issue it a credential.
4. Write the worker. It calls the three functions in section 4 and implements
   exactly two platform-specific operations: **apply(desired)** and
   **read_back() -> observed**. Everything else is already done for you.
5. Run it with `enabled` false until the drift report has been right for a week.
6. Flip `enabled` true.

If writing a worker requires anything beyond apply and read back, the contract is
wrong and should be fixed here rather than worked around in the worker.

## 11. Reference implementation: Roomies

Roomies is the hardest case, which is why it is first. It has no API and no
availability field, so availability rides entirely on the two things we control:
whether the listing is live, and what its title says.

| | |
| --- | --- |
| Channel slug | `roomies` |
| Mechanism | `browser` |
| Worker | Mac mini, `worker_id` `mini-roomies` |
| Session | Persistent Chrome profile at `~/.claude/browser-profiles/roomies`, outside `/tmp` on purpose since `/tmp` is wiped on reboot, which is what kept killing the previous setup |
| Runtime | `~/.claude/tools/roomies/.venv`, Playwright 1.62 |
| apply | Edit listing title, toggle live state |
| read_back | Reload the listing page, read title and live state |

Standing constraint: Mark's rule of 9 August 2026 is that Roomies is driven by
the Chrome extension only, and that rule explicitly overrides the usual browser
escalation ladder. It was made because `/tmp/browser-session` kept being wiped. A
persistent profile removes that cause, but the rule is Mark's and only Mark
retires it. **Until he does, the Roomies worker runs in report-only mode: it
reads and reports observed state and never writes to the platform.** The contract
is identical either way, which is the point.
