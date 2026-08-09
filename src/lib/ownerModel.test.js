// Run with: node --test src/lib/ownerModel.test.js
//
// The one thing this page cannot get wrong is arithmetic. A visitor reads a
// headline annual number and then reads twelve bars underneath it, and if those
// two disagree the whole argument dies on the spot. So the invariant tested here
// is not "the numbers look right", it is "the bars sum to the totals", held
// across the full range of the sliders rather than at one convenient input.
//
// The constants are pinned as well. They are unconfirmed assumptions, and an
// unconfirmed assumption that changes quietly is worse than one that is wrong.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  UPLIFT, OPEX, FLOORPCT, SHARE, VOIDMO, AGENTMO, REPAIRS,
  SEASON, VOID_MONTH, MONTHS, PSF, SECTOR, DI, DEFAULT_STATE,
  model, sgd, districtForPostal,
} from "./ownerModel.js";

/* Every state the sliders can actually produce, thinned to something a test can
   sweep: 400 to 2600 sqft in the real 50 step, against every district psf. */
function everyState() {
  const out = [];
  for (const district of Object.keys(PSF)) {
    for (let sqft = 400; sqft <= 2600; sqft += 50) {
      out.push({ psf: PSF[district], sqft, district, beds: 3 });
    }
  }
  return out;
}

const near = (a, b, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `expected ${a} to be within ${eps} of ${b}`);

/* ── the constants are not allowed to drift ───────────────────────── */

test("money model constants are exactly the ones in the prototype", () => {
  assert.equal(UPLIFT, 1.70);
  assert.equal(OPEX, 0.26);
  assert.equal(FLOORPCT, 0.92);
  assert.equal(SHARE, 0.50);
  assert.equal(VOIDMO, 0.75);
  assert.equal(AGENTMO, 0.5);
  assert.equal(REPAIRS, 0.02);
  assert.equal(VOID_MONTH, 11);
  assert.deepEqual(SEASON, [0.96, 1.00, 1.03, 1.01, 0.95, 0.90, 1.04, 1.09, 1.03, 0.99, 0.95, 0.85]);
  assert.equal(MONTHS.length, 12);
  assert.equal(SEASON.length, 12);
});

test("district tables cover every district the postal sector table can produce", () => {
  for (const district of Object.values(SECTOR)) {
    assert.ok(PSF[district] !== undefined, `${district} has no psf`);
    assert.ok(DI[district] !== undefined, `${district} has no name`);
  }
  assert.equal(Object.keys(PSF).length, 28);
});

/* ── the bars must sum to the totals ──────────────────────────────── */

test("the twelve lease bars sum to the annual lease total", () => {
  for (const state of everyState()) {
    const m = model(state);
    assert.equal(m.leaseM.length, 12);
    assert.equal(m.leaseM.reduce((a, b) => a + b, 0), m.leaseTotal);
  }
});

test("the twelve Lazybee bars sum to the annual Lazybee total", () => {
  for (const state of everyState()) {
    const m = model(state);
    assert.equal(m.shareM.length, 12);
    assert.equal(m.shareM.reduce((a, s) => a + s.floor + s.up, 0), m.ourTotal);
  }
});

test("the floor part of every bar sums to the annual floor", () => {
  for (const state of everyState()) {
    const m = model(state);
    near(m.shareM.reduce((a, s) => a + s.floor, 0), m.floorYear, 1e-6);
  }
});

test("the upside part of every bar sums to the owner's half of the surplus", () => {
  for (const state of everyState()) {
    const m = model(state);
    near(m.shareM.reduce((a, s) => a + s.up, 0), m.surplus * SHARE, 1e-6);
  }
});

test("annual Lazybee total is exactly the floor plus the owner's half of the surplus", () => {
  for (const state of everyState()) {
    const m = model(state);
    near(m.ourTotal, m.floorYear + m.surplus * SHARE, 1e-6);
  }
});

/* ── the shape of the year ────────────────────────────────────────── */

test("the void month pays a quarter of a month and the first month carries the agent and the repairs", () => {
  const state = { psf: 4.4, sqft: 900 };
  const m = model(state);
  const market = state.psf * state.sqft;
  near(m.market, market);
  // an untouched month is simply the market rent
  near(m.leaseM[5], market);
  // month eleven is the turnover: three quarters of a month is lost
  near(m.leaseM[VOID_MONTH], market * (1 - VOIDMO));
  // month zero carries the agent's half month plus the year's repairs
  near(m.leaseM[0], market - market * AGENTMO - market * 12 * REPAIRS);
});

test("no month ever pays a negative lease, at any size", () => {
  for (const state of everyState()) {
    for (const l of model(state).leaseM) assert.ok(l >= 0, `negative lease month: ${l}`);
  }
  // and at an absurd input the clamp still holds
  for (const l of model({ psf: 0, sqft: 400 }).leaseM) assert.equal(l, 0);
});

test("the upside is spread across the year in the seasonal shape, not evenly", () => {
  const m = model({ psf: 4.4, sqft: 900 });
  const ss = SEASON.reduce((a, b) => a + b, 0);
  m.shareM.forEach((s, i) => near(s.up, (m.surplus * SHARE) * (SEASON[i] / ss), 1e-9));
  // August (index 7, the 1.09 month) must pay more upside than December (0.85)
  assert.ok(m.shareM[7].up > m.shareM[11].up);
});

test("the floor is the same every month, full or empty", () => {
  const m = model({ psf: 5.5, sqft: 1400 });
  for (const s of m.shareM) near(s.floor, m.floorMo, 1e-9);
  near(m.floorMo, m.market * FLOORPCT, 1e-9);
});

test("surplus is never negative, so a bad year cannot claw back the floor", () => {
  for (const state of everyState()) assert.ok(model(state).surplus >= 0);
  // a unit where the gross cannot clear costs plus floor yields zero upside, not a loss
  assert.equal(model({ psf: 0.0001, sqft: 400 }).surplus >= 0, true);
});

test("a bigger unit is worth more on both sides, and the model is linear in size", () => {
  const small = model({ psf: 4.4, sqft: 900 });
  const big = model({ psf: 4.4, sqft: 1800 });
  assert.ok(big.ourTotal > small.ourTotal);
  assert.ok(big.leaseTotal > small.leaseTotal);
  near(big.ourTotal, small.ourTotal * 2, 1e-6);
  near(big.leaseTotal, small.leaseTotal * 2, 1e-6);
});

test("the default state produces the same numbers as the prototype", () => {
  // Checked against the prototype by running the model block out of
  // design-preview/owners.html on the same default state. Note that the numbers
  // hardcoded in that file's markup (S$42,340, S$34,052) are stale placeholders
  // that its own render() overwrites on load, so the running page is the oracle,
  // not the HTML text.
  const m = model(DEFAULT_STATE);
  assert.equal(sgd(m.ourTotal), "S$51,749");
  assert.equal(sgd(m.leaseTotal), "S$41,620");
  assert.equal(sgd(m.floorYear), "S$43,718");
  assert.equal(m.upliftPct, 24);
  assert.deepEqual(
    m.leaseM.map((x) => Math.round(x)),
    [1030, 3960, 3960, 3960, 3960, 3960, 3960, 3960, 3960, 3960, 3960, 990],
  );
});

/* ── the small helpers ────────────────────────────────────────────── */

test("postal codes resolve to a district once two digits are in", () => {
  assert.equal(districtForPostal("5"), null);
  assert.equal(districtForPostal("55"), "D19");
  assert.equal(districtForPostal("556114"), "D19");
  assert.equal(districtForPostal("60"), "D22");
  assert.equal(districtForPostal(""), null);
  assert.equal(districtForPostal(null), null);
  // a sector that does not exist is honestly nothing, not a guess
  assert.equal(districtForPostal("99"), null);
  // letters and spaces are stripped rather than breaking the lookup
  assert.equal(districtForPostal("s 55 6114"), "D19");
});

test("money is rounded and grouped the Singapore way", () => {
  assert.equal(sgd(0), "S$0");
  assert.equal(sgd(1234.4), "S$1,234");
  assert.equal(sgd(1234.6), "S$1,235");
  assert.equal(sgd(42340.2), "S$42,340");
});
