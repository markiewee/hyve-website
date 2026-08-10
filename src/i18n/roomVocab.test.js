// Run with: node --test src/i18n/roomVocab.test.js
//
// The room data is pulled from hyve-iot and is English, so a visitor reading
// Chinese still met "Queen bed" and "Ensuite bathroom" inside a Chinese card.
// The vocabulary is small and closed, so it maps in the front end rather than
// needing a migration and a second column on every room.
//
// The first test reads the LIVE data rather than a hardcoded list, so the next
// time someone re-pulls lazybeeRooms.js and a new bed type appears, this fails
// instead of quietly rendering English at a Chinese reader.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ROOMS } from '../data/lazybeeRooms.js';
import { VOCAB, vocabKey } from './roomVocab.js';

/** Every English word in the room data a visitor can actually see. */
function visibleVocabulary() {
  const seen = new Set();
  for (const r of ROOMS) {
    if (r.type) seen.add(r.type);
    if (r.bed) seen.add(r.bed);
    for (const a of r.am ?? []) seen.add(a);
  }
  return [...seen];
}

test('every room type, bed and amenity in the live data has a mapping', () => {
  const unmapped = visibleVocabulary().filter((v) => !VOCAB[v]);
  assert.deepEqual(unmapped, [], `no mapping for: ${unmapped.join(', ')}`);
});

test('an unknown value falls through unchanged rather than blanking', () => {
  assert.equal(vocabKey('Rooftop helipad'), 'Rooftop helipad');
});

test('a mapped value returns a dictionary key, not Chinese directly', () => {
  // One source of truth: the words stay in en.json and zh.json with everything
  // else, so the parity and key-resolution tests keep covering them. This file
  // only says which key a database value maps to.
  assert.equal(vocabKey('Queen bed'), 'owner.vocab.queenBed');
  assert.match(vocabKey('Master room'), /^owner\.vocab\./);
});

test('every mapping points at an owner.vocab key', () => {
  const stray = Object.values(VOCAB).filter((k) => !k.startsWith('owner.vocab.'));
  assert.deepEqual(stray, [], `mappings outside owner.vocab: ${stray.join(', ')}`);
});
