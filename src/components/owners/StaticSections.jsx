import { HOMES, ROOMS, HOME_HERO, roomsForHome, isLet } from '../../data/lazybeeRooms';
import { COMPARE_HEADS, COMPARE_ROWS, ZEROS, TRIAL_KEEPS, COMPLIANCE, POSTS } from '../../data/ownerPage';

/** The green band: three numbers, one of them counted off the live room data. */
export function GreenBand() {
  const let_ = ROOMS.filter((r) => isLet(r)).length;
  return (
    <div className="band">
      <div
        className="wrap grid g3"
        style={{ paddingTop: 'clamp(30px,4vw,56px)', paddingBottom: 'clamp(30px,4vw,56px)' }}
      >
        <div className="rv"><div className="n">{ROOMS.length}</div><div className="l">Cells under management</div></div>
        <div className="rv"><div className="n">{let_} / {ROOMS.length}</div><div className="l">Let today</div></div>
        <div className="rv"><div className="n">S$0</div><div className="l">Owner spend on fit-out</div></div>
      </div>
    </div>
  );
}

export function AlignmentSection() {
  return (
    <section className="wrap sec" id="why">
      <h2 className="h1 rv">We are asking for the deal that is worse for us in a bad year.</h2>
      <div className="grid g3" style={{ marginTop: 'var(--s6)', gap: 'var(--s6)' }}>
        <p className="body rv">
          A fixed lease pays us to pay you as little as possible. We would quote low, hold your unit for three years and
          keep everything above the number. Every owner who has signed one has the same quiet suspicion, and the
          suspicion is usually correct.
        </p>
        <p className="body rv">
          A share flips it. We earn nothing until your floor is paid and the running costs are covered. Empty rooms come
          out of our side first. There is no version of this where we do well and you do not.
        </p>
        <p className="body rv">
          That is the whole argument. Not that we are nicer, but that we have deliberately taken the structure where the
          only way we make money in year two is to keep your unit full in year one.
        </p>
      </div>
    </section>
  );
}

export function CompareSection() {
  return (
    <section className="wrap sec rule" id="compare">
      <h2 className="h1 rv">Three ways to own the same unit.</h2>
      <p className="body rv" style={{ marginTop: 18 }}>
        The honest version, including the parts that are worse for us.
      </p>
      <div className="cmpwrap rv">
        <table className="cmp">
          <thead>
            <tr>
              <th />
              {COMPARE_HEADS.map((h, i) => (
                <th key={h} className={i === 2 ? 'us' : undefined}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map(([k, a, b, us]) => (
              <tr key={k}>
                <td>{k}</td><td>{a}</td><td>{b}</td><td className="us">{us}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TrialSection() {
  return (
    <section className="wrap sec rule" id="trial">
      <div className="label rv">No commitment</div>
      <h2 className="h1 rv" style={{ marginTop: 14 }}>Ninety days, then decide.</h2>
      <p className="body rv" style={{ marginTop: 18 }}>
        We spend our money before you spend yours. We furnish the unit, shoot it, list it across every channel and start
        paying your floor, all before anything binds you to us. At day ninety you carry on or you walk.{' '}
        <b>Walking costs you nothing.</b> We take our furniture back out at our own cost and leave the unit as we found it.
      </p>

      <div className="zeros rv">
        {ZEROS.map((l) => (
          <div key={l}><div className="z">S$0</div><div className="label">{l}</div></div>
        ))}
      </div>

      <div className="grid g2 rv" style={{ marginTop: 'var(--s7)', gap: 'var(--s7)' }}>
        <div>
          <h3 className="h2">What you keep either way</h3>
          <div className="rows" style={{ marginTop: 'var(--s4)' }}>
            {TRIAL_KEEPS.map(([k, v]) => (
              <div className="row" key={k}><span>{k}</span><b>{v}</b></div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="h2">The one string attached</h3>
          <p className="body" style={{ marginTop: 'var(--s4)' }}>
            Anyone we house during the trial signs a real lease, because they are real people moving their lives into
            your unit. So if you leave at day ninety you pick how that lands: take the tenancies over as they stand,
            with the agreements and the deposits handed to you, or give us the time to see them out.
          </p>
          <p className="body" style={{ marginTop: 14 }}>
            That is the whole of the small print. We would rather put it on the page than bury it in a clause you find
            in month four.
          </p>
        </div>
      </div>
    </section>
  );
}


export function ComplianceSection() {
  return (
    <section className="wrap sec rule" id="legal">
      <h2 className="h1 rv">The boring part, done properly.</h2>
      <p className="body rv" style={{ marginTop: 18 }}>
        Three things go wrong for owners who let room by room: the stay is too short, the unit is over-occupied, and
        nobody can produce a document when it is asked for. We run all three as checklists, not as promises.
      </p>
      <div className="deal rv">
        {COMPLIANCE.map(([label, head, body]) => (
          <div key={head}>
            <span className="label">{label}</span>
            <h3>{head}</h3>
            <p>{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The three homes, photographed, with a bar per cell and how many are let. */
export function HomesStrip() {
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
                {rs.length} cells, {filled} let{open ? `, ${open} open now` : ''}
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
 * The prototype linked every card to hive.html, a sibling static page. There is no
 * Hive route in this app yet, so the cards are rendered as articles rather than as
 * links: a dead link is worse than no link. Point them at the real route the day
 * The Hive ships.
 */
export function HiveSection() {
  return (
    <section className="wrap sec" id="thehive">
      <div className="label rv">The Hive</div>
      <h2 className="h1 rv" style={{ marginTop: 14 }}>What we write down.</h2>
      <p className="body rv" style={{ marginTop: 18 }}>
        Everything we learn running the comb goes into The Hive. What a Singapore unit actually earns once the void is
        counted, what the URA rules mean on a Tuesday rather than in a circular, what breaks in year two and what it
        costs to fix. No lead magnets and no gated PDFs.
      </p>
      <div className="posts">
        {POSTS.map(([img, kicker, title, body]) => (
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
    </section>
  );
}
