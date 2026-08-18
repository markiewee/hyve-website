import SEO from './SEO';
import { breadcrumbSchema } from '../lib/seo';
import FadeIn from './marketing/FadeIn';
import {
  testimonialsFor,
  quoteFor,
  aggregateRating,
  reviewSchemaFor,
} from '../data/testimonials';

/* What residents said about living here.
 *
 * Unlisted on purpose: nothing on the site links here, it is not in the nav and
 * not in the footer. It is in the sitemap and it is indexable, because being
 * read by a search engine and by the assistants people now ask for housing
 * recommendations is the entire reason it exists. Same pattern the Burmese and
 * Bengali Hive articles use, see src/lib/hiveArticles.js.
 *
 * Content comes from src/data/testimonials.js, which carries the rule about
 * what may go in it. If that file is empty this page is never prerendered and
 * never enters the sitemap, so there is no state in which it ships as a heading
 * with nothing underneath. */

const COPY = {
  en: {
    eyebrow: 'In their words',
    heading: 'What it is like to live here',
    lede:
      'Unedited, from residents who have actually held a room with us. Each one agreed to be quoted.',
    empty:
      'We are collecting these from current residents. Nothing goes on this page until the person who said it has agreed to it.',
    months: (n) => `${n} ${n === 1 ? 'month' : 'months'}`,
    crumb: 'Reviews',
  },
  zh: {
    eyebrow: '住客原话',
    heading: '在这里居住是什么感觉',
    lede: '以下内容来自真实住客，未经修改，且均已获得本人同意刊登。',
    empty: '我们正在向现住客收集评价。未经本人同意，任何内容都不会出现在此页面。',
    months: (n) => `${n} 个月`,
    crumb: '住客评价',
  },
};

export default function ReviewsPage({ lang = 'en' }) {
  const t = COPY[lang] ?? COPY.en;
  const list = testimonialsFor(lang);
  const agg = aggregateRating(lang);
  const path = lang === 'zh' ? '/zh/reviews' : '/reviews';

  /* The same builder the prerender uses, so the JSON-LD on the static page and
     the JSON-LD after a client-side navigation cannot disagree. */
  const reviewSchema = reviewSchemaFor(lang);
  const schema = [
    breadcrumbSchema([{ name: 'Home', path: '/' }, { name: t.crumb, path }]),
    ...(reviewSchema ? [reviewSchema] : []),
  ];

  return (
    <main className="bg-background text-foreground pt-24 md:pt-28">
      <SEO
        title={lang === 'zh' ? 'Lazybee 住客评价' : 'Resident reviews | Lazybee co-living Singapore'}
        description={
          lang === 'zh'
            ? 'Lazybee 新加坡共居公寓的真实住客评价，来自 Chiltern Park、Ivory Heights 与 Thomson Grove 的住客本人。'
            : 'Real reviews from people who have lived in Lazybee co-living rooms in Singapore, at Chiltern Park, Ivory Heights and Thomson Grove. In their own words, published with their consent.'
        }
        canonical={path}
        schema={schema}
      />

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <FadeIn>
          <p className="font-mono text-[11px] tracking-[0.22em] uppercase text-accent-foreground/70">
            {t.eyebrow}
          </p>
          <h1 className="mt-4 text-4xl md:text-5xl font-light tracking-tight">{t.heading}</h1>
          <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-2xl">{t.lede}</p>
          {agg && (
            <p className="mt-4 font-mono text-xs tracking-[0.14em] uppercase text-muted-foreground">
              {agg.value} / 5 &middot; {agg.count} {lang === 'zh' ? '条评价' : 'reviews'}
            </p>
          )}
        </FadeIn>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        {list.length === 0 ? (
          <p className="text-muted-foreground">{t.empty}</p>
        ) : (
          <ul className="space-y-12">
            {list.map((r) => (
              <li key={r.id} id={r.id} className="border-t border-border pt-8">
                <FadeIn>
                  <blockquote className="text-lg md:text-xl font-light leading-relaxed">
                    {quoteFor(r, lang)}
                  </blockquote>
                  <figcaption className="mt-5 font-mono text-[11px] tracking-[0.16em] uppercase text-muted-foreground">
                    {r.display} &middot; {r.property} &middot; {r.room} &middot; {t.months(r.months)}
                  </figcaption>
                </FadeIn>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
