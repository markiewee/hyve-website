/**
 * Rent proration.
 *
 * Plain ESM on purpose: Deno imports it directly from the edge functions, and
 * `node --test` runs the test file beside it, so the arithmetic that decides
 * what 18 people are billed is not first exercised in production.
 *
 * The rule this replaces (AdminRentPage.jsx:349) prorated move-INS only. A
 * tenant leaving on the 10th was billed the whole month, every month, silently.
 * Here one occupancy-window calculation covers move-in, move-out, and both
 * falling inside the same month, and collapses to full rent for a full month.
 */

/** First day of the month a YYYY-MM-DD string falls in, as YYYY-MM-01. */
export function monthStart(dateStr) {
  return `${String(dateStr).slice(0, 7)}-01`;
}

/** Days in the month a YYYY-MM-01 string names. UTC, so no DST drift. */
export function daysInMonth(monthStr) {
  const [y, m] = String(monthStr).split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Day-of-month as an integer, 1-31. */
function dayOf(dateStr) {
  return Number(String(dateStr).slice(8, 10));
}

/**
 * The days of `month` this tenancy actually occupies.
 *
 * @param {string} month  YYYY-MM-01
 * @param {string|null} start  tenancy_start_date, YYYY-MM-DD
 * @param {string|null} end    tenancy_end_date, YYYY-MM-DD
 * @returns {{firstDay:number, lastDay:number, days:number}|null}
 *          null when the tenancy does not overlap the month at all.
 */
export function occupancyWindow(month, start, end) {
  const total = daysInMonth(month);
  const monthKey = String(month).slice(0, 7);

  // Starts after this month ends, so nothing is owed yet.
  if (start && String(start).slice(0, 7) > monthKey) return null;
  // Ended before this month began, so nothing is owed any more.
  if (end && String(end).slice(0, 7) < monthKey) return null;

  const firstDay = start && String(start).slice(0, 7) === monthKey ? dayOf(start) : 1;
  const lastDay = end && String(end).slice(0, 7) === monthKey ? dayOf(end) : total;

  // A tenancy that ends before it starts inside the same month is bad data,
  // not a zero bill. Refuse it rather than quietly billing nothing.
  if (lastDay < firstDay) return null;

  return { firstDay, lastDay, days: lastDay - firstDay + 1 };
}

/**
 * What to bill this tenant for this month. Returns null when they should not
 * be billed at all, which the caller must treat as "skip", not "bill zero".
 *
 * @param {object} args
 * @param {string} args.month        YYYY-MM-01
 * @param {number} args.monthlyRent
 * @param {string|null} args.start
 * @param {string|null} args.end
 * @returns {{amount:number, prorated:boolean, days:number, ofDays:number}|null}
 */
export function rentForMonth({ month, monthlyRent, start = null, end = null }) {
  const rent = Number(monthlyRent);
  if (!Number.isFinite(rent) || rent <= 0) return null;

  const win = occupancyWindow(month, start, end);
  if (!win) return null;

  const total = daysInMonth(month);
  if (win.days >= total) {
    return { amount: round2(rent), prorated: false, days: total, ofDays: total };
  }
  return {
    amount: round2((rent * win.days) / total),
    prorated: true,
    days: win.days,
    ofDays: total,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * The reference a tenant quotes when paying. Mirrors the database trigger
 * fn_rent_payments_mint_ref exactly; kept here only so the function can show
 * the ref back to a human before the row exists.
 */
export function paymentRefFor(unitCode, month) {
  const unit = String(unitCode || "UNK").toUpperCase().replace(/-/g, "");
  const [y, m] = String(month).split("-");
  return `LB-${unit}-${y.slice(2)}${m}`;
}
