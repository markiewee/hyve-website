// src/i18n/nationalityVocab.js
//
// Nationalities as they are actually recorded in tenant_details, which is not
// how anyone would design them. The column is free text typed by whoever did
// the onboarding, so it mixes demonyms with country names ("American" and
// "United States" are both in there, so are "Netherlands" and "Lithuanian"),
// and it carries one value that is not a nationality at all: "Singapore PR" is
// a residency status. That one keeps its own key, because to somebody choosing
// housemates it means something real and flattening it to "Singaporean" would
// be a lie.
//
// Same shape and same reasoning as roomVocab.js: map to dictionary KEYS, not to
// Chinese, so the words live in en.json and zh.json with everything else and the
// existing parity and key-resolution tests keep covering them.
//
// nationalityVocab.test.js asserts every value currently in the database maps,
// so an unseen nationality fails the build rather than rendering English at a
// Chinese reader.

export const NOT_PROVIDED = 'owner.vocab.natUnknown';

export const NATIONALITY_VOCAB = {
  Filipino: 'owner.vocab.natFilipino',
  Indian: 'owner.vocab.natIndian',
  Singaporean: 'owner.vocab.natSingaporean',
  'Singapore PR': 'owner.vocab.natSingaporePr',
  French: 'owner.vocab.natFrench',
  German: 'owner.vocab.natGerman',
  Thai: 'owner.vocab.natThai',
  Malaysian: 'owner.vocab.natMalaysian',
  Indonesian: 'owner.vocab.natIndonesian',
  Lithuanian: 'owner.vocab.natLithuanian',

  // Two spellings of one nationality, and a country name used where a demonym
  // belongs. Both collapse, so the roster does not appear to house two
  // different kinds of person.
  American: 'owner.vocab.natAmerican',
  'United States': 'owner.vocab.natAmerican',
  Dutch: 'owner.vocab.natDutch',
  Netherlands: 'owner.vocab.natDutch',
};

export const GENDER_VOCAB = {
  M: 'owner.vocab.genderM',
  F: 'owner.vocab.genderF',
};

/**
 * The dictionary key for a recorded nationality.
 *
 * Empty, null and unrecognised all resolve to the not-provided key rather than
 * to a blank cell or to raw English. Four of the twenty-six active tenants have
 * no nationality on file, so this is the common path, not the edge case.
 */
export function nationalityKey(value) {
  if (!value) return NOT_PROVIDED;
  return NATIONALITY_VOCAB[value.trim()] ?? NOT_PROVIDED;
}

/** The dictionary key for a recorded gender, or the not-provided key. */
export function genderKey(value) {
  if (!value) return NOT_PROVIDED;
  return GENDER_VOCAB[value.trim().toUpperCase()] ?? NOT_PROVIDED;
}
