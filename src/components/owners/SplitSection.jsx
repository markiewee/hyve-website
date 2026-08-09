import { MONTHS, VOID_MONTH, OPEX, SHARE, sgd } from '../../lib/ownerModel';
import { scrollToId } from '../../lib/scrollToId';

/**
 * Twelve months of a fixed lease against twelve months with us.
 *
 * Every figure here comes out of one call to model() in ownerModel.js, so the
 * headline totals are literally the sum of the bars drawn beside them.
 */
export default function SplitSection({ m, estimator, districtLabel }) {
  const max = Math.max(...m.leaseM, ...m.shareM.map((s) => s.floor + s.up)) * 1.06;

  const rows = [
    ['District', districtLabel],
    ['Asking rent, whole unit', `S$${estimator.psf.toFixed(1)} psf, ${sgd(m.market)} / mo`],
    ['Lets as', `${estimator.beds} cells`],
    ['Gross room income', `${sgd(m.grossYear / 12)} / mo`],
    ['Running costs, our side', `${Math.round(OPEX * 100)}% of gross`],
    ['Your floor', `${sgd(m.floorMo)} / mo`],
    ['Your share above it', `${Math.round(SHARE * 100)}%`],
  ];

  return (
    <section className="wrap sec" id="split">
      <h2 className="h1 rv">A lease pays you a number. A year pays you what actually happened.</h2>
      <p className="body rv" style={{ marginTop: 18 }}>
        Move the sliders in the hero and this redraws. The left bar in every month is what a fixed lease really puts in
        your account after the void, the agent and the repairs. The right bar is what the same unit makes with us.{' '}
        <b>The dark part is your floor. The bright part is your share.</b>
      </p>

      <div className="split rv">
        <div className="l">
          <div className="label">A normal year with us</div>
          <div className="num-xl" style={{ marginTop: 12 }}>{sgd(m.ourTotal)}</div>
          <p className="small" style={{ marginTop: 12 }}>
            Against {sgd(m.leaseTotal)} from a fixed lease on the same unit. That is <b>{m.upliftPct}% more</b>, on an
            asset you already own.
          </p>
          <div className="versus">
            <div className="k">Fixed lease, after the year happens</div>
            <div className="amt">{sgd(m.leaseTotal)}</div>
          </div>
          <div className="floorline">
            <div className="label">Your floor, even in our worst year</div>
            <div className="amt" style={{ marginTop: 4 }}>{sgd(m.floorYear)}</div>
            <p className="fine" style={{ marginTop: 8 }}>
              Paid on the first, full or empty. If we let the rooms badly, we earn nothing and you still clear the lease.
            </p>
          </div>
          <div style={{ marginTop: 'var(--s6)' }}>
            <a
              className="btn btn-accent"
              href="#ask"
              onClick={(e) => { e.preventDefault(); scrollToId('ask'); }}
            >
              Get this number for my unit <span aria-hidden="true">&rarr;</span>
            </a>
            <p className="fine" style={{ marginTop: 12, maxWidth: '34ch' }}>
              Two fields, then Marcus comes to you with the real version of this chart, worked out on your actual unit.
            </p>
          </div>
        </div>

        <div>
          <div className="label">Twelve months, side by side</div>
          <div className="chart">
            <div className="cols">
              {m.leaseM.map((l, i) => {
                const s = m.shareM[i], tot = s.floor + s.up, upPct = tot > 0 ? (s.up / tot * 100) : 0;
                return (
                  <div className="col" key={i}>
                    <div
                      className={`b lease${i === VOID_MONTH ? ' void' : ''}`}
                      style={{ height: `${l / max * 100}%` }}
                      title={`Lease: ${sgd(l)}`}
                    />
                    <div className="b share" style={{ height: `${tot / max * 100}%` }} title={`Lazybee: ${sgd(tot)}`}>
                      <div className="up" style={{ height: `${upPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mlabels">
              {MONTHS.map((x, i) => <span key={i}>{x}</span>)}
            </div>
          </div>
          <div className="key">
            <span><i style={{ background: 'var(--lease)' }} />Fixed lease</span>
            <span><i style={{ background: 'var(--share)' }} />Your floor</span>
            <span><i style={{ background: 'var(--share-up)' }} />Your share of the upside</span>
          </div>
          <div className="totals">
            <div className="t"><div className="k">Lease, twelve months</div><div className="n">{sgd(m.leaseTotal)}</div></div>
            <div className="t">
              <div className="k">Lazybee, twelve months</div>
              <div className="n" style={{ color: 'var(--accent-text)' }}>{sgd(m.ourTotal)}</div>
            </div>
            <div className="t">
              <div className="k">Difference</div>
              <div className="n">{(m.ourTotal >= m.leaseTotal ? '+' : '') + sgd(m.ourTotal - m.leaseTotal)}</div>
            </div>
          </div>
          <div className="rows" style={{ marginTop: 'var(--s5)' }}>
            {rows.map(([k, v]) => (
              <div className="row" key={k}><span>{k}</span><b>{v}</b></div>
            ))}
          </div>
          <p className="fine" style={{ marginTop: 14 }}>
            Indicative, from median asking rents in your district and from how our own nineteen cells actually perform.
            The real floor is agreed in writing after we walk the unit.
          </p>
        </div>
      </div>
    </section>
  );
}
