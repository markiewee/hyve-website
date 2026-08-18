// src/lib/hiveMultilingual.test.js
//
// The four-language archive, and in particular the promise that Burmese and
// Bengali articles are reachable by URL and by nothing else.
//
// The leak tests are the point of this file. Every other behaviour here is
// recoverable by editing a component; a hidden article that turns up in a
// listing has already been crawled, linked and possibly shared before anyone
// notices, and there is no way to un-publish a thing that was never meant to be
// browsable in the first place.

// Run with: node --test src/lib/hiveMultilingual.test.js
//
// This imported `expect` from vitest until 18 Aug 2026, and vitest is not a
// dependency of this repo and never has been, so the file threw on import and
// the 54 assertions below had never run. The leak guards in particular were
// protecting nothing. Rather than rewrite every assertion into node:assert and
// risk mistranslating one, the matchers used here are shimmed onto the runner
// the other 46 test files already use.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const contains = (actual, v) =>
  typeof actual === 'string' ? actual.includes(v) : Array.from(actual).includes(v);

function matchers(actual, negated) {
  const ok = (cond, msg) => assert.ok(negated ? !cond : cond, msg);
  return {
    toBe: (v) => ok(Object.is(actual, v), `expected ${JSON.stringify(actual)} ${negated ? 'not ' : ''}to be ${JSON.stringify(v)}`),
    toEqual: (v) =>
      negated ? assert.notDeepStrictEqual(actual, v) : assert.deepStrictEqual(actual, v),
    toContain: (v) =>
      ok(contains(actual, v), `expected ${JSON.stringify(actual)} ${negated ? 'not ' : ''}to contain ${JSON.stringify(v)}`),
    toHaveLength: (n) => ok(actual.length === n, `expected length ${negated ? 'not ' : ''}${n}, got ${actual.length}`),
    toBeGreaterThan: (n) => ok(actual > n, `expected ${actual} ${negated ? 'not ' : ''}> ${n}`),
    toBeLessThan: (n) => ok(actual < n, `expected ${actual} ${negated ? 'not ' : ''}< ${n}`),
    toBeTruthy: () => ok(Boolean(actual), `expected ${JSON.stringify(actual)} ${negated ? 'not ' : ''}to be truthy`),
    toMatch: (re) => ok(re.test(String(actual)), `expected ${JSON.stringify(actual)} ${negated ? 'not ' : ''}to match ${re}`),
    toThrow: () => (negated ? assert.doesNotThrow(actual) : assert.throws(actual)),
  };
}

function expect(actual) {
  return { ...matchers(actual, false), not: matchers(actual, true) };
}
import {
  buildArchive, hiveRoutes, countWords, readingMinutes, relatedTo, neighboursOf,
  variantsOf, langFromPath, tagLabel, formatDate, TAG_LABELS,
  LANGUAGES, HIDDEN_LANGS, VISIBLE_LANGS,
} from './hiveArticles.js';

const md = (title, extra = '') => `---
title: ${title}
date: 2026-08-0${extra.includes('older') ? '1' : '5'}
excerpt: ${title} standfirst
tags: [Students, Rules]
---

Body for ${title}. ${'word '.repeat(60)}
`;

const FILES = {
  '../content/hive/en/alpha.md': md('Alpha'),
  '../content/hive/en/beta.md': md('Beta', 'older'),
  '../content/hive/zh/alpha.md': md('Alpha 中文'),
  '../content/hive/my/alpha.md': md('Alpha Burmese'),
  '../content/hive/bn/alpha.md': md('Alpha Bengali'),
  '../content/hive/bn/gamma.md': md('Gamma Bengali'),
};

const archive = buildArchive(FILES);
const routes = hiveRoutes(archive);

describe('language is the directory', () => {
  it('reads the language off the parent directory', () => {
    expect(langFromPath('../content/hive/my/foo.md')).toBe('my');
    expect(langFromPath('../content/hive/en/foo.md')).toBe('en');
  });

  it('treats a file outside a language directory as English', () => {
    expect(langFromPath('../content/hive/stray.md')).toBe('en');
  });

  it('gives English no URL prefix and everything else one', () => {
    expect(archive.byLang.en.articles[0].path).toBe('/hive/alpha');
    expect(archive.byLang.zh.articles[0].path).toBe('/hive/zh/alpha');
    expect(archive.byLang.my.articles[0].path).toBe('/hive/my/alpha');
  });
});

describe('the unlisted languages never leak', () => {
  const hiddenPaths = HIDDEN_LANGS.flatMap((c) => archive.byLang[c].articles.map((a) => a.path));

  it('has hidden articles to test with', () => {
    expect(hiddenPaths.length).toBeGreaterThan(0);
  });

  it('keeps them out of every visible listing', () => {
    for (const code of VISIBLE_LANGS) {
      for (const a of archive.byLang[code].articles) {
        expect(LANGUAGES[a.lang].hidden).toBe(false);
      }
    }
  });

  it('keeps them out of every topic hub', () => {
    for (const code of VISIBLE_LANGS) {
      for (const t of archive.byLang[code].topics) {
        for (const a of t.articles) expect(LANGUAGES[a.lang].hidden).toBe(false);
      }
    }
  });

  it('mints no index or hub route for them', () => {
    for (const code of HIDDEN_LANGS) {
      expect(routes).not.toContain(`/hive/${code}`);
      expect(routes.filter((r) => r.startsWith(`/hive/${code}/topic/`))).toHaveLength(0);
      expect(routes.filter((r) => r.startsWith(`/hive/${code}/page/`))).toHaveLength(0);
    }
  });

  it('still routes every one of them, because the sitemap is built from this', () => {
    for (const p of hiddenPaths) expect(routes).toContain(p);
  });

  it('never offers one as related reading from a visible article', () => {
    const en = archive.byLang.en.articles[0];
    for (const r of relatedTo(en, archive.all, 10)) {
      expect(LANGUAGES[r.lang].hidden).toBe(false);
    }
  });

  it('never offers one as a neighbour of a visible article', () => {
    for (const a of archive.byLang.en.articles) {
      const { newer, older } = neighboursOf(a, archive.all);
      for (const n of [newer, older].filter(Boolean)) expect(n.lang).toBe('en');
    }
  });

  it('keeps a hidden article inside its own language for related and neighbours', () => {
    const bn = archive.byLang.bn.articles[0];
    for (const r of relatedTo(bn, archive.all, 10)) expect(r.lang).toBe('bn');
    const { newer, older } = neighboursOf(bn, archive.all);
    for (const n of [newer, older].filter(Boolean)) expect(n.lang).toBe('bn');
  });
});

describe('hreflang clusters', () => {
  it('groups the four variants of one piece by filename', () => {
    const en = archive.byLang.en.articles.find((a) => a.slug === 'alpha');
    const langs = variantsOf(en, archive).map((v) => v.lang);
    expect(langs).toEqual(['en', 'zh', 'my', 'bn']);
  });

  it('is reciprocal: every variant sees the identical set', () => {
    const en = archive.byLang.en.articles.find((a) => a.slug === 'alpha');
    const expected = JSON.stringify(variantsOf(en, archive).map((v) => v.article.path));
    for (const { article } of variantsOf(en, archive)) {
      expect(JSON.stringify(variantsOf(article, archive).map((v) => v.article.path))).toBe(expected);
    }
  });

  it('leaves an untranslated article alone in its own cluster', () => {
    const beta = archive.byLang.en.articles.find((a) => a.slug === 'beta');
    expect(variantsOf(beta, archive).map((v) => v.lang)).toEqual(['en']);
  });

  it('does not invent an English variant for a hidden article that has none', () => {
    const gamma = archive.byLang.bn.articles.find((a) => a.slug === 'gamma');
    expect(variantsOf(gamma, archive).map((v) => v.lang)).toEqual(['bn']);
  });
});

describe('reserved slugs', () => {
  it('refuses an English article that would shadow a language root', () => {
    expect(() => buildArchive({ '../content/hive/en/zh.md': md('Shadow') })).toThrow(/reserved slug/);
  });

  it('allows the same slug in a different language', () => {
    expect(() => buildArchive({ '../content/hive/zh/zh.md': md('Fine') })).not.toThrow();
  });
});

describe('counting words in scripts that do not space them', () => {
  it('counts English on whitespace', () => {
    expect(countWords('one two three four five')).toBe(5);
  });

  it('counts Burmese by character, not by whitespace', () => {
    const burmese = 'စင်ကာပူတွင်ကျောင်းသားအိမ်ရာနှင့်ပတ်သက်သောအချက်အလက်များ';
    expect(countWords(burmese)).toBeGreaterThan(burmese.split(/\s+/).length);
  });

  it('counts Chinese by character, not by whitespace', () => {
    const chinese = '我们在新加坡三处房子十九个房间的日常运营记录都写在这里面了';
    expect(countWords(chinese)).toBeGreaterThan(10);
  });

  it('counts Bengali on whitespace, because Bengali spaces its words', () => {
    expect(countWords('একটি দুটি তিনটি চারটি')).toBe(4);
  });

  it('does not flip an English sentence onto a character count for one foreign name', () => {
    const mostlyEnglish = `The office is in 樟宜 and the rent is fixed. ${'word '.repeat(40)}`;
    expect(countWords(mostlyEnglish)).toBeLessThan(60);
  });

  it('never reports zero minutes for a real article', () => {
    expect(readingMinutes('short')).toBe(1);
  });
});

describe('a tag is one subject with a label per language', () => {
  const zh = archive.byLang.zh.articles[0];
  const en = archive.byLang.en.articles.find((a) => a.slug === 'alpha');
  const bn = archive.byLang.bn.articles.find((a) => a.slug === 'alpha');

  it('carries the canonical English tag in every language, so the hubs are one set', () => {
    expect(zh.tags).toEqual(en.tags);
    expect(bn.tags).toEqual(en.tags);
  });

  it('gives every language the same hub slug, which is what lets the hubs cluster', () => {
    expect(zh.tagSlugs).toEqual(en.tagSlugs);
    expect(bn.tagSlugs).toEqual(en.tagSlugs);
    expect(zh.tagSlugs.every((s) => /^[a-z0-9-]+$/.test(s))).toBe(true);
  });

  /* The bug this file exists to keep fixed: a Mandarin card printing WORK. */
  it('shows the reader a label in their own language', () => {
    expect(zh.tagLabels).toEqual(['学生', '条例']);
    expect(bn.tagLabels).toEqual(['শিক্ষার্থী', 'নিয়ম']);
    expect(en.tagLabels).toEqual(en.tags);
  });

  it('falls back to the English tag rather than rendering undefined', () => {
    expect(tagLabel('Not A Real Tag', 'zh')).toBe('Not A Real Tag');
    expect(tagLabel('Students', 'xx')).toBe('Students');
  });

  it('has a label in all four languages for every tag in the vocabulary', () => {
    for (const [tag, labels] of Object.entries(TAG_LABELS)) {
      for (const code of Object.keys(LANGUAGES)) {
        expect(labels[code], `${tag} in ${code}`).toBeTruthy();
      }
    }
  });
});

describe('subject hubs per language', () => {
  it('builds a hub set for every visible language', () => {
    for (const code of VISIBLE_LANGS) {
      expect(archive.byLang[code].topics.length).toBeGreaterThan(0);
    }
  });

  it('labels each language\'s hubs in that language', () => {
    const zhStudents = archive.byLang.zh.topics.find((t) => t.slug === 'students');
    const enStudents = archive.byLang.en.topics.find((t) => t.slug === 'students');
    expect(zhStudents.label).toBe('学生');
    expect(enStudents.label).toBe('Students');
    expect(zhStudents.slug).toBe(enStudents.slug);
  });

  /* A hub is a listing page, and a listing page is the one thing an unlisted
     language must never have. This is the same promise as the leak tests. */
  it('builds no hub for a hidden language, and mints no hub route for one', () => {
    for (const code of HIDDEN_LANGS) {
      expect(archive.byLang[code].topics).toEqual([]);
    }
    expect(routes.some((r) => /\/hive\/(my|bn)\/topic\//.test(r))).toBe(false);
  });

  it('routes the Mandarin hubs, because the sitemap is built from this', () => {
    expect(routes).toContain('/hive/zh/topic/students');
    expect(routes).toContain('/hive/topic/students');
  });
});

describe('dates are written the way each language writes them', () => {
  it('formats per language and never returns the raw ISO string', () => {
    expect(formatDate('2025-06-25', 'en')).toBe('25 Jun 2025');
    expect(formatDate('2025-06-25', 'zh')).toBe('2025年6月25日');
    for (const code of Object.keys(LANGUAGES)) {
      expect(formatDate('2025-06-25', code)).not.toBe('2025-06-25');
    }
  });

  it('keeps the machine readable date untouched on the article record', () => {
    const zh = archive.byLang.zh.articles[0];
    expect(zh.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(zh.dateLabel).not.toBe(zh.date);
  });

  it('survives a date it cannot parse', () => {
    expect(formatDate('not a date', 'zh')).toBe('not a date');
  });
});
