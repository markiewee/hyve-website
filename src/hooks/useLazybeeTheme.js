// src/hooks/useLazybeeTheme.js
import { useCallback, useEffect, useState } from 'react';

const THEME_KEY = 'lzb-theme';

/**
 * The alabaster / tobacco toggle, remembered across route changes.
 *
 * The owner homepage holds this in local state, which is fine for one page. The
 * Hive is several pages, and a reader who switched to dark on the index should not
 * be thrown back into light by opening an article.
 *
 * localStorage is read in an effect rather than in the useState initialiser so the
 * first render is identical on the server and in the browser. The prerender step
 * renders these pages in Node, where localStorage does not exist, and a mismatched
 * first render would either throw there or produce markup React then discards.
 */
export function useLazybeeTheme() {
  const [theme, setTheme] = useState('alabaster');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved === 'tobacco' || saved === 'alabaster') setTheme(saved);
    } catch {
      /* private mode, or storage disabled. The default is fine. */
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === 'tobacco' ? 'alabaster' : 'tobacco';
      try { window.localStorage.setItem(THEME_KEY, next); } catch { /* not worth breaking a page over */ }
      return next;
    });
  }, []);

  return [theme, toggle];
}
