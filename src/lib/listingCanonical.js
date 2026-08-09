/**
 * Turning a Lazybee room into what a platform should show.
 *
 * Pure on purpose: every mapping decision is testable without a browser, so a
 * bad price or a truncated description is caught here rather than discovered
 * live on someone else's website.
 */

/**
 * What we must list at, so that after commission we still net our price.
 *
 * Mark's decision, 9 Aug: gross up per platform rather than absorb. A channel
 * taking 10% is listed at net / 0.9, not at net. Absorbing it would quietly
 * cost us the commission on every room those channels fill.
 *
 * A null commission means UNKNOWN, not zero. That happens before Mark has
 * signed and seen the real number, and publishing at the net price then would
 * hand the platform its cut out of our margin. So unknown returns null and the
 * caller must refuse to publish.
 *
 * @param {number} netPrice
 * @param {{commission_pct: number|null, gross_up: boolean}} channel
 * @returns {number|null} the price to display, or null if it cannot be decided
 */
export function listPriceFor(netPrice, channel) {
  const net = Number(netPrice);
  if (!Number.isFinite(net) || net <= 0) return null;

  if (channel?.gross_up === false) return round2(net);

  const pct = channel?.commission_pct;
  if (pct === null || pct === undefined || pct === "") return null; // unknown, not free
  const p = Number(pct);
  if (!Number.isFinite(p) || p < 0 || p >= 100) return null;
  if (p === 0) return round2(net);

  return round2(net / (1 - p / 100));
}

/**
 * Fit a description to a platform's cap without slicing a word in half or
 * ending on a comma. Returns the original when it already fits.
 */
export function fitDescription(text, maxChars) {
  const s = String(text ?? "").trim();
  if (!maxChars || s.length <= maxChars) return s;

  const cut = s.slice(0, maxChars);
  // Prefer the last sentence end, then the last space. Never mid-word.
  // Half the cap is the bar: ending cleanly on a full stop reads better than
  // squeezing in a trailing fragment, but dropping more than half the allowance
  // wastes space a platform gave us.
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (lastStop >= maxChars * 0.5) return cut.slice(0, lastStop + 1).trim();

  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return base.replace(/[,;:\-\s]+$/, "").trim();
}

/**
 * Photos in the order a platform should receive them: hero first, no
 * duplicates, capped at the platform's limit.
 */
export function orderedPhotos(profile, maxPhotos) {
  const all = Array.isArray(profile?.photos) ? profile.photos.filter(Boolean) : [];
  const hero = profile?.hero_photo;
  const ordered = hero ? [hero, ...all.filter((p) => p !== hero)] : all;
  const unique = [...new Set(ordered)];
  return maxPhotos ? unique.slice(0, maxPhotos) : unique;
}

/**
 * The channel-ready payload, plus an explicit list of reasons it must not be
 * published. Refusing loudly is the point: a listing that goes out with a
 * placeholder title or an unknown commission is worse than no listing.
 *
 * @returns {{publishable: boolean, blockers: string[], payload: object}}
 */
export function buildPayload({ room, profile, channel }) {
  const cfg = channel?.config ?? {};
  const blockers = [];

  const price = listPriceFor(room?.price_monthly, channel);
  if (price === null) {
    blockers.push(
      channel?.commission_pct == null && channel?.gross_up !== false
        ? "commission unknown for this channel, so the list price cannot be computed"
        : "no valid net price on the room"
    );
  }

  if (profile?.needs_review) {
    blockers.push("title is a generated placeholder and has not been reviewed");
  }
  if (!profile?.title) blockers.push("no title");
  if (!profile?.description) blockers.push("no description");

  const photos = orderedPhotos(profile, cfg.max_photos);
  if (photos.length === 0) blockers.push("no photos");
  if (cfg.min_photos && photos.length < cfg.min_photos) {
    blockers.push(`needs at least ${cfg.min_photos} photos, has ${photos.length}`);
  }

  if (channel?.enabled === false) blockers.push("channel is disabled");

  return {
    publishable: blockers.length === 0,
    blockers,
    payload: {
      external_ref: room?.unit_code,
      title: profile?.title ?? null,
      description: fitDescription(profile?.description, cfg.max_description_chars),
      price,
      currency: profile?.fields?.currency ?? "SGD",
      price_period: profile?.fields?.price_period ?? "monthly",
      available_from: room?.next_available ?? null,
      available_until: room?.available_until ?? null,
      min_stay_months: profile?.fields?.min_stay_months ?? null,
      deposit_months: profile?.fields?.deposit_months ?? null,
      max_occupancy: profile?.fields?.max_occupancy ?? null,
      bills_included: profile?.fields?.bills_included ?? null,
      address: profile?.fields?.address ?? null,
      photos,
    },
  };
}

/**
 * What a channel currently shows versus what it should show. An empty object
 * means the listing is correct right now; anything else is a listing that is
 * publicly wrong.
 */
export function diffAgainstLive(expected, live) {
  const drift = {};
  for (const key of Object.keys(expected ?? {})) {
    const want = expected[key];
    const got = live?.[key];
    if (got === undefined) continue; // the channel does not expose this field
    const same = Array.isArray(want)
      ? JSON.stringify(want) === JSON.stringify(got)
      : String(want ?? "") === String(got ?? "");
    if (!same) drift[key] = { expected: want, live: got };
  }
  return drift;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
