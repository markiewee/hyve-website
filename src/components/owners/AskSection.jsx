import { useRef, useState } from 'react';
import { UPLIFT, OPEX, FLOORPCT, SHARE, DI, sgd } from '../../lib/ownerModel';
import { WHAT_HAPPENS } from '../../data/ownerPage';
import { track, EVENTS } from '../../lib/analytics';

/**
 * The ask: a postal code, a way to reach you, and Marcus turns up with coffee.
 *
 * Everything the owner worked out on this page is captured with the enquiry, so
 * Marcus walks into the coffee already knowing the unit instead of asking from
 * scratch. The lead is sent to PostHog today. It still needs to be written into
 * hyve-iot leads and to ping Marcus on Telegram: that is a backend task, not part
 * of this port, and the prototype only logged it to the console.
 */
export default function AskSection({ m, estimator, variant, copy }) {
  const [postal, setPostal] = useState('');
  const [contact, setContact] = useState('');
  const [lead, setLead] = useState(null);
  const reportRef = useRef(null);

  const submit = (e) => {
    e.preventDefault();
    const payload = {
      source: 'lazybee.sg/owners',
      hero_variant: variant,
      hero_headline: copy.headline,
      postal_code: postal,
      contact,
      district: estimator.district,
      district_name: DI[estimator.district],
      floor_area_sqft: estimator.sqft,
      bedrooms: estimator.beds,
      psf_used: estimator.psf,
      market_rent_monthly: Math.round(m.market),
      floor_offered_monthly: Math.round(m.floorMo),
      modelled_owner_year: Math.round(m.ourTotal),
      modelled_lease_year: Math.round(m.leaseTotal),
      uplift_pct: m.upliftPct,
      assumptions: { uplift: UPLIFT, opex: OPEX, floor_pct: FLOORPCT, share: SHARE },
      captured_at: new Date().toISOString(),
    };
    track(EVENTS.OWNER_LEAD_SUBMITTED, payload);
    setLead(payload);
    // the report replaces the form, so put the reader on it
    requestAnimationFrame(() => {
      reportRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'center',
      });
    });
  };

  const reportRows = lead && [
    ['Postal code', lead.postal_code || 'not given'],
    ['District', `${lead.district} ${lead.district_name}`],
    ['Size and layout', `${lead.floor_area_sqft.toLocaleString('en-SG')} sqft, ${lead.bedrooms} bedrooms`],
    ['District asking rent', `S$${lead.psf_used.toFixed(1)} psf, ${sgd(lead.market_rent_monthly)} / mo`],
    ['Floor we would start from', `${sgd(lead.floor_offered_monthly)} / mo`],
    ['Modelled against a lease', `+${lead.uplift_pct}%, ${sgd(lead.modelled_owner_year - lead.modelled_lease_year)} a year`],
  ];

  return (
    <section className="wrap sec rule" id="ask">
      <div className="askbox">
        <div className="label rv">The next step is a coffee</div>
        <h2 className="h1 rv" style={{ maxWidth: 'none', margin: '16px auto 0' }}>
          Marcus will come to you<br />and buy you a coffee.
        </h2>
        <p className="body rv" style={{ margin: '20px auto 0' }}>
          Not a call. Not a deck. Tell me roughly where your unit is and I will come to you, anywhere on the island, at
          whatever hour suits. I will buy the coffee, look at the photos on your phone, and tell you what I think your
          unit would actually make.
        </p>
        <p className="body rv" style={{ margin: '14px auto 0' }}>
          If it is not a fit I will say so before the cup is cold, and you will have lost forty minutes and gained a
          flat white.
        </p>

        {!lead && (
          <form className="askform rv" onSubmit={submit}>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="Postal code"
              required
              aria-label="Postal code"
              value={postal}
              onChange={(e) => setPostal(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <input
              type="text"
              placeholder="WhatsApp or email"
              required
              aria-label="WhatsApp or email"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
            <button className="btn btn-accent" type="submit">Book the coffee</button>
          </form>
        )}

        {lead && (
          <div className="report rv in" ref={reportRef}>
            <div className="label">Saved. This is what Marcus brings to the table.</div>
            <h3 className="h2" style={{ marginTop: 12 }}>Your unit, {DI[estimator.district] || ''}</h3>
            <p className="small" style={{ marginTop: 10 }}>
              Everything you worked out on this page is attached to your enquiry, so the first thing he says is not
              &quot;tell me about your unit&quot;.
            </p>
            <div className="rr">
              {reportRows.map(([k, v]) => (
                <div key={k}><div className="k">{k}</div><div className="v">{v}</div></div>
              ))}
            </div>
            <p className="fine" style={{ marginTop: 'var(--s5)' }}>
              Your enquiry is saved against hero variant <b>{lead.hero_variant.toUpperCase()}</b>, which is how we find
              out which opening line actually produces coffees. Marcus is messaged within a day.
            </p>
          </div>
        )}

        <div className="whathappens rv">
          <div className="label" style={{ textAlign: 'left' }}>What happens when you press that</div>
          <div className="wh">
            {WHAT_HAPPENS.map(([title, body], i) => (
              <div key={title}>
                <span className="i">{i + 1}</span>
                <div><b>{title}</b><p>{body}</p></div>
              </div>
            ))}
          </div>
        </div>

        <div className="sign rv">
          <div className="sig">Marcus</div>
          <div className="fine">Marcus · Makery Pte Ltd · the one who actually turns up</div>
        </div>
        <p className="fine rv" style={{ marginTop: 'var(--s5)' }}>
          No newsletter. No sequence of five emails. No agent ringing you on a Sunday.
        </p>
      </div>
    </section>
  );
}
