// Canonical portal host/URL. Defaults to the current live host so the app is
// unchanged until portal.lazybee.sg DNS is live, at which point set
// VITE_PORTAL_HOST=portal.lazybee.sg (build-time env) to flip every portal link.
export const PORTAL_HOST = import.meta.env.VITE_PORTAL_HOST || "lazybee.sg";
export const PORTAL_URL = `https://${PORTAL_HOST}`;
