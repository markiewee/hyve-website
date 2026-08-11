import { useEffect, useState } from 'react';
import SEO from './SEO';
import { orgSchema, breadcrumbSchema } from '../lib/seo';
import './developers.css';

/* Partner API reference. Static by design: the examples below are the real
   resource shapes returned by /api/v1 (see src/lib/partnerSerialize.js, whose
   tests assert these exact key sets), so the docs and the API cannot drift
   apart without a failing test pointing at one of them.

   Styled as Mark's notepad board (white, black monospace, dotted leaders),
   not the marketing theme; see developers.css. */

const NAV = [
  ['auth', 'Base URL and authentication'],
  ['properties', 'Properties'],
  ['listings', 'Listings'],
  ['calendar', 'Availability calendar'],
  ['booking-requests', 'Booking requests'],
  ['bookings', 'Bookings'],
  ['webhooks', 'Webhooks'],
  ['limits', 'Rate limits and errors'],
  ['access', 'Request access'],
];

const Code = ({ children }) => (
  <pre className="dev-code">
    <code>{children}</code>
  </pre>
);

const Section = ({ id, title, children }) => (
  <section id={id} className="dev-section">
    {/* font-mono opts out of the site surface's serif heading rule */}
    <h2 className="dev-h2 font-mono"><span>{title}</span><span className="dev-dots" /></h2>
    {children}
  </section>
);

const P = ({ children }) => <p className="dev-p">{children}</p>;

const DevelopersPage = () => {
  const [active, setActive] = useState('auth');

  useEffect(() => {
    // Scrollspy for the left column: the topmost section inside the reading
    // band wins. Client-only; the prerendered page simply has no highlight.
    const sections = Array.from(document.querySelectorAll('.dev-section[id]'));
    if (!sections.length || typeof IntersectionObserver === 'undefined') return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting);
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: '-25% 0px -65% 0px' }
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  return (
    <main className="dev pt-24 md:pt-28">
      <SEO
        title="Lazybee Partner API | Developers"
        description="Integrate Lazybee co-living inventory: properties, listings, live availability calendars, rates, booking requests and signed webhooks over a versioned JSON API."
        canonical="/developers"
        schema={[orgSchema(), breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Developers', path: '/developers' }])]}
      />

      <div className="dev-wrap">
        <nav className="dev-nav" aria-label="API sections">
          <div className="dev-nav-head">partner api</div>
          {NAV.map(([id, label]) => (
            <a key={id} href={'#' + id} className={active === id ? 'on' : ''}>{label}</a>
          ))}
          <a className="dev-nav-mail" href="mailto:mark@lazybee.sg">mark@lazybee.sg</a>
        </nav>

        <div className="dev-body">
          <h1 className="dev-h1 font-mono">Lazybee Partner API</h1>
          <p className="dev-intro">
            Programmatic access to Lazybee co-living inventory: properties, room listings with media and
            features, live availability calendars, partner rates, booking-request intake and signed webhooks.
            JSON over HTTPS, versioned as v1, dates in ISO 8601, amounts in SGD.
          </p>
          <hr />

          <Section id="auth" title="Base URL and authentication">
            <P>
              All endpoints live under <code>https://www.lazybee.sg/api/v1</code> (the bare
              domain redirects here; use the www host in scripts so plain curl works without following redirects). Every
              request carries your API key in the Authorization header. Keys are issued per partner and can be revoked or
              rate-limited independently.
            </P>
            <Code>{`curl -s https://www.lazybee.sg/api/v1/ping \\
  -H "Authorization: Bearer $LAZYBEE_API_KEY"

{"ok":true,"partner":"Your Platform","version":"v1"}`}</Code>
          </Section>

          <Section id="properties" title="Properties">
            <P>
              <code>GET /properties</code> lists our buildings.{' '}
              <code>GET /properties/&#123;slug&#125;</code> returns one.
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

          <Section id="listings" title="Listings">
            <P>
              <code>GET /listings</code> returns every lettable room. Filter with{' '}
              <code>property</code>, <code>available_from</code> and{' '}
              <code>max_rate</code>. Rates are quoted per month for a default 12-month stay;
              pass <code>duration_months</code> (3 to 36) to quote a different length.{' '}
              <code>GET /listings/&#123;code&#125;</code> returns one room.
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

          <Section id="calendar" title="Availability calendar">
            <P>
              <code>GET /listings/&#123;code&#125;/calendar</code> returns date windows one
              year ahead. A window is <code>open</code> or{' '}
              <code>unavailable</code> and carries nothing else: no occupant information,
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

          <Section id="booking-requests" title="Booking requests">
            <P>
              Push a tenant to us with <code>POST /booking-requests</code>. Include an{' '}
              <code>idempotency_key</code> so safe retries never create duplicates. Status
              moves through <code>received</code>, <code>in_review</code>,
              then <code>confirmed</code> or <code>declined</code>;
              poll <code>GET /booking-requests/&#123;id&#125;</code> or subscribe to the{' '}
              <code>booking_request.updated</code> webhook.
            </P>
            <Code>{`curl -s -X POST https://www.lazybee.sg/api/v1/booking-requests \\
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

          <Section id="bookings" title="Bookings">
            <P>
              Where a booking request is a lead we review, <code>POST /bookings</code> places a
              confirmed hold that immediately blocks the calendar. Provide <code>starts_on</code>{' '}
              and optionally <code>ends_on</code> (omit for open-ended), your own{' '}
              <code>external_ref</code>, and an <code>idempotency_key</code>{' '}
              for safe retries. Manage with <code>GET /bookings</code>,{' '}
              <code>GET /bookings/&#123;id&#125;</code> and{' '}
              <code>POST /bookings/&#123;id&#125;/cancel</code>. Every create and status change
              emits the <code>booking.updated</code> webhook to you.
            </P>
            <Code>{`curl -s -X POST https://www.lazybee.sg/api/v1/bookings \\
  -H "Authorization: Bearer $LAZYBEE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "listing_code": "IH-STD1",
    "starts_on": "2026-10-01",
    "ends_on": "2027-03-31",
    "external_ref": "your-booking-8891",
    "idempotency_key": "your-booking-8891",
    "guest": { "name": "Jane Tan", "email": "jane@example.com" }
  }'

{"id":"...","listing_code":"IH-STD1","starts_on":"2026-10-01","ends_on":"2027-03-31",
 "status":"confirmed","external_ref":"your-booking-8891","created_at":"..."}`}</Code>
          </Section>

          <Section id="webhooks" title="Webhooks">
            <P>
              Register an HTTPS endpoint with <code>POST /webhooks</code> and choose from five
              events: <code>listing.calendar.updated</code>,{' '}
              <code>listing.rates.updated</code>,{' '}
              <code>listing.profile.updated</code>,{' '}
              <code>booking_request.updated</code> and{' '}
              <code>booking.updated</code>. The response includes your signing secret,
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

          <Section id="limits" title="Rate limits and errors">
            <P>
              Default limit is 60 requests per minute per key; excess returns HTTP 429. Errors always use one envelope:
            </P>
            <Code>{`{ "error": { "code": "validation_failed", "message": "Missing: move_in" } }`}</Code>
          </Section>

          <Section id="access" title="Request access">
            <P>
              Keys are issued directly by our team. Write to{' '}
              <a href="mailto:mark@lazybee.sg">mark@lazybee.sg</a>{' '}
              with your platform name and what you plan to build, and we will set you up with a key and, where relevant,
              your contracted rate card.
            </P>
          </Section>
        </div>
      </div>
    </main>
  );
};

export default DevelopersPage;
