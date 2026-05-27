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
    // Stitch the marketing → booking funnel across the subdomain hop.
    cross_subdomain_cookie: true,
    cookie_domain: '.lazybee.sg',
  });
  initialized = true;
}

export function track(event, props = {}) {
  if (!initialized) return;
  posthog.capture(event, props);
}

export const EVENTS = {
  BROWSE_ROOMS_CLICK: 'browse_rooms_click',
};
