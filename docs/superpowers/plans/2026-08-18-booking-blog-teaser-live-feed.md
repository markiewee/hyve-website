# Booking Site Blog Teaser, Live and Language-Aware

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The "From the blog" section on book.lazybee.sg shows three real, current articles from the live blog, in the reader's language, and stops linking to pages that do not exist.

**Architecture:** Two repos. `hyve-website` (the blog, Vite + prerender) gains a per-language JSON index at `/hive/articles.json`, written by the same prerender step that already writes `sitemap.xml` and `feed.xml`, so it can never drift from what actually shipped. `hyve-booking` (Next.js 16, the booking site) fetches that file server-side in `app/page.tsx` with an hour of ISR cache, picks the reader's language, and passes three articles into `HiveTeaser` as props. `HiveTeaser` stops carrying hardcoded content.

**Tech Stack:** Node (prerender script), Next.js 16 App Router server components, `fetch` with `next.revalidate`.

**The bug being fixed:** `components/HiveTeaser.tsx` in hyve-booking holds three hardcoded articles with slugs `what-a-room-actually-costs`, `why-three-months-not-twelve` and `three-homes-nineteen-rooms`. None of those exist on the live blog: all three URLs serve the SPA fallback with the generic title "Lazybee: managed co-living in Singapore" rather than an article. The file's own comment says these were placeholders to be swapped "when hyve-website ships The Hive". It shipped (137 English articles live), the swap never happened. Separately the component points at `https://lazybee.sg/hive`, which 307s to the www host on every click.

**Language behaviour:** the booking site supports `en` and `zh` (`lib/lang.ts`, `tFor` in `lib/dict.ts`). The live blog currently has 137 English articles and 2 Chinese ones, with the 206-article Mandarin translation still in flight. So the teaser takes up to three from the reader's language and tops up with English if that language has fewer than three. A Chinese reader sees Chinese articles first today, and three Chinese articles automatically once the translations land, with no further code change.

**Branches:** `feat/hive-articles-json` in hyve-website, `fix/blog-teaser-live-feed` in hyve-booking. The website change must merge and deploy first, because the booking change fetches the file it creates.

---

## Part A: hyve-website emits the per-language index

### Task 1: Write `/hive/articles.json` in the prerender step

**Files:**
- Modify: `scripts/prerender.mjs` (after the `writeFileSync(join(DIST, 'feed.xml'), rss);` line, near the end)

- [ ] **Step 1: Add the JSON writer**

Insert immediately after the `feed.xml` write:

```js
/* A small per-language index of the archive, for other Lazybee surfaces to read.
   book.lazybee.sg renders three of these on its home page and used to carry its
   own hardcoded copies, which silently went stale and ended up pointing at slugs
   that were never published. Generated here, from the same route list the pages
   and the sitemap come from, so it cannot describe an article that does not exist.

   Grouped by language rather than filtered to English like feed.xml, because the
   consumer needs to show a reader the language they are reading in. */
const articlesByLang = {};
for (const r of HIVE_ROUTES) {
  const meta = ALL_ROUTE_META[r];
  if (!meta) continue;
  const article = (meta.schema?.() || []).find((s) => s['@type'] === 'BlogPosting');
  if (!article) continue;
  const lang = meta.lang || 'en';
  (articlesByLang[lang] ||= []).push({
    path: r,
    url: `${BASE_URL}${r}`,
    lang,
    title: article.headline || meta.title,
    excerpt: meta.description || '',
    date: article.datePublished || meta.lastmod || '',
    tags: String(article.keywords || '').split(',').map((t) => t.trim()).filter(Boolean),
  });
}
for (const lang of Object.keys(articlesByLang)) {
  articlesByLang[lang].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
mkdirSync(join(DIST, 'hive'), { recursive: true });
writeFileSync(
  join(DIST, 'hive', 'articles.json'),
  JSON.stringify({ generated: buildStamp, base: BASE_URL, languages: articlesByLang }, null, 2),
);
console.log(
  `  dist/hive/articles.json written (${Object.entries(articlesByLang)
    .map(([l, a]) => `${l}:${a.length}`)
    .join(' ')})`,
);
```

Two things to check while editing, because the surrounding script already has them and the names must match rather than be re-declared: `mkdirSync` must be in the `node:fs` import at the top of the file (add it to the existing import if absent), and `buildStamp` is whatever the script already uses for the sitemap's `lastmod` timestamp. If no such constant exists, use `new Date().toISOString().slice(0, 10)` inline instead and do not introduce a new global.

- [ ] **Step 2: Build and verify the file**

```bash
cd /Users/mark/Desktop/hyve-website
npm run build 2>&1 | tail -5
python3 - <<'PY'
import json
d = json.load(open('dist/hive/articles.json'))
langs = d['languages']
print('languages:', {k: len(v) for k, v in langs.items()})
en = langs['en'][0]
print('newest en:', en['title'][:60], '|', en['path'])
assert en['path'].startswith('/hive/'), en['path']
assert en['title'] and en['excerpt'], 'title/excerpt must be non-empty'
assert 'zh' in langs and langs['zh'], 'zh must be present'
print('newest zh:', langs['zh'][0]['title'][:40], '|', langs['zh'][0]['path'])
assert all(a['path'].startswith('/hive/zh/') for a in langs['zh']), 'zh paths must be under /hive/zh/'
print('OK')
PY
```

Expected: a language count line, a real English title and path, a real Chinese title under `/hive/zh/`, then `OK`.

- [ ] **Step 3: Confirm every listed path is a page that was actually prerendered**

```bash
python3 - <<'PY'
import json, os
d = json.load(open('dist/hive/articles.json'))
missing = [a['path'] for v in d['languages'].values() for a in v
           if not os.path.exists('dist' + a['path'] + '/index.html')]
print('missing pages:', missing)
assert not missing
print('OK: every article in the index has a prerendered page')
PY
```

Expected: `missing pages: []` then `OK`.

- [ ] **Step 4: Lint and commit**

```bash
npm run lint 2>&1 | grep -oE "✖ [0-9]+ problems"
git add scripts/prerender.mjs
git commit -m "feat: per-language article index at /hive/articles.json"
```

Lint count must equal the count on `master` (242 problems at time of writing). If it went up, fix what you added.

- [ ] **Step 5: Push, PR, merge, and confirm the file is live**

```bash
git push -u origin feat/hive-articles-json
gh pr create --base master --title "A per-language article index for other Lazybee surfaces" --body "(body from the approved draft)"
```

After CI is green and the PR is merged, wait for the production deploy, then:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://www.lazybee.sg/hive/articles.json
curl -s https://www.lazybee.sg/hive/articles.json | python3 -c "import json,sys; d=json.load(sys.stdin); print({k: len(v) for k, v in d['languages'].items()})"
```

Expected: `200`, then the per-language counts. **Do not start Part B until this returns 200**, because the booking site fetches this exact URL.

---

## Part B: hyve-booking renders the live feed

### Task 2: A typed reader for the index

**Files:**
- Create: `lib/articles.ts`

- [ ] **Step 1: Write the module**

```ts
import type { Lang } from "./lang";

/** One article, as published on lazybee.sg. */
export type Article = {
  path: string;
  url: string;
  lang: string;
  title: string;
  excerpt: string;
  date: string;
  tags: string[];
};

/** Where the blog publishes its per-language index. Written by the prerender
    step in the hyve-website repo, so it always matches what actually shipped. */
const INDEX_URL = "https://www.lazybee.sg/hive/articles.json";

/**
 * The three articles to show a reader, in their language.
 *
 * Topped up with English when the requested language has fewer than three, which
 * is the state Chinese is in while the archive is being translated: a Chinese
 * reader sees the Chinese pieces first and the row still fills. Once the
 * translations land this returns three Chinese articles on its own.
 *
 * Returns an empty array if the index cannot be read. The caller renders nothing
 * rather than showing links we cannot vouch for, which is the bug this replaces:
 * three hardcoded slugs that were never published.
 */
export async function getTeaserArticles(lang: Lang, count = 3): Promise<Article[]> {
  let languages: Record<string, Article[]>;
  try {
    const res = await fetch(INDEX_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    languages = (await res.json()).languages ?? {};
  } catch {
    return [];
  }
  const picked = [...(languages[lang] ?? [])].slice(0, count);
  if (picked.length < count) {
    const seen = new Set(picked.map((a) => a.path));
    for (const a of languages.en ?? []) {
      if (picked.length >= count) break;
      if (!seen.has(a.path)) picked.push(a);
    }
  }
  return picked;
}
```

- [ ] **Step 2: Write the failing test**

Create `lib/articles.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { getTeaserArticles } from "./articles";

const article = (path: string, lang: string) => ({
  path, url: `https://www.lazybee.sg${path}`, lang,
  title: `title ${path}`, excerpt: "excerpt", date: "2026-08-01", tags: ["Money"],
});

const mockIndex = (languages: Record<string, unknown[]>) => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ languages }) })));
};

afterEach(() => vi.unstubAllGlobals());

describe("getTeaserArticles", () => {
  it("returns three articles in the requested language when it has enough", async () => {
    mockIndex({
      zh: [article("/hive/zh/a", "zh"), article("/hive/zh/b", "zh"), article("/hive/zh/c", "zh")],
      en: [article("/hive/x", "en")],
    });
    const out = await getTeaserArticles("zh");
    expect(out.map((a) => a.path)).toEqual(["/hive/zh/a", "/hive/zh/b", "/hive/zh/c"]);
  });

  it("tops up with English when the language has too few", async () => {
    mockIndex({
      zh: [article("/hive/zh/a", "zh")],
      en: [article("/hive/x", "en"), article("/hive/y", "en")],
    });
    const out = await getTeaserArticles("zh");
    expect(out.map((a) => a.path)).toEqual(["/hive/zh/a", "/hive/x", "/hive/y"]);
  });

  it("returns nothing when the index cannot be read", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await getTeaserArticles("en")).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
cd /Users/mark/Desktop/hyve-booking
npx vitest run lib/articles.test.ts
```

Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add lib/articles.ts lib/articles.test.ts
git commit -m "feat: read the blog's per-language article index"
```

### Task 3: HiveTeaser renders what it is given

**Files:**
- Modify: `components/HiveTeaser.tsx`
- Modify: `app/page.tsx:50`

- [ ] **Step 1: Rewrite HiveTeaser to take articles as props**

Replace the whole file with:

```tsx
"use client";
import { useT } from "./LangProvider";
import type { Article } from "@/lib/articles";

/** Where the blog lives. The www host on purpose: the bare domain 307s to it. */
export const HIVE_INDEX_URL = "https://www.lazybee.sg/hive";

/**
 * A short reading block above the footer: three pieces, then the way in.
 *
 * The articles are passed in, fetched from the blog's own per-language index in
 * app/page.tsx. This component used to carry three hardcoded articles instead,
 * left behind as placeholders before the blog shipped. They were never updated,
 * and all three slugs pointed at pages that do not exist. Nothing here should
 * ever hardcode an article again.
 */
export default function HiveTeaser({ articles }: { articles: Article[] }) {
  const t = useT();
  if (!articles.length) return null;

  const topics = Array.from(new Set(articles.map((a) => a.tags[0]).filter(Boolean)));

  return (
    <section className="border-t border-line px-[clamp(20px,4vw,58px)] py-[clamp(52px,7vw,96px)]">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <p className="lb-label">{t("hive.fromThe")}</p>
            <h2 className="lb-h1 mt-3">{t("hive.worthKnowing")}</h2>
          </div>
          <a href={HIVE_INDEX_URL} className="lb-btn lb-btn-ghost">
            {t("hive.readTheHive")}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </a>
        </div>

        <div className="lb-hivegrid mt-9">
          {articles.map((a) => (
            <a key={a.path} href={a.url} className="lb-hivecard" lang={a.lang}>
              {a.tags[0] && <span className="tag">{a.tags[0]}</span>}
              <span className="ttl">{a.title}</span>
              <span className="ex">{a.excerpt}</span>
              <span className="go">{t("hive.read")}</span>
            </a>
          ))}
        </div>

        {topics.length > 0 && (
          <p className="lb-fine mt-6">
            {t("hive.topics")}{" "}
            {topics.map((tag, i) => (
              <span key={tag}>
                {i > 0 && " · "}
                <span className="text-[var(--accent-text)]">{tag}</span>
              </span>
            ))}
          </p>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Feed it from the page**

In `app/page.tsx`, add the import beside the existing ones:

```tsx
import { getTeaserArticles } from "@/lib/articles";
```

The page is already an async server component that calls `getLang()`. Beside that call, add:

```tsx
  const teaserArticles = await getTeaserArticles(lang);
```

(If the local variable holding the language is not named `lang`, use whatever name the file already uses rather than renaming it.)

Then change line 50 from `<HiveTeaser />` to:

```tsx
      <HiveTeaser articles={teaserArticles} />
```

- [ ] **Step 3: Remove the dead dictionary entries**

In `lib/dict.ts`, delete these keys from both the `en` and `zh` maps, since no code reads them once the teaser takes props. Leave `hive.fromThe`, `hive.read`, `hive.worthKnowing`, `hive.readTheHive` and `hive.topics`, which the component still uses.

```
hive.homes, hive.homesBody, hive.cost, hive.costBody,
hive.threeMonths, hive.threeMonthsBody,
hive.tagMoney, hive.tagLeases, hive.tagHomes
```

Verify nothing else references them before deleting:

```bash
grep -rn "hive.homes\|hive.cost\|hive.threeMonths\|hive.tagMoney\|hive.tagLeases\|hive.tagHomes" app/ components/ lib/ --include="*.tsx" --include="*.ts" | grep -v dict.ts
```

Expected: no output. If anything prints, keep those keys and stop to reassess.

- [ ] **Step 4: Typecheck, lint, test, build**

```bash
cd /Users/mark/Desktop/hyve-booking
npx tsc --noEmit
npm run lint
npx vitest run
npm run build 2>&1 | tail -5
```

Expected: no type errors, lint no worse than `main`, all tests pass, build succeeds.

- [ ] **Step 5: See it in the browser, both languages**

```bash
npm run dev
```

Open the printed URL. The section must show three real article titles that match the top of `https://www.lazybee.sg/hive`. Click one and confirm it opens a real article, not the generic Lazybee home page. Then switch the site to 中文 with the language control and confirm the Chinese article or articles appear first, with English filling the remaining slots. Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add components/HiveTeaser.tsx app/page.tsx lib/dict.ts
git commit -m "fix: blog teaser reads the live archive instead of three dead slugs"
```

### Task 4: Ship it

- [ ] **Step 1: Push and open the PR**

```bash
git push -u origin fix/blog-teaser-live-feed
gh pr create --base main --title "Blog teaser: real articles, in the reader's language" --body "(body from the approved draft)"
```

- [ ] **Step 2: After CI is green, merge and verify production**

```bash
gh pr merge --squash --delete-branch
```

Then, once deployed:

```bash
curl -s https://book.lazybee.sg | grep -c "what-a-room-actually-costs"
curl -s https://book.lazybee.sg | grep -oE 'href="https://www\.lazybee\.sg/hive/[^"]*"' | head -5
```

Expected: `0` for the dead slug, and three links to real article URLs. Open each one and confirm it serves an article rather than the generic home page.
