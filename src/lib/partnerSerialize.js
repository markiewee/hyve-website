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
//
// Media and features fall back from the marketing profile to the operational
// row (rooms.photos / properties.images, stored as relative paths) so the API
// is truthful today, before every profile is fully populated.

import { quotedPrice } from "../../supabase/functions/_shared/channelPricing.js";

const SITE = "https://lazybee.sg";
const BOOKING = "https://book.lazybee.sg";

/** Relative asset paths become absolute; anything already shaped is passed through. */
export function toMediaUrls(list) {
  return (list ?? []).map((p) => {
    if (p && typeof p === "object") return p;
    const path = String(p ?? "");
    return { url: path.startsWith("/") ? `${SITE}${path}` : path };
  });
}

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
  const monthly = quotedPrice(Number(room.price_monthly), channel, durationMonths);
  return {
    monthly_rate: monthly,
    // Months of the QUOTED rate: the deposit a tenant on this channel pays.
    deposit: room.deposit_months == null ? null : Math.round(Number(room.deposit_months) * monthly),
    min_stay_months: room.min_stay_months == null ? null : Number(room.min_stay_months),
    currency: "SGD",
    duration_months: durationMonths,
  };
}

export function listingResource({ code, propertySlug, profile, room, channel, availableFrom, durationMonths, updatedAt }) {
  const fields = profile.fields ?? {};
  const media = Array.isArray(fields.media) && fields.media.length ? fields.media : room.photos;
  const features = Array.isArray(fields.features) && fields.features.length ? fields.features : room.amenities;
  return {
    code,
    property: propertySlug,
    profile: { title: profile.title ?? null, description: profile.description ?? null },
    media: toMediaUrls(media),
    features: features ?? [],
    rate_card: rateCard(room, channel, durationMonths),
    available_from: availableFrom ?? null,
    max_occupancy: room.max_occupancy ?? null,
    links: { canonical: `${SITE}/rooms/${code}`, book: BOOKING },
    updated_at: updatedAt ?? null,
  };
}

export function propertyResource({ slug, profile, listingCount, updatedAt, fallbackMedia, fallbackFeatures }) {
  const fields = profile.fields ?? {};
  const media = Array.isArray(fields.media) && fields.media.length ? fields.media : fallbackMedia;
  const features = Array.isArray(fields.features) && fields.features.length ? fields.features : fallbackFeatures;
  return {
    slug,
    profile: { title: profile.title ?? null, description: profile.description ?? null },
    media: toMediaUrls(media),
    features: features ?? [],
    listing_count: listingCount,
    links: { canonical: `${SITE}/properties/${slug}`, book: BOOKING },
    updated_at: updatedAt ?? null,
  };
}
