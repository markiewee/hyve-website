// src/lib/experiment.js
//
// Hero split test for the owner homepage.
//
// This module holds no imports on purpose. The assignment rules are the part that
// can silently ruin a test result, so they are pure and testable, and the PostHog
// client is passed in by the caller.
//
// Assignment order:
//   1. ?hero=a|b|c in the URL, so a specific variant can be shared with someone.
//   2. A PostHog feature flag, once one exists. This is what we want long term,
//      because PostHog then owns the split, the exposure log and the stats.
//   3. A local random draw, made sticky in localStorage. The fallback, so the test
//      runs today rather than waiting on anyone opening the PostHog UI.
//
// However it is assigned, the variant is registered as a PostHog super property so
// every later event carries it. Without that we learn which headline got pageviews,
// not which headline produced a lead, and only the second question is worth asking.

export const HERO_FLAG = 'owner-hero-headline';
export const HERO_STORAGE_KEY = 'lb_hero_variant';
export const HERO_VARIANTS = ['a', 'b', 'c'];

export const HERO_COPY = {
  a: {
    headline: 'Be a lazy landlord',
    sub: 'We do the viewings, the contracts, the cleaning. You do nothing, and you still keep half the upside.',
  },
  b: {
    headline: 'We pay first. You decide after.',
    sub: 'We furnish it, shoot it, list it and start paying your floor, all before anything binds you to us. Ninety days later you carry on or you walk.',
  },
  c: {
    headline: 'What is your unit actually worth?',
    sub: 'Not the asking rent. The number after the empty month, the agent and the repairs. Put in a postal code and we will show you both, side by side.',
  },
};

export const isHeroVariant = (v) => typeof v === 'string' && HERO_VARIANTS.includes(v);

/**
 * Pure resolution. Given what the URL, the flag and storage say, decide the variant.
 * `random` is injectable so the test does not depend on Math.random.
 *
 * Returns { variant, source, persist } where persist says whether the caller should
 * write to storage. Only our own draws are persisted: a flag or a shared ?hero= link
 * must never rewrite a real visitor's bucket, or one link in a WhatsApp group
 * quietly moves everyone who opens it.
 */
export function resolveHeroVariant({ queryValue, flagValue, storedValue, random = Math.random } = {}) {
  if (isHeroVariant(queryValue)) return { variant: queryValue, source: 'query', persist: false };
  if (isHeroVariant(flagValue)) return { variant: flagValue, source: 'feature_flag', persist: false };
  if (isHeroVariant(storedValue)) return { variant: storedValue, source: 'stored', persist: false };
  const variant = HERO_VARIANTS[Math.floor(random() * HERO_VARIANTS.length)];
  return { variant, source: 'random', persist: true };
}

/* ── browser wiring ───────────────────────────────────────────────── */

function readQuery(win) {
  try {
    return new URLSearchParams(win.location.search).get('hero');
  } catch {
    return null;
  }
}

function readStored(win) {
  try {
    return win.localStorage.getItem(HERO_STORAGE_KEY);
  } catch {
    return null; // private mode, or storage disabled
  }
}

function writeStored(win, variant) {
  try {
    win.localStorage.setItem(HERO_STORAGE_KEY, variant);
  } catch {
    // Not worth breaking the page over. The visitor gets a fresh draw next time,
    // which costs the test a little precision and costs them nothing.
  }
}

/**
 * Resolve the hero for this visitor and tell PostHog about it.
 * Safe to call more than once. Analytics failures never propagate.
 *
 * @param {object} posthog  the posthog-js client, or any object with the same shape
 * @param {Window} win
 */
export function assignHeroVariant(posthog, win = typeof window !== 'undefined' ? window : undefined) {
  if (!win) return { variant: 'a', source: 'ssr', copy: HERO_COPY.a };

  let flagValue = null;
  try {
    flagValue = posthog?.getFeatureFlag?.(HERO_FLAG) ?? null;
  } catch {
    flagValue = null;
  }

  const { variant, source, persist } = resolveHeroVariant({
    queryValue: readQuery(win),
    flagValue,
    storedValue: readStored(win),
  });

  if (persist) writeStored(win, variant);

  try {
    posthog?.register?.({ hero_variant: variant });
    posthog?.capture?.('hero_variant_shown', {
      variant,
      assignment_source: source,
      headline: HERO_COPY[variant].headline,
    });
  } catch {
    // Analytics must never take the page down.
  }

  return { variant, source, copy: HERO_COPY[variant] };
}
