// Run with: node --test src/data/testimonials.test.js
//
// This file is one bad entry away from publishing a false testimonial to
// everyone who searches for us, so the shape is checked rather than trusted.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TESTIMONIALS,
  testimonialsFor,
  quoteFor,
  hasTestimonials,
  aggregateRating,
} from "./testimonials.js";

const PROPERTIES = new Set(["Chiltern Park", "Ivory Heights", "Thomson Grove"]);

test("every entry carries the fields the page and the schema need", () => {
  for (const t of TESTIMONIALS) {
    assert.ok(t.id, "missing id");
    assert.ok(t.display, `${t.id}: missing display name`);
    assert.ok(PROPERTIES.has(t.property), `${t.id}: ${t.property} is not one of ours`);
    assert.ok(t.room, `${t.id}: missing room`);
    assert.ok(Number.isInteger(t.months) && t.months > 0, `${t.id}: months must be a positive integer`);
    assert.ok(t.quote && t.quote.trim().length > 20, `${t.id}: quote is too short to be a real one`);
    assert.ok(t.rating >= 1 && t.rating <= 5, `${t.id}: rating out of range`);
  }
});

test("every entry records when the person agreed to be published", () => {
  // The point of the field is being able to answer "who said they could use
  // that" a year later, so a blank one is a defect, not a nicety.
  for (const t of TESTIMONIALS) {
    assert.match(t.consentedAt || "", /^\d{4}-\d{2}-\d{2}$/, `${t.id}: consentedAt must be an ISO date`);
    assert.ok(
      ["whatsapp", "email", "portal"].includes(t.collectedVia),
      `${t.id}: collectedVia must say where the quote actually came from`
    );
  }
});

test("ids are unique, because they become the schema @id", () => {
  const ids = TESTIMONIALS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate testimonial id");
});

test("not every review is a five, once there are enough to tell", () => {
  // Thirty entries all rated five is the single loudest signal that a set was
  // written rather than collected. If we ever have ten and they are all
  // perfect, that is worth a human looking at before it ships.
  if (TESTIMONIALS.length >= 10) {
    const fives = TESTIMONIALS.filter((t) => t.rating === 5).length;
    assert.ok(
      fives < TESTIMONIALS.length,
      "every single review is a 5, which is what a fabricated set looks like"
    );
  }
});

test("the Chinese page shows only quotes actually translated into Chinese", () => {
  for (const t of testimonialsFor("zh")) {
    assert.ok(t.zh && t.zh.trim(), `${t.id} reached the zh list without a zh quote`);
  }
  assert.equal(
    testimonialsFor("zh").length,
    TESTIMONIALS.filter((t) => t.zh).length
  );
});

test("quoteFor returns the right language", () => {
  const sample = { quote: "in English", zh: "in Chinese" };
  assert.equal(quoteFor(sample, "en"), "in English");
  assert.equal(quoteFor(sample, "zh"), "in Chinese");
});

test("an empty file keeps the page out of the sitemap entirely", () => {
  // The behaviour the route table depends on. A reviews page with nothing on it
  // is a soft 404 to a crawler and a dead end to a reader.
  if (TESTIMONIALS.length === 0) {
    assert.equal(hasTestimonials("en"), false);
    assert.equal(hasTestimonials("zh"), false);
  }
});

test("no aggregate rating is published from fewer than three reviews", () => {
  assert.equal(aggregateRating("en"), TESTIMONIALS.length < 3 ? null : aggregateRating("en"));
  if (TESTIMONIALS.length < 3) assert.equal(aggregateRating("en"), null);
});

test("the file ships empty until real quotes are collected", () => {
  // Deliberate. Delete this test when the first real testimonial lands; it is
  // here so an accidental merge of placeholder content fails the build rather
  // than going live quietly.
  assert.equal(
    TESTIMONIALS.length,
    0,
    "testimonials were added: confirm each one is a real, consented quote from a real tenant, then delete this test"
  );
});
