import { useLazybeeTheme } from '../hooks/useLazybeeTheme';

/**
 * The alabaster / tobacco control, sitting beside LangSwitch in the header.
 *
 * Iconographic rather than the word "Dark", to match book.lazybee.sg, and
 * because the slot next to a 中文 / EN label is the wrong place for a second
 * piece of text: two word-buttons side by side read as a pair of links.
 *
 * Labelled with the theme you GET by pressing it, which is the same rule
 * LangSwitch follows. A sun means press me for light. Labelling it with the
 * current state instead makes half the visitors press it twice to learn which
 * way it goes.
 *
 * The strokes are 1.6 and the box is 44px, matching the language button, so the
 * two sit as a pair rather than as one control and one afterthought.
 */
export default function ThemeToggle() {
  const { theme, toggle } = useLazybeeTheme();
  const goingLight = theme === 'tobacco';

  return (
    <button
      className="modebtn"
      type="button"
      onClick={toggle}
      title={goingLight ? 'Switch to light' : 'Switch to dark'}
      aria-label={goingLight ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {goingLight ? (
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
          aria-hidden="true" focusable="false"
        >
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.6v2.2M12 19.2v2.2M4.3 4.3l1.6 1.6M18.1 18.1l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.3 19.7l1.6-1.6M18.1 5.9l1.6-1.6" />
        </svg>
      ) : (
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true" focusable="false"
        >
          <path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1Z" />
        </svg>
      )}
    </button>
  );
}
