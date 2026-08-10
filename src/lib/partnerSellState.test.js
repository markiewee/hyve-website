import test from "node:test";
import assert from "node:assert/strict";
import { sellStateView } from "./partnerSellState.js";

const row = {
  id: "room-uuid", unit_code: "CP-MR", price: 2200, max_occupancy: 2,
  frees_on: "2026-09-14", next_arrival: "2026-12-01",
};

test("sell state exposes exactly the agent-facing keys, never ids", () => {
  const v = sellStateView(row, new Set(["CP-MR"]));
  assert.deepEqual(Object.keys(v).sort(),
    ["frees_on", "listing_code", "next_arrival", "price", "should_be_live"]);
  assert.equal(v.listing_code, "CP-MR");
  assert.equal(v.price, 2200);
  assert.equal(v.frees_on, "2026-09-14");
  assert.equal(v.next_arrival, "2026-12-01");
  assert.equal(v.should_be_live, true);
});

test("membership decides should_be_live, nulls pass through", () => {
  const v = sellStateView({ ...row, frees_on: null, next_arrival: null }, new Set());
  assert.equal(v.should_be_live, false);
  assert.equal(v.frees_on, null);
  assert.equal(v.next_arrival, null);
});
