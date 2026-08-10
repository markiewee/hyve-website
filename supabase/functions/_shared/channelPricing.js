/**
 * Channel pricing.
 *
 * One base price per room lives in rooms.price_monthly and is what a direct
 * tenant pays. Every other channel costs us something to sell through, so the
 * quoted price carries that cost on top. Nothing is written back to rooms: the
 * quote is derived at read time, so changing a base price moves every channel
 * at once and the two can never drift apart.
 *
 * Plain ESM on purpose, same as rentMath.js: Deno imports it from the edge
 * functions, `node --test` runs the tests beside it, and the arithmetic that
 * decides what a prospect is quoted is not first exercised in production.
 *
 * THE ONE THING TO UNDERSTAND
 *
 * "Add the commission on top" has two readings and they are not the same
 * number. An agent taking one month on a twelve month lease takes a month of
 * the price the tenant actually pays, not a month of our base. So:
 *
 *   base × (1 + c/L)      $1,500 -> $1,625, and we net $17,875 over the year
 *   base × L / (L − c)    $1,500 -> $1,636, and we net exactly $18,000
 *
 * The first quietly costs us the commission on the commission. Only the second
 * makes the cost genuinely external, which is what "on top" is supposed to
 * mean, so that is what grossUp does. Mark confirmed this on 10 Aug 2026.
 *
 * Pro-rata falls out of the same formula rather than needing a rule of its own:
 * half a month on a six month lease is the identical 9.09% uplift as one month
 * on twelve. That equivalence is asserted in the tests.
 */

/** How a channel bills US. Distinct from listing_channels.mechanism,
 * which is how we PUBLISH to it (browser, feed, api). Same word, two ideas. */
export const BILLING = {
  /** Agents: a number of months' rent, once, on signing. SG convention. */
  MONTHS: "months",
  /** Platforms: a percentage of rent, usually for the life of the booking. */
  PERCENT: "percent",
  /** Direct: costs nothing to sell through. */
  NONE: "none",
};

/**
 * Which way a channel bills us.
 *
 * Both fields set is a data error rather than something to guess at: the two
 * uplifts compound differently and silently picking one would produce a wrong
 * price nobody could explain. The migration carries a CHECK for this too; this
 * is the belt to its braces, because the edge functions read rows that may
 * predate the constraint.
 */
export function billingOf(channel) {
  const months = channel?.commission_months;
  const pct = channel?.commission_pct;
  const hasMonths = months != null && Number(months) > 0;
  const hasPct = pct != null && Number(pct) > 0;

  if (hasMonths && hasPct) {
    throw new Error(
      `channel "${channel.slug}" sets both commission_months (${months}) and ` +
        `commission_pct (${pct}); it must use exactly one`,
    );
  }
  if (hasMonths) return BILLING.MONTHS;
  if (hasPct) return BILLING.PERCENT;
  return BILLING.NONE;
}

/**
 * The multiplier applied to the base price for one channel and lease length.
 *
 * Returns 1 when the channel costs nothing, or when gross_up is off because we
 * have chosen to absorb the cost rather than pass it on.
 */
export function upliftFor(channel, leaseMonths) {
  const L = Number(leaseMonths);
  if (!Number.isFinite(L) || L <= 0) {
    throw new Error(`leaseMonths must be a positive number, got ${leaseMonths}`);
  }
  if (channel?.gross_up === false) return 1;

  switch (billingOf(channel)) {
    case BILLING.MONTHS: {
      const c = Number(channel.commission_months);
      // c === L would divide by zero; c > L means the agent takes more than the
      // lease is worth. Both are data errors, and both would otherwise surface
      // as Infinity or a negative price in front of a prospect.
      if (c >= L) {
        throw new Error(
          `channel "${channel.slug}" takes ${c} months' commission on a ` +
            `${L} month lease; commission must be shorter than the lease`,
        );
      }
      return L / (L - c);
    }
    case BILLING.PERCENT: {
      const p = Number(channel.commission_pct);
      if (p >= 1) {
        throw new Error(
          `channel "${channel.slug}" has commission_pct ${p}; must be below 1`,
        );
      }
      return 1 / (1 - p);
    }
    default:
      return 1;
  }
}

/**
 * What a prospect on this channel is quoted, per month, rounded to the dollar.
 *
 * Rounding happens once, here, at the end. Rounding the uplift first and
 * multiplying compounds the error across a twelve month lease.
 */
export function quotedPrice(basePrice, channel, leaseMonths) {
  const base = Number(basePrice);
  if (!Number.isFinite(base) || base <= 0) {
    throw new Error(`basePrice must be a positive number, got ${basePrice}`);
  }
  const flat = Number(channel?.fee_fixed ?? 0);
  const spread = flat > 0 ? flat / Number(leaseMonths) : 0;
  return Math.round(base * upliftFor(channel, leaseMonths) + spread);
}

/**
 * What the channel takes, in dollars, over the whole lease.
 *
 * Agents take months of the QUOTED rent, not of our base. That is the whole
 * reason grossUp divides rather than multiplies.
 */
export function channelCost(basePrice, channel, leaseMonths) {
  const L = Number(leaseMonths);
  const quoted = quotedPrice(basePrice, channel, leaseMonths);
  const flat = Number(channel?.fee_fixed ?? 0);

  switch (billingOf(channel)) {
    case BILLING.MONTHS:
      return round2(quoted * Number(channel.commission_months) + flat);
    case BILLING.PERCENT:
      return round2(quoted * L * Number(channel.commission_pct) + flat);
    default:
      return round2(flat);
  }
}

/**
 * Everything a pricing screen needs for one room on one channel.
 *
 * `net` is what actually reaches us over the lease, and it is the number worth
 * looking at. With gross_up on it should land back on base × leaseMonths, give
 * or take the rounding to whole dollars.
 */
export function priceBreakdown(basePrice, channel, leaseMonths) {
  const L = Number(leaseMonths);
  const quoted = quotedPrice(basePrice, channel, leaseMonths);
  const cost = channelCost(basePrice, channel, leaseMonths);
  const gross = quoted * L;

  return {
    slug: channel?.slug ?? null,
    leaseMonths: L,
    basePrice: Number(basePrice),
    quotedMonthly: quoted,
    grossOverLease: round2(gross),
    channelCost: cost,
    net: round2(gross - cost),
    netMonthly: round2((gross - cost) / L),
    billing: billingOf(channel),
    grossedUp: channel?.gross_up !== false,
  };
}

/** Two decimals, without the float dust that makes money comparisons fail. */
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
