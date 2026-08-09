import { useState } from 'react';
import { roomsForHome, isLet } from '../../data/lazybeeRooms';
import { PORTAL_TABS, PORTAL_TILES, DOCS, LOG, GAL } from '../../data/ownerPage';

const money = (n) => 'S$' + n.toLocaleString('en-SG');

/**
 * The owner portal, as an owner would meet it. Real rooms from Chiltern Park,
 * everything else a worked example of one month. A share only feels risky when it
 * is a black box, so the point of this section is to open the box.
 */
export default function PortalSection() {
  const [tab, setTab] = useState(PORTAL_TABS[0].id);
  const cp = roomsForHome('CP');

  return (
    <section className="wrap sec rule" id="see">
      <h2 className="h1 rv">You see exactly what we see.</h2>
      <p className="body rv" style={{ marginTop: 18 }}>
        A share only feels risky when it is a black box. So it is not one. You get an owner login on the day you sign.
        Everything below is a real view from a real month, with tenant names and identity numbers masked the way they
        are masked for us too.
      </p>

      <div className="portal rv">
        <div className="bar">
          <i /><i /><i />
          <span className="label" style={{ marginLeft: 8 }}>owner.lazybee.sg · Chiltern Park 135</span>
        </div>
        <div className="tabs" role="tablist">
          {PORTAL_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'p-stat' && (
          <div className="pane" id="p-stat" role="tabpanel" aria-labelledby="tab-p-stat">
            <div className="tiles">
              {PORTAL_TILES.map(([n, l]) => (
                <div className="stat" key={l}><div className="n">{n}</div><div className="l">{l}</div></div>
              ))}
            </div>
            <div className="rows" style={{ marginTop: 'var(--s5)' }}>
              {cp.map((r) => (
                <div className="row" key={r.code}>
                  <span>{r.code}, {r.type.toLowerCase()}{isLet(r) ? '' : ', open, not billed'}</span>
                  <b>{isLet(r) ? money(r.price) : 'S$0'}</b>
                </div>
              ))}
              <div className="row"><span>Running costs, itemised</span><b>-S$2,228</b></div>
              <div className="row"><span>Your floor</span><b>S$4,324</b></div>
              <div className="row"><span>Your share of the upside</span><b>S$1,001</b></div>
            </div>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 'var(--s5)' }}>
              <span className="chip on">Download August as PDF</span>
              <span className="chip">Export twelve months to CSV</span>
            </div>
          </div>
        )}

        {tab === 'p-docs' && (
          <div className="pane" id="p-docs" role="tabpanel" aria-labelledby="tab-p-docs">
            <p className="small">
              Every document we hold on your unit, in one place. Identity numbers are partly masked under the PDPA, and
              the full copy is released only if you are legally required to produce it.
            </p>
            <div className="docs" style={{ marginTop: 'var(--s5)' }}>
              {DOCS.map(([title, meta, badge, state]) => (
                <div className="d" key={title}>
                  <div>
                    <div className="t">{title}</div>
                    <div className="fine" style={{ marginTop: 3 }}>{meta}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <span className={`badge badge-${badge}`}>{state}</span>
                    <span className="link" aria-hidden="true">Open</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="note" style={{ marginTop: 'var(--s5)' }}>
              Nothing here is ever emailed around. Documents are viewed in the portal, access is logged, and tenants can
              see that you looked.
            </div>
          </div>
        )}

        {tab === 'p-log' && (
          <div className="pane" id="p-log" role="tabpanel" aria-labelledby="tab-p-log">
            <p className="small">
              Every job on the unit, what it cost, who did it and whether the photos came back. Anything over S$300
              needs your tap before we spend it.
            </p>
            <div className="log" style={{ marginTop: 'var(--s5)' }}>
              {LOG.map(([date, title, body, cost, badge, state]) => (
                <div className="e" key={title}>
                  <div className="dt">{date}</div>
                  <div>
                    <div className="t">{title}</div>
                    <p className="fine" style={{ marginTop: 4, maxWidth: '60ch' }}>{body}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="num" style={{ fontSize: 13 }}>{cost}</div>
                    <span className={`badge badge-${badge}`} style={{ marginTop: 7 }}>{state}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="rows" style={{ marginTop: 'var(--s5)', maxWidth: 420 }}>
              <div className="row"><span>Maintenance, year to date</span><b>S$1,284</b></div>
              <div className="row"><span>Charged to you</span><b>S$0</b></div>
            </div>
          </div>
        )}

        {tab === 'p-gal' && (
          <div className="pane" id="p-gal" role="tabpanel" aria-labelledby="tab-p-gal">
            <p className="small">
              A photo set on move-in, on move-out, and every quarter in between. This is the record that settles any
              argument about condition, and it is why the trial can end with the unit going back as we found it.
            </p>
            <div className="gal" style={{ marginTop: 'var(--s5)' }}>
              {GAL.map(([src, caption]) => (
                <figure key={caption}>
                  <img src={src} alt={caption} loading="lazy" />
                  <figcaption>{caption}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
