// lib/lease-pricing.js
// Mirror of the lease-tier pricing + early-bird logic in
// src/components/StaffResourcePage.jsx so the leasing consultant can
// quote the same numbers the website does.

const TIER_DELTAS = [
  { months: 3,  delta: +100 },
  { months: 6,  delta: +50  },
  { months: 12, delta: 0, recommended: true },
  { months: 24, delta: -50 },
];

const EARLY_BIRD_PER_MONTH = 50;
const EARLY_BIRD_MONTHS = 2;

/**
 * Compute the 4 lease-tier prices for a room.
 * @param {number} baseMonthlyRent - rooms.price_monthly (the 12-month price)
 * @returns {Array<{months, monthly_rent, recommended?}>}
 */
export function computeLeaseTiers(baseMonthlyRent) {
  const base = Number(baseMonthlyRent);
  return TIER_DELTAS.map((t) => ({
    months: t.months,
    monthly_rent: base + t.delta,
    ...(t.recommended ? { recommended: true } : {}),
  }));
}

/**
 * Is the early-bird offer available?
 *
 * Live website rule: "Early bird: $50 off first 2 months if booked before
 * available_from". Returns null if not applicable, or the discount object.
 *
 * @param {string|Date} availableFrom - room.available_from (ISO date)
 * @param {Date} [now=new Date()] - reference "today"
 * @returns {null | { ends_on: string, per_month: number, months: number, total_savings: number }}
 */
export function earlyBird(availableFrom, now = new Date()) {
  if (!availableFrom) return null;
  const endsOn = new Date(availableFrom);
  if (isNaN(endsOn.getTime())) return null;
  if (endsOn <= now) return null;
  return {
    ends_on: endsOn.toISOString().slice(0, 10),
    per_month: EARLY_BIRD_PER_MONTH,
    months: EARLY_BIRD_MONTHS,
    total_savings: EARLY_BIRD_PER_MONTH * EARLY_BIRD_MONTHS,
  };
}

/**
 * Convenience: build the full pricing block for a room.
 */
export function buildPricingBlock(room, now = new Date()) {
  return {
    base_monthly: Number(room.monthly_rent),
    tiers: computeLeaseTiers(room.monthly_rent),
    early_bird: earlyBird(room.available_from, now),
  };
}
