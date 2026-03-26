/**
 * tagging.js — Pure functions for pattern matching and auto-tagging of bank transactions.
 * No side effects, no database calls.
 */

const NOISE_WORDS = new Set(['pte', 'ltd', 'sdn', 'bhd', 'sg', 'sgd']);

/**
 * Normalize a transaction description for matching:
 * - Lowercase
 * - Remove non-alphanumeric characters except spaces
 * - Collapse whitespace
 * - Strip common noise words
 * - Trim
 *
 * @param {string} desc
 * @returns {string}
 */
export function normalizeDescription(desc) {
  if (!desc || typeof desc !== 'string') return '';

  return desc
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0 && !NOISE_WORDS.has(word))
    .join(' ')
    .trim();
}

/**
 * Score how well a rule pattern matches a transaction description (0–1).
 *
 * Scoring rules (after normalization):
 *   1.0 — Exact match
 *   0.9 — Description contains the pattern
 *   0.7 — Pattern contains description (only if desc > 3 chars)
 *   word overlap ≥ 50% → score * 0.8
 *   0   — No match
 *
 * @param {string} rulePattern
 * @param {string} transactionDesc
 * @returns {number} score between 0 and 1
 */
export function matchScore(rulePattern, transactionDesc) {
  const normPattern = normalizeDescription(rulePattern);
  const normDesc = normalizeDescription(transactionDesc);

  if (!normPattern || !normDesc) return 0;

  // Exact match
  if (normPattern === normDesc) return 1.0;

  // Description contains pattern
  if (normDesc.includes(normPattern)) return 0.9;

  // Pattern contains description (only meaningful if desc is more than 3 chars)
  if (normDesc.length > 3 && normPattern.includes(normDesc)) return 0.7;

  // Word overlap ≥ 50%
  const patternWords = new Set(normPattern.split(' '));
  const descWords = normDesc.split(' ');
  const totalUnique = new Set([...patternWords, ...descWords]).size;

  if (totalUnique === 0) return 0;

  const overlap = descWords.filter(w => patternWords.has(w)).length;
  const overlapRatio = overlap / totalUnique;

  if (overlapRatio >= 0.5) return overlapRatio * 0.8;

  return 0;
}

/**
 * Find the best matching rule for a transaction.
 *
 * For each rule, the raw matchScore is boosted by:
 *   log10(hit_count + 1) * 0.05, capped at 1.0
 *
 * @param {Object} transaction — must have a `description` field
 * @param {Array}  rules       — each rule must have `pattern`, `property_id`, `category`, `id`, optionally `hit_count`
 * @param {number} threshold   — minimum confidence to return a match (default 0.6)
 * @returns {{ rule: Object, confidence: number } | null}
 */
export function findBestMatch(transaction, rules, threshold = 0.6) {
  if (!transaction || !Array.isArray(rules) || rules.length === 0) return null;

  let best = null;
  let bestScore = -Infinity;

  for (const rule of rules) {
    const base = matchScore(rule.pattern, transaction.description);
    if (base === 0) continue;

    const hitCount = typeof rule.hit_count === 'number' ? rule.hit_count : 0;
    const boost = Math.log10(hitCount + 1) * 0.05;
    const score = Math.min(1.0, base + boost);

    if (score > bestScore) {
      bestScore = score;
      best = { rule, confidence: score };
    }
  }

  if (best && bestScore >= threshold) return best;
  return null;
}

/**
 * Auto-tag an array of transactions using the provided rules.
 *
 * Matched transactions receive:
 *   property_id, category, confidence, matched_rule_id, status: "AUTO_TAGGED"
 *
 * Unmatched transactions receive:
 *   status: "PENDING", confidence: 0
 *
 * @param {Array} transactions
 * @param {Array} rules
 * @returns {Array} new array of tagged transaction objects (originals not mutated)
 */
export function autoTagTransactions(transactions, rules) {
  if (!Array.isArray(transactions)) return [];

  return transactions.map(transaction => {
    const match = findBestMatch(transaction, rules);

    if (match) {
      return {
        ...transaction,
        property_id: match.rule.property_id,
        category: match.rule.category,
        confidence: match.confidence,
        matched_rule_id: match.rule.id,
        status: 'AUTO_TAGGED',
      };
    }

    return {
      ...transaction,
      status: 'PENDING',
      confidence: 0,
    };
  });
}

/**
 * Extract a vendor pattern from a raw description.
 * Normalizes the description, splits into words longer than 2 chars,
 * and takes the first 4 such words joined by a space.
 *
 * Used when creating new rules from user confirmations.
 *
 * @param {string} description
 * @returns {string}
 */
export function extractVendorPattern(description) {
  const normalized = normalizeDescription(description);
  const words = normalized.split(' ').filter(w => w.length > 2);
  return words.slice(0, 4).join(' ');
}
