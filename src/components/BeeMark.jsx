/**
 * The Lazybee mark. One path, no text, brass by default.
 *
 * Lifted out of owners/OwnerChrome so the site chrome can use it without
 * pulling the whole owner homepage module into the marketing bundle.
 *
 * Sizing is the caller's job. Inside .lzb the stylesheet sizes it through
 * `.brandlock svg`; everywhere else pass a className. The viewBox is the wide
 * crop (the square icon is design-preview/assets/lazybee-icon.svg), which sits
 * better beside a wordmark on a single line.
 */
export function BeeMark({ className = '', fill = 'currentColor' }) {
  return (
    <svg
      viewBox="13.43 21.63 73.13 57.45"
      className={className}
      fill={fill}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M50.000,78.080Q50.000,69.658 45.141,58.091Q35.950,59.205 30.485,63.562Q35.950,59.205 39.081,50.492Q24.393,42.155 14.435,39.882Q24.393,42.155 41.243,41.017Q41.203,29.733 37.782,22.629Q41.203,29.733 50.000,36.800Q58.797,29.733 62.218,22.629Q58.797,29.733 58.757,41.017Q75.607,42.155 85.565,39.882Q75.607,42.155 60.919,50.492Q64.050,59.205 69.515,63.562Q64.050,59.205 54.859,58.091Q50.000,69.658 50.000,78.080Z" />
    </svg>
  );
}

export default BeeMark;
