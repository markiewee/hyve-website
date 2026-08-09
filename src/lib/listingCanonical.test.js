// Run with: node --test src/lib/listingCanonical.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  listPriceFor,
  fitDescription,
  orderedPhotos,
  buildPayload,
  diffAgainstLive,
} from "./listingCanonical.js";

/* ── gross-up ────────────────────────────────────────────────────── */

test("a zero-commission channel lists at the net price", () => {
  assert.equal(listPriceFor(1500, { commission_pct: 0, gross_up: true }), 1500);
});

test("a 10% channel lists high enough that we still net our price", () => {
  const listed = listPriceFor(1500, { commission_pct: 10, gross_up: true });
  assert.equal(listed, 1666.67);
  // The real test: after they take their cut, we get what we asked for.
  assert.ok(Math.abs(listed * 0.9 - 1500) < 0.01);
});

test("grossing up is NOT the same as adding the percentage", () => {
  // 1500 + 10% = 1650, which nets 1485 and quietly loses us 15 a month.
  assert.notEqual(listPriceFor(1500, { commission_pct: 10, gross_up: true }), 1650);
});

test("UNKNOWN commission refuses to price rather than assuming zero", () => {
  assert.equal(listPriceFor(1500, { commission_pct: null, gross_up: true }), null);
  assert.equal(listPriceFor(1500, {}), null);
});

test("gross_up off means publish the net price as-is", () => {
  assert.equal(listPriceFor(1500, { commission_pct: null, gross_up: false }), 1500);
});

test("a nonsense commission is refused, not applied", () => {
  assert.equal(listPriceFor(1500, { commission_pct: 100, gross_up: true }), null);
  assert.equal(listPriceFor(1500, { commission_pct: -5, gross_up: true }), null);
});

test("a missing price is refused", () => {
  assert.equal(listPriceFor(0, { commission_pct: 10, gross_up: true }), null);
  assert.equal(listPriceFor(null, { commission_pct: 10, gross_up: true }), null);
});

/* ── description fitting ─────────────────────────────────────────── */

test("a description within the cap is untouched", () => {
  assert.equal(fitDescription("Short and sweet.", 100), "Short and sweet.");
});

test("truncation prefers a sentence end", () => {
  const out = fitDescription("One sentence here. Then a second one that overflows badly.", 30);
  assert.equal(out, "One sentence here.");
});

test("truncation never slices a word in half", () => {
  const out = fitDescription("aaa bbb ccc ddd eee fff", 10);
  assert.ok(!out.endsWith("c"), out);
  assert.ok(out.split(" ").every((w) => "aaa bbb ccc ddd eee fff".includes(w)));
});

test("truncation does not leave a trailing comma", () => {
  assert.ok(!fitDescription("alpha, beta, gamma delta", 12).endsWith(","));
});

/* ── photos ──────────────────────────────────────────────────────── */

test("the hero photo comes first and is not duplicated", () => {
  const out = orderedPhotos({ hero_photo: "b.jpg", photos: ["a.jpg", "b.jpg", "c.jpg"] });
  assert.deepEqual(out, ["b.jpg", "a.jpg", "c.jpg"]);
});

test("photos are capped at the channel limit", () => {
  const out = orderedPhotos({ hero_photo: "a.jpg", photos: ["a.jpg", "b.jpg", "c.jpg"] }, 2);
  assert.deepEqual(out, ["a.jpg", "b.jpg"]);
});

/* ── the publish gate ────────────────────────────────────────────── */

const room = { unit_code: "CP-PR3", price_monthly: 1380, next_available: "2026-09-01" };
const profile = {
  title: "Premium room in Serangoon",
  description: "A bright room close to Lorong Chuan MRT.",
  hero_photo: "/photos/cp/PR3.jpg",
  photos: ["/photos/cp/PR3.jpg", "/photos/cp/PR3-2.jpg"],
  needs_review: false,
  fields: { currency: "SGD", price_period: "monthly", min_stay_months: 3 },
};
const channel = { slug: "hozuko", commission_pct: 0, gross_up: true, enabled: true, config: {} };

test("a complete room on an enabled channel is publishable", () => {
  const r = buildPayload({ room, profile, channel });
  assert.equal(r.publishable, true, r.blockers.join("; "));
  assert.equal(r.payload.price, 1380);
  assert.equal(r.payload.external_ref, "CP-PR3");
});

test("THE GATE: a generated placeholder title blocks publication", () => {
  const r = buildPayload({ room, profile: { ...profile, needs_review: true }, channel });
  assert.equal(r.publishable, false);
  assert.match(r.blockers.join(" "), /placeholder/);
});

test("an unknown commission blocks publication rather than underpricing", () => {
  const r = buildPayload({ room, profile, channel: { ...channel, commission_pct: null } });
  assert.equal(r.publishable, false);
  assert.match(r.blockers.join(" "), /commission unknown/);
});

test("a disabled channel blocks publication", () => {
  const r = buildPayload({ room, profile, channel: { ...channel, enabled: false } });
  assert.equal(r.publishable, false);
  assert.match(r.blockers.join(" "), /disabled/);
});

test("missing photos block publication", () => {
  const r = buildPayload({ room, profile: { ...profile, photos: [], hero_photo: null }, channel });
  assert.equal(r.publishable, false);
  assert.match(r.blockers.join(" "), /no photos/);
});

test("every blocker is reported at once, not one at a time", () => {
  const r = buildPayload({
    room: { unit_code: "X" },
    profile: { needs_review: true, photos: [] },
    channel: { ...channel, enabled: false, commission_pct: null },
  });
  assert.ok(r.blockers.length >= 4, JSON.stringify(r.blockers));
});

/* ── drift ───────────────────────────────────────────────────────── */

test("a listing that agrees with us shows no drift", () => {
  assert.deepEqual(diffAgainstLive({ price: 1380, title: "A" }, { price: 1380, title: "A" }), {});
});

test("a stale price on the platform is caught", () => {
  const d = diffAgainstLive({ price: 1380 }, { price: 1600 });
  assert.deepEqual(d, { price: { expected: 1380, live: 1600 } });
});

test("a field the channel does not expose is not treated as drift", () => {
  assert.deepEqual(diffAgainstLive({ price: 1380, bills_included: true }, { price: 1380 }), {});
});
