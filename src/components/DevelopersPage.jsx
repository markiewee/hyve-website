import SEO from './SEO';
import { orgSchema, breadcrumbSchema } from '../lib/seo';
import FadeIn from './marketing/FadeIn';

/* Partner API reference. Static by design: the examples below are the real
   resource shapes returned by /api/v1 (see src/lib/partnerSerialize.js, whose
   tests assert these exact key sets), so the docs and the API cannot drift
   apart without a failing test pointing at one of them. */

const Code = ({ children }) => (
  <pre className="bg-surface border border-border rounded-lg p-4 overflow-x-auto text-sm text-foreground-variant leading-relaxed">
    <code>{children}</code>
  </pre>
);

const Section = ({ title, children }) => (
  <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-14">
    <FadeIn>
      <h2 className="font-display tracking-display text-2xl md:text-3xl text-foreground mb-4">{title}</h2>
      {children}
    </FadeIn>
  </section>
);

const P = ({ children }) => (
  <p className="text-foreground-variant text-base leading-relaxed mb-4">{children}</p>
);

const DevelopersPage = () => (
  <main className="bg-background text-foreground pt-24 md:pt-28">
    <SEO
      title="Lazybee Partner API | Developers"
      description="Integrate Lazybee co-living inventory: properties, listings, live availability calendars, rates, booking requests and signed webhooks over a versioned JSON API."
      canonical="/developers"
      schema={[orgSchema(), breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Developers', path: '/developers' }])]}
    />

    <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
      <FadeIn>
        <span className="block text-[11px] uppercase tracking-[0.4em] font-semibold text-accent mb-6">Developers</span>
        <h1 className="font-display tracking-display text-4xl md:text-5xl text-foreground mb-4">Lazybee Partner API</h1>
        <p className="text-foreground-variant text-lg">
          Programmatic access to Lazybee co-living inventory: properties, room listings with media and
          features, live availability calendars, partner rates, booking-request intake and signed webhooks.
          JSON over HTTPS, versioned as v1, dates in ISO 8601, amounts in SGD.
        </p>
      </FadeIn>
    </section>

    <Section title="Base URL and authentication">
      <P>
        All endpoints live under <code className="text-foreground">https://lazybee.sg/api/v1</code>. Every request
        carries your API key in the Authorization header. Keys are issued per partner and can be revoked or
        rate-limited independently.
      </P>
      <Code>{`curl -s https://lazybee.sg/api/v1/ping \\
  -H "Authorization: Bearer $LAZYBEE_API_KEY"

{"ok":true,"partner":"Your Platform","version":"v1"}`}</Code>
    </Section>

    <Section title="Properties">
      <P>
        <code className="text-foreground">GET /properties</code> lists our buildings.{' '}
        <code className="text-foreground">GET /properties/&#123;slug&#125;</code> returns one.
      </P>
      <Code>{`{
  "slug": "ivory-heights",
  "profile": { "title": "Ivory Heights", "description": "..." },
  "media": [ { "url": "https://...jpg", "hero": true } ],
  "features": [ "pool", "gym", "near-mrt" ],
  "listing_count": 7,
  "links": {
    "canonical": "https://lazybee.sg/properties/ivory-heights",
    "book": "https://book.lazybee.sg"
  },
  "updated_at": "2026-08-01T02:11:09Z"
}`}</Code>
    </Section>

    <Section title="Listings">
      <P>
        <code className="text-foreground">GET /listings</code> returns every lettable room. Filter with{' '}
        <code className="text-foreground">property</code>, <code className="text-foreground">available_from</code> and{' '}
        <code className="text-foreground">max_rate</code>. Rates are quoted per month for a default 12-month stay;
        pass <code className="text-foreground">duration_months</code> (3 to 36) to quote a different length.{' '}
        <code className="text-foreground">GET /listings/&#123;code&#125;</code> returns one room.
      </P>
      <Code>{`{
  "code": "IH-STD1",
  "property": "ivory-heights",
  "profile": { "title": "Standard Room 1", "description": "..." },
  "media": [ { "url": "https://...jpg", "hero": true } ],
  "features": [ "aircon", "window" ],
  "rate_card": {
    "monthly_rate": 1500,
    "deposit": 1500,
    "min_stay_months": 3,
    "currency": "SGD",
    "duration_months": 12
  },
  "available_from": "2026-09-01",
  "max_occupancy": 2,
  "links": {
    "canonical": "https://lazybee.sg/rooms/IH-STD1",
    "book": "https://book.lazybee.sg"
  },
  "updated_at": "2026-08-05T11:40:00Z"
}`}</Code>
    </Section>

    <Section title="Availability calendar">
      <P>
        <code className="text-foreground">GET /listings/&#123;code&#125;/calendar</code> returns date windows one
        year ahead. A window is <code className="text-foreground">open</code> or{' '}
        <code className="text-foreground">unavailable</code> and carries nothing else: no occupant information,
        by design.
      </P>
      <Code>{`{
  "listing": "IH-STD1",
  "from": "2026-08-12",
  "horizon_days": 365,
  "windows": [
    { "start": "2026-08-12", "end": "2026-08-31", "status": "open" },
    { "start": "2026-09-01", "end": "2026-12-14", "status": "unavailable" },
    { "start": "2026-12-15", "end": "2027-08-12", "status": "open" }
  ]
}`}</Code>
    </Section>

    <Section title="Booking requests">
      <P>
        Push a tenant to us with <code className="text-foreground">POST /booking-requests</code>. Include an{' '}
        <code className="text-foreground">idempotency_key</code> so safe retries never create duplicates. Status
        moves through <code className="text-foreground">received</code>, <code className="text-foreground">in_review</code>,
        then <code className="text-foreground">confirmed</code> or <code className="text-foreground">declined</code>;
        poll <code className="text-foreground">GET /booking-requests/&#123;id&#125;</code> or subscribe to the{' '}
        <code className="text-foreground">booking_request.updated</code> webhook.
      </P>
      <Code>{`curl -s -X POST https://lazybee.sg/api/v1/booking-requests \\
  -H "Authorization: Bearer $LAZYBEE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "listing_code": "IH-STD1",
    "move_in": "2026-10-01",
    "duration_months": 6,
    "idempotency_key": "your-ref-123",
    "applicant": { "name": "Jane Tan", "email": "jane@example.com", "phone": "+65..." }
  }'

{"id":"1f4c...","listing_code":"IH-STD1","status":"received","created_at":"..."}`}</Code>
    </Section>

    <Section title="Webhooks">
      <P>
        Register an HTTPS endpoint with <code className="text-foreground">POST /webhooks</code> and choose from four
        events: <code className="text-foreground">listing.calendar.updated</code>,{' '}
        <code className="text-foreground">listing.rates.updated</code>,{' '}
        <code className="text-foreground">listing.profile.updated</code> and{' '}
        <code className="text-foreground">booking_request.updated</code>. The response includes your signing secret,
        shown once. Payloads are pointers; re-read the API for current state. Deliveries retry with backoff for
        up to eight attempts.
      </P>
      <Code>{`// Verify the Lazybee-Signature header (t=<unix>,v1=<hmac>)
import { createHmac, timingSafeEqual } from "node:crypto";

function verify(secret, body, header) {
  const m = /^t=(\\d+),v1=([0-9a-f]{64})$/.exec(header ?? "");
  if (!m) return false;
  const mac = createHmac("sha256", secret).update(m[1] + "." + body).digest("hex");
  return timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(m[2], "hex"));
}`}</Code>
    </Section>

    <Section title="Rate limits and errors">
      <P>
        Default limit is 60 requests per minute per key; excess returns HTTP 429. Errors always use one envelope:
      </P>
      <Code>{`{ "error": { "code": "validation_failed", "message": "Missing: move_in" } }`}</Code>
    </Section>

    <Section title="Request access">
      <P>
        Keys are issued directly by our team. Write to{' '}
        <a className="text-accent underline underline-offset-4" href="mailto:mark@lazybee.sg">mark@lazybee.sg</a>{' '}
        with your platform name and what you plan to build, and we will set you up with a key and, where relevant,
        your contracted rate card.
      </P>
    </Section>
  </main>
);

export default DevelopersPage;
