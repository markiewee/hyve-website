// Pure comparison between what a listing SHOULD say and what a worker last saw
// it say. No I/O, no Supabase, no React, so it is testable on its own.
//
// "Never observed" is deliberately its own state rather than being folded into
// drift. A row we have never looked at and a row we looked at and found correct
// are different facts, and showing them the same way would hide a worker that
// has never once run.

const NEVER_OBSERVED = { kind: "unknown", fields: [] };

export function driftOf(desired, observed) {
  if (!observed) return NEVER_OBSERVED;

  const fields = [];
  if (Boolean(desired?.on) !== Boolean(observed?.on)) fields.push("on");

  // Null and empty string both mean "no headline". Treating them as different
  // would report permanent drift on every listing that is correctly off.
  const dH = desired?.headline ?? "";
  const oH = observed?.headline ?? "";
  if (dH !== oH) fields.push("headline");

  return { kind: fields.length ? "drift" : "match", fields };
}

// Ordered by how much a human needs to look at it. Disputed data comes first
// because it is the only state no automation will ever clear on its own.
export function rowStatus(row) {
  if (row?.availability_disputed) return "disputed";
  if (row?.frozen_reason) return "frozen";
  if (row?.last_error) return "error";
  return driftOf(row?.desired, row?.observed_state).kind;
}

const RANK = { disputed: 0, frozen: 1, error: 2, drift: 3, unknown: 4, match: 5 };

export function sortRows(rows) {
  // Copy first: callers pass React state, and sorting it in place would mutate
  // state directly. Ties break on unit code so the table does not reshuffle
  // itself between loads.
  return [...rows].sort((a, b) => {
    const d = RANK[rowStatus(a)] - RANK[rowStatus(b)];
    return d !== 0 ? d : (a.unit_code ?? "").localeCompare(b.unit_code ?? "");
  });
}
