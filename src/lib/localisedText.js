// Free text that exists in two columns.
//
// roomVocab.js handles the closed vocabulary, the bed types and room types
// where the set of possible values is small and known. Descriptions are prose
// and cannot be mapped that way, so they live in a second column and this picks
// between them.
//
// The fallback direction matters: an untranslated row renders its English
// rather than a blank. A missing translation should look like work not yet
// done, not like a room with nothing to say about it.

/**
 * @param {object} row      a properties or rooms record
 * @param {string} field    the English column name, e.g. "description"
 * @param {string} lang     "en" or "zh"
 */
export function localised(row, field, lang) {
  if (!row) return '';
  if (lang === 'zh') {
    const zh = row[`${field}_zh`];
    if (zh && String(zh).trim()) return zh;
  }
  return row[field] ?? '';
}

/**
 * The array variant, for house_rules and anything else stored as a list.
 *
 * Falls back whole rather than element by element: a half-translated list read
 * worse than an English one, and the two arrays are maintained in the same
 * order precisely so they can be swapped as a unit.
 */
export function localisedList(row, field, lang) {
  if (!row) return [];
  if (lang === 'zh') {
    const zh = row[`${field}_zh`];
    if (Array.isArray(zh) && zh.length) return zh;
  }
  const en = row[field];
  return Array.isArray(en) ? en : [];
}
