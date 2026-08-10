// src/i18n/roomVocab.js
//
// The room records in lazybeeRooms.js are pulled from hyve-iot and are written
// in English, so a visitor who switched to Chinese still met "Queen bed" and
// "Ensuite bathroom" in the middle of an otherwise Chinese card.
//
// The vocabulary is small and closed, so it is mapped here rather than in the
// database, which would mean a migration, a second column on every room, and a
// translation step in every future data pull.
//
// Values map to dictionary KEYS rather than to Chinese directly, so the words
// themselves stay in en.json and zh.json with everything else and the existing
// parity and key-resolution tests keep covering them.
//
// roomVocab.test.js reads the live ROOMS array, so if a re-pull introduces a bed
// type nobody has seen the test fails rather than the page quietly rendering
// English at a Chinese reader.

export const VOCAB = {
  // room types
  'Master room': 'owner.vocab.masterRoom',
  'Premium room': 'owner.vocab.premiumRoom',
  'Standard room': 'owner.vocab.standardRoom',

  // beds. "Super single" and "Super single bed" both appear in the data.
  'Queen bed': 'owner.vocab.queenBed',
  'Super single bed': 'owner.vocab.superSingleBed',
  'Super single': 'owner.vocab.superSingle',
  'Single bed': 'owner.vocab.singleBed',

  // amenities
  'Ensuite bathroom': 'owner.vocab.ensuiteBathroom',
  'Study table': 'owner.vocab.studyTable',
  'Wardrobe': 'owner.vocab.wardrobe',
  'WiFi': 'owner.vocab.wifi',

  // MRT stations on the homes strip. Place names, but these particular three
  // have settled Chinese names that a local reader expects to see.
  'Serangoon': 'owner.vocab.serangoon',
  'Jurong East': 'owner.vocab.jurongEast',
  'Upper Thomson': 'owner.vocab.upperThomson',
};

/**
 * The dictionary key for a database value, or the value itself when we have
 * never seen it. Falling through unchanged is deliberate: an unmapped amenity
 * should show up in English, which is wrong but readable, rather than blank.
 */
export function vocabKey(value) {
  return VOCAB[value] ?? value;
}
