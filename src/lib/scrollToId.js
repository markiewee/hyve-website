// src/lib/scrollToId.js
//
// In-page anchors, without putting scroll-behavior:smooth on <html> where it would
// change how every other route in the app scrolls. Honours reduced motion.

export function scrollToId(id) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(id);
  if (!el) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}
