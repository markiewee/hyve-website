// Run with: node --test src/lib/comb.test.js
//
// The comb is the one claim on the page that is checkable at a glance: nineteen
// cells, each one a real room, each at its real location. If a cell goes missing,
// doubles up, or lands in the sea, the page is quietly lying about the portfolio.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildComb } from "./comb.js";
import { HOMES, ROOMS, roomsForHome, isLet } from "../data/lazybeeRooms.js";
import { ISLAND } from "../data/singaporeIsland.js";

const comb = () => buildComb(ISLAND, HOMES, roomsForHome, (r) => isLet(r, new Date("2026-08-09")));

test("every lettable room gets exactly one cell", () => {
  const c = comb();
  const codes = c.homes.flatMap((h) => h.cells.map((cell) => cell.code));
  assert.equal(codes.length, ROOMS.length);
  assert.equal(new Set(codes).size, ROOMS.length);
  assert.deepEqual([...codes].sort(), ROOMS.map((r) => r.code).sort());
});

test("the three homes are all drawn, each with its own rooms", () => {
  const c = comb();
  assert.equal(c.homes.length, 3);
  for (const h of c.homes) {
    assert.equal(h.cells.length, roomsForHome(h.code).length);
    assert.ok(h.core.length > 0);
  }
});

test("no cell shares a position with another cell or with a land tile", () => {
  const c = comb();
  const cellPoints = c.homes.flatMap((h) => h.cells.map((cell) => cell.points));
  assert.equal(new Set(cellPoints).size, cellPoints.length);
  const landPoints = new Set(c.land.map((l) => l.points));
  for (const p of cellPoints) assert.equal(landPoints.has(p), false);
});

test("every drawn point sits inside the viewBox", () => {
  const c = comb();
  const all = [...c.land.map((l) => l.points), ...c.homes.flatMap((h) => [h.core, ...h.cells.map((x) => x.points)])];
  for (const pts of all) {
    for (const pair of pts.split(" ")) {
      const [x, y] = pair.split(",").map(Number);
      assert.ok(x > -40 && x < c.width + 40, `x out of frame: ${x}`);
      assert.ok(y > -40 && y < c.height + 40, `y out of frame: ${y}`);
    }
  }
});

test("the island is tiled, not empty, and stays a sensible shape", () => {
  const c = comb();
  assert.ok(c.land.length > 400, `only ${c.land.length} land tiles`);
  assert.equal(c.width, 960);
  // the prototype's hand written viewBox was "0 0 960 580", so the computed
  // frame has to land on that, give or take rounding
  assert.ok(Math.abs(c.height - 580) <= 5, `height ${c.height}`);
});

test("let and open are read off the room data, not guessed", () => {
  const c = comb();
  const byCode = Object.fromEntries(c.homes.flatMap((h) => h.cells).map((cell) => [cell.code, cell]));
  // CP-MR frees up on 2026-08-09, so on that date it is open
  assert.equal(byCode["CP-MR"].state, "open");
  // CP-PR1 runs to 2026-08-12
  assert.equal(byCode["CP-PR1"].state, "let");
  assert.match(byCode["CP-PR1"].title, /^CP-PR1, Premium room, let$/);
});
