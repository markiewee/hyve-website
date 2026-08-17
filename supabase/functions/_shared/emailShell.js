/* ═══════════════════════════════════════════════════════════════════
   Lazybee transactional email shell, v2.0
   Reviewed and approved by Mark on 18 August 2026.
   Ported onto the Lazybee design system v1.0 (alabaster theme).

   Tokens lifted verbatim from src/styles/lazybee.css so the emails and
   the site are the same brand rather than two brands that share a name.

     bg #F6F2EA   raised #FFFCF6   line #DED5C6
     ink #241C16  muted #5C5247    faint #7C7263
     accent #B08D4F (brass)        accent-text #8A6733
     band #0E2E20 (regal green)    band-num #C6A467   band-mut #7FA692
     bad #8C3A2B                   radius --r 2px, --r-pill 999px

   Type: Italiana (wordmark) / Cormorant Garamond (headlines) /
         Inter Tight (body) / JetBrains Mono (every number and label).

   Email-safe: table layout, inline CSS, hex colours, no JS, no classes.
   Google Fonts <link> is honoured by Apple Mail and iOS Mail; Gmail and
   Outlook strip it and fall through to the Georgia / Courier fallbacks,
   which is why every stack has a real fallback rather than a bare name.
   ═══════════════════════════════════════════════════════════════════ */

const PORTAL_BASE = "https://www.lazybee.sg";

const T = {
  bg: "#F6F2EA",
  raised: "#FFFCF6",
  surface: "#EFE9DE",
  line: "#DED5C6",
  ink: "#241C16",
  muted: "#5C5247",
  faint: "#7C7263",
  accent: "#B08D4F",
  accentText: "#8A6733",
  band: "#0E2E20",
  bandInk: "#EDE6DA",
  bandNum: "#C6A467",
  bandMut: "#7FA692",
  bad: "#8C3A2B",
  badSoft: "#F0E2DE",
  ok: "#2F6B4F",
};

const F = {
  display:
    "'Italiana','Cormorant Garamond',Georgia,'Times New Roman',serif",
  head: "'Cormorant Garamond',Georgia,'Times New Roman',serif",
  body:
    "'Inter Tight',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
  mono:
    "'JetBrains Mono',ui-monospace,'SF Mono',Menlo,Consolas,'Courier New',monospace",
};

/**
 * Escape for both element text and attribute values.
 *
 * Quotes matter: escape() output lands inside href="..." as well as in text,
 * so escaping only < > & would let a stray quote close the attribute early
 * and inject its own. Entity-encoded quotes render as ordinary quotes in text
 * content, so covering all five costs nothing on the display side.
 */
function escape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ── the brass wordmark, set as live text ──────────────────────────
   Deliberately not an image. Gmail blocks remote images by default and
   a logo that has to be "shown" is a logo nobody sees. Italiana at
   .30em tracking degrades to Georgia at .30em tracking, which still
   reads as the Lazybee lockup rather than as a broken asset. */
function wordmark() {
  return `
    <tr><td style="padding:0 0 22px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="left" style="font-family:${F.display};font-size:23px;letter-spacing:.30em;color:${T.ink};line-height:1;text-transform:uppercase">Lazybee</td>
          <td align="right" style="font-family:${F.mono};font-size:9.5px;letter-spacing:.22em;color:${T.faint};text-transform:uppercase">Singapore</td>
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding:0 0 26px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="44" style="background:${T.accent};height:2px;line-height:2px;font-size:2px">&nbsp;</td>
          <td style="background:${T.line};height:1px;line-height:1px;font-size:1px">&nbsp;</td>
        </tr>
      </table>
    </td></tr>`;
}

/* ── the money band ────────────────────────────────────────────────
   The one element that carries a number the reader actually needs.
   Regal green with a brass numeral, mono and tabular so digits line up. */
function moneyBand(money, urgent) {
  if (!money) return "";
  const bg = urgent ? T.bad : T.band;
  const mut = urgent ? "#E4C4BC" : T.bandMut;
  const num = urgent ? "#F4DDD6" : T.bandNum;
  const foot = money.footnote
    ? `<div style="font-family:${F.mono};font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:${mut};padding-top:10px">${escape(money.footnote)}</div>`
    : "";
  return `
    <tr><td style="padding:0 0 30px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};border-radius:2px">
        <tr><td style="padding:24px 26px">
          <div style="font-family:${F.mono};font-size:10.5px;letter-spacing:.22em;text-transform:uppercase;color:${mut};padding-bottom:12px">${escape(money.label)}</div>
          <div style="font-family:${F.mono};font-weight:700;font-size:38px;line-height:1;letter-spacing:-.035em;color:${num}">${escape(money.value)}</div>
          ${foot}
        </td></tr>
      </table>
    </td></tr>`;
}

/* ── detail rows ───────────────────────────────────────────────────
   Mono uppercase label in the left gutter, ink value on the right.
   Hairline separators instead of a boxed card: the design system uses
   rules, not containers, to group things. */
function detailsTable(details) {
  if (!details || !details.length) return "";
  const rows = details
    .map(
      (d, i) => `
        <tr>
          <td style="padding:${i === 0 ? "0" : "12px"} 18px 12px 0;border-top:${i === 0 ? "0" : `1px solid ${T.line}`};font-family:${F.mono};font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${T.faint};vertical-align:top;white-space:nowrap;width:34%">${escape(d.label)}</td>
          <td style="padding:${i === 0 ? "0" : "12px"} 0 12px 0;border-top:${i === 0 ? "0" : `1px solid ${T.line}`};font-family:${F.body};font-size:14.5px;line-height:1.55;color:${T.ink};vertical-align:top">${d.value}</td>
        </tr>`
    )
    .join("");
  return `
    <tr><td style="padding:0 0 30px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
    </td></tr>`;
}

/* Inline code chip, used for payment refs and credentials. */
function chip(v) {
  return `<span style="font-family:${F.mono};font-size:13px;background:${T.surface};border:1px solid ${T.line};border-radius:2px;padding:3px 8px;color:${T.ink};letter-spacing:.02em">${escape(v)}</span>`;
}

function renderEmail(opts) {
  const isUrgent = opts.variant === "urgent";
  const eyebrowFg = isUrgent ? T.bad : T.accentText;
  const rule = isUrgent ? T.bad : T.accent;

  const preheader = opts.preheader || opts.headline;
  const greeting = opts.greeting
    ? `<p style="margin:0 0 18px 0">${escape(opts.greeting)}</p>`
    : "";
  const paras = opts.paragraphs
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 18px 0">${p}</p>`)
    .join("");

  const ctaCaption = opts.ctaCaption
    ? `<tr><td align="center" style="padding:14px 0 0 0;font-family:${F.mono};font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${T.faint}">${escape(opts.ctaCaption)}</td></tr>`
    : "";

  const secondary = opts.secondary
    ? `<tr><td align="center" style="padding:16px 0 0 0;font-family:${F.body};font-size:13.5px;color:${T.muted}">
         <a href="${escape(opts.secondary.url)}" style="color:${T.accentText};text-decoration:underline">${escape(opts.secondary.label)}</a>
       </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${escape(opts.headline)}</title>
<link href="https://fonts.googleapis.com/css2?family=Italiana&family=Cormorant+Garamond:wght@300;400&family=Inter+Tight:wght@300;400;500&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${T.bg};font-family:${F.body};color:${T.ink};-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0">${escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${T.bg}" style="background:${T.bg}">
  <tr><td align="center" style="padding:40px 16px 56px 16px">
    <table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%">

      ${wordmark()}

      <!-- Card -->
      <tr><td style="background:${T.raised};border:1px solid ${T.line};border-radius:2px;padding:38px 36px 36px 36px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

          <!-- Eyebrow -->
          <tr><td style="padding:0 0 18px 0">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="18" style="background:${rule};height:1px;line-height:1px;font-size:1px">&nbsp;</td>
                <td style="padding-left:10px;font-family:${F.mono};font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:${eyebrowFg}">${escape(opts.badge)}</td>
              </tr>
            </table>
          </td></tr>

          <!-- Headline -->
          <tr><td style="padding:0 0 22px 0;font-family:${F.head};font-weight:300;font-size:37px;line-height:1.06;letter-spacing:-.015em;color:${T.ink}">${escape(opts.headline)}</td></tr>

          <!-- Body -->
          <tr><td style="padding:0 0 28px 0;font-family:${F.body};font-weight:300;font-size:16px;line-height:1.7;color:${T.muted}">
            ${greeting}${paras}
          </td></tr>

          ${moneyBand(opts.money, isUrgent)}
          ${detailsTable(opts.details)}

          <!-- CTA -->
          <tr><td align="center" style="padding:0">
            <a href="${escape(opts.cta.url)}" style="display:inline-block;padding:16px 30px;background:${T.ink};color:${T.bg};text-decoration:none;border-radius:999px;font-family:${F.mono};font-weight:500;font-size:11.5px;letter-spacing:.15em;text-transform:uppercase">${escape(opts.cta.label)}</a>
          </td></tr>
          ${ctaCaption}
          ${secondary}

        </table>
      </td></tr>

      <!-- Footer -->
      <tr><td align="center" style="padding:34px 8px 0 8px">
        <p style="margin:0 0 6px 0;font-family:${F.display};font-size:13px;letter-spacing:.26em;text-transform:uppercase;color:${T.ink}">Lazybee</p>
        <p style="margin:0 0 14px 0;font-family:${F.mono};font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${T.faint}">39 Jalan Kelulut &middot; Singapore 809056</p>
        <p style="margin:0;font-family:${F.mono};font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${T.faint}">
          <a href="${PORTAL_BASE}/privacy-policy" style="color:${T.faint};text-decoration:none;border-bottom:1px solid ${T.line}">Privacy</a>
          &nbsp;&nbsp;&middot;&nbsp;&nbsp;
          <a href="mailto:hello@lazybee.sg?subject=Unsubscribe" style="color:${T.faint};text-decoration:none;border-bottom:1px solid ${T.line}">Unsubscribe</a>
          &nbsp;&nbsp;&middot;&nbsp;&nbsp;
          <a href="mailto:hello@lazybee.sg" style="color:${T.faint};text-decoration:none;border-bottom:1px solid ${T.line}">Contact</a>
        </p>
        <p style="margin:16px 0 0 0;font-family:${F.mono};font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:#A79C8B">&copy; 2026 Makery Pte Ltd</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

const generic = (o) => renderEmail({ ...o, variant: "generic" });
const urgent = (o) => renderEmail({ ...o, variant: "urgent" });

export { generic, urgent, escape, chip, PORTAL_BASE, T, F };
