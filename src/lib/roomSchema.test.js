// Run with: node --test src/lib/roomSchema.test.js
//
// The room schemas are the only thing on the site that tells a machine what we
// actually let. Nothing renders them visibly, so a mistake here is invisible on
// the page and wrong everywhere the page is read: search, LLM answers, and the
// uhomes crawler that is the one live route onto their marketplace.
//
// The load-bearing assertion is the last one. Every fact published here has to
// be stable between deploys, and availability is not, so it must never appear.

import { test } from "node:test";
import assert from "node:assert/strict";
import { accommodationSchema, roomListSchema } from "./seo.js";
import { HOMES, ROOMS } from "../data/lazybeeRooms.js";

const list = () => roomListSchema();
const items = () => list().itemListElement.map((e) => e.item);

test("every lettable room is published exactly once", () => {
  const l = list();
  const ids = items().map((i) => i.identifier);
  assert.equal(l.numberOfItems, ROOMS.length);
  assert.equal(ids.length, ROOMS.length);
  assert.equal(new Set(ids).size, ROOMS.length);
});

test("positions are 1..n with no gaps, because a crawler reads the order", () => {
  const pos = list().itemListElement.map((e) => e.position);
  assert.deepEqual(pos, ROOMS.map((_, i) => i + 1));
});

test("the price published is the price in the inventory, in SGD per month", () => {
  for (const room of ROOMS) {
    const spec = accommodationSchema(room).offers.priceSpecification;
    assert.equal(spec.price, room.price, `${room.code} price`);
    assert.equal(spec.priceCurrency, "SGD");
    assert.equal(spec.unitCode, "MON");
  }
});

test("every room links to its own booking page", () => {
  for (const room of ROOMS) {
    const s = accommodationSchema(room);
    const want = `https://book.lazybee.sg/rooms/${room.code}`;
    assert.equal(s.url, want, `${room.code} url`);
    assert.equal(s["@id"], want);
    assert.equal(s.offers.url, want);
  }
});

test("each room sits in the home it belongs to, at that home's address", () => {
  for (const room of ROOMS) {
    const home = HOMES.find((h) => h.code === room.home);
    const place = accommodationSchema(room).containedInPlace;
    assert.equal(place.name, home.full, `${room.code} home`);
    assert.equal(place.address.addressCountry, "SG");
    assert.match(place.address.postalCode, /^\d{6}$/);
  }
});

test("images are absolute, since a relative path is unresolvable off-site", () => {
  for (const s of items()) {
    for (const src of s.image || []) {
      assert.ok(src.startsWith("https://"), `relative image on ${s.identifier}: ${src}`);
    }
  }
});

test("a room with no photos, size or bed still produces valid output", () => {
  const bare = { code: "XX-TEST", home: "CP", type: "Standard room", price: 900 };
  const s = accommodationSchema(bare);
  assert.equal(s.offers.priceSpecification.price, 900);
  assert.ok(!("image" in s));
  assert.ok(!("floorSize" in s));
  assert.ok(!("bed" in s));
  assert.doesNotThrow(() => JSON.stringify(s));
});

test("an unknown home does not throw, it just omits the place", () => {
  const orphan = { code: "ZZ-1", home: "ZZ", type: "Standard room", price: 700 };
  const s = accommodationSchema(orphan);
  assert.ok(!("containedInPlace" in s));
  assert.equal(s.name, "Standard room");
});

test("nothing claims availability, because that is not stable between deploys", () => {
  const blob = JSON.stringify(list());
  for (const banned of ["availability", "availabilityStarts", "validFrom", "InStock", "OutOfStock"]) {
    assert.ok(!blob.includes(banned), `structured data must not state ${banned}`);
  }
});
