// src/lib/analytics.js
import posthog from 'posthog-js';

let initialized = false;

export function initAnalytics() {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
  if (!key || initialized) return;            // no key (not yet provisioned) → silently skip
  posthog.init(key, {
    api_host: host,
    capture_pageview: true,
    autocapture: true,
    persistence: 'localStorage+cookie',
    // Stitch the marketing to booking funnel across the subdomain hop.
    cross_subdomain_cookie: true,
    // Feature flags drive the hero split test. Without this the flag is not
    // resolved before first paint and every visitor falls back to a local draw.
    advanced_disable_feature_flags: false,
    bootstrap: {},
  });
  initialized = true;
}

/** True once init has actually run, so callers can avoid firing into the void. */
export function analyticsReady() {
  return initialized;
}

export function track(event, props = {}) {
  if (!initialized) return;
  posthog.capture(event, props);
}

export const EVENTS = {
  BROWSE_ROOMS_CLICK: 'browse_rooms_click',
  // Owner homepage funnel. Each step is one event so the split test can be read
  // as a funnel per hero variant rather than as a single conversion number.
  HERO_VARIANT_SHOWN: 'hero_variant_shown',
  ESTIMATOR_STARTED: 'estimator_started',
  ESTIMATOR_CHANGED: 'estimator_changed',
  COMB_CELL_OPENED: 'comb_cell_opened',
  OWNER_LEAD_SUBMITTED: 'owner_lead_submitted',
};
