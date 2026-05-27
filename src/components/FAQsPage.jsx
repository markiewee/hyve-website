import SEO from './SEO';
import { faqPageSchema, breadcrumbSchema } from '../lib/seo';
import FadeIn from './marketing/FadeIn';
import CtaBand from './marketing/CtaBand';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from './ui/accordion';

const FAQS = [
  {
    q: 'What is the cheapest co-living in Singapore?',
    a: 'Lazybee offers all-inclusive rooms from S$950/month — rent, utilities, WiFi and weekly cleaning of shared spaces.',
  },
  {
    q: 'How does co-living work at Lazybee?',
    a: 'You rent a private furnished room in a shared apartment. Kitchen, living room and bathrooms are shared. All bills are one monthly payment. Minimum stay is 3 months.',
  },
  {
    q: 'Are there agent fees?',
    a: 'No. Lazybee charges zero agent fees — you deal directly with us.',
  },
  {
    q: "Where are Lazybee's rooms located?",
    a: "In Lentor, Jurong East and Serangoon — all within about 10 minutes' walk of an MRT station.",
  },
  {
    q: 'What is the minimum lease?',
    a: 'Three months. There is no 12-month lock-in.',
  },
  {
    q: 'Can couples stay?',
    a: 'Yes, in Master and Premium rooms.',
  },
  {
    q: 'How do I book a room?',
    a: 'Browse availability and reserve online at book.lazybee.sg, or WhatsApp +65 8069 5410.',
  },
  {
    q: "What's included in the rent?",
    a: 'Your rent covers everything: fully furnished private room, access to all common areas, high-speed Wi-Fi, utilities, weekly housekeeping of shared spaces, and management support.',
  },
  {
    q: 'Do I need to pay a security deposit?',
    a: "Yes, a refundable security deposit equivalent to one month's rent is required. It is returned within 14 days of move-out, minus any deductions.",
  },
  {
    q: 'How do I renew my condo access card?',
    a: 'Bring your Tenancy Agreement (downloadable from the tenant portal) and your IRAS stamping certificate to the condo management office. If you need us to handle IRAS e-stamping, WhatsApp us — allow 2–3 working days.',
  },
  {
    q: 'What is a licence transfer and how does it work?',
    a: "A licence transfer lets you pass your remaining lease to a replacement tenant instead of losing your deposit. You are responsible for finding the replacement and coordinating the handover. Lazybee issues the updated licence and processes your deposit refund once the incoming tenant has signed, paid, and moved in.",
  },
  {
    q: 'How quickly will maintenance issues be resolved?',
    a: 'Urgent issues (safety, major leaks, no power or water) are addressed within 24 hours. Standard repairs take 3–5 working days. Cosmetic issues are batched into a monthly sweep.',
  },
];

const FAQsPage = () => (
  <main className="bg-background text-foreground pt-24 md:pt-28">
    <SEO
      title="Co-living FAQs — Singapore"
      description="Answers about Lazybee co-living in Singapore — pricing, what's included, lease terms, locations and how to book."
      canonical="/faqs"
      schema={[faqPageSchema(FAQS), breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'FAQs', path: '/faqs' }])]}
    />

    {/* Header */}
    <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
      <FadeIn>
        <h1 className="font-display tracking-display text-4xl md:text-5xl text-foreground mb-4">
          Frequently asked questions
        </h1>
        <p className="text-foreground-variant text-lg">
          Everything you need to know about Lazybee co-living — pricing, leases, what's included, and how to book.
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

    <CtaBand source="faqs_footer" />
  </main>
);

export default FAQsPage;
