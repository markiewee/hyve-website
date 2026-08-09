// Run with: node --test src/lib/experiment.test.js
//
// The assignment rules are the part of a split test that can silently ruin the
// result: a variant that is not sticky inflates exposures, and a shared ?hero=
// link that overwrites storage moves real visitors between buckets. Neither is
// visible by looking at the page, so both are tested here.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveHeroVariant,
  assignHeroVariant,
  HERO_VARIANTS,
  HERO_COPY,
  HERO_STORAGE_KEY,
  isHeroVariant,
} from "./experiment.js";

/* ── a minimum viable window ──────────────────────────────────────── */

function fakeWindow(search = "", seed = {}) {
  const store = { ...seed };
  return {
    location: { search },
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
    },
    _store: store,
  };
}

function fakePosthog(flagValue) {
  const captured = [];
  const registered = [];
  return {
    getFeatureFlag: () => flagValue,
    register: (p) => registered.push(p),
    capture: (event, props) => captured.push({ event, props }),
    captured,
    registered,
  };
}

/* ── pure resolution ──────────────────────────────────────────────── */

test("a draw always lands on a declared variant", () => {
  for (const r of [0, 0.34, 0.5, 0.67, 0.999]) {
    const { variant } = resolveHeroVariant({ random: () => r });
    assert.ok(HERO_VARIANTS.includes(variant), `unexpected variant ${variant}`);
  }
});

test("the draw covers every variant rather than favouring one", () => {
  const seen = new Set(
    [0, 0.4, 0.8].map((r) => resolveHeroVariant({ random: () => r }).variant)
  );
  assert.deepEqual([...seen].sort(), ["a", "b", "c"]);
});

test("precedence is query, then flag, then storage, then a draw", () => {
  assert.equal(
    resolveHeroVariant({ queryValue: "c", flagValue: "b", storedValue: "a" }).source,
    "query"
  );
  assert.equal(resolveHeroVariant({ flagValue: "b", storedValue: "a" }).source, "feature_flag");
  assert.equal(resolveHeroVariant({ storedValue: "a" }).source, "stored");
  assert.equal(resolveHeroVariant({ random: () => 0 }).source, "random");
});

test("only our own draw is persisted", () => {
  assert.equal(resolveHeroVariant({ random: () => 0 }).persist, true);
  assert.equal(resolveHeroVariant({ queryValue: "b" }).persist, false);
  assert.equal(resolveHeroVariant({ flagValue: "b" }).persist, false);
  assert.equal(resolveHeroVariant({ storedValue: "b" }).persist, false);
});

test("junk values fall through instead of rendering a blank hero", () => {
  assert.equal(resolveHeroVariant({ queryValue: "purple", random: () => 0 }).source, "random");
  assert.equal(resolveHeroVariant({ flagValue: "control", random: () => 0 }).source, "random");
  assert.equal(resolveHeroVariant({ storedValue: "", random: () => 0 }).source, "random");
  assert.equal(isHeroVariant(undefined), false);
});

/* ── browser wiring ───────────────────────────────────────────────── */

test("a random draw is stored, so a reload keeps the same hero", () => {
  const win = fakeWindow();
  const ph = fakePosthog(null);
  const first = assignHeroVariant(ph, win);
  assert.equal(first.source, "random");
  assert.equal(win._store[HERO_STORAGE_KEY], first.variant);

  const second = assignHeroVariant(ph, win);
  assert.equal(second.variant, first.variant);
  assert.equal(second.source, "stored");
});

test("a shared ?hero= link does not rebucket the person who opens it", () => {
  const win = fakeWindow("?hero=c", { [HERO_STORAGE_KEY]: "a" });
  const { variant, source } = assignHeroVariant(fakePosthog(null), win);
  assert.equal(variant, "c");
  assert.equal(source, "query");
  assert.equal(win._store[HERO_STORAGE_KEY], "a");
});

test("a PostHog flag takes over from the local draw once it exists", () => {
  const win = fakeWindow("", { [HERO_STORAGE_KEY]: "a" });
  const { variant, source } = assignHeroVariant(fakePosthog("b"), win);
  assert.equal(variant, "b");
  assert.equal(source, "feature_flag");
});

test("the variant becomes a super property, not just a one-off event", () => {
  const ph = fakePosthog(null);
  const { variant } = assignHeroVariant(ph, fakeWindow());
  assert.deepEqual(ph.registered.at(-1), { hero_variant: variant });
});

test("exposure is captured with its assignment source", () => {
  const ph = fakePosthog(null);
  const { variant } = assignHeroVariant(ph, fakeWindow());
  const e = ph.captured.find((c) => c.event === "hero_variant_shown");
  assert.ok(e, "no exposure event");
  assert.equal(e.props.variant, variant);
  assert.equal(e.props.assignment_source, "random");
  assert.equal(e.props.headline, HERO_COPY[variant].headline);
});

test("a throwing analytics client does not take the hero down", () => {
  const angry = {
    getFeatureFlag: () => { throw new Error("flags down"); },
    register: () => { throw new Error("no"); },
    capture: () => { throw new Error("no"); },
  };
  const { variant } = assignHeroVariant(angry, fakeWindow());
  assert.ok(HERO_VARIANTS.includes(variant));
});

test("storage being unavailable does not take the hero down", () => {
  const win = {
    location: { search: "" },
    localStorage: {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    },
  };
  const { variant } = assignHeroVariant(fakePosthog(null), win);
  assert.ok(HERO_VARIANTS.includes(variant));
});

test("no window at all returns a usable default", () => {
  const { variant, copy } = assignHeroVariant(fakePosthog(null), undefined);
  assert.ok(HERO_VARIANTS.includes(variant));
  assert.ok(copy.headline);
});

/* ── copy ─────────────────────────────────────────────────────────── */

test("every variant has copy, or the hero renders empty in production", () => {
  for (const v of HERO_VARIANTS) {
    assert.ok(HERO_COPY[v]?.headline, `variant ${v} has no headline`);
    assert.ok(HERO_COPY[v]?.sub, `variant ${v} has no sub`);
  }
});
