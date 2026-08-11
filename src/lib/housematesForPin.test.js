// Run with: node --test src/lib/housematesForPin.test.js
//
// housemates_for_staff_pin is the only route by which a six digit PIN can reach
// tenant data, and a channel partner holds one of those PINs. The function is
// SQL, so what is pinned here is its source: the exact column list it returns,
// and the absence of every column that would turn a leaked PIN from a
// commercial annoyance into a privacy incident.
//
// This is the same mechanism partnerSerialize.test.js uses on the public API.
// Widening the RETURNS TABLE without changing this test is a build failure.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SQL = readFileSync(
  new URL(
    "../../supabase/migrations/20260814000000_staff_desk_partner_ready.sql",
    import.meta.url,
  ),
  "utf8",
);

// Comments stripped before the banned-column scan. The migration names those
// columns in prose, to say why they are absent, and a scan that cannot tell
// documentation from a select fails on the documentation.
const CODE = SQL.replace(/--.*$/gm, "");

const returnsBlock = SQL.slice(
  SQL.indexOf("returns table ("),
  SQL.indexOf(")\nlanguage plpgsql"),
);

test("the roster returns exactly five columns", () => {
  const cols = returnsBlock
    .split("\n")
    .slice(1)
    .map((l) => l.trim().split(/\s+/)[0])
    .filter(Boolean);
  assert.deepEqual(cols, [
    "property_id",
    "unit_code",
    "nationality",
    "gender",
    "lease_end",
  ]);
});

test("no identifying column is selected anywhere in the function", () => {
  // full_name and username identify the person outright. The id and pass
  // columns are passport and work-pass data that the landlord portal guards
  // behind a server round trip. monthly_rent is the tenant's own commercial
  // position and is nobody else's business.
  for (const banned of [
    "full_name",
    "username",
    "id_number",
    "id_type",
    "id_expiry",
    "passport",
    "pass_number",
    "pass_type",
    "monthly_rent",
    "user_id",
    "email",
    "phone",
  ]) {
    assert.ok(
      !CODE.includes(banned),
      `${banned} must never be reachable through a staff PIN`,
    );
  }
});

test("an unrecognised PIN returns empty rather than raising", () => {
  // Raising would confirm which codes exist. Same posture as redeem_staff_pin
  // and rooms_for_pin.
  assert.match(SQL, /if not exists \(\s*select 1 from public\.staff_pins/);
  assert.match(SQL, /then\s+return;\s+end if;/);
});

test("the function is security definer and granted to anon", () => {
  // The desk runs signed out behind a PIN, so anon must be able to call it,
  // which is only safe because the column list above is what it returns.
  assert.match(SQL, /security definer/);
  assert.match(SQL, /set search_path = public/);
  assert.match(
    SQL,
    /grant execute on function public\.housemates_for_staff_pin\(text\) to anon, authenticated;/,
  );
});
