"""Build the Lazybee horizontal lockup: brass mark + LAZYBEE wordmark, text as outlines.

The wordmark is Italiana at 0.30em tracking, which is what lazybee.css declares as
--display ("wordmark only"). Converting to paths means the SVG renders identically
everywhere, with no webfont dependency.
"""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

FONT = "Italiana-Regular.ttf"
WORD = "LAZYBEE"
TRACKING_EM = 0.30          # matches .wordmark { letter-spacing:.30em }
BRASS = "#B08D4F"
INK = "#241C16"

# The bee mark, lifted verbatim from design-preview/assets/lazybee-icon.svg.
MARK_PATH = ("M50.000,78.080Q50.000,69.658 45.141,58.091Q35.950,59.205 30.485,63.562"
             "Q35.950,59.205 39.081,50.492Q24.393,42.155 14.435,39.882Q24.393,42.155 "
             "41.243,41.017Q41.203,29.733 37.782,22.629Q41.203,29.733 50.000,36.800"
             "Q58.797,29.733 62.218,22.629Q58.797,29.733 58.757,41.017Q75.607,42.155 "
             "85.565,39.882Q75.607,42.155 60.919,50.492Q64.050,59.205 69.515,63.562"
             "Q64.050,59.205 54.859,58.091Q50.000,69.658 50.000,78.080Z")
MARK_VB = (11.43, 11.79, 77.13, 77.13)   # x, y, w, h of the square icon


def wordmark_paths(font_path, word, tracking_em):
    """Return (path_d, advance_width, upem, cap_height) in font units."""
    f = TTFont(font_path)
    upem = f["head"].unitsPerEm
    gs = f.getGlyphSet()
    cmap = f.getBestCmap()
    hmtx = f["hmtx"]
    try:
        cap = f["OS/2"].sCapHeight
    except AttributeError:
        cap = None
    if not cap:
        # Fall back to the measured height of "H".
        cap = f["glyf"]["H"].yMax if "glyf" in f else int(upem * 0.7)

    track = tracking_em * upem
    d_parts, x = [], 0.0
    for ch in word:
        name = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        gs[name].draw(pen)
        d = pen.getCommands()
        if d:
            d_parts.append(f'<path transform="translate({x:.3f} 0)" d="{d}"/>')
        x += hmtx[name][0] + track
    # Trailing tracking is dead space after the final E: drop it.
    advance = x - track
    return "".join(d_parts), advance, upem, cap


def build(out, mark_fill, text_fill, mark_ratio=1.26, gap_ratio=0.68):
    """mark_ratio: mark height as a multiple of cap height.
       gap_ratio:  gap as a multiple of cap height."""
    d, adv, upem, cap = wordmark_paths(FONT, WORD, TRACKING_EM)

    # Work in a coordinate space where cap height == 100.
    s = 100.0 / cap                      # font units -> our units
    text_w = adv * s
    mark_h = 100.0 * mark_ratio
    mark_w = mark_h                      # the icon viewBox is square
    gap = 100.0 * gap_ratio

    total_w = mark_w + gap + text_w
    pad = 100.0 * 0.10
    vb_h = max(mark_h, 100.0) + pad * 2
    vb_w = total_w + pad * 2

    # Vertically centre both on the cap band.
    cap_top = pad + (vb_h - 2 * pad - 100.0) / 2
    mark_y = pad + (vb_h - 2 * pad - mark_h) / 2

    mark_s = mark_h / MARK_VB[3]
    mark_tx = pad - MARK_VB[0] * mark_s
    mark_ty = mark_y - MARK_VB[1] * mark_s

    # Glyph outlines run y-up from the baseline; flip and drop to the baseline,
    # which sits one cap height below the top of the cap band.
    base_y = cap_top + 100.0
    text_x = pad + mark_w + gap

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vb_w:.2f} {vb_h:.2f}" '
        f'width="{vb_w:.2f}" height="{vb_h:.2f}" fill="none" role="img" aria-label="Lazybee">'
        f'<title>Lazybee</title>'
        f'<g transform="translate({mark_tx:.3f} {mark_ty:.3f}) scale({mark_s:.5f})">'
        f'<path fill="{mark_fill}" d="{MARK_PATH}"/></g>'
        f'<g fill="{text_fill}" transform="translate({text_x:.3f} {base_y:.3f}) '
        f'scale({s:.6f} {-s:.6f})">{d}</g>'
        f'</svg>'
    )
    open(out, "w").write(svg)
    print(f"{out}: {vb_w:.1f} x {vb_h:.1f}  (mark {mark_w:.1f}, gap {gap:.1f}, text {text_w:.1f})")


if __name__ == "__main__":
    build("lazybee-lockup-brass.svg", BRASS, INK)
    build("lazybee-lockup-ink.svg", INK, INK)
    build("lazybee-lockup-mono.svg", "#EDE6DA", "#EDE6DA")
    build("lazybee-lockup-allbrass.svg", BRASS, BRASS)
