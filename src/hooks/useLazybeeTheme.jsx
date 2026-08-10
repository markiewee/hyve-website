import { createContext, forwardRef, useCallback, useContext, useEffect, useState } from 'react';

const THEME_KEY = 'lzb-theme';
const ThemeContext = createContext(null);

/**
 * The alabaster / tobacco toggle for the .lzb surfaces: the owner homepage and
 * The Hive.
 *
 * Restored 10 Aug 2026. It was removed earlier the same day along with the rest
 * of the dark mode, which left book.lazybee.sg carrying a toggle that lazybee.sg
 * did not: a prospect clicking through from one to the other gained a control
 * out of nowhere.
 *
 * A context rather than props, because the button that flips it lives inside the
 * header while the attribute it flips sits on the root element above it. Passing
 * `theme` and `onToggleTheme` down through every header, which is how this
 * worked before, meant four pages all threading the same two props.
 *
 * localStorage is read in an effect rather than in the useState initialiser so
 * the first render is identical on the server and in the browser. The prerender
 * step renders these pages in Node, where localStorage does not exist, and a
 * mismatched first render would either throw there or produce markup React
 * immediately discards.
 *
 * Alabaster is the default here, unlike the booking site, whose photography-led
 * layout defaults to tobacco. Both remember the visitor's choice.
 */
export function LazybeeThemeProvider({ children }) {
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
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch {
        /* not worth breaking a page over */
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
  );
}

/**
 * Returns { theme, toggle }. Safe outside a provider: falls back to alabaster
 * with a no-op toggle, so a component can be dropped on an unwrapped page
 * without exploding.
 */
export function useLazybeeTheme() {
  return useContext(ThemeContext) ?? { theme: 'alabaster', toggle: () => {} };
}

/**
 * The .lzb root, which owns both the class and the data-theme attribute.
 *
 * Wrapping the provider around the element it themes keeps the two from drifting:
 * there is no way to mount the toggle without also mounting the attribute it
 * controls.
 */
export const LazybeeRoot = forwardRef(function LazybeeRoot(
  { className = 'lzb', children, ...rest },
  ref,
) {
  return (
    <LazybeeThemeProvider>
      <ThemedRoot className={className} ref={ref} {...rest}>
        {children}
      </ThemedRoot>
    </LazybeeThemeProvider>
  );
});

/* The ref is forwarded because every page that mounts this hands it an
   IntersectionObserver target. Swallowing it would leave the header stuck on
   transparent and the scroll animations dead, with nothing in the console. */
const ThemedRoot = forwardRef(function ThemedRoot({ className, children, ...rest }, ref) {
  const { theme } = useLazybeeTheme();
  return (
    <div className={className} data-theme={theme} ref={ref} {...rest}>
      {children}
    </div>
  );
});
