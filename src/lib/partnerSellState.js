// src/lib/partnerSellState.js
//
// Internal-scope sell state for platform agents: which rooms to actively
// market (CLAUDE.md rule 18), straight from v_sellable_rooms and
// v_should_be_live so the rule lives in the database once and agents can
// never drift from it. The whitelist is asserted by tests: room ids and
// occupancy stay internal to the views, agents get codes and dates.

export function sellStateView(row, shouldBeLiveCodes) {
  return {
    listing_code: row.unit_code,
    price: row.price ?? null,
    frees_on: row.frees_on ?? null,
    next_arrival: row.next_arrival ?? null,
    should_be_live: shouldBeLiveCodes.has(row.unit_code),
  };
}
