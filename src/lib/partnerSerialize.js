// src/lib/partnerSerialize.js
//
// Resource shapes for the partner API. The exact output key sets are asserted
// by tests: adding a field here without updating the test is a build failure,
// which is the mechanism that keeps tenant data and margin math out of the
// public surface. Prices resolve through the same arithmetic every other
// channel uses (channelPricing.js), so the API can never drift from what a
// platform listing would show. quotedPrice quotes whole dollars and throws on
// impossible commission/duration combinations; the router turns that into a
// 422 rather than ever under-quoting.

import { quotedPrice } from "../../supabase/functions/_shared/channelPricing.js";

const SITE = "https://lazybee.sg";
const BOOKING = "https://book.lazybee.sg";

/** Room profile over property profile: NULL inherits, empty string blanks. */
export function mergeProfiles(propertyProfile, roomProfile) {
  const base = propertyProfile ?? {};
  const over = roomProfile ?? {};
  const pick = (a, b) => (b === null || b === undefined ? a ?? null : b);
  return {
    title: pick(base.title, over.title),
    description: pick(base.description, over.description),
    fields: { ...(base.fields ?? {}), ...Object.fromEntries(
      Object.entries(over.fields ?? {}).filter(([, v]) => v !== null && v !== undefined)
    ) },
  };
}

export function rateCard(room, channel, durationMonths) {
  return {
    monthly_rate: quotedPrice(Number(room.price_monthly), channel, durationMonths),
    deposit: room.deposit == null ? null : Number(room.deposit),
    min_stay_months: room.min_stay_months == null ? null : Number(room.min_stay_months),
    currency: "SGD",
    duration_months: durationMonths,
  };
}

export function listingResource({ code, propertySlug, profile, room, channel, availableFrom, durationMonths, updatedAt }) {
  return {
    code,
    property: propertySlug,
    profile: { title: profile.title ?? null, description: profile.description ?? null },
    media: profile.fields?.media ?? [],
    features: profile.fields?.features ?? [],
    rate_card: rateCard(room, channel, durationMonths),
    available_from: availableFrom ?? null,
    max_occupancy: room.max_occupancy ?? null,
    links: { canonical: `${SITE}/rooms/${code}`, book: BOOKING },
    updated_at: updatedAt ?? null,
  };
}

export function propertyResource({ slug, profile, listingCount, updatedAt }) {
  return {
    slug,
    profile: { title: profile.title ?? null, description: profile.description ?? null },
    media: profile.fields?.media ?? [],
    features: profile.fields?.features ?? [],
    listing_count: listingCount,
    links: { canonical: `${SITE}/properties/${slug}`, book: BOOKING },
    updated_at: updatedAt ?? null,
  };
}
