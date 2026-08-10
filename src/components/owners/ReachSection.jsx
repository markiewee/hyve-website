import { LOGOS } from '../../data/channelLogos';
import { CHANNELS_LIVE, CHANNELS_SOON } from '../../data/ownerPage';
import { useLanguage } from '../../i18n/LanguageContext';

/* Real brand marks where simple-icons has one, a typeset wordmark where it does not.
   The wordmark tiles are visibly different, so it is obvious which logos still need
   dropping in rather than being quietly faked. */
function Tile({ name, mark, soon }) {
  const m = mark && LOGOS[mark];
  return (
    <div className={`t${soon ? ' soon' : ''}`} title={name}>
      {m ? (
        <>
          <svg viewBox={m.vb} role="img" aria-label={name}><path d={m.d} /></svg>
          <span className="nm">{name}</span>
        </>
      ) : (
        <span className="wm">{name}</span>
      )}
    </div>
  );
}

export default function ReachSection() {
  const { t } = useLanguage();
  return (
    <section className="wrap sec rule" id="reach">
      <h2 className="h1 rv">{t('owner.reach.title')}</h2>
      <p className="body rv" style={{ marginTop: 18 }}>
        {t('owner.reach.body')}
      </p>
      <div className="label rv" style={{ marginTop: 'var(--s6)' }}>{t('owner.reach.live')}</div>
      <div className="wall rv">
        {CHANNELS_LIVE.map(([name, mark]) => <Tile key={name} name={name} mark={mark} soon={false} />)}
      </div>
      <div className="label rv" style={{ marginTop: 'var(--s6)' }}>{t('owner.reach.soon')}</div>
      <div className="wall rv">
        {CHANNELS_SOON.map(([name, mark]) => <Tile key={name} name={name} mark={mark} soon />)}
      </div>
    </section>
  );
}
