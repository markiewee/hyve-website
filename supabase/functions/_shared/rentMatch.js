/**
 * Matching a bank credit to a rent row.
 *
 * Three tiers, because the evidence differs in strength:
 *
 *   1. The tenant quoted their payment_ref. Unambiguous by construction, so
 *      it settles on its own.
 *   2. No ref, but the counterparty name matches a tenant AND the amount is
 *      exactly what they owe AND no other open row fits. Two independent
 *      signals agreeing is enough to close.
 *   3. Anything weaker becomes a proposal for a human. It is never closed
 *      automatically.
 *
 * Amount alone is never enough, and that is measured rather than assumed: on
 * production, 13 of 24 distinct rent amounts are shared by more than one row.
 * Auto-closing on amount would credit the wrong tenant, which is worse than
 * not matching at all, because the tenant who really paid then gets chased.
 */

/** Uppercase alphanumerics only, so "lb cppr3 2608" matches "LB-CPPR3-2608". */
export function squash(s) {
  return String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Honorifics and generational suffixes carry no identifying information, and
// banks add and drop them freely.
const NOISE = new Set(["MR", "MRS", "MS", "MISS", "DR", "JR", "SR", "II", "III", "IV"]);

/** Name tokens, uppercased, noise dropped, single letters dropped. */
export function nameTokens(s) {
  return String(s ?? "")
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !NOISE.has(t));
}

/**
 * How much two names look like the same person, 0 to 1.
 *
 * Token-set overlap rather than string distance, because bank counterparty
 * names reorder freely: "Heckman III David John" against "DAVID HECKMAN" is
 * the same person and scores 1, while any edit-distance measure would call
 * them different.
 */
export function nameScore(a, b) {
  const A = new Set(nameTokens(a));
  const B = new Set(nameTokens(b));
  if (A.size === 0 || B.size === 0) return 0;

  let shared = 0;
  for (const t of A) if (B.has(t)) shared++;

  // Divide by the smaller set so an abbreviated bank name is not punished for
  // omitting middle names it never had room for.
  const score = shared / Math.min(A.size, B.size);

  // One shared token is a coincidence waiting to happen ("Lim", "Tan", "Wee"),
  // so a single match cannot reach the auto threshold on its own.
  if (shared < 2) return Math.min(score, 0.5);
  return score;
}

/** What this row still needs, in dollars. */
export function outstandingOf(row) {
  const due = Number(row.rent_amount ?? 0) + Number(row.late_fee ?? 0);
  return round2(due - Number(row.paid_amount ?? 0));
}

/**
 * How well a credit's amount fits a row.
 *  1.0 exactly what is owed (within a cent, for conversion rounding)
 *  0.7 more than owed, so it settles but the surplus needs a human
 *  0.5 a plausible part payment
 *  0   nothing like it
 */
export function amountScore(creditAmount, row) {
  const owed = outstandingOf(row);
  if (owed <= 0) return 0;
  const diff = Number(creditAmount) - owed;
  if (Math.abs(diff) <= 0.01) return 1;
  if (diff > 0) return 0.7;
  if (Math.abs(diff) <= owed * 0.05) return 0.5;
  return 0;
}

/**
 * Match one credit against every open rent row.
 *
 * @param {{amount:number, haystack:string, counterparty:string}} credit
 * @param {Array<object>} rows  open rent_payments, each with payment_ref,
 *                              rent_amount, late_fee, paid_amount, tenant_name
 * @returns {{decision:'AUTO'|'REVIEW'|'UNMATCHED', row:object|null,
 *            confidence:number, reason:string, alternatives:Array<object>}}
 */
export function matchCredit(credit, rows) {
  const scored = [];

  for (const row of rows) {
    const ref = squash(row.payment_ref);
    const refHit = Boolean(ref) && String(credit.haystack ?? "").includes(ref);
    const nScore = nameScore(credit.counterparty, row.tenant_name);
    const aScore = amountScore(credit.amount, row);
    scored.push({ row, refHit, nameScore: nScore, amountScore: aScore });
  }

  // Tier 1: the reference. Unambiguous, so it wins outright.
  const byRef = scored.filter((s) => s.refHit);
  if (byRef.length === 1) {
    return {
      decision: "AUTO",
      row: byRef[0].row,
      confidence: 1,
      reason: `payment reference ${byRef[0].row.payment_ref} quoted on the transfer`,
      alternatives: [],
    };
  }
  if (byRef.length > 1) {
    // Two open rows carrying refs that both appear in one transfer. Real, if
    // someone pays two months at once. A human decides how to split it.
    return {
      decision: "REVIEW",
      row: null,
      confidence: 0.6,
      reason: `${byRef.length} payment references appear on one transfer`,
      alternatives: byRef.map((s) => s.row),
    };
  }

  // Tier 2: name and amount agreeing, with nothing else competing.
  const nameAndAmount = scored.filter((s) => s.nameScore >= 0.8 && s.amountScore === 1);
  if (nameAndAmount.length === 1) {
    return {
      decision: "AUTO",
      row: nameAndAmount[0].row,
      confidence: 0.9,
      reason: `name "${credit.counterparty}" matches ${nameAndAmount[0].row.tenant_name} and the amount is exactly what is owed`,
      alternatives: [],
    };
  }
  if (nameAndAmount.length > 1) {
    return {
      decision: "REVIEW",
      row: null,
      confidence: 0.5,
      reason: `${nameAndAmount.length} tenants match this name and amount equally well`,
      alternatives: nameAndAmount.map((s) => s.row),
    };
  }

  // Tier 3: one signal only. Enough to propose, never enough to close.
  const plausible = scored
    .filter((s) => s.nameScore >= 0.5 || s.amountScore >= 0.5)
    .sort((x, y) => y.nameScore + y.amountScore - (x.nameScore + x.amountScore));

  if (plausible.length === 0) {
    return {
      decision: "UNMATCHED",
      row: null,
      confidence: 0,
      reason: "no tenant name or amount resembles this credit",
      alternatives: [],
    };
  }

  const best = plausible[0];
  return {
    decision: "REVIEW",
    row: best.row,
    confidence: round2((best.nameScore + best.amountScore) / 2),
    reason: describe(best, credit),
    alternatives: plausible.slice(1, 4).map((s) => s.row),
  };
}

function describe(s, credit) {
  if (s.nameScore >= 0.8 && s.amountScore === 0) {
    return `name matches ${s.row.tenant_name} but the amount is not what they owe`;
  }
  if (s.amountScore === 1 && s.nameScore < 0.5) {
    return `amount is exactly what ${s.row.tenant_name} owes, but "${credit.counterparty}" does not look like their name`;
  }
  if (s.amountScore === 0.5) {
    return `looks like a part payment towards ${s.row.tenant_name}`;
  }
  if (s.amountScore === 0.7) {
    return `more than ${s.row.tenant_name} owes, so the surplus needs a decision`;
  }
  return `weak match against ${s.row.tenant_name}`;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
