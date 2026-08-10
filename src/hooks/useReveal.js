// src/hooks/useReveal.js
import { useEffect } from 'react';

/**
 * Reveal on scroll, ported from design-preview/owners.html.
 *
 * The rule that matters: anything already on screen at load is shown immediately
 * and never handed to the observer. IntersectionObserver callbacks are throttled
 * in background tabs, and an element above the fold must never depend on a scroll
 * that may never happen. Under prefers-reduced-motion everything is simply shown.
 *
 * The .in class is added imperatively rather than through state because React
 * leaves a className prop alone when it has not changed, so the class survives
 * re-renders and no rerender is needed per element that scrolls into view.
 *
 * @param {{current: HTMLElement|null}} rootRef  the page wrapper to search
 * @param {*} [changeKey]  re-run the sweep when this changes. A route that swaps
 *   its content in place (The Hive going from page 1 to page 2) keeps the same
 *   wrapper element, so without this the new .rv nodes would never be revealed
 *   and the page would render blank below the fold.
 */
export function useReveal(rootRef, changeKey) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nodes = [...root.querySelectorAll('.rv')];
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach((n) => n.classList.add('in'));
      return;
    }
    const vh = window.innerHeight || 800, pending = [];
    nodes.forEach((n, i) => {
      if (n.classList.contains('in')) return;
      if (n.getBoundingClientRect().top < vh * 0.92) {
        n.classList.add('in');
      } else {
        n.style.transitionDelay = (i % 4 * 60) + 'ms';
        pending.push(n);
      }
    });
    const io = new IntersectionObserver(
      (es) => es.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      }),
      { rootMargin: '0px 0px -8% 0px' },
    );
    pending.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [rootRef, changeKey]);
}
