# PRD: Four-language Hive, two visible and two search-only

Status: approved for build, 18 Aug 2026
Owner: Mark Wee

## Problem

Articles are being produced in English, Mandarin, Burmese and Bengali. The site
offers two languages in its header, EN and 中文. Today the blog is single
language: one folder, one index, one set of URLs, and `inLanguage: 'en-SG'`
hardcoded into every Article schema.

Two different jobs are being asked of the four languages.

1. **EN and ZH are audience facing.** A visitor reading in English sees English
   articles only. A visitor reading in Mandarin sees Mandarin articles only.
   The two sets never mix in a listing.

2. **MY and BN are search acquisition only.** They exist at real URLs so Google
   can index them and send a Burmese or Bengali searcher straight to the page.
   Nobody browsing lazybee.sg can reach or discover them by clicking.

## What this is and is not

This is **not cloaking**. Cloaking means serving different content to Googlebot
than to a human at the same URL, and it is a policy violation that gets sites
deindexed. Every MY and BN URL here returns identical bytes to everyone who
requests it. They are simply not linked from the site's navigation or listings.

That pattern is an **orphan page**, and it is legitimate and ordinary. Campaign
landing pages work the same way.

The real cost of orphan pages is that they receive no internal link equity and
are discoverable only through the sitemap, so they get crawled less often and
rank weaker than a linked page would. Two things offset that here, and both are
load bearing rather than decorative:

- reciprocal hreflang binding each MY and BN page to its English counterpart,
  which does carry internal links and authority;
- MY and BN articles linking to each other **within their own language**, so
  each hidden set is an internally connected island rather than N isolated
  pages with no inbound links at all.

## URL scheme

|          | Index                        | Article            |
|----------|------------------------------|--------------------|
| English  | `/hive`, `/hive/page/N`      | `/hive/<slug>`     |
| Mandarin | `/hive/zh`, `/hive/zh/page/N`| `/hive/zh/<slug>`  |
| Burmese  | none                         | `/hive/my/<slug>`  |
| Bengali  | none                         | `/hive/bn/<slug>`  |

Existing English URLs do not change, so there are no redirects and no lost link
equity.

`zh`, `my`, `bn`, `page` and `topic` become reserved slugs. The build fails if
an English article claims one, because `/hive/zh` as an article would shadow the
Mandarin index.

## Content layout

```
src/content/hive/en/*.md     the five existing files move here, URLs unchanged
src/content/hive/zh/*.md
src/content/hive/my/*.md
src/content/hive/bn/*.md
```

Language comes from the directory. There is nothing to declare in frontmatter
and nothing to keep in sync.

Translations are grouped by filename stem, so `bukit-timah.md` in `en/` and in
`my/` are understood to be the same article and hreflang to each other. An
optional `translationKey:` in frontmatter overrides that when a translated file
needs a different filename.

Slugs stay Latin in all four languages. A Burmese script slug percent encodes
into an unreadable URL and buys nothing in ranking.

## Visibility rules

Hidden languages (`my`, `bn`) are **excluded** from: every index and paginated
listing, every topic hub, related reading blocks, previous and next neighbours,
the RSS feed, the language switcher, and site navigation.

They are **included** in: `sitemap.xml`, prerendered static HTML, hreflang
clusters, and internal links from other articles in the same hidden language.

They are never `noindex` and never disallowed in `robots.txt`. Either one would
defeat the entire purpose of writing them.

## hreflang

Every article variant carries the full reciprocal set, including a self
reference and an `x-default` pointing at English:

```html
<link rel="alternate" hreflang="en"        href="https://www.lazybee.sg/hive/foo" />
<link rel="alternate" hreflang="zh-Hans"   href="https://www.lazybee.sg/hive/zh/foo" />
<link rel="alternate" hreflang="my"        href="https://www.lazybee.sg/hive/my/foo" />
<link rel="alternate" hreflang="bn"        href="https://www.lazybee.sg/hive/bn/foo" />
<link rel="alternate" hreflang="x-default" href="https://www.lazybee.sg/hive/foo" />
```

Google ignores a non reciprocal hreflang cluster wholesale, so this is generated
from a single source and asserted in the build rather than hand maintained.

## Sitemap

All four languages listed as `<loc>` entries. This is the only discovery path MY
and BN have, which makes it the single most important line item in this
document. Each entry also carries `xhtml:link` hreflang alternates, which is
Google's own recommended way to declare clusters for pages that are not
internally linked.

## Per page language correctness

- `<html lang>` per route: `en`, `zh-Hans`, `my`, `bn`
- `og:locale` per route, replacing the hardcoded `en_SG`
- `inLanguage` in the Article JSON-LD per route, replacing the hardcoded `en-SG`
- RSS stays English only

## Burmese word counting

The prerender audit fails any page under 50 words, and reading time is computed
by splitting on whitespace. Burmese does not put spaces between words, so a full
Burmese article counts as a handful of "words" and would fail the build.

Both the audit threshold and the reading time estimate switch to a character
based measure when the text contains Myanmar block codepoints. Bengali uses
spaces normally and needs no special case.

## Language switch behaviour

On Hive pages the EN / 中文 control becomes a link rather than a state toggle: it
navigates to the counterpart URL, so a language change is a real page at a real
URL that Google can crawl. When the counterpart article does not exist it falls
back to that language's index. It never offers MY or BN.

## Out of scope for v1

Chinese topic hubs. `slugify()` strips all non ASCII, so a Chinese tag produces
an empty slug and every Chinese tag would collide on one broken URL. Mandarin
gets index, pagination and articles; hubs land once tag slugs handle CJK.

## Acceptance

1. `/hive` lists English only. `/hive/zh` lists Mandarin only. Neither shows MY
   or BN.
2. No path of clicks from any page on the site reaches a MY or BN article.
3. `curl` on a MY or BN URL returns full prerendered content, HTTP 200, with no
   `noindex`.
4. `sitemap.xml` contains every English, Mandarin, Burmese and Bengali article.
5. hreflang is reciprocal across every present variant of every article.
6. `npm run build` passes its own audit for all four languages.
