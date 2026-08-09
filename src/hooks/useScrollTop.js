// src/hooks/useScrollTop.js
import { useEffect } from 'react';

/**
 * Put the viewport back at the top when a route swaps its content in place.
 *
 * react-router does not restore scroll on navigation, so clicking through from
 * page 2 of The Hive to an article would otherwise drop you two thirds of the way
 * down the new page.
 *
 * behavior is 'instant', not 'smooth', on purpose. A smooth scroll does not run at
 * all in a background or automation tab, so any measurement taken after one is
 * taken at the old position. Instant always moves.
 */
export function useScrollTop(key) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [key]);
}
