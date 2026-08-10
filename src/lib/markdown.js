// src/lib/markdown.js
//
// A small markdown to HTML renderer, covering the subset an article in The Hive
// actually uses: headings, paragraphs, lists, blockquotes, tables, fenced code,
// images, rules, and the usual inline marks.
//
// Why not a library. Three reasons, in order of weight:
//
//   1. Every character of input is escaped before anything else happens, and raw
//      HTML in the source is rendered as text rather than executed. A markdown
//      article is content, not a template, so there is no reason to hand it the
//      ability to inject script into the page.
//   2. Adding marked or remark to a marketing site to render five files is a
//      dependency, a bundle, and a supply chain, for something this size.
//   3. The headings need stable anchor ids and the tables need the design
//      system's own classes, which a general renderer has to be configured into
//      anyway.
//
// Anything outside the subset degrades to a paragraph of visible text rather
// than to markup, which is the safe direction to fail in.

import { slugify } from './hiveArticles.js';

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/* Placeholder for a lifted-out code span. A private use area character, so it can
   never collide with anything a person could type into an article. */
const SENTINEL = '\uE000';
const CODE_SLOT = /\uE000(\d+)\uE000/g;

/**
 * Inline marks, applied to text that is already HTML-escaped.
 *
 * Code spans are lifted out first and put back last, so that backticked text is
 * never re-read as bold or as a link. That is the one ordering bug every naive
 * inline pass has.
 */
function inline(text) {
  const codes = [];
  let s = String(text).replace(/`([^`]+)`/g, (_m, c) => {
    codes.push(c);
    return `${SENTINEL}${codes.length - 1}${SENTINEL}`;
  });

  // Links. Only http(s), mailto, tel and site-relative targets are allowed
  // through; anything else (javascript:, data:) renders as plain text.
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
    const safe = /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(href);
    if (!safe) return m;
    const external = /^https?:\/\//i.test(href);
    const rel = external ? ' rel="noopener" target="_blank"' : '';
    return `<a href="${href}"${rel}>${label}</a>`;
  });

  s = s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>');

  return s.replace(CODE_SLOT, (_m, i) => `<code>${codes[Number(i)]}</code>`);
}

/* A line that starts a new block, so a paragraph or a list item knows to stop
   swallowing lines. Kept in one place because the paragraph loop and the list
   continuation loop must agree, and they silently would not if duplicated. */
const BLOCK_START = /^(#{2,4}\s|>|```|!\[|\s*[-*+]\s|\s*\d+[.)]\s|(\*{3,}|-{3,}|_{3,})\s*$)/;

const cell = (c) => `<td>${inline(esc(c.trim()))}</td>`;
const headCell = (c) => `<th>${inline(esc(c.trim()))}</th>`;
const splitRow = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');

/**
 * Render a markdown body to an HTML string.
 *
 * The output is meant for dangerouslySetInnerHTML, which is safe here precisely
 * because escaping happens before any markup is produced: nothing in the source
 * can become a tag that this function did not decide to emit.
 *
 * @param {string} md
 * @returns {{html: string, headings: {id: string, text: string, level: number}[]}}
 */
export function renderMarkdown(md) {
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const headings = [];
  const seen = new Map();
  let i = 0;

  const anchor = (text) => {
    const base = slugify(text) || 'section';
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i += 1; continue; }

    // fenced code
    if (/^```/.test(line.trim())) {
      const buf = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i].trim())) { buf.push(lines[i]); i += 1; }
      i += 1;
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // horizontal rule
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) { out.push('<hr />'); i += 1; continue; }

    // heading
    const h = line.match(/^(#{2,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = esc(h[2].trim());
      const id = anchor(h[2].trim());
      headings.push({ id, text, level });
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i += 1;
      continue;
    }

    // standalone image becomes a figure
    const img = line.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)\)(?:\s*"([^"]*)")?$/);
    if (img) {
      const caption = img[3] ? `<figcaption>${inline(esc(img[3]))}</figcaption>` : '';
      out.push(`<figure><img src="${esc(img[2])}" alt="${esc(img[1])}" loading="lazy" />${caption}</figure>`);
      i += 1;
      continue;
    }

    // table: a header row, a divider of dashes, then body rows
    if (line.includes('|') && /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1] || '')) {
      const head = splitRow(line).map(headCell).join('');
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(`<tr>${splitRow(lines[i]).map(cell).join('')}</tr>`);
        i += 1;
      }
      out.push(
        `<div class="tblwrap"><table class="tbl"><thead><tr>${head}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`,
      );
      continue;
    }

    // blockquote
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i += 1; }
      out.push(`<blockquote><p>${inline(esc(buf.join(' ')))}</p></blockquote>`);
      continue;
    }

    // lists, ordered and not
    const ordered = /^\s*\d+[.)]\s+/.test(line);
    if (ordered || /^\s*[-*+]\s+/.test(line)) {
      const items = [];
      const marker = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/;
      while (i < lines.length && marker.test(lines[i])) {
        let text = lines[i].replace(marker, '');
        i += 1;
        // a wrapped continuation line belongs to the item above it
        while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) {
          text += ` ${lines[i].trim()}`;
          i += 1;
        }
        items.push(`<li>${inline(esc(text))}</li>`);
      }
      out.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
      continue;
    }

    // paragraph: everything until a blank line or the start of another block
    const buf = [];
    while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) {
      buf.push(lines[i].trim());
      i += 1;
    }
    if (buf.length) out.push(`<p>${inline(esc(buf.join(' ')))}</p>`);
  }

  return { html: out.join('\n'), headings };
}

/** Plain text, for meta descriptions and for anything that must not carry markup. */
export function markdownToText(md) {
  return String(md)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
