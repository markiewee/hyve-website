import { Link } from 'react-router-dom';
import { HOMES, ROOMS, HOME_HERO, roomsForHome, isLet } from '../../data/lazybeeRooms';
import { COMPARE_HEADS, COMPARE_ROWS, ZEROS, TRIAL_KEEPS, COMPLIANCE, POSTS } from '../../data/ownerPage';
import { ARTICLES } from '../../lib/hiveContent';
import { useLanguage } from '../../i18n/LanguageContext';

/** The green band: three numbers, one of them counted off the live room data. */
export function GreenBand() {
  const { t } = useLanguage();
  const let_ = ROOMS.filter((r) => isLet(r)).length;
  return (
    <div className="band">
      <div
        className="wrap grid g3"
        style={{ paddingTop: 'clamp(30px,4vw,56px)', paddingBottom: 'clamp(30px,4vw,56px)' }}
      >
        <div className="rv"><div className="n">{ROOMS.length}</div><div className="l">{t('owner.band.cells')}</div></div>
        <div className="rv"><div className="n">{let_} / {ROOMS.length}</div><div className="l">{t('owner.band.let')}</div></div>
        <div className="rv"><div className="n">S$0</div><div className="l">{t('owner.band.spend')}</div></div>
      </div>
    </div>
  );
}

export function AlignmentSection() {
  const { t } = useLanguage();
  return (
    <section className="wrap sec" id="why">
      <h2 className="h1 rv">{t('owner.why.title')}</h2>
      <div className="grid g3" style={{ marginTop: 'var(--s6)', gap: 'var(--s6)' }}>
        <p className="body rv">{t('owner.why.p1')}</p>
        <p className="body rv">{t('owner.why.p2')}</p>
        <p className="body rv">{t('owner.why.p3')}</p>
      </div>
    </section>
  );
}

export function CompareSection() {
  const { t } = useLanguage();
  return (
    <section className="wrap sec rule" id="compare">
      <h2 className="h1 rv">{t('owner.compare.title')}</h2>
      <p className="body rv" style={{ marginTop: 18 }}>
        {t('owner.compare.sub')}
      </p>
      <div className="cmpwrap rv">
        <table className="cmp">
          <thead>
            <tr>
              <th />
              {COMPARE_HEADS.map((h, i) => (
                <th key={h} className={i === 2 ? 'us' : undefined}>{t(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map(([k, a, b, us]) => (
              <tr key={k}>
                <td>{t(k)}</td><td>{t(a)}</td><td>{t(b)}</td><td className="us">{t(us)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TrialSection() {
  const { t } = useLanguage();
  return (
    <section className="wrap sec rule" id="trial">
      <div className="label rv">{t('owner.trial.kicker')}</div>
      <h2 className="h1 rv" style={{ marginTop: 14 }}>{t('owner.trial.title')}</h2>
      <p className="body rv" style={{ marginTop: 18 }}>
        {t('owner.trial.body')}{' '}
        <b>{t('owner.trial.bodyBold')}</b> {t('owner.trial.bodyTail')}
      </p>

      <div className="zeros rv">
        {ZEROS.map((l) => (
          <div key={l}><div className="z">S$0</div><div className="label">{t(l)}</div></div>
        ))}
      </div>

      <div className="grid g2 rv" style={{ marginTop: 'var(--s7)', gap: 'var(--s7)' }}>
        <div>
          <h3 className="h2">{t('owner.trial.keepTitle')}</h3>
          <div className="rows" style={{ marginTop: 'var(--s4)' }}>
            {TRIAL_KEEPS.map(([k, v]) => (
              <div className="row" key={k}><span>{t(k)}</span><b>{t(v)}</b></div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="h2">{t('owner.trial.stringTitle')}</h3>
          <p className="body" style={{ marginTop: 'var(--s4)' }}>
            {t('owner.trial.string1')}
          </p>
          <p className="body" style={{ marginTop: 14 }}>
            {t('owner.trial.string2')}
          </p>
        </div>
      </div>
    </section>
  );
}


export function ComplianceSection() {
  const { t } = useLanguage();
  return (
    <section className="wrap sec rule" id="legal">
      <h2 className="h1 rv">{t('owner.legal.title')}</h2>
      <p className="body rv" style={{ marginTop: 18 }}>
        {t('owner.legal.sub')}
      </p>
      <div className="deal rv">
        {COMPLIANCE.map(([label, head, body]) => (
          <div key={head}>
            <span className="label">{t(label)}</span>
            <h3>{t(head)}</h3>
            <p>{t(body)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The three homes, photographed, with a bar per cell and how many are let. */
export function HomesStrip() {
  const { t } = useLanguage();
  return (
    <section className="homes" id="homes">
      {HOMES.map((h) => {
        const rs = roomsForHome(h.code);
        const filled = rs.filter((r) => isLet(r)).length;
        const open = rs.length - filled;
        return (
          <article className="photocard" key={h.code}>
            <img src={HOME_HERO[h.code]} alt={h.name} loading="lazy" />
            <div className="scrim" />
            <div className="cap">
              <div className="label" style={{ color: '#D3C7B2' }}>{h.mrt ? h.mrt.station : ''}</div>
              <div className="place" style={{ marginTop: 6 }}>{h.name}</div>
              <div style={{ fontSize: 12.5, color: '#D6CDBC', marginTop: 6 }}>
                {t('owner.homes.count', { cells: rs.length, filled })}
                {open ? t('owner.homes.open', { open }) : ''}
              </div>
              <div className="bars" style={{ marginTop: 13 }}>
                {rs.map((r, i) => <i key={r.code} className={i < filled ? 'on' : ''} />)}
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}

/**
 * The Hive teaser.
 *
 * The prototype linked every card to hive.html, a sibling static page. The Hive is
 * now a real set of routes, so these are the three most recent articles read
 * straight off src/content/hive, each one a real link. The hardcoded POSTS list in
 * ownerPage.js is the fallback for the case where nothing has been published yet,
 * which keeps the homepage from rendering an empty section on a fresh checkout.
 */
export function HiveSection() {
  const { t } = useLanguage();
  const recent = ARTICLES.slice(0, 3);
  return (
    <section className="wrap sec" id="thehive">
      <div className="label rv">{t('owner.hive.kicker')}</div>
      <h2 className="h1 rv" style={{ marginTop: 14 }}>{t('owner.hive.title')}</h2>
      <p className="body rv" style={{ marginTop: 18 }}>
        {t('owner.hive.body')}
      </p>
      <div className="posts">
        {recent.length > 0
          ? recent.map((a) => (
            <Link className="post rv" to={a.path} key={a.slug}>
              <div className="im"><img src={a.hero || '/photos/cp/Common-1.jpg'} alt={a.heroAlt || ''} loading="lazy" /></div>
              <div className="bd">
                <div className="label">{a.tags[0] || 'Lazybee'}</div>
                <h3>{a.title}</h3>
                <p>{a.excerpt}</p>
              </div>
            </Link>
          ))
          : POSTS.map(([img, kicker, title, body]) => (
            <article className="post rv" key={title}>
              <div className="im"><img src={img} alt="" loading="lazy" /></div>
              <div className="bd">
                <div className="label">{kicker}</div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            </article>
          ))}
      </div>
      <p className="rv" style={{ marginTop: 'var(--s6)' }}>
        <Link className="btn btn-ghost" to="/hive">{t('owner.hive.cta')}</Link>
      </p>
    </section>
  );
}
