// Run with: node --test src/i18n/dictionaries.test.js
//
// A translation bug does not throw. It renders blank, or renders English at
// someone who pressed 中文, and nobody notices until a stranger bounces. The
// invariants here are the ones an eye will not catch on a 570-key file: that
// both dictionaries carry the same keys, that no Chinese value is quietly still
// the English one, and that placeholders survive translation.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const en = JSON.parse(readFileSync(new URL('./en.json', import.meta.url)));
const zh = JSON.parse(readFileSync(new URL('./zh.json', import.meta.url)));

/** Flatten to dotted keys, the same shape LanguageContext's `t` walks. */
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

const EN = flatten(en);
const ZH = flatten(zh);

/* Brand and technical names that stay Latin in Chinese copy, by design rather
   than by neglect. Anything added here should be a proper noun a Chinese reader
   would expect to see unchanged, not a phrase nobody got round to. */
const SAME_IN_BOTH = new Set([
  'nav.whatsapp',
  'moveIn.wifi',              // "WiFi"
  'public.contact.whatsapp',  // "WhatsApp"
]);

test('every English key has a Chinese counterpart', () => {
  const missing = Object.keys(EN).filter((k) => !(k in ZH));
  assert.deepEqual(missing, [], `no Chinese for: ${missing.join(', ')}`);
});

test('no Chinese key is left orphaned after an English rename', () => {
  const orphans = Object.keys(ZH).filter((k) => !(k in EN));
  assert.deepEqual(orphans, [], `Chinese with no English: ${orphans.join(', ')}`);
});

test('no Chinese value is still the untranslated English string', () => {
  const copied = Object.keys(ZH).filter((k) => {
    if (SAME_IN_BOTH.has(k)) return false;
    if (ZH[k] !== EN[k]) return false;
    // Bare numbers, currency and punctuation are legitimately identical.
    return /[A-Za-z]{3}/.test(String(ZH[k]));
  });
  assert.deepEqual(copied, [], `copied, not translated: ${copied.join(', ')}`);
});

test('placeholders survive translation, in both directions', () => {
  const slots = (s) => (String(s).match(/\{(\w+)\}/g) || []).sort().join(',');
  const broken = Object.keys(EN).filter((k) => k in ZH && slots(EN[k]) !== slots(ZH[k]));
  // A dropped {name} renders a sentence with a hole in it; an invented one
  // renders a literal "{name}" at the reader. Both are silent in review.
  assert.deepEqual(broken, [], `placeholder mismatch in: ${broken.join(', ')}`);
});

test('the renamed owner nav is present in both languages', () => {
  for (const k of ['earnings', 'compare', 'portfolio', 'guides', 'estimate']) {
    assert.ok(EN[`nav.${k}`], `missing en nav.${k}`);
    assert.ok(ZH[`nav.${k}`], `missing zh nav.${k}`);
  }
  assert.equal(EN['nav.earnings'], 'Metrics');
  assert.equal(ZH['nav.earnings'], '数据');
});

test('the labels that named our own sections rather than the reader are gone', () => {
  /* "Free coffee" is deliberately NOT in this list. Mark put it back on 10 Aug:
     it is the literal offer at the bottom of the page, so it does say what it
     opens. The others named our internal metaphors and told a visitor nothing. */
  const cheesy = ['The comb', 'Your split', 'Versus a lease'];
  const found = Object.entries(EN).filter(([, v]) => cheesy.includes(v));
  assert.deepEqual(found, [], `still present: ${JSON.stringify(found)}`);
});
