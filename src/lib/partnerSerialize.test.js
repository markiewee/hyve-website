// src/lib/partnerSerialize.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { mergeProfiles, rateCard, listingResource, propertyResource } from "./partnerSerialize.js";

test("mergeProfiles: NULL inherits from property, empty string is a deliberate blank", () => {
  const property = { title: "Ivory Heights", description: "Condo near Jurong East.", fields: { house_rules: "No smoking", mrt: "Jurong East" } };
  const room = { title: "IH Standard 1", description: null, fields: { house_rules: "", view: "pool" } };
  const m = mergeProfiles(property, room);
  assert.equal(m.title, "IH Standard 1");
  assert.equal(m.description, "Condo near Jurong East."); // null inherited
  assert.equal(m.fields.house_rules, ""); // empty string stays blank
  assert.equal(m.fields.mrt, "Jurong East"); // inherited
  assert.equal(m.fields.view, "pool");
});

test("rateCard resolves through channel pricing: percent channel grossed up to whole dollars", () => {
  const card = rateCard(
    { price_monthly: 1500, deposit: 1500, min_stay_months: 3 },
    { commission_pct: 0.10, commission_months: null, gross_up: true, fee_fixed: null },
    12
  );
  // quotedPrice rounds once, to the dollar: 1500 / 0.9 = 1666.67 -> 1667
  assert.equal(card.monthly_rate, 1667);
  assert.equal(card.currency, "SGD");
  assert.equal(card.duration_months, 12);
});

test("rateCard refuses a duration too short for month-based commission", () => {
  assert.throws(() =>
    rateCard({ price_monthly: 1500, deposit: 1500, min_stay_months: 3 },
      { commission_pct: null, commission_months: 1, gross_up: true, fee_fixed: null, slug: "agent-x" }, 1)
  );
});

test("rateCard with no commission configured quotes base", () => {
  const card = rateCard({ price_monthly: 1500, deposit: 1500, min_stay_months: 3 },
    { commission_pct: null, commission_months: null, gross_up: true, fee_fixed: null }, 12);
  assert.equal(card.monthly_rate, 1500);
});

test("listingResource exposes ONLY the documented keys", () => {
  const res = listingResource({
    code: "IH-STD1", propertySlug: "ivory-heights",
    profile: { title: "t", description: "d", fields: { features: ["aircon"], media: [{ url: "https://x/1.jpg", hero: true }] } },
    room: { price_monthly: 1500, deposit: 1500, min_stay_months: 3, max_occupancy: 2 },
    channel: { commission_pct: null, commission_months: null, gross_up: true, fee_fixed: null },
    availableFrom: "2026-09-01", durationMonths: 12,
  });
  assert.deepEqual(Object.keys(res).sort(),
    ["available_from", "code", "features", "links", "max_occupancy", "media", "profile", "property", "rate_card", "updated_at"].sort());
  assert.equal(res.links.canonical, "https://lazybee.sg/rooms/IH-STD1");
  assert.equal(res.links.book, "https://book.lazybee.sg");
});

test("propertyResource never leaks room or tenant data", () => {
  const res = propertyResource({
    slug: "ivory-heights",
    profile: { title: "Ivory Heights", description: "d", fields: { media: [], features: ["pool"] } },
    listingCount: 7,
  });
  assert.deepEqual(Object.keys(res).sort(),
    ["features", "links", "listing_count", "media", "profile", "slug", "updated_at"].sort());
});
