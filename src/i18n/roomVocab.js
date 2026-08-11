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

  // Building facilities, from properties.facilities.
  'Swimming pool': 'owner.vocab.swimmingPool',
  'Gym': 'owner.vocab.gym',
  'BBQ pit': 'owner.vocab.bbqPit',
  'Playground': 'owner.vocab.playground',
  'Covered parking': 'owner.vocab.coveredParking',
  'Covered HDB parking': 'owner.vocab.coveredHdbParking',
  'Lift access': 'owner.vocab.liftAccess',
  '24hr security': 'owner.vocab.security24',
  'Nearby hawker centre': 'owner.vocab.hawkerCentre',
  'Private garden': 'owner.vocab.privateGarden',
  'Covered porch': 'owner.vocab.coveredPorch',
  'Bicycle storage': 'owner.vocab.bicycleStorage',

  // What every room here comes with, from properties.amenities.
  'Fully furnished rooms': 'owner.vocab.fullyFurnishedRooms',
  'High-speed WiFi': 'owner.vocab.highSpeedWifi',
  'Weekly common area cleaning': 'owner.vocab.weeklyCleaning',
  'Washing machine': 'owner.vocab.washingMachine',
  'Dryer': 'owner.vocab.dryer',
  'Shared kitchen': 'owner.vocab.sharedKitchen',
  'Shared living room': 'owner.vocab.sharedLivingRoom',
  'Garden': 'owner.vocab.garden',

  // rooms.facilities, the fixtures in the room itself.
  'Attached bathroom': 'owner.vocab.attachedBathroom',
  'Door lock': 'owner.vocab.doorLock',
  'Window': 'owner.vocab.window',

  // properties.common_areas. One sentence, identical across all three homes,
  // so it maps like any other closed value rather than earning a column.
  'All other areas not defined as private dwellings': 'owner.vocab.commonAreasAll',
};

/**
 * A room's display name, translated.
 *
 * rooms.name is not free text, it is a formula: "CP Premium Room 2". Mapping
 * all nineteen would mean a new entry every time a room is added, so the parts
 * are translated and the number is carried through. Anything that does not
 * match the formula is returned unchanged, which is how a renamed room degrades
 * to English rather than to nothing.
 */
const NAME_RE = /^(CP|IH|TG)\s+(Master|Premium|Standard)\s+Room\s*(\d*)$/;
const NAME_TYPE_KEY = {
  Master: 'owner.vocab.masterRoom',
  Premium: 'owner.vocab.premiumRoom',
  Standard: 'owner.vocab.standardRoom',
};

export function roomDisplayName(name, t, lang) {
  if (lang !== 'zh' || !name) return name ?? '';
  const m = NAME_RE.exec(name.trim());
  if (!m) return name;
  const [, code, type, n] = m;
  return `${code} ${t(NAME_TYPE_KEY[type])}${n ? ` ${n}` : ''}`;
}

/**
 * The dictionary key for a database value, or the value itself when we have
 * never seen it. Falling through unchanged is deliberate: an unmapped amenity
 * should show up in English, which is wrong but readable, rather than blank.
 */
export function vocabKey(value) {
  return VOCAB[value] ?? value;
}
