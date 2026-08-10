import { useMemo, useState } from 'react';
import { HOMES, ROOMS, HOME_HERO, roomsForHome, isLet } from '../../data/lazybeeRooms';
import { ISLAND } from '../../data/singaporeIsland';
import { buildComb } from '../../lib/comb';
import { bookingUrl } from '../../lib/booking';
import { track, EVENTS } from '../../lib/analytics';
import { scrollToId } from '../../lib/scrollToId';
import { useLanguage } from '../../i18n/LanguageContext';
import { vocabKey } from '../../i18n/roomVocab';

const money = (n) => 'S$' + n.toLocaleString('en-SG');
const nice = (d) => new Date(d).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });

/** The listing preview beside the comb. Straight out of the same room record the
    booking site reads, so nothing here can quietly diverge from what is on sale. */
function CellCard({ room, shot, onShot }) {
  const { t } = useLanguage();
  const home = HOMES.find((x) => x.code === room.home);
  const let_ = isLet(room);
  const photos = room.photos.length ? room.photos : [HOME_HERO[room.home]];
  const i = Math.min(shot, photos.length - 1);

  const specs = [
    [t('owner.comb.size'), room.sqm ? t('owner.comb.sqm', { n: room.sqm }) : t('owner.comb.notMeasured')],
    [t('owner.comb.bed'), room.bed || t('owner.comb.notSet')],
    [t('owner.comb.sleeps'), t(room.occ > 1 ? 'owner.comb.people' : 'owner.comb.person', { n: room.occ })],
    [t('owner.comb.minStay'), t('owner.comb.months', { n: room.min })],
    [t('owner.comb.bathroom'), room.ensuite ? t('owner.comb.ensuite') : t('owner.comb.shared')],
    [t('owner.comb.nextAvailable'), let_ ? nice(room.next) : t('owner.comb.now')],
  ];

  return (
    <>
      <div className="shot">
        <img src={photos[i]} alt={room.code} loading="lazy" />
        <span
          className={`badge ${let_ ? 'badge-ok' : 'badge-warn'} tag`}
          style={{
            background: 'rgba(10,13,12,.55)',
            backdropFilter: 'blur(8px)',
            color: let_ ? '#9ED3B6' : '#E3C489',
          }}
        >
          {let_ ? t('owner.comb.letUntil', { date: nice(room.next) }) : t('owner.comb.keyOpen')}
        </span>
        {photos.length > 1 && (
          <div className="thumbs">
            {photos.map((p, n) => (
              <button
                key={p + n}
                type="button"
                aria-current={n === i ? 'true' : undefined}
                style={{ backgroundImage: `url(${p})` }}
                aria-label={`Photo ${n + 1}`}
                onClick={() => onShot(n)}
              />
            ))}
          </div>
        )}
      </div>
      <div className="in">
        <div className="label">{room.code} · {home.name}</div>
        <div className="place" style={{ fontSize: 26, marginTop: 6 }}>{t(vocabKey(room.type))}</div>
        <div className="num" style={{ fontSize: 22, fontWeight: 700, marginTop: 10 }}>
          {money(room.price)}
          <span className="label" style={{ letterSpacing: '.2em', marginLeft: 8 }}>{t('owner.comb.perMonth')}</span>
        </div>
        <div className="specs">
          {specs.map(([k, v]) => (
            <div key={k}><div className="k">{k}</div><div className="v">{v}</div></div>
          ))}
        </div>
        {room.am.length > 0 && (
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 'var(--s4)' }}>
            {room.am.map((a) => (
              <span className="chip" key={a} style={{ fontSize: 10.5, padding: '6px 11px' }}>{t(vocabKey(a))}</span>
            ))}
          </div>
        )}
        <p className="fine" style={{ marginTop: 'var(--s4)' }}>
          {home.address}.{' '}
          {home.mrt
            ? t('owner.comb.mrtWalk', { station: t(vocabKey(home.mrt.station)), minutes: home.mrt.walking_minutes })
            : ''}
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 'var(--s5)', flexWrap: 'wrap' }}>
          <a
            className="btn btn-sm"
            /* the live listing for THIS room, not the site root. An owner clicking a
               specific cell and landing on a generic index is the whole point missed.
               Verified route shape: book.lazybee.sg/rooms/<unit_code> */
            href={bookingUrl(`/rooms/${encodeURIComponent(room.code)}`)}
            target="_blank"
            rel="noopener"
            onClick={() => track(EVENTS.BROWSE_ROOMS_CLICK, { source: 'comb_cell', room: room.code })}
          >
            {t('owner.comb.seeItLive')}
          </a>
          <button
            type="button"
            className="link"
            style={{ alignSelf: 'center' }}
            onClick={() => scrollToId('ask')}
          >
            {t('owner.comb.listAUnit')}
          </button>
        </div>
      </div>
    </>
  );
}

export default function CombSection() {
  const { t } = useLanguage();
  const comb = useMemo(() => buildComb(ISLAND, HOMES, roomsForHome, (r) => isLet(r)), []);
  const firstOpen = useMemo(() => ROOMS.find((r) => !isLet(r)) || ROOMS[0], []);
  const [code, setCode] = useState(firstOpen.code);
  const [shot, setShot] = useState(0);

  const room = ROOMS.find((r) => r.code === code) || firstOpen;

  const select = (next) => {
    if (next === code) return;
    setCode(next);
    setShot(0);
    track(EVENTS.COMB_CELL_OPENED, { room: next, home: next.split('-')[0] });
  };

  return (
    <section className="wrap sec rule" id="comb">
      <div className="label rv">{t('owner.comb.kicker')}</div>
      <h2 className="h1 rv" style={{ marginTop: 14 }}>{t('owner.comb.title')}</h2>
      <p className="body rv" style={{ marginTop: 18 }}>
        {t('owner.comb.introPre')} <b>{t('owner.comb.introBold')}</b> {t('owner.comb.introTail')}
      </p>
      <div className="key rv">
        <span><i style={{ background: 'var(--comb-occ)' }} />{t('owner.comb.keyLet')}</span>
        <span><i style={{ background: 'var(--comb-open)' }} />{t('owner.comb.keyOpen')}</span>
        <span><i style={{ background: 'var(--comb-land-fill)', border: '1px solid var(--comb-land)' }} />{t('owner.comb.keyNotOurs')}</span>
      </div>

      <div className="combgrid">
        <div className="rv">
          <svg
            className="comb"
            viewBox={`0 0 ${comb.width} ${comb.height}`}
            role="img"
            aria-label="Singapore drawn as a honeycomb. Each filled cell is a Lazybee room at its real location."
          >
            <g>
              {comb.land.map((l) => <polygon key={l.key} className="land" points={l.points} />)}
            </g>
            {comb.homes.map((h) => (
              <g key={h.code}>
                {h.cells.map((cell) => (
                  <polygon
                    key={cell.code}
                    className="cell"
                    points={cell.points}
                    data-state={cell.state}
                    data-sel={cell.code === code ? '1' : '0'}
                    tabIndex={0}
                    role="button"
                    aria-label={cell.title}
                    onClick={() => select(cell.code)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(cell.code); }
                    }}
                  >
                    <title>{cell.title}</title>
                  </polygon>
                ))}
                <polygon className="core" points={h.core} />
                <text
                  className="homelabel"
                  x={h.label.x}
                  y={h.label.y}
                  textAnchor="middle"
                  fontFamily="JetBrains Mono, monospace"
                  fontSize={h.label.size}
                  fontWeight="700"
                >
                  {h.code}
                </text>
              </g>
            ))}
          </svg>
          <div className="hint"><span>&larr;</span> {t('owner.comb.hint')}</div>
        </div>
        <aside className="cellcard rv" aria-live="polite">
          <CellCard room={room} shot={shot} onShot={setShot} />
        </aside>
      </div>
    </section>
  );
}
