// src/lib/reserveOnboarding.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  RESERVE_FIRST_STEP,
  addMonthsMinusADay,
  monthSpan,
  pickReusableProfileId,
  buildProfileSeed,
  buildOnboardingSeed,
} from "./reserveOnboarding.js";

// The convention the admin UI already uses: start + N months, minus one day.
// AdminOnboardingPage.jsx says "1 Apr + 6 months = 30 Sep" in its own comment.
test("a lease ends the day before the anniversary, not on it", () => {
  assert.equal(addMonthsMinusADay("2026-04-01", 6), "2026-09-30");
  assert.equal(addMonthsMinusADay("2026-09-08", 3), "2026-12-07");
  assert.equal(addMonthsMinusADay("2026-01-15", 12), "2027-01-14");
});

test("a missing or nonsense duration yields no end date rather than a wrong one", () => {
  assert.equal(addMonthsMinusADay("2026-09-08", null), null);
  assert.equal(addMonthsMinusADay("2026-09-08", 0), null);
  assert.equal(addMonthsMinusADay(null, 3), null);
  assert.equal(addMonthsMinusADay("not-a-date", 3), null);
});

// Documents JS setMonth overflow deliberately. The admin UI has the identical
// behaviour, so matching it keeps the API and the screen in agreement. Diverging
// here would be a new bug, not a fix.
test("month-end overflow matches the admin UI instead of quietly differing", () => {
  assert.equal(addMonthsMinusADay("2026-01-31", 1), "2026-03-02");
});

// Defect 1: the real move-in was on the reserve the whole time.
test("the profile carries the tenancy start, never the submission time", () => {
  const seed = buildProfileSeed({
    reserve: { room_id: "room-1", property_id: "prop-1", preferred_move_in: "2026-09-08", duration_months: 3 },
    room: { price_monthly: 1500, deposit_months: 1 },
  });
  assert.equal(seed.moved_in_at, "2026-09-08");
  assert.equal(seed.lease_end, "2026-12-07");
  assert.equal(seed.lease_months, 3);
  assert.equal(seed.monthly_rent, 1500);
  assert.equal(seed.room_id, "room-1");
  assert.equal(seed.property_id, "prop-1");
  assert.equal(seed.role, "TENANT");
  assert.equal(seed.is_active, true);
});

test("with no stated move-in we omit the field and let the column default stand", () => {
  const seed = buildProfileSeed({
    reserve: { room_id: "room-1", property_id: "prop-1", preferred_move_in: null, duration_months: null },
    room: { price_monthly: 1500, deposit_months: 1 },
  });
  assert.equal("moved_in_at" in seed, false);
  assert.equal("lease_end" in seed, false);
  assert.equal("lease_months" in seed, false);
});

// Defect 2: registration must not be skipped.
test("onboarding starts at the first registration step, not at the money", () => {
  const seed = buildOnboardingSeed({
    tenantProfileId: "tp-1",
    reserve: { room_id: "room-1", preferred_move_in: "2026-09-08", duration_months: 3 },
    room: { price_monthly: 1500, deposit_months: 1 },
  });
  assert.equal(seed.current_step, RESERVE_FIRST_STEP);
  assert.notEqual(seed.current_step, "DEPOSIT");
  assert.equal(seed.status, "ONBOARDING");
  assert.equal(seed.tenant_profile_id, "tp-1");
  assert.equal(seed.tenancy_start_date, "2026-09-08");
  assert.equal(seed.tenancy_end_date, "2026-12-07");
  assert.equal(seed.deposit_amount, 1500);
});

test("deposit amount is months times rent, and absent when the room cannot price it", () => {
  const priced = buildOnboardingSeed({
    tenantProfileId: "tp-1",
    reserve: { room_id: "room-1", preferred_move_in: "2026-09-08", duration_months: 3 },
    room: { price_monthly: 1200, deposit_months: 2 },
  });
  assert.equal(priced.deposit_amount, 2400);

  const unpriced = buildOnboardingSeed({
    tenantProfileId: "tp-1",
    reserve: { room_id: "room-1", preferred_move_in: "2026-09-08", duration_months: 3 },
    room: { price_monthly: null, deposit_months: null },
  });
  assert.equal("deposit_amount" in unpriced, false);
});

// Defect 3: Julia's exact production shape. Two reserves, one room, one person.
test("a second reserve for the same room reuses the first profile", () => {
  const siblings = [
    { id: "a4994b34", status: "account_created", tenant_profile_id: "7785384a", created_at: "2026-08-11T07:22:49Z" },
  ];
  assert.equal(pickReusableProfileId(siblings), "7785384a");
});

test("the oldest usable profile wins so we converge rather than ping-pong", () => {
  const siblings = [
    { id: "newer", status: "account_created", tenant_profile_id: "profile-new", created_at: "2026-08-12T19:45:58Z" },
    { id: "older", status: "reserved", tenant_profile_id: "profile-old", created_at: "2026-08-11T07:22:49Z" },
  ];
  assert.equal(pickReusableProfileId(siblings), "profile-old");
});

test("dead reserves and empty ones never donate a profile", () => {
  assert.equal(pickReusableProfileId([]), null);
  assert.equal(pickReusableProfileId(null), null);
  assert.equal(pickReusableProfileId([
    { id: "x", status: "lost", tenant_profile_id: "profile-lost", created_at: "2026-08-01T00:00:00Z" },
    { id: "y", status: "expired", tenant_profile_id: "profile-exp", created_at: "2026-08-02T00:00:00Z" },
    { id: "z", status: "reserved", tenant_profile_id: null, created_at: "2026-08-03T00:00:00Z" },
  ]), null);
});

// Defect 4: the derived end date was a guess. Real tenancies rarely land on
// start + N months, so an admin had to correct Julia's end date by hand after the
// fact. When the prospect states a move-out date, that date is the tenancy end.
test("an explicit move-out date beats the derived one", () => {
  const reserve = {
    room_id: "room-1",
    property_id: "prop-1",
    preferred_move_in: "2026-09-08",
    preferred_move_out: "2026-12-19",
    duration_months: 3,
  };

  const seed = buildOnboardingSeed({ tenantProfileId: "tp-1", reserve, room: null });
  assert.equal(seed.tenancy_start_date, "2026-09-08");
  assert.equal(seed.tenancy_end_date, "2026-12-19");

  const profile = buildProfileSeed({ reserve, room: null });
  assert.equal(profile.lease_end, "2026-12-19");
  assert.equal(profile.lease_months, 3);
});

test("without a move-out date we still derive the end from the duration", () => {
  const reserve = {
    room_id: "room-1",
    property_id: "prop-1",
    preferred_move_in: "2026-09-08",
    duration_months: 3,
  };
  assert.equal(
    buildOnboardingSeed({ tenantProfileId: "tp-1", reserve, room: null }).tenancy_end_date,
    "2026-12-07"
  );
  assert.equal(buildProfileSeed({ reserve, room: null }).lease_months, 3);
});

test("monthSpan counts calendar months, floored at one", () => {
  assert.equal(monthSpan("2026-09-08", "2026-12-19"), 3);
  assert.equal(monthSpan("2026-09-08", "2027-09-07"), 12);
  assert.equal(monthSpan("2026-09-08", "2026-09-20"), 1);
  assert.equal(monthSpan("", "2026-12-19"), 0);
});
