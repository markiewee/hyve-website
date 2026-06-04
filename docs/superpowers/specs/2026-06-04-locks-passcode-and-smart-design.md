# Locks page v2 — passcode + smart locks

*Spec — 2026-06-04*

## Problem

The admin **Smart Locks** page (`AdminLocksPage`, route `/portal/admin/locks`) is mislabelled and incomplete. It only edits **manual access codes** stored as JSON in `property_guides` (section `access_codes`). Meanwhile a full **TTLock** integration already exists in the backend (`api/portal/admin-actions.js`) but the page never uses it. Mark wants the page to handle **locks in general**: a door is either a **passcode** lock (update the code manually, as today) or a **smart** lock (show its live state from TTLock).

## Goal

One Locks page that, per door, renders the right control:
- **Passcode lock** → today's editable code field (unchanged).
- **Smart lock** → read-only live status pulled from TTLock: battery, online/offline, current passcode(s), and the recent entry log.

No remote lock/unlock (TTLock can't open a door over the internet without a per-unit Wi-Fi gateway, and there's no unlock action). No DB migration. No manual tagging.

## Decisions (from brainstorm)

- **Smart "toggle" = live status + passcodes, read-only.** Not an action.
- **Lock typing = auto from the TTLock list.** Pull `list_locks`, match each smart lock to a door by name. Matched ⇒ smart; unmatched ⇒ passcode. Relies on consistent lock naming.

## Existing pieces (reused, not rebuilt)

- `api/portal/admin-actions.js` → `handleTTLock` with actions: `list_locks`, `lock_detail`, `list_passcodes`, `lock_records` (also generate/add/delete passcode — not used by this read-only view). Gated on `TTLOCK_CLIENT_ID`; returns 500 `"TTLock not configured"` when env vars are absent.
- `property_guides` (section `access_codes`, JSON `{ main_door, rooms: { UNIT_CODE: code } }`) → passcode storage. Unchanged.
- `AdminLocksPage` per-property layout, the manual code editor, and `saveEdit`. Unchanged for passcode doors.

## Design

### Data flow on page load
1. Existing: fetch `properties → rooms` + `property_guides` access codes (unchanged).
2. New: `POST /api/portal/admin-actions` `{ ttlock_action: "list_locks" }` → list of TTLock smart locks (each has a `lockId` and an alias/name like `lockAlias`).
3. Build a **match map**: for each door (main door + each room unit_code), find a TTLock lock whose alias matches:
   - **Room:** alias contains the `unit_code` (case-insensitive), e.g. alias `"CP-PR1 Bedroom"` ⇒ matches room `CP-PR1`.
   - **Main door:** alias contains a keyword (`main`, `front`, `gate`) for that property, or a `<property code>-MAIN` convention.
   - First match wins; ambiguous/no match ⇒ passcode.
4. Render each door's card by type.

### Card behaviour
- **Passcode card** (no match): identical to today — show/edit the code from `property_guides`, copy button, `saveEdit`.
- **Smart card** (matched): a "Smart" badge + the door label. **Collapsed by default.** On expand, lazily fetch and show:
  - `lock_detail` → battery %, online/offline (electricQuantity, lock state fields).
  - `list_passcodes` → current keyboard passcodes (name + code + validity).
  - `lock_records` (last ~10) → recent entry events (who/when).
  - Read-only. A manual "Refresh" re-fetches.

### Graceful degradation
- If step 2 errors or returns `"TTLock not configured"` / non-2xx → match map is empty → **every door falls back to a passcode card** (exactly today's behaviour). The page must never break or block on the TTLock call; it loads passcode mode first, then enriches with smart matches when the list resolves.

## Components / units

- **`AdminLocksPage`** — orchestrates: existing fetch + the new `list_locks` call + builds the match map; renders passcode rows (existing) or `<SmartLockCard>` per door. Owns the graceful-fallback logic.
- **`SmartLockCard`** (new, `src/components/portal/SmartLockCard.jsx`) — props: `{ lock, doorLabel }`. Collapsed badge row; on expand, lazy-loads `lock_detail` + `list_passcodes` + `lock_records` via the admin-actions endpoint, renders status/passcodes/log, handles its own loading/error state. Self-contained; no shared state with the passcode editor.
- **`ttlock` client helper** (small, `src/lib/ttlock.js`) — thin `callTTLock(action, params)` wrapper around `POST /api/portal/admin-actions` so the page and card don't duplicate fetch boilerplate. Returns parsed JSON or throws.

## Error handling

- Network/`not configured` on `list_locks` → empty match map, all passcode (no toast spam; optional single quiet console note).
- Per-`SmartLockCard` expand failure → inline "Couldn't reach this lock" + Retry, doesn't affect other cards.
- Passcode save path → unchanged (existing toast handling).

## Out of scope (YAGNI)

- Remote lock/unlock, gateway provisioning.
- Creating/revoking passcodes from this page (the backend supports it; not part of read-only v2).
- A `locks` DB table / manual typing / migrations.
- Real-time/websocket updates (manual Refresh only).

## Testing / verification

- TTLock can't be exercised without live creds; verify behaviour in two states:
  1. **TTLOCK unset** (current prod likely) → page renders all passcode cards exactly as today (regression check).
  2. **TTLOCK set** → `list_locks` returns; at least one room with a matching alias renders a Smart card that expands to status/passcodes/log.
- Build passes (`npm run build`). Manual click-through of expand/refresh/fallback.

## Dependency to flag

Smart cards only appear when `TTLOCK_CLIENT_ID/SECRET/USERNAME/PASSWORD_MD5` are set in Vercel. Until then the page is unchanged (all passcode) — which is the safe default.
