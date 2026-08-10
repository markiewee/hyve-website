// Run with: node --test src/i18n/keys-resolve.test.js
//
// The bug this exists to catch, found on 10 Aug 2026: the dictionaries were
// written with flat dotted keys like `{ "hero": { "a.line1": "..." } }` while
// `t()` walks the object one dot-segment at a time, so `t('owner.hero.a.line1')`
// resolved to nothing and the page silently rendered the key. Nothing threw, the
// build passed, and the only visible symptom was the prerendered homepage losing
// eight hundred words.
//
// So: every literal key the source passes to t() must resolve to a real string
// in BOTH dictionaries.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('..', import.meta.url).pathname;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.jsx?$/.test(entry) && !/\.test\.jsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/* t('key'), t("key"), and the bare 'owner.*' strings the data lists in
   data/ownerPage.js hold. Template literals with ${} are skipped on purpose:
   `owner.hero.${variant}.sub` is resolved per variant in the next test. */
const CALL = /\bt\(\s*['"]([\w.]+)['"]/g;
const DATA_KEY = /['"](owner\.[\w.]+)['"]/g;

function usedKeys() {
  const keys = new Set();
  for (const file of walk(SRC)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(CALL)) keys.add(m[1]);
    for (const m of src.matchAll(DATA_KEY)) keys.add(m[1]);
  }
  return [...keys];
}

const en = JSON.parse(readFileSync(new URL('./en.json', import.meta.url)));
const zh = JSON.parse(readFileSync(new URL('./zh.json', import.meta.url)));

const lookup = (dict) => (key) => {
  let v = dict;
  for (const part of key.split('.')) v = v?.[part];
  return v;
};

test('every t() key used in src resolves to a string in English', () => {
  const bad = usedKeys().filter((k) => typeof lookup(en)(k) !== 'string');
  assert.deepEqual(bad, [], `unresolved in en.json: ${bad.join(', ')}`);
});

test('every t() key used in src resolves to a string in Chinese', () => {
  const bad = usedKeys().filter((k) => typeof lookup(zh)(k) !== 'string');
  assert.deepEqual(bad, [], `unresolved in zh.json: ${bad.join(', ')}`);
});

test('the per-variant hero keys resolve for every variant', () => {
  // Built by template literal in HeroSection, so the scan above cannot see them.
  for (const v of ['a', 'b', 'c']) {
    for (const part of ['line1', 'line2', 'sub']) {
      const key = `owner.hero.${v}.${part}`;
      assert.equal(typeof lookup(en)(key), 'string', `missing en ${key}`);
      assert.equal(typeof lookup(zh)(key), 'string', `missing zh ${key}`);
    }
  }
});

test('the dictionaries are nested, never flat dotted keys', () => {
  // The shape that caused the original bug. A key containing a dot can never be
  // reached by a resolver that splits on dots, so it is always dead weight.
  const flat = [];
  (function scan(node, path) {
    for (const [k, v] of Object.entries(node)) {
      if (k.includes('.')) flat.push(`${path}${k}`);
      if (v && typeof v === 'object') scan(v, `${path}${k}.`);
    }
  })(en, '');
  assert.deepEqual(flat, [], `flat dotted keys in en.json: ${flat.join(', ')}`);
});
