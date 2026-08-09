import SEO from './SEO';
import { faqPageSchema, breadcrumbSchema } from '../lib/seo';
import { FAQ_PAGE_QUESTIONS } from '../lib/siteMeta';
import FadeIn from './marketing/FadeIn';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from './ui/accordion';

/* The questions live in src/lib/siteMeta.js, which is also what the prerender step
   reads to build this page's FAQPage structured data. One array, so the answers a
   visitor reads and the answers we hand to Google and the AI crawlers are the same
   strings. A schema whose answers are not on the page is a violation, and the way
   that happens is two copies of the copy drifting apart. */
const FAQS = FAQ_PAGE_QUESTIONS;

const FAQsPage = () => (
  <main className="bg-background text-foreground pt-24 md:pt-28">
    <SEO
      title="Lazybee for landlords & investors — FAQs"
      description="How Lazybee's managed co-living master lease works for landlords and investors — what we pay, lease terms, who manages tenants, and how to get an offer."
      canonical="/faqs"
      schema={[faqPageSchema(FAQS), breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'FAQs', path: '/faqs' }])]}
    />

    {/* Header */}
    <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
      <FadeIn>
        <span className="block text-[11px] uppercase tracking-[0.4em] font-semibold text-accent mb-6">Landlords &amp; investors</span>
        <h1 className="font-display tracking-display text-4xl md:text-5xl text-foreground mb-4">
          Landlord and investor FAQs
        </h1>
        <p className="text-foreground-variant text-lg">
          How the managed master lease works, what we pay, and how to get a guaranteed offer on your unit.
        </p>
      </FadeIn>
    </section>

    {/* Accordion */}
    <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
      <FadeIn>
        <Accordion type="single" collapsible className="w-full">
          {FAQS.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border-border">
              <AccordionTrigger className="font-display text-left text-foreground hover:text-accent">
                {f.q}
              </AccordionTrigger>
              {/* forceMount keeps every answer in the HTML instead of mounting it
                  on click. Radix still hides a closed panel, so nothing changes on
                  screen, but the answers are now in the raw markup a crawler reads.
                  That is the whole point of this page: without it the server-rendered
                  HTML carried eight questions and no answers, which is both thin
                  content and an FAQPage schema whose answers are nowhere on the page. */}
              <AccordionContent forceMount className="text-foreground-variant">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </FadeIn>
    </section>

    {/* Close: landlord / investor ask */}
    <section className="px-6 pb-28 md:pb-40">
      <FadeIn className="max-w-3xl mx-auto text-center rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-10 md:p-14">
        <h2 className="font-display tracking-display text-3xl md:text-4xl font-bold mb-4">Still have a question?</h2>
        <p className="text-foreground-variant mb-8 max-w-xl mx-auto">
          Tell us about your unit and we'll come back with a guaranteed offer — or request the deck for the full picture.
        </p>
        <a
          href="/contact"
          className="inline-flex items-center gap-3 rounded-full bg-accent text-accent-foreground px-10 py-4 font-semibold text-xs uppercase tracking-[0.3em] hover:opacity-90 active:scale-95 transition-all"
        >
          Talk to us <span aria-hidden>→</span>
        </a>
      </FadeIn>
    </section>
  </main>
);

export default FAQsPage;
