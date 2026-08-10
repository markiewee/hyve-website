import { useState } from 'react';
import { roomsForHome, isLet } from '../../data/lazybeeRooms';
import { PORTAL_TABS, PORTAL_TILES, DOCS, LOG, GAL } from '../../data/ownerPage';
import { vocabKey } from '../../i18n/roomVocab';
import { useLanguage } from '../../i18n/LanguageContext';

const money = (n) => 'S$' + n.toLocaleString('en-SG');

/**
 * The owner portal, as an owner would meet it. Real rooms from Chiltern Park,
 * everything else a worked example of one month. A share only feels risky when it
 * is a black box, so the point of this section is to open the box.
 */
export default function PortalSection() {
  const { t } = useLanguage();
  const [tab, setTab] = useState(PORTAL_TABS[0].id);
  const cp = roomsForHome('CP');

  return (
    <section className="wrap sec rule" id="see">
      <h2 className="h1 rv">{t('owner.portal.title')}</h2>
      <p className="body rv" style={{ marginTop: 18 }}>
        {t('owner.portal.intro')}
      </p>

      <div className="portal rv">
        <div className="bar">
          <i /><i /><i />
          <span className="label" style={{ marginLeft: 8 }}>{t('owner.portal.addressBar')}</span>
        </div>
        <div className="tabs" role="tablist">
          {/* Named `pane` rather than `t`: the tab objects used to shadow the
              translator, which is fine until a label needs translating. */}
          {PORTAL_TABS.map((pane) => (
            <button
              key={pane.id}
              type="button"
              role="tab"
              id={`tab-${pane.id}`}
              aria-selected={tab === pane.id}
              aria-controls={pane.id}
              onClick={() => setTab(pane.id)}
            >
              {t(pane.label)}
            </button>
          ))}
        </div>

        {tab === 'p-stat' && (
          <div className="pane" id="p-stat" role="tabpanel" aria-labelledby="tab-p-stat">
            <div className="tiles">
              {PORTAL_TILES.map(([n, l]) => (
                <div className="stat" key={l}><div className="n">{n}</div><div className="l">{t(l)}</div></div>
              ))}
            </div>
            <div className="rows" style={{ marginTop: 'var(--s5)' }}>
              {cp.map((r) => (
                <div className="row" key={r.code}>
                  <span>
                    {r.code}, {t(vocabKey(r.type))}{isLet(r) ? '' : t('owner.portal.notBilled')}
                  </span>
                  <b>{isLet(r) ? money(r.price) : 'S$0'}</b>
                </div>
              ))}
              <div className="row"><span>{t('owner.portal.opex')}</span><b>-S$2,228</b></div>
              <div className="row"><span>{t('owner.portal.floor')}</span><b>S$4,324</b></div>
              <div className="row"><span>{t('owner.portal.upside')}</span><b>S$1,001</b></div>
            </div>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 'var(--s5)' }}>
              <span className="chip on">{t('owner.portal.pdf')}</span>
              <span className="chip">{t('owner.portal.csv')}</span>
            </div>
          </div>
        )}

        {tab === 'p-docs' && (
          <div className="pane" id="p-docs" role="tabpanel" aria-labelledby="tab-p-docs">
            <p className="small">{t('owner.portal.docsIntro')}</p>
            <div className="docs" style={{ marginTop: 'var(--s5)' }}>
              {DOCS.map(([title, meta, badge, state]) => (
                <div className="d" key={title}>
                  <div>
                    <div className="t">{t(title)}</div>
                    <div className="fine" style={{ marginTop: 3 }}>{t(meta)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <span className={`badge badge-${badge}`}>{t(state)}</span>
                    <span className="link" aria-hidden="true">{t('owner.portal.open')}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="note" style={{ marginTop: 'var(--s5)' }}>{t('owner.portal.docsNote')}</div>
          </div>
        )}

        {tab === 'p-log' && (
          <div className="pane" id="p-log" role="tabpanel" aria-labelledby="tab-p-log">
            <p className="small">{t('owner.portal.logIntro')}</p>
            <div className="log" style={{ marginTop: 'var(--s5)' }}>
              {LOG.map(([date, title, body, cost, badge, state]) => (
                <div className="e" key={title}>
                  <div className="dt">{date}</div>
                  <div>
                    <div className="t">{t(title)}</div>
                    <p className="fine" style={{ marginTop: 4, maxWidth: '60ch' }}>{t(body)}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="num" style={{ fontSize: 13 }}>{cost}</div>
                    <span className={`badge badge-${badge}`} style={{ marginTop: 7 }}>{t(state)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="rows" style={{ marginTop: 'var(--s5)', maxWidth: 420 }}>
              <div className="row"><span>{t('owner.portal.maintYtd')}</span><b>S$1,284</b></div>
              <div className="row"><span>{t('owner.portal.chargedYou')}</span><b>S$0</b></div>
            </div>
          </div>
        )}

        {tab === 'p-gal' && (
          <div className="pane" id="p-gal" role="tabpanel" aria-labelledby="tab-p-gal">
            <p className="small">{t('owner.portal.galIntro')}</p>
            <div className="gal" style={{ marginTop: 'var(--s5)' }}>
              {GAL.map(([src, caption]) => (
                <figure key={caption}>
                  <img src={src} alt={t(caption)} loading="lazy" />
                  <figcaption>{t(caption)}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
