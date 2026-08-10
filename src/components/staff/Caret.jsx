/**
 * The disclosure chevron on room cards and FAQ rows.
 *
 * An SVG rather than a text character. The prototype used a literal "v", which
 * in JetBrains Mono reads as the letter it is, and a screen reader announces it
 * as one. This is aria-hidden because the <summary> it sits in already carries
 * the open state.
 *
 * Rotation is handled in lazybee.css off the [open] attribute of the parent
 * <details>, so there is no state to pass in.
 */
export default function Caret() {
  return (
    <svg className="caret" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 4.5 6 8l3.5-3.5" />
    </svg>
  );
}
