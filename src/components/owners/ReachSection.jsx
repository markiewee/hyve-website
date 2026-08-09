import { LOGOS } from '../../data/channelLogos';
import { CHANNELS_LIVE, CHANNELS_SOON } from '../../data/ownerPage';

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
  return (
    <section className="wrap sec rule" id="reach">
      <h2 className="h1 rv">Your rooms go on sale in places you have never heard of.</h2>
      <p className="body rv" style={{ marginTop: 18 }}>
        A room in Serangoon gets taken from Chengdu, Bangalore or Berlin, weeks before the tenant lands in Singapore. We
        list, price and sync every cell from one system, so a booking on any channel closes the others in the same
        minute. An agent puts your unit on two portals and waits for a phone call.
      </p>
      <div className="label rv" style={{ marginTop: 'var(--s6)' }}>Live now</div>
      <div className="wall rv">
        {CHANNELS_LIVE.map(([name, mark]) => <Tile key={name} name={name} mark={mark} soon={false} />)}
      </div>
      <div className="label rv" style={{ marginTop: 'var(--s6)' }}>Onboarded or in progress</div>
      <div className="wall rv">
        {CHANNELS_SOON.map(([name, mark]) => <Tile key={name} name={name} mark={mark} soon />)}
      </div>
    </section>
  );
}
