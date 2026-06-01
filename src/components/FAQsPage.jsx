import SEO from './SEO';
import { faqPageSchema, breadcrumbSchema } from '../lib/seo';
import FadeIn from './marketing/FadeIn';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from './ui/accordion';

const FAQS = [
  {
    q: 'How does the Lazybee master lease work?',
    a: 'We lease your whole unit on a 12–24 month agreement and pay you a fixed monthly rent. We then furnish it and run it as managed co-living. You get one guaranteed payment — no tenants to chase, no void periods.',
  },
  {
    q: 'Will I really earn more than renting it out normally?',
    a: 'Typically around 10% above open-market whole-unit rent, plus you save agent commission and lose nothing to vacancy. Enter your postal code in the estimator on the home page for a figure on your specific unit.',
  },
  {
    q: 'Who handles furnishing, tenants and maintenance?',
    a: 'We do — entirely, at our cost. Furnishing and fit-out, photography, marketing, tenant screening, rent collection, cleaning and repairs all sit with Lazybee. You are completely hands-off.',
  },
  {
    q: 'What condition does my unit need to be in?',
    a: 'Vacant possession is all we need. Unfurnished or part-furnished are both fine — we fit out every unit to the same standard ourselves.',
  },
  {
    q: 'What are the lease terms?',
    a: 'Typically 12 to 24 months with a standard notice clause. Longer terms unlock better rates for you and let us invest more into the unit.',
  },
  {
    q: 'How is my property protected?',
    a: 'A security deposit, a move-in condition report, landlord-friendly insurance, and regular checks by our in-house captains. Every unit is run to a single operating SOP, so it comes back in the condition it went out.',
  },
  {
    q: 'Can I invest instead of leasing my unit?',
    a: 'Yes. Alongside landlords, we work with capital partners backing the portfolio. Request the deck and we will share financials and pipeline under NDA.',
  },
  {
    q: 'How do I get an offer?',
    a: 'Send us your unit details or postal code, we arrange a quick viewing, and we come back with a guaranteed monthly offer — usually within the week. WhatsApp +65 8069 5410.',
  },
];

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
          Frequently asked questions
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
              <AccordionContent className="text-foreground-variant">
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
