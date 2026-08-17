// Run with: node --test src/lib/hiveArticles.test.js
//
// The claim this file exists to protect: every article in the archive is reachable
// by following links from /hive, with JavaScript off. Pagination and the topic
// hubs are the two mechanisms that make that true, and both of them are pure
// functions, so both of them are checkable here rather than in a browser.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseFrontmatter, parseArticle, buildArchive, pageOf, relatedTo, neighboursOf,
  hiveRoutes, slugify, formatDate, readingMinutes, PAGE_SIZE,
} from './hiveArticles.js';
import { renderMarkdown, markdownToText } from './markdown.js';

const CONTENT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'content', 'hive');

/* One directory per language now, so this walks a level deeper than it used to.
   Reading all of them rather than only en/ is deliberate: the frontmatter and
   no-dash checks below should hold for a Burmese article exactly as much as for
   an English one, and those are the articles nobody will browse past by
   accident. */
const realFiles = () =>
  Object.fromEntries(
    readdirSync(CONTENT, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .flatMap((d) =>
        readdirSync(join(CONTENT, d.name))
          .filter((f) => f.endsWith('.md'))
          .map((f) => [join(CONTENT, d.name, f), readFileSync(join(CONTENT, d.name, f), 'utf8')]),
      ),
  );

/** A synthetic archive of n articles, for the sizes we do not have content for yet. */
const fixture = (n) =>
  Object.fromEntries(
    Array.from({ length: n }, (_, i) => {
      const day = String(28 - (i % 28)).padStart(2, '0');
      const month = String(12 - Math.floor(i / 28)).padStart(2, '0');
      return [
        `/c/post-${String(i).padStart(3, '0')}.md`,
        `---\ntitle: Post ${i}\ndate: 2026-${month}-${day}\nexcerpt: Number ${i}.\ntags: [${i % 2 ? 'Numbers' : 'Rules'}]\n---\n\nBody of post ${i}.\n`,
      ];
    }),
  );

/* ── frontmatter ──────────────────────────────────────────────────── */

test('frontmatter reads scalars, inline lists, block lists and folded text', () => {
  const { data, body } = parseFrontmatter(
    '---\n' +
    'title: "The three month rule: in practice"\n' +
    'date: 2026-07-14\n' +
    'tags: [Rules, Tenants]\n' +
    'authors:\n  - Mark Wee\n  - Someone Else\n' +
    'excerpt: >\n  One line.\n  Two lines.\n' +
    '---\n\nBody starts here.\n',
  );
  assert.equal(data.title, 'The three month rule: in practice');
  assert.equal(data.date, '2026-07-14');
  assert.deepEqual(data.tags, ['Rules', 'Tenants']);
  assert.deepEqual(data.authors, ['Mark Wee', 'Someone Else']);
  assert.equal(data.excerpt, 'One line. Two lines.');
  assert.equal(body, 'Body starts here.');
});

test('a file with no frontmatter is still an article', () => {
  const a = parseArticle('/c/plain-post.md', 'Just prose.');
  assert.equal(a.slug, 'plain-post');
  assert.equal(a.title, 'plain-post');
  assert.deepEqual(a.tags, []);
  assert.equal(a.readingMinutes, 1);
});

test('the filename is the url unless frontmatter overrides it', () => {
  assert.equal(parseArticle('/c/a-b-c.md', '---\ntitle: T\n---\nx').path, '/hive/a-b-c');
  assert.equal(parseArticle('/c/a-b-c.md', '---\nslug: Renamed Post\n---\nx').path, '/hive/renamed-post');
});

test('slugify and formatDate', () => {
  assert.equal(slugify('Rules & Regulations'), 'rules-regulations');
  assert.equal(formatDate('2026-08-04'), '4 Aug 2026');
  assert.equal(readingMinutes('word '.repeat(400)), 2);
});

/* ── ordering and tags ────────────────────────────────────────────── */

test('the archive is newest first and stable on ties', () => {
  const { articles } = buildArchive({
    '/c/b.md': '---\ntitle: B\ndate: 2026-01-01\n---\nx',
    '/c/a.md': '---\ntitle: A\ndate: 2026-01-01\n---\nx',
    '/c/c.md': '---\ntitle: C\ndate: 2026-05-05\n---\nx',
  });
  assert.deepEqual(articles.map((a) => a.slug), ['c', 'a', 'b']);
});

test('one hub per tag, however the tag is capitalised, counted correctly', () => {
  const { topics } = buildArchive({
    '/c/a.md': '---\ntitle: A\ndate: 2026-01-02\ntags: [Rules]\n---\nx',
    '/c/b.md': '---\ntitle: B\ndate: 2026-01-01\ntags: [rules, Numbers]\n---\nx',
  });
  assert.equal(topics.length, 2);
  const rules = topics.find((t) => t.slug === 'rules');
  assert.equal(rules.articles.length, 2);
  assert.equal(rules.label, 'Rules');
});

/* ── pagination ───────────────────────────────────────────────────── */

test('pages partition the archive with no gap and no repeat', () => {
  const archive = buildArchive(fixture(127));
  assert.equal(archive.pageCount, 3);

  const seen = [];
  for (let p = 1; p <= archive.pageCount; p += 1) seen.push(...pageOf(archive.articles, p).map((a) => a.slug));

  assert.equal(seen.length, 127, 'every article appears');
  assert.equal(new Set(seen).size, 127, 'no article appears twice');
  assert.deepEqual(seen, archive.articles.map((a) => a.slug), 'in archive order');
  assert.equal(pageOf(archive.articles, 1).length, PAGE_SIZE);
  assert.equal(pageOf(archive.articles, 3).length, 27);
  assert.equal(pageOf(archive.articles, 4).length, 0, 'past the end is empty, not wrapped');
});

test('an archive smaller than a page is exactly one page', () => {
  assert.equal(buildArchive(fixture(5)).pageCount, 1);
  assert.equal(buildArchive({}).pageCount, 1);
});

/* ── the reachability claim ───────────────────────────────────────── */

test('every article is reachable from /hive by following links, with no JavaScript', () => {
  const archive = buildArchive(fixture(240));
  const routes = new Set(hiveRoutes(archive));

  /* Walk the site the way a crawler does: start at /hive, follow the numbered
     page links and the subject hub links, and collect every article link found.
     Nothing here depends on a click handler, a fetch or a load-more button. */
  const reached = new Set();
  const visit = (articles) => articles.forEach((a) => reached.add(a.path));

  for (let p = 1; p <= archive.pageCount; p += 1) {
    assert.ok(routes.has(p === 1 ? '/hive' : `/hive/page/${p}`), `page ${p} is a real url`);
    visit(pageOf(archive.articles, p));
  }
  for (const t of archive.topics) {
    assert.ok(routes.has(`/hive/topic/${t.slug}`), `hub for ${t.slug} is a real url`);
    visit(t.articles);
  }

  assert.equal(reached.size, archive.articles.length);
  for (const a of archive.articles) assert.ok(reached.has(a.path), `${a.slug} is reachable`);
});

test('the route table lists each url exactly once', () => {
  const routes = hiveRoutes(buildArchive(fixture(60)));
  assert.equal(new Set(routes).size, routes.length);
  assert.equal(routes[0], '/hive');
});

/* ── cross links ──────────────────────────────────────────────────── */

test('related reading prefers the same subject and never includes the article itself', () => {
  const { articles } = buildArchive(fixture(20));
  const a = articles[0];
  const related = relatedTo(a, articles);
  assert.equal(related.length, 3);
  assert.ok(!related.some((r) => r.slug === a.slug));
  assert.ok(related.every((r) => r.tagSlugs.some((t) => a.tagSlugs.includes(t))));
});

test('related reading still fills up when nothing shares a subject', () => {
  const { articles } = buildArchive({
    '/c/a.md': '---\ntitle: A\ndate: 2026-03-01\ntags: [Rules]\n---\nx',
    '/c/b.md': '---\ntitle: B\ndate: 2026-02-01\ntags: [Numbers]\n---\nx',
    '/c/c.md': '---\ntitle: C\ndate: 2026-01-01\ntags: [Tenants]\n---\nx',
  });
  assert.deepEqual(relatedTo(articles[0], articles).map((a) => a.slug), ['b', 'c']);
});

test('neighbours walk the archive in time', () => {
  const { articles } = buildArchive(fixture(3));
  assert.equal(neighboursOf(articles[0], articles).newer, null);
  assert.equal(neighboursOf(articles[0], articles).older.slug, articles[1].slug);
  assert.equal(neighboursOf(articles[2], articles).older, null);
});

/* ── markdown ─────────────────────────────────────────────────────── */

test('markdown renders the blocks an article uses', () => {
  const { html, headings } = renderMarkdown(
    '## A heading\n\nSome **bold** and a [link](/hive).\n\n- one\n- two\n\n' +
    '| A | B |\n| --- | --- |\n| 1 | 2 |\n\n> Quoted.\n',
  );
  assert.match(html, /<h2 id="a-heading">A heading<\/h2>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<a href="\/hive">link<\/a>/);
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.match(html, /<table class="tbl">/);
  assert.match(html, /<blockquote><p>Quoted\.<\/p><\/blockquote>/);
  assert.deepEqual(headings, [{ id: 'a-heading', text: 'A heading', level: 2 }]);
});

test('markdown never emits markup that the source asked for directly', () => {
  const { html } = renderMarkdown('<script>alert(1)</script>\n\n[x](javascript:alert(1))\n\n<img onerror=x>');
  assert.ok(!html.includes('<script>'));
  // The text "javascript:" survives, as visible text. What must not exist is an
  // anchor pointing at it, and the literal is left unlinked precisely because of that.
  assert.ok(!/<a\s[^>]*href="javascript:/i.test(html));
  assert.match(html, /\[x\]\(javascript:/);
  assert.ok(!/<img[^>]*onerror/.test(html));
  assert.match(html, /&lt;script&gt;/);
});

test('a code span is not re-read as bold or as a link', () => {
  const { html } = renderMarkdown('Use `**not bold**` and `[not a link](/x)` here.');
  assert.match(html, /<code>\*\*not bold\*\*<\/code>/);
  assert.ok(!html.includes('<strong>'));
  assert.ok(!/<a href="\/x"/.test(html));
});

test('markdownToText strips markup for meta descriptions', () => {
  assert.equal(markdownToText('## Head\n\nSome **bold** [text](/x).'), 'Head Some bold text.');
});

/* ── the real content on disk ─────────────────────────────────────── */

test('every shipped article has the frontmatter the routes depend on', () => {
  const { articles, topics } = buildArchive(realFiles());
  assert.ok(articles.length >= 4, 'there is content to serve');

  for (const a of articles) {
    assert.ok(a.title && a.title !== a.slug, `${a.slug} has a title`);
    assert.match(a.date, /^\d{4}-\d{2}-\d{2}$/, `${a.slug} has an ISO date`);
    assert.ok(a.excerpt.length > 40, `${a.slug} has an excerpt long enough to be a meta description`);
    assert.ok(a.tags.length > 0, `${a.slug} carries at least one subject`);
    assert.ok(a.body.length > 500, `${a.slug} has a body`);
    assert.ok(!/[\u2013\u2014]/.test(`${a.title} ${a.excerpt} ${a.body}`), `${a.slug} has no en or em dashes`);
  }

  assert.equal(new Set(articles.map((a) => a.slug)).size, articles.length, 'no two articles share a url');
  assert.ok(topics.length >= 3, 'the subject hubs are populated');
});
