// Run with: node --test src/i18n/nationalityVocab.test.js
//
// The staff room desk is read by a Chinese rental aggregator on a dedicated
// PIN. A nationality that falls through unmapped would render English at them,
// or worse render blank, so the live set is pinned here the way roomVocab.test
// pins the live room vocabulary.
//
// LIVE_VALUES is the distinct set of tenant_details.nationality in hyve-iot as
// at 11 Aug 2026. When onboarding types a new one, this test fails and the map
// gets an entry, which is the whole point.

import { test } from "node:test";
import assert from "node:assert/strict";
import en from "./en.json" with { type: "json" };
import zh from "./zh.json" with { type: "json" };
import {
  NATIONALITY_VOCAB,
  NOT_PROVIDED,
  nationalityKey,
  genderKey,
} from "./nationalityVocab.js";

const LIVE_VALUES = [
  "Filipino",
  "Singapore PR",
  "Indian",
  "American",
  "Singaporean",
  "French",
  "German",
  "Netherlands",
  "United States",
  "Lithuanian",
  "Thai",
  "Malaysian",
  "Indonesian",
];

function resolve(dict, key) {
  return key.split(".").reduce((o, k) => o?.[k], dict);
}

test("every nationality in the database maps to a key", () => {
  for (const v of LIVE_VALUES) {
    assert.ok(
      NATIONALITY_VOCAB[v],
      `"${v}" is recorded on a live tenant and has no vocabulary entry`,
    );
  }
});

test("every key resolves in both dictionaries", () => {
  const keys = [...new Set(Object.values(NATIONALITY_VOCAB))];
  keys.push(NOT_PROVIDED, "owner.vocab.genderM", "owner.vocab.genderF");
  for (const k of keys) {
    assert.equal(typeof resolve(en, k), "string", `${k} missing from en.json`);
    assert.equal(typeof resolve(zh, k), "string", `${k} missing from zh.json`);
  }
});

test("the two spellings of one nationality collapse to one key", () => {
  assert.equal(nationalityKey("American"), nationalityKey("United States"));
  assert.equal(nationalityKey("Netherlands"), nationalityKey("Dutch"));
});

test("Singapore PR keeps its own key rather than flattening to Singaporean", () => {
  assert.notEqual(nationalityKey("Singapore PR"), nationalityKey("Singaporean"));
});

test("missing and unknown both read as not provided, never blank", () => {
  assert.equal(nationalityKey(null), NOT_PROVIDED);
  assert.equal(nationalityKey(""), NOT_PROVIDED);
  assert.equal(nationalityKey("Martian"), NOT_PROVIDED);
  assert.equal(genderKey(null), NOT_PROVIDED);
  assert.equal(genderKey("X"), NOT_PROVIDED);
});

test("gender maps both cases", () => {
  assert.equal(genderKey("M"), "owner.vocab.genderM");
  assert.equal(genderKey("f"), "owner.vocab.genderF");
});
