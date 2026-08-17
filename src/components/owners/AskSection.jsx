import { useRef, useState } from 'react';
import { UPLIFT, OPEX, FLOORPCT, SHARE, DI, sgd } from '../../lib/ownerModel';
import { WHAT_HAPPENS } from '../../data/ownerPage';
import { track, EVENTS } from '../../lib/analytics';
import { useLanguage } from '../../i18n/LanguageContext';

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
  const { t } = useLanguage();
  const [postal, setPostal] = useState('');
  const [contact, setContact] = useState('');
  const [lead, setLead] = useState(null);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const reportRef = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
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

    // The email IS the pipeline: there is no table behind this. So the success
    // card is only shown once the send is actually confirmed. Showing it on a
    // failed send is what silently binned every previous lead.
    setSending(true);
    setFailed(false);
    try {
      const r = await fetch('/api/owners/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`lead ${r.status}`);
    } catch (err) {
      console.error('[owner-lead] submit failed', err);
      setSending(false);
      setFailed(true);
      return;
    }
    setSending(false);
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
    [t('owner.ask.rowPostal'), lead.postal_code || t('owner.ask.rowNotGiven')],
    [t('owner.ask.rowDistrict'), `${lead.district} ${lead.district_name}`],
    [t('owner.ask.rowSize'), t('owner.ask.valSize', { sqft: lead.floor_area_sqft.toLocaleString('en-SG'), beds: lead.bedrooms })],
    [t('owner.ask.rowAsking'), t('owner.ask.valAsking', { psf: lead.psf_used.toFixed(1), amount: sgd(lead.market_rent_monthly) })],
    [t('owner.ask.rowFloor'), t('owner.ask.valPerMo', { amount: sgd(lead.floor_offered_monthly) })],
    [t('owner.ask.rowModelled'), t('owner.ask.valModelled', { pct: lead.uplift_pct, amount: sgd(lead.modelled_owner_year - lead.modelled_lease_year) })],
  ];

  return (
    <section className="wrap sec rule" id="ask">
      <div className="askbox">
        <div className="label rv">{t('owner.ask.kicker')}</div>
        <h2 className="h1 rv" style={{ maxWidth: 'none', margin: '16px auto 0' }}>
          {t('owner.ask.title1')}<br />{t('owner.ask.title2')}
        </h2>
        <p className="body rv" style={{ margin: '20px auto 0' }}>
          {t('owner.ask.p1')}
        </p>
        <p className="body rv" style={{ margin: '14px auto 0' }}>
          {t('owner.ask.p2')}
        </p>

        {!lead && (
          <form className="askform rv" onSubmit={submit}>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder={t('owner.ask.postal')}
              required
              aria-label={t('owner.ask.postal')}
              value={postal}
              onChange={(e) => setPostal(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <input
              type="text"
              placeholder={t('owner.ask.contact')}
              required
              aria-label={t('owner.ask.contact')}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
            <button className="btn btn-accent" type="submit" disabled={sending}>
              {sending ? t('owner.ask.sending') : t('owner.ask.submit')}
            </button>
          </form>
        )}

        {/* No table behind this form, so a failed send would lose the lead. Hand
            the owner a route they control rather than a false confirmation. */}
        {failed && !lead && (
          <p className="askfail rv" role="alert">
            {t('owner.ask.failed')}{' '}
            <a href={`https://wa.me/6580695410?text=${encodeURIComponent(
              `Hi Lazybee, I own a unit${postal ? ` at ${postal}` : ''} and would like the earnings breakdown.`
            )}`}>
              {t('owner.ask.failedWhatsapp')}
            </a>
          </p>
        )}

        {lead && (
          <div className="report rv in" ref={reportRef}>
            <div className="label">{t('owner.ask.saved')}</div>
            <h3 className="h2" style={{ marginTop: 12 }}>
              {t('owner.ask.yourUnit', { district: DI[estimator.district] || '' })}
            </h3>
            <p className="small" style={{ marginTop: 10 }}>
              {t('owner.ask.attached')}
            </p>
            <div className="rr">
              {reportRows.map(([k, v]) => (
                <div key={k}><div className="k">{k}</div><div className="v">{v}</div></div>
              ))}
            </div>
            <p className="fine" style={{ marginTop: 'var(--s5)' }}>
              {t('owner.ask.variantPre')} <b>{lead.hero_variant.toUpperCase()}</b>{t('owner.ask.variantPost')}
            </p>
          </div>
        )}

        <div className="whathappens rv">
          <div className="label" style={{ textAlign: 'left' }}>{t('owner.ask.whatHappens')}</div>
          <div className="wh">
            {WHAT_HAPPENS.map(([title, body], i) => (
              <div key={title}>
                <span className="i">{i + 1}</span>
                <div><b>{t(title)}</b><p>{t(body)}</p></div>
              </div>
            ))}
          </div>
        </div>

        <div className="sign rv">
          <div className="sig">Marcus</div>
          <div className="fine">{t('owner.ask.signFine')}</div>
        </div>
        <p className="fine rv" style={{ marginTop: 'var(--s5)' }}>
          {t('owner.ask.noSpam')}
        </p>
      </div>
    </section>
  );
}
