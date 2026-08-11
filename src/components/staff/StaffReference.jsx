// The answers staff repeat all day: lease terms, the move-in sequence, and the
// questions that come up every week.
//
// These three blocks existed in the old StaffResourcePage.jsx as LeaseTermsSection,
// MoveInProcessSection and FAQSection, and none of them were ever rendered: the
// default export only returned the hero, the search and the property tabs. This
// is the first time the team actually sees them.

import Caret from './Caret';
import { useLanguage } from '../../i18n/LanguageContext';

const TERMS = [
  ['staff.ref.term1.k', 'staff.ref.term1.v'],
  ['staff.ref.term2.k', 'staff.ref.term2.v'],
  ['staff.ref.term3.k', 'staff.ref.term3.v'],
  ['staff.ref.term4.k', 'staff.ref.term4.v'],
];

const INCLUDED = [
  'staff.ref.inc1',
  'staff.ref.inc2',
  'staff.ref.inc3',
  'staff.ref.inc4',
  'staff.ref.inc5',
];

const EXCLUDED = [
  'staff.ref.exc1',
  'staff.ref.exc2',
];

const STEPS = [
  ['01', 'staff.ref.step1.t', 'staff.ref.step1.b'],
  ['02', 'staff.ref.step2.t', 'staff.ref.step2.b'],
  ['03', 'staff.ref.step3.t', 'staff.ref.step3.b'],
  ['04', 'staff.ref.step4.t', 'staff.ref.step4.b'],
  ['05', 'staff.ref.step5.t', 'staff.ref.step5.b'],
];

const FAQ = [
  ['staff.ref.q1.q', 'staff.ref.q1.a'],
  ['staff.ref.q2.q', 'staff.ref.q2.a'],
  ['staff.ref.q3.q', 'staff.ref.q3.a'],
  ['staff.ref.q4.q', 'staff.ref.q4.a'],
  ['staff.ref.q5.q', 'staff.ref.q5.a'],
  ['staff.ref.q6.q', 'staff.ref.q6.a'],
  ['staff.ref.q7.q', 'staff.ref.q7.a'],
  ['staff.ref.q8.q', 'staff.ref.q8.a'],
  ['staff.ref.q9.q', 'staff.ref.q9.a'],
  ['staff.ref.q10.q', 'staff.ref.q10.a'],
];

export default function StaffReference() {
  const { t } = useLanguage();
  return (
    <section className="rule" style={{ marginTop: 'var(--s9)', paddingTop: 'var(--s7)' }}>
      <div className="label">{t('staff.reference')}</div>
      <h2 className="h2" style={{ marginTop: 'var(--s3)' }}>{t('staff.ref.termsIntro')}</h2>

      <div className="grid g2" style={{ marginTop: 'var(--s6)', gap: 'var(--s7)' }}>
        <div>
          <div className="label">{t('staff.ref.leaseTerms')}</div>
          <div className="rows" style={{ marginTop: 'var(--s3)' }}>
            {TERMS.map(([k, v]) => (
              <div className="row" key={k}><span>{t(k)}</span><b>{t(v)}</b></div>
            ))}
          </div>
        </div>
        <div>
          <div className="label">{t('staff.ref.included')}</div>
          <ul className="bullets">
            {INCLUDED.map((x) => <li key={x}>{t(x)}</li>)}
          </ul>
          <div className="label" style={{ marginTop: 'var(--s5)' }}>{t('staff.ref.excluded')}</div>
          <ul className="bullets">
            {EXCLUDED.map((x) => <li key={x}>{t(x)}</li>)}
          </ul>
        </div>
      </div>

      <div className="label" style={{ marginTop: 'var(--s8)' }}>{t('staff.ref.moveIn')}</div>
      {/* .staffsteps, not .steps. The design system already has a .steps on the
          owner page, and it is a bordered list, not this five-across grid. */}
      <div className="staffsteps">
        {STEPS.map(([n, title, note]) => (
          <div key={n}>
            <div className="n">{n}</div>
            <p className="small" style={{ marginTop: 10, color: 'var(--ink)' }}>{t(title)}</p>
            <p className="fine" style={{ marginTop: 6 }}>{t(note)}</p>
          </div>
        ))}
      </div>

      <div className="label" style={{ marginTop: 'var(--s8)' }}>{t('staff.ref.faq')}</div>
      <div className="faq">
        {FAQ.map(([q, a]) => (
          <details key={q}>
            <summary>{t(q)}<Caret /></summary>
            <p>{t(a)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
