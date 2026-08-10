// Run with: node --test supabase/functions/_shared/channelPricing.test.js
//
// The test that matters is "grossing up nets us the base exactly". It is the
// one that fails against the intuitive `base × (1 + c/L)`, which looks right,
// reads right, and quietly hands the agent a commission on their own
// commission. Everything else here is guarding the edges of that.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BILLING,
  billingOf,
  upliftFor,
  quotedPrice,
  channelCost,
  priceBreakdown,
} from "./channelPricing.js";

const AGENT = { slug: "agent", commission_months: 1, gross_up: true };
const DIRECT = { slug: "direct", commission_months: 0, gross_up: false };
const PLATFORM = { slug: "spotahome", commission_pct: 0.15, gross_up: true };
const ABSORBED = { slug: "agent-absorbed", commission_months: 1, gross_up: false };

test("billing mechanism is inferred from whichever commission field is set", () => {
  assert.equal(billingOf(AGENT), BILLING.MONTHS);
  assert.equal(billingOf(PLATFORM), BILLING.PERCENT);
  assert.equal(billingOf(DIRECT), BILLING.NONE);
  assert.equal(billingOf({ slug: "x" }), BILLING.NONE);
});

test("a channel setting both commission fields is rejected, not guessed at", () => {
  assert.throws(
    () => billingOf({ slug: "bad", commission_months: 1, commission_pct: 0.1 }),
    /must use exactly one/,
  );
});

test("direct is quoted the base price untouched", () => {
  assert.equal(quotedPrice(1500, DIRECT, 12), 1500);
  assert.equal(channelCost(1500, DIRECT, 12), 0);
});

test("agent quote on the real CP-PR1 price is 1636, not 1625", () => {
  // 1625 is base × (1 + 1/12). It is the number you get if you treat the
  // commission as a month of OUR price rather than a month of the quote.
  assert.equal(quotedPrice(1500, AGENT, 12), 1636);
  assert.notEqual(quotedPrice(1500, AGENT, 12), 1625);
});

test("grossing up nets us the base price exactly, which is the whole point", () => {
  for (const base of [600, 1000, 1380, 1500, 2200]) {
    const b = priceBreakdown(base, AGENT, 12);
    // Within a dollar a month, since the quote is rounded to whole dollars.
    assert.ok(
      Math.abs(b.net - base * 12) <= 12,
      `base ${base}: netted ${b.net}, wanted ${base * 12}`,
    );
    assert.ok(b.net > base * 12 - 12, `base ${base} undershot: ${b.net}`);
  }
});

test("the naive formula would undershoot, so the difference is real money", () => {
  const naive = Math.round(1500 * (1 + 1 / 12)); // 1625
  const naiveNet = naive * 12 - naive * 1; //      17875
  const proper = priceBreakdown(1500, AGENT, 12);
  assert.equal(naiveNet, 17875);
  assert.ok(proper.net >= 17995, `proper netted ${proper.net}`);
});

test("pro-rata: half a month on six is the same uplift as one month on twelve", () => {
  const half = { slug: "agent", commission_months: 0.5, gross_up: true };
  assert.ok(
    Math.abs(upliftFor(half, 6) - upliftFor(AGENT, 12)) < 1e-12,
    "pro-rata should fall out of the formula, not need a special case",
  );
  assert.equal(quotedPrice(1500, half, 6), quotedPrice(1500, AGENT, 12));
});

test("shorter leases cost more per month, because the commission spreads thinner", () => {
  const q3 = quotedPrice(1500, AGENT, 3);
  const q6 = quotedPrice(1500, AGENT, 6);
  const q12 = quotedPrice(1500, AGENT, 12);
  assert.ok(q3 > q6 && q6 > q12, `${q3} > ${q6} > ${q12}`);
});

test("a percentage platform nets us the base too", () => {
  const b = priceBreakdown(1500, PLATFORM, 12);
  assert.equal(b.quotedMonthly, 1765); // 1500 / 0.85
  assert.ok(Math.abs(b.net - 18000) <= 12, `netted ${b.net}`);
});

test("gross_up false absorbs the cost: same quote, smaller net", () => {
  const b = priceBreakdown(1500, ABSORBED, 12);
  assert.equal(b.quotedMonthly, 1500);
  assert.equal(b.channelCost, 1500);
  assert.equal(b.net, 16500);
});

test("a fixed fee is spread across the lease, not charged monthly", () => {
  const flat = { slug: "feed", fee_fixed: 240, gross_up: true };
  assert.equal(quotedPrice(1500, flat, 12), 1520); // 240 / 12 = 20
  assert.equal(quotedPrice(1500, flat, 6), 1540); //  240 / 6  = 40
});

test("commission at or beyond the lease length is refused, not rendered as Infinity", () => {
  assert.throws(() => quotedPrice(1500, AGENT, 1), /must be shorter than the lease/);
  assert.throws(
    () => quotedPrice(1500, { slug: "greedy", commission_months: 2, gross_up: true }, 2),
    /must be shorter than the lease/,
  );
});

test("nonsense inputs throw rather than reaching a prospect", () => {
  assert.throws(() => quotedPrice(0, AGENT, 12), /positive number/);
  assert.throws(() => quotedPrice(-100, AGENT, 12), /positive number/);
  assert.throws(() => quotedPrice(1500, AGENT, 0), /positive number/);
  assert.throws(
    () => quotedPrice(1500, { slug: "all", commission_pct: 1, gross_up: true }, 12),
    /must be below 1/,
  );
});

test("rounding happens once at the end, not on the uplift", () => {
  // 1380 × 12/11 = 1505.4545…  A rounded uplift (1.09) would give 1504.
  assert.equal(quotedPrice(1380, AGENT, 12), 1505);
});

test("breakdown reports what a pricing screen needs", () => {
  const b = priceBreakdown(2200, AGENT, 12);
  assert.equal(b.slug, "agent");
  assert.equal(b.quotedMonthly, 2400);
  assert.equal(b.billing, BILLING.MONTHS);
  assert.equal(b.grossedUp, true);
  assert.equal(b.channelCost, 2400);
  assert.equal(b.grossOverLease, 28800);
  assert.equal(b.net, 26400);
});
