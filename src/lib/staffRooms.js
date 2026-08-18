// The decisions behind the staff room desk. Pure, so they can be tested without
// a browser or a database.
//
// `today` is always a parameter. Reading the clock inside these functions would
// make every test depend on the day it runs, and the availability wording is the
// one thing on the page that must not drift.
//
// The prices are a parameter in the same spirit. A room has one base price and
// what the viewer is quoted depends on which channel their PIN belongs to, so
// every price on this page is derived here and never read raw off the row.

import { quotedPrice } from "../../supabase/functions/_shared/channelPricing.js";

/** The twelve week sell window from CLAUDE.md rule 18: viewing to move-in runs
 *  four to eight weeks, so anything opening inside twelve is worth marketing. */
export const SELL_WINDOW_DAYS = 84;

/**
 * How far ABOVE the stated budget we still show a room.
 *
 * A ceiling, not a band. Someone who says 1500 will happily take a 900 room, so
 * putting a floor under the search hides cheaper inventory from the person most
 * likely to book it. They will stretch a couple of hundred for the right room,
 * and no further.
 */
export const BUDGET_STRETCH = 200;

const DAY = 86400000;

/** Midnight-normalised, so a comparison is date to date and not clock to clock. */
export function atMidnight(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysUntil(dateStr, today) {
  return Math.round((atMidnight(dateStr) - atMidnight(today)) / DAY);
}

export function formatDate(dateStr, lang) {
  const d = atMidnight(dateStr);
  // 2026年9月30日 reads as a date to a Chinese reader in a way "30 Sept 2026"
  // does not. Built by hand rather than through toLocaleDateString("zh-CN"),
  // whose output varies with the ICU data compiled into whichever Node or
  // browser is rendering, and this string is asserted in tests.
  if (lang === "zh") {
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }
  return d.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** A real lettable bedroom has a type and a price. Kitchens, yards and shared
 *  toilets are rows in the same table with neither, and are not inventory. */
export function isLettable(room) {
  return !!room.room_type && !!room.price_monthly;
}

/**
 * The availability line, worded the way a captain would say it out loud.
 *
 * Returns { key, date, tone }, not a finished sentence. The desk is read in
 * Chinese as well as English, so the wording belongs to the dictionaries and
 * the date belongs to whichever language is rendering. This function stays
 * pure and language-free, and the component does `t(key, { date })`.
 *
 * tone is 'warn' (sellable) or 'ok' (occupied), matching the .badge-warn and
 * .badge-ok classes in lazybee.css.
 */
export function availabilityStatus(room, today) {
  if (!room.next_available) {
    return room.available_until
      ? { key: "staff.room.openUntil", date: room.available_until, tone: "warn" }
      : { key: "staff.room.openNow", date: null, tone: "warn" };
  }
  const d = daysUntil(room.next_available, today);
  if (d <= 0) return { key: "staff.room.openNow", date: null, tone: "warn" };
  if (d <= SELL_WINDOW_DAYS)
    return { key: "staff.room.opensOn", date: room.next_available, tone: "warn" };
  return { key: "staff.room.occupiedTo", date: room.next_available, tone: "ok" };
}

/** Worth actively marketing: going empty with nothing booked behind it, inside
 *  the sell window. A room free today but with an arrival already booked is
 *  covered, not a target. */
export function isSellNow(room, today) {
  if (!room.next_available) return !room.available_until;
  return daysUntil(room.next_available, today) <= SELL_WINDOW_DAYS;
}

/** The published ladder. Twelve months is the anchor and the one we push. */
export function priceLadder(basePrice) {
  if (!basePrice) return null;
  const base = Number(basePrice);
  return [
    { months: 3, price: base + 100 },
    { months: 6, price: base + 50 },
    { months: 12, price: base, anchor: true },
    { months: 24, price: base - 50 },
  ];
}

/** The lease length the headline price and every ordering decision quote at.
 *  Twelve is the ladder's anchor, so the big number on the card and the rung we
 *  highlight underneath it are the same number rather than two prices for the
 *  same room. */
export const ANCHOR_MONTHS = 12;

/**
 * What this desk's viewer is quoted for a room, per month.
 *
 * `channel` is null for Mark and the captains, and quotedPrice returns the base
 * unchanged for a null channel, so the internal desk renders exactly what it
 * rendered before this existed. That equivalence is the point and it is
 * asserted in the tests: a regression here shows a captain a partner's price.
 */
export function quotedMonthly(basePrice, channel, months = ANCHOR_MONTHS) {
  if (!basePrice) return null;
  return quotedPrice(basePrice, channel, months);
}

/**
 * The ladder, priced for this channel.
 *
 * Each rung is quoted at ITS OWN lease length rather than uplifting the twelve
 * month figure, because for a channel billed in months the uplift is a function
 * of the lease: Fiona's one month is L/(L-1), which is 1.5x over three months
 * and 1.09x over twelve. Uplifting one figure and reusing it would overcharge
 * the long leases and undercharge the short ones, and the short ones are where
 * the error is largest.
 *
 * The +100/+50/-50 adjustments are applied to the BASE first and the result is
 * then quoted, so the uplift covers the adjusted price. Adding them afterwards
 * would leave the extra $100 on a three month lease ungrossed, and we would pay
 * the commission on it out of our own margin.
 */
export function quotedLadder(basePrice, channel) {
  const ladder = priceLadder(basePrice);
  if (!ladder) return null;
  if (!channel) return ladder;
  return ladder.map((rung) => ({
    ...rung,
    price: quotedPrice(rung.price, channel, rung.months),
  }));
}

export const EMPTY_SEARCH = {
  date: "",
  dateMode: "fixed",
  budget: "",
  location: "ALL",
  sell: false,
  couple: false,
  ensuite: false,
};

/** dateMode is deliberately excluded: on its own it filters nothing, and
 *  counting it would leave the page stuck in results mode with every room. */
export function isSearchActive(s) {
  return !!(
    s.date ||
    s.budget ||
    (s.location && s.location !== "ALL") ||
    s.sell ||
    s.couple ||
    s.ensuite
  );
}

/**
 * The price this viewer sees for a room, whatever channel they are on.
 *
 * The desk stamps quoted_monthly onto each row once, after it has resolved the
 * channel behind the PIN, and everything downstream reads it through here. The
 * fallback is not decoration: it is what a captain, an internal PIN and every
 * existing test get, and it must stay identical to the old behaviour.
 *
 * Filtering and sorting have to agree with the number on the card. An agent
 * types "1000" into the budget box meaning the prices they are looking at, so
 * comparing that against our base would show them rooms they cannot sell at
 * that budget and hide ones they can.
 */
export function quotedOf(room) {
  return room?.quoted_monthly ?? room?.price_monthly ?? null;
}

export function roomMatchesSearch(room, propertyCode, s, today) {
  if (s.budget) {
    const b = Number(s.budget);
    const price = quotedOf(room);
    if (!price) return false;
    if (price > b + BUDGET_STRETCH) return false;
  }
  if (s.location && s.location !== "ALL" && propertyCode !== s.location) return false;
  if (s.sell && !isSellNow(room, today)) return false;
  if (s.couple && (room.max_occupancy || 1) < 2) return false;
  if (s.ensuite && !room.has_private_bathroom) return false;
  if (s.date) {
    const target = atMidnight(s.date);
    const limit = atMidnight(s.date);
    if (s.dateMode === "flexible") limit.setDate(limit.getDate() + 30);
    const from = room.next_available ? atMidnight(room.next_available) : atMidnight(today);
    if (from > limit) return false;
    // Free today, but taken again before they would move in.
    if (room.available_until && atMidnight(room.available_until) < target) return false;
  }
  return true;
}
