import { VOID_MONTH, OPEX, SHARE, sgd } from '../../lib/ownerModel';
import { scrollToId } from '../../lib/scrollToId';
import { useLanguage } from '../../i18n/LanguageContext';

/**
 * Twelve months of a fixed lease against twelve months with us.
 *
 * Every figure here comes out of one call to model() in ownerModel.js, so the
 * headline totals are literally the sum of the bars drawn beside them.
 */
export default function SplitSection({ m, estimator, districtLabel }) {
  const { t } = useLanguage();
  const max = Math.max(...m.leaseM, ...m.shareM.map((s) => s.floor + s.up)) * 1.06;

  /* The month initials are a dictionary string rather than the MONTHS constant,
     because J F M A M J J A S O N D is an English abbreviation and reads as
     nothing in Chinese, which numbers its months. */
  const months = t('owner.split.months').split(',');

  const rows = [
    [t('owner.split.rowDistrict'), districtLabel],
    [t('owner.split.rowAsking'), t('owner.split.valAsking', { psf: estimator.psf.toFixed(1), amount: sgd(m.market) })],
    [t('owner.split.rowLetsAs'), t('owner.split.valCells', { n: estimator.beds })],
    [t('owner.split.rowGross'), t('owner.split.valPerMo', { amount: sgd(m.grossYear / 12) })],
    [t('owner.split.rowOpex'), t('owner.split.valPctGross', { pct: Math.round(OPEX * 100) })],
    [t('owner.split.rowFloor'), t('owner.split.valPerMo', { amount: sgd(m.floorMo) })],
    [t('owner.split.rowShare'), `${Math.round(SHARE * 100)}%`],
  ];

  return (
    <section className="wrap sec" id="split">
      <h2 className="h1 rv">{t('owner.split.title')}</h2>
      <p className="body rv" style={{ marginTop: 18 }}>
        {t('owner.split.intro')}{' '}
        <b>{t('owner.split.introBold')}</b>
      </p>

      <div className="split rv">
        <div className="l">
          <div className="label">{t('owner.split.normalYear')}</div>
          <div className="num-xl" style={{ marginTop: 12 }}>{sgd(m.ourTotal)}</div>
          <p className="small" style={{ marginTop: 12 }}>
            {t('owner.split.againstPre', { lease: sgd(m.leaseTotal) })}{' '}
            <b>{t('owner.split.againstBold', { pct: m.upliftPct })}</b>
            {t('owner.split.againstPost')}
          </p>
          <div className="versus">
            <div className="k">{t('owner.split.versus')}</div>
            <div className="amt">{sgd(m.leaseTotal)}</div>
          </div>
          <div className="floorline">
            <div className="label">{t('owner.split.floorLabel')}</div>
            <div className="amt" style={{ marginTop: 4 }}>{sgd(m.floorYear)}</div>
            <p className="fine" style={{ marginTop: 8 }}>
              {t('owner.split.floorNote')}
            </p>
          </div>
          <div style={{ marginTop: 'var(--s6)' }}>
            <a
              className="btn btn-accent"
              href="#ask"
              onClick={(e) => { e.preventDefault(); scrollToId('ask'); }}
            >
              {t('owner.split.cta')} <span aria-hidden="true">&rarr;</span>
            </a>
            <p className="fine" style={{ marginTop: 12, maxWidth: '34ch' }}>
              {t('owner.split.ctaNote')}
            </p>
          </div>
        </div>

        <div>
          <div className="label">{t('owner.split.sideBySide')}</div>
          <div className="chart">
            <div className="cols">
              {m.leaseM.map((l, i) => {
                const s = m.shareM[i], tot = s.floor + s.up, upPct = tot > 0 ? (s.up / tot * 100) : 0;
                return (
                  <div className="col" key={i}>
                    <div
                      className={`b lease${i === VOID_MONTH ? ' void' : ''}`}
                      style={{ height: `${l / max * 100}%` }}
                      title={t('owner.split.tipLease', { amount: sgd(l) })}
                    />
                    <div className="b share" style={{ height: `${tot / max * 100}%` }} title={t('owner.split.tipUs', { amount: sgd(tot) })}>
                      <div className="up" style={{ height: `${upPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mlabels">
              {months.map((x, i) => <span key={i}>{x}</span>)}
            </div>
          </div>
          <div className="key">
            <span><i style={{ background: 'var(--lease)' }} />{t('owner.split.keyLease')}</span>
            <span><i style={{ background: 'var(--share)' }} />{t('owner.split.keyFloor')}</span>
            <span><i style={{ background: 'var(--share-up)' }} />{t('owner.split.keyUpside')}</span>
          </div>
          <div className="totals">
            <div className="t"><div className="k">{t('owner.split.totalLease')}</div><div className="n">{sgd(m.leaseTotal)}</div></div>
            <div className="t">
              <div className="k">{t('owner.split.totalUs')}</div>
              <div className="n" style={{ color: 'var(--accent-text)' }}>{sgd(m.ourTotal)}</div>
            </div>
            <div className="t">
              <div className="k">{t('owner.split.totalDiff')}</div>
              <div className="n">{(m.ourTotal >= m.leaseTotal ? '+' : '') + sgd(m.ourTotal - m.leaseTotal)}</div>
            </div>
          </div>
          <div className="rows" style={{ marginTop: 'var(--s5)' }}>
            {rows.map(([k, v]) => (
              <div className="row" key={k}><span>{k}</span><b>{v}</b></div>
            ))}
          </div>
          <p className="fine" style={{ marginTop: 14 }}>
            {t('owner.split.fine')}
          </p>
        </div>
      </div>
    </section>
  );
}
