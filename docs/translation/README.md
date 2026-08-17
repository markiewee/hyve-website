# Translating a Hive article

The blog holds four languages. English and Mandarin are listed on the site and
each has its own index. Burmese and Bengali are unlisted: real pages at real
URLs, in the sitemap and indexable, but nothing on the site links to them. See
the header of `src/lib/hiveArticles.js` for why that is an orphan page rather
than cloaking, and what it costs.

## The whole procedure

Drop a `.md` file into the language directory, **using the same filename as the
English original**:

```
src/content/hive/en/bukit-timah-clementi-student-housing.md   original
src/content/hive/zh/bukit-timah-clementi-student-housing.md   add this
src/content/hive/my/bukit-timah-clementi-student-housing.md   and this
src/content/hive/bn/bukit-timah-clementi-student-housing.md   and this
```

That is it. The matching filename is what forms the hreflang cluster, so the
four variants find each other with nothing to declare and nothing to keep in
sync. The URL follows from the directory: `/hive/<slug>`, `/hive/zh/<slug>`,
`/hive/my/<slug>`, `/hive/bn/<slug>`.

If a translated file genuinely cannot share its original's filename, set
`translationKey:` in its frontmatter to the English filename stem instead.

## What to translate, and what to copy

| field | do |
|---|---|
| `title` | translate |
| `excerpt` | translate, it is the meta description and the card text |
| `heroAlt` | translate |
| body prose | translate |
| image alt text | **look it up**, see below |
| `date` | **copy the English date exactly** |
| `tags` | **copy the English tags exactly** |
| `hero` | **copy the English path exactly** |
| body image paths | **copy the English paths exactly** |

A translation is the same piece of writing as its original, so it carries the
same date, the same tags and the same pictures. Re-picking images per language
would leave one article looking like a different article depending on which URL
you landed on. Re-dating it would break the archive's sort order, because the
date decides where an article sits on `/hive`.

## Image captions

`hive-image-captions.json` holds a written caption for all 113 sketches in
`public/sketches/`, in all four languages:

```json
"loc-neighbourhood__bukit-timah__leafy-road": {
  "en": "A leafy road in Bukit Timah",
  "zh": "武吉知马一条绿树成荫的马路",
  "my": "Bukit Timah ရှိ သစ်ပင်စိမ်းစိုသော လမ်းတစ်လမ်း",
  "bn": "Bukit Timah-র গাছে ঘেরা একটি রাস্তা"
}
```

Look the caption up rather than translating it inline. The same 113 drawings
recur across the whole archive, and translating a caption per article would
produce a hundred slightly different descriptions of one identical picture.

The hero's alt may append the article's subject after the caption. Body image
alts should not: repeating the subject on all four images of a page is keyword
stuffing, and it is the hero that carries the page in image search.

## Two things the build will catch

**Word counts.** The prerender fails any page under 50 words. Burmese and
Chinese do not put spaces between words, so `countWords()` in
`src/lib/hiveArticles.js` switches to a per-script character count. Bengali
spaces its words normally and needs no special case. If a Burmese article
fails as thin content, check the script detection before shortening the article.

**Reserved slugs.** An English article can never be slugged `zh`, `my`, `bn`,
`page` or `topic`, because each already names a route. The build throws rather
than let one silently never render. Translations are exempt: `zh/zh.md` is fine.

## Checking it

```
npm run build
```

The prerender prints one line per route with its word count, `h1` count, link
count and canonical, and fails the build on a missing `h1`, a wrong canonical,
no links, or thin content. The summary line reports the per-language split:

```
dist/sitemap.xml regenerated with 141 urls (en:137 zh:2 my:1 bn:1)
```

Two test suites cover the rules that matter. The important ones assert that no
visible page links to an unlisted article, and that hreflang is reciprocal
across every variant of every article, because Google discards a cluster whose
members do not all point at each other.

```
node --test src/lib/hiveArticles.test.js
npx vitest run src/lib/hiveMultilingual.test.js
```
