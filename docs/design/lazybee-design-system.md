# Lazybee Design System — "Editorial Dark"
*Reverse-engineered from the live booking site `book.lazybee.sg` (2026-06-01). This is the canonical visual language for lazybee.sg.*

## 1. Design DNA — what makes it feel like Lazybee

The booking site is **cinematic, editorial, and quiet**. It behaves like a design magazine (Kinfolk / Aesop / Cereal), not a SaaS dashboard. Five principles:

1. **Photography is the interface.** Rooms are shown full-bleed, edge-to-edge, zero gaps, zero rounded corners. The image *is* the card. Chrome floats on top of it.
2. **Dark, warm, near-black canvas.** Everything sits on `#0c0f0f` (black with a faint green-teal undertone). It makes warm room photography glow.
3. **One accent, used sparingly.** A single copper/amber `#c47a35` — for the brand mark, the primary CTA, and almost nothing else. No second accent.
4. **Frosted glass chrome.** Navigation and the search bar are translucent panels with heavy `backdrop-blur` — they sit *over* the photography, never on an opaque bar.
5. **Two type voices only.** Giant tight-tracked **Hanken Grotesk** for display, and **wide-tracked uppercase micro-labels** for everything structural (eyebrows, statuses, nav). Body copy is **Inter**.

## 2. Color Tokens

```css
:root {
  --background:        #0c0f0f;  /* near-black canvas, slight green undertone */
  --surface:           #121414;  /* raised panels / sheets */
  --surface-container: #1e2020;  /* cards, inputs, hover fills */
  --foreground:        #e2e2e2;  /* primary text (NOT pure white) */
  --foreground-variant:#c4c7c7;  /* secondary text */
  --accent:            #c47a35;  /* copper — brand mark + primary CTA only */
}
```

### White-alpha overlay scale (the "glass" ladder)
Used for borders, dividers, fills on top of photography. Always white at low opacity, never grey:

| Token | Value | Use |
|-------|-------|-----|
| white/5%  | `rgba(255,255,255,.05)` | glass panel fill (search bar) |
| white/10% | `rgba(255,255,255,.10)` | glass panel border |
| white/15% | `rgba(255,255,255,.15)` | dividers between segments |
| white/40% | `rgba(255,255,255,.40)` | muted dots / inactive controls |
| white/60% | `rgba(255,255,255,.60)` | status micro-labels over photos |
| white/70% | `rgba(255,255,255,.70)` | eyebrow micro-labels over photos |

### Image scrim (text-over-photo gradient)
```css
background: linear-gradient(
  rgba(0,0,0,.60) 0%,
  rgba(0,0,0,.25) 50%,
  rgba(0,0,0,.75) 100%
);
```
Darkens top and bottom so overlaid captions stay legible; lets the photo breathe in the middle.

## 3. Typography

| Role | Font | Size | Weight | Tracking | Case |
|------|------|------|--------|----------|------|
| Hero display | Hanken Grotesk | 96px (clamp down on mobile) | 700 | **-0.035em** (very tight) | Title |
| Card / section title | Hanken Grotesk | ~28px | 700 | -0.02em | Title |
| Body | Inter | 16px | 400 | normal | sentence |
| Wordmark "LAZYBEE" | Inter | 16px | 600 | **5.6px** | UPPER |
| Nav link ("CONTACT") | Inter | 11px | 400 | 2.75px | UPPER |
| Eyebrow (over photo) | Inter | 10px | 400 | 2.5px | UPPER |
| Status label | Inter | 11px | 400 | 2.2px | UPPER |
| CTA button label | Inter | 14px | 600 | 2.52px | UPPER |

**Rule of thumb:** anything small and structural is UPPERCASE with 2–6px letter-spacing. Anything large is Hanken Grotesk with *negative* tracking. There is no mid-size "normal" heading — the jump from giant display to tiny tracked label is the whole signature.

Fonts already loaded site-wide: `Hanken Grotesk` (display) + `Inter` (body). No new font loading needed.

## 4. Glass & Elevation

```css
/* Floating navigation header */
.glass-header {
  position: fixed; inset-inline: 0; top: 0;
  background: transparent;
  backdrop-filter: blur(24px);
}

/* Floating search / control bar */
.glass-bar {
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.10);
  backdrop-filter: blur(24px);
  border-radius: 16px;            /* rounded-2xl */
  /* internal segments separated by */
  /* divide-x divide-white/15 */
}

/* Heaviest frost (modal / sheet backdrop) */
.glass-sheet { backdrop-filter: blur(40px); border-radius: 24px; }
```

No drop shadows anywhere. Elevation is communicated by **blur + a 1px white/10% hairline border**, never by `box-shadow`.

## 5. Components

### Primary button (accent CTA)
```css
background: #c47a35;
color: #fff;
border-radius: 9999px;        /* full pill */
padding: 0 32px; height: ~44px;
font: 600 14px Inter; letter-spacing: 2.52px; text-transform: uppercase;
/* hover: slightly lighten / subtle scale, no shadow */
```

### Secondary / ghost button
Transparent fill, white/70% text, optional white/10% hairline border, same pill radius and uppercase tracked label.

### Segmented control (the search bar pattern)
Glass bar → internal segments split by `white/15%` vertical dividers. Each segment = a tiny uppercase eyebrow label (e.g. `MOVE IN`) stacked above its value (`Anytime ▾`). Reusable anywhere we have grouped filters or stat tiles.

### Full-bleed media card
- 3-column grid, **gap: 0**, images fill the cell, no radius.
- Scrim gradient overlaid (see §2).
- Caption block bottom-left: `EYEBROW` (property · type) → **Title** (Hanken) → `STATUS` micro-label.
- Price top-right: `from $X,XXX/mo`, small, right-aligned, white.
- Whole card is the click target; hover can gently zoom the image (`scale(1.03)`, ~700ms ease).

### Brand mark
The `✳` asterisk glyph in `--accent`, paired with the tracked `LAZYBEE` wordmark. Use the asterisk as a standalone bullet/loader/section marker throughout.

### Tagline lockup
Property/section name in giant Hanken, with a tiny `BY LAZYBEE` uppercase tracked label centered beneath it.

## 6. Motion
- Reveal-on-scroll fades + gentle upward translate.
- Image hover zoom (slow, 600–800ms, ease-out).
- Glass elements fade/scale in. Nothing bounces. Everything is calm and slow.

## 7. Applying to other surfaces (portal, staff, marketing)

The booking site is **dark**. The current portal + marketing site are **light honey**. To adopt this system, each surface maps as follows:

| Booking element | Portal/app equivalent |
|-----------------|----------------------|
| `--background #0c0f0f` | page canvas |
| `--surface-container #1e2020` | cards, table rows, inputs |
| white/10% hairline | all borders & dividers (replaces honey borders) |
| `#c47a35` accent | primary buttons, active nav, key figures — sparingly |
| Hanken display + Inter body | already in place, just enforce the tracking rules |
| uppercase tracked micro-label | every table header, stat label, nav item, badge |
| glass blur (24px) | sidebar, top bar, sticky toolbars, modals |
| pill accent CTA | all primary actions |
| no shadows | remove existing shadows, replace with hairline borders |

**Data-density caveat (for portal/admin):** the booking site has almost no dense data. Admin tables, forms, and charts need contrast that pure cinematic dark can fight. Recommended adjustments for app surfaces while staying on-brand:
- Lift body text to `#e2e2e2` and ensure ≥ `#c4c7c7` for secondary (passes AA on `#0c0f0f`).
- Allow `--surface-container #1e2020` for table zebra/row separation instead of relying only on hairlines.
- Keep accent for *one* primary action per view; status colors (paid/overdue/etc.) stay semantic, not copper.
