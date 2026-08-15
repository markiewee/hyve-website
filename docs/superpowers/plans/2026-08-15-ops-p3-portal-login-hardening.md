# P3 Portal Login Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans, inline, no subagents (Mark's rule).

**Goal:** No tenant can ever sit on a dead "SIGNING IN..." spinner or get silently bounced back to the login page again; if it does break, the watchdog knows before a tenant does.

**Architecture:** All client fixes in hyve-website (useAuth.jsx, AuthGuard.jsx, new lib/withTimeout.js). Data sweep on hyve-iot. Canary is a real tenant-shaped account exercised hourly by the mini watchdog through the same REST path the browser client uses.

**Tech Stack:** React, supabase-js, node --test, Python watchdog on the mini.

## The failure modes this closes (Julia, 15 Aug)

1. `signInWithPassword` hangs on the supabase-js auth lock (13 May and 30 May incidents patched page-load, not the sign-in click) with no timeout: eternal spinner.
2. Auth succeeds but `fetchProfile` returns null (inactive profile, missing profile, or TWO active rows breaking `.single()`): signIn "succeeds", navigate to dashboard, AuthGuard silently Navigates back to login. No message anywhere.
3. Nothing sweeps for other tenants sitting in Julia's half-provisioned state.
4. No synthetic login: the portal can be broken for days silently.

### Task 1: withTimeout helper + tests

Create `src/lib/withTimeout.js`:

```js
export function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
```

Test `src/lib/withTimeout.test.js` (node --test): resolves pass through, slow promise rejects with the message, timer cleared on fast resolve. Commit.

### Task 2: signIn hardening in useAuth.jsx

Wrap `signInWithPassword` (10s) and `fetchProfile` (10s) in withTimeout. When profile comes back null after successful auth: sign out (best effort) and throw "Your login works but your account is not set up right. Message us on WhatsApp 8069 5410 and we will sort it out." LoginPage already renders thrown errors; no change needed there. Commit.

### Task 3: AuthGuard inactive-account screen

`user && !profile` after loading renders a panel (not a redirect): "Signed in, but your account is not linked to an active tenancy. Message us on WhatsApp 8069 5410." with a Sign out button. Covers the page-load path signIn cannot. Commit, push, verify Vercel deploy.

### Task 4: same-state tenant sweep (hyve-iot, data)

One query, three buckets: (a) auth users with zero tenant_profiles rows and zero investor rows, (b) users whose profiles are ALL is_active=false, (c) users with more than one active profile (breaks `.single()`). Fix what has an obvious fix, report the rest.

### Task 5: login canary in the mini watchdog

Canary account `canary@portal.lazybee.sg`, role TENANT, is_active=true, no room. Creds in `~/.agent-runner/env` on the mini. Watchdog check `portal:login`: POST `/auth/v1/token?grant_type=password` (anon key, 10s timeout), then GET its own tenant_profiles row with the user JWT (10s), expect exactly one row. Red pages CRITICAL (add `portal:` to PAGING_PREFIXES). Unit-test the classifier; live run; commit.

## Non-goals

Password reset flow, signup flow, RLS redesign, portal UI beyond the two guard points.
