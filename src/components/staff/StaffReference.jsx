// The answers staff repeat all day: lease terms, the move-in sequence, and the
// questions that come up every week.
//
// These three blocks existed in the old StaffResourcePage.jsx as LeaseTermsSection,
// MoveInProcessSection and FAQSection, and none of them were ever rendered: the
// default export only returned the hero, the search and the property tabs. This
// is the first time the team actually sees them.

import Caret from './Caret';

const TERMS = [
  ['Minimum stay', '3 months'],
  ['Deposit', '1 month, refundable'],
  ['Notice period', '1 month'],
  ['Payment', 'Bank transfer, due on the 1st'],
];

const INCLUDED = [
  'High-speed WiFi',
  'Water and electricity, with a monthly AC allowance',
  'Weekly common area cleaning',
  'Fully furnished room',
  'Kitchen, washing machine and dryer access',
];

const EXCLUDED = [
  'AC used above the monthly allowance, billed at cost',
  'Personal toiletries, and cleaning inside the bedroom',
];

const STEPS = [
  ['01', 'Browse or book a viewing', 'Two working days of lead time, minimum.'],
  ['02', 'Sign the licence', 'Digital, sent from the portal.'],
  ['03', 'Pay deposit and first month', 'Bank transfer, reference on the invoice.'],
  ['04', 'Receive access', 'Door code and directions, on the day.'],
  ['05', 'Move in', 'Captain meets them if it is a first tenancy.'],
];

const FAQ = [
  [
    'Can they have guests overnight?',
    'Yes, with advance notice to the housemates. Three nights or more needs approval from us first.',
  ],
  [
    'What is the WiFi like?',
    'Fibre broadband at every property, 300Mbps or better, and coverage reaches every room.',
  ],
  [
    'Is cooking allowed?',
    'Yes, the shared kitchen is fully equipped. Clean up after, and use the exhaust fan for anything heavily spiced.',
  ],
  [
    'How do they report a problem?',
    'A ticket in the tenant portal, or a WhatsApp message to the SG line. We aim to reply inside 24 hours.',
  ],
  [
    'Can they leave early?',
    'One month of written notice. The deposit may be forfeited depending on the circumstances, so check before promising.',
  ],
  [
    'When does the deposit come back?',
    'Within 14 days of move-out, after the room inspection. Deductions only for damage beyond fair wear.',
  ],
  [
    'Are utilities included?',
    'Water, electricity with a monthly AC allowance, WiFi and weekly common cleaning are all in the rent. AC above the allowance is billed at cost.',
  ],
  [
    'Is there parking?',
    'HDB parking near Chiltern Park and Ivory Heights. Thomson Grove has limited porch parking. Check before committing.',
  ],
  [
    'How is AC usage tracked?',
    'Smart plugs meter each room against its monthly allowance, and any overage is billed the following month.',
  ],
  [
    'How much notice does a viewing need?',
    'Two working days, minimum. A captain has to be lined up to open the unit, so never offer same day or next day.',
  ],
];

export default function StaffReference() {
  return (
    <section className="rule" style={{ marginTop: 'var(--s9)', paddingTop: 'var(--s7)' }}>
      <div className="label">Reference</div>
      <h2 className="h2" style={{ marginTop: 'var(--s3)' }}>The terms, in the order they get asked.</h2>

      <div className="grid g2" style={{ marginTop: 'var(--s6)', gap: 'var(--s7)' }}>
        <div>
          <div className="label">Lease terms</div>
          <div className="rows" style={{ marginTop: 'var(--s3)' }}>
            {TERMS.map(([k, v]) => (
              <div className="row" key={k}><span>{k}</span><b>{v}</b></div>
            ))}
          </div>
        </div>
        <div>
          <div className="label">In the rent</div>
          <ul className="bullets">
            {INCLUDED.map((x) => <li key={x}>{x}</li>)}
          </ul>
          <div className="label" style={{ marginTop: 'var(--s5)' }}>Not in the rent</div>
          <ul className="bullets">
            {EXCLUDED.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </div>
      </div>

      <div className="label" style={{ marginTop: 'var(--s8)' }}>Move-in, five steps</div>
      {/* .staffsteps, not .steps. The design system already has a .steps on the
          owner page, and it is a bordered list, not this five-across grid. */}
      <div className="staffsteps">
        {STEPS.map(([n, title, note]) => (
          <div key={n}>
            <div className="n">{n}</div>
            <p className="small" style={{ marginTop: 10, color: 'var(--ink)' }}>{title}</p>
            <p className="fine" style={{ marginTop: 6 }}>{note}</p>
          </div>
        ))}
      </div>

      <div className="label" style={{ marginTop: 'var(--s8)' }}>Questions that come up every week</div>
      <div className="faq">
        {FAQ.map(([q, a]) => (
          <details key={q}>
            <summary>{q}<Caret /></summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
