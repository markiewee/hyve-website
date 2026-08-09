import { useMemo, useState } from 'react';
import { HOMES, ROOMS, HOME_HERO, roomsForHome, isLet } from '../../data/lazybeeRooms';
import { ISLAND } from '../../data/singaporeIsland';
import { buildComb } from '../../lib/comb';
import { BOOKING_URL } from '../../lib/booking';
import { track, EVENTS } from '../../lib/analytics';
import { scrollToId } from '../../lib/scrollToId';

const money = (n) => 'S$' + n.toLocaleString('en-SG');
const nice = (d) => new Date(d).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });

/** The listing preview beside the comb. Straight out of the same room record the
    booking site reads, so nothing here can quietly diverge from what is on sale. */
function CellCard({ room, shot, onShot }) {
  const home = HOMES.find((x) => x.code === room.home);
  const let_ = isLet(room);
  const photos = room.photos.length ? room.photos : [HOME_HERO[room.home]];
  const i = Math.min(shot, photos.length - 1);

  const specs = [
    ['Size', room.sqm ? `${room.sqm} sqm` : 'not measured'],
    ['Bed', room.bed || 'not set'],
    ['Sleeps', room.occ + (room.occ > 1 ? ' people' : ' person')],
    ['Minimum stay', `${room.min} months`],
    ['Bathroom', room.ensuite ? 'Ensuite' : 'Shared'],
    ['Next available', let_ ? nice(room.next) : 'Now'],
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
          {let_ ? `Let until ${nice(room.next)}` : 'Open now'}
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
        <div className="place" style={{ fontSize: 26, marginTop: 6 }}>{room.type}</div>
        <div className="num" style={{ fontSize: 22, fontWeight: 700, marginTop: 10 }}>
          {money(room.price)}
          <span className="label" style={{ letterSpacing: '.2em', marginLeft: 8 }}>per month</span>
        </div>
        <div className="specs">
          {specs.map(([k, v]) => (
            <div key={k}><div className="k">{k}</div><div className="v">{v}</div></div>
          ))}
        </div>
        {room.am.length > 0 && (
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 'var(--s4)' }}>
            {room.am.map((a) => (
              <span className="chip" key={a} style={{ fontSize: 10.5, padding: '6px 11px' }}>{a}</span>
            ))}
          </div>
        )}
        <p className="fine" style={{ marginTop: 'var(--s4)' }}>
          {home.address}. {home.mrt ? `${home.mrt.station} MRT, ${home.mrt.walking_minutes} minutes on foot.` : ''}
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 'var(--s5)', flexWrap: 'wrap' }}>
          <a
            className="btn btn-sm"
            href={BOOKING_URL}
            target="_blank"
            rel="noopener"
            onClick={() => track(EVENTS.BROWSE_ROOMS_CLICK, { source: 'comb_cell', room: room.code })}
          >
            See it live
          </a>
          <button
            type="button"
            className="link"
            style={{ alignSelf: 'center' }}
            onClick={() => scrollToId('ask')}
          >
            List a unit like this
          </button>
        </div>
      </div>
    </>
  );
}

export default function CombSection() {
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
      <div className="label rv">The comb</div>
      <h2 className="h1 rv" style={{ marginTop: 14 }}>Every cell is a real room.</h2>
      <p className="body rv" style={{ marginTop: 18 }}>
        Nineteen cells so far, each one drawn where it actually stands on the island. <b>Click any cell</b> and you get
        the room itself, straight from the same database that runs the booking site: the photographs, the price, the
        size, the bed, what is in it and when it next opens. The pale cells are the rest of Singapore, which is the part
        of the comb we have not built yet.
      </p>
      <div className="key rv">
        <span><i style={{ background: 'var(--comb-occ)' }} />Let</span>
        <span><i style={{ background: 'var(--comb-open)' }} />Open now</span>
        <span><i style={{ background: 'var(--comb-land-fill)', border: '1px solid var(--comb-land)' }} />Not ours yet</span>
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
          <div className="hint"><span>&larr;</span> Click a filled cell to open the listing</div>
        </div>
        <aside className="cellcard rv" aria-live="polite">
          <CellCard room={room} shot={shot} onShot={setShot} />
        </aside>
      </div>
    </section>
  );
}
