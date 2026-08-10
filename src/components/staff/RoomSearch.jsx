// The filter panel. Every control is a real form element, so the page works
// with a keyboard and reads correctly to a screen reader.
//
// Stateless by design: the page owns the search object, because the same object
// drives both the result list and the count line, and splitting it would let the
// two disagree.

import { BUDGET_STRETCH } from '../../lib/staffRooms';

const LOCATIONS = [
  { code: 'ALL', label: 'All properties' },
  { code: 'CP', label: 'Chiltern Park, Serangoon' },
  { code: 'IH', label: 'Ivory Heights, Jurong East' },
  { code: 'TG', label: 'Thomson Grove, Upper Thomson' },
];

const CHIPS = [
  { key: 'sell', label: 'Sell now, opens within 12 weeks' },
  { key: 'couple', label: 'Sleeps two' },
  { key: 'ensuite', label: 'Ensuite' },
];

export default function RoomSearch({ search, onChange, onClear, active, count, homeCount }) {
  const set = (k, v) => onChange({ ...search, [k]: v });

  return (
    <div className="search">
      <div className="searchgrid">
        <div className="field" style={{ margin: 0 }}>
          <label className="label" htmlFor="staff-date">Move-in date</label>
          <input
            className="input"
            type="date"
            id="staff-date"
            value={search.date}
            onChange={(e) => set('date', e.target.value)}
          />
          <div className="seg" role="group" aria-label="Date flexibility">
            {['fixed', 'flexible'].map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={search.dateMode === mode}
                onClick={() => set('dateMode', mode)}
              >
                {mode === 'fixed' ? 'Fixed' : 'Flexible'}
              </button>
            ))}
          </div>
        </div>

        <div className="field" style={{ margin: 0 }}>
          <label className="label" htmlFor="staff-budget">
            Budget, up to {BUDGET_STRETCH} over
          </label>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            id="staff-budget"
            placeholder="1200"
            value={search.budget}
            onChange={(e) => set('budget', e.target.value)}
          />
          <div className="help">Cheaper rooms always show. Blank shows every price.</div>
        </div>

        <div className="field" style={{ margin: 0 }}>
          <label className="label" htmlFor="staff-loc">Property</label>
          <select
            className="select input"
            id="staff-loc"
            value={search.location}
            onChange={(e) => set('location', e.target.value)}
          >
            {LOCATIONS.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          <div className="help">Walk times are in each property panel.</div>
        </div>
      </div>

      <div className="searchfoot">
        <div className="chips" style={{ margin: 0 }}>
          {CHIPS.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`chip chip-sm${search[c.key] ? ' on' : ''}`}
              aria-pressed={!!search[c.key]}
              onClick={() => set(c.key, !search[c.key])}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s4)' }}>
          {/* Announced politely: a count that changes as you type is worth
              hearing, but not worth interrupting what is already being read. */}
          <span className="label" style={{ letterSpacing: '.14em' }} aria-live="polite">
            {active
              ? `${count} ${count === 1 ? 'room' : 'rooms'}${
                  homeCount ? ` in ${homeCount} ${homeCount === 1 ? 'home' : 'homes'}` : ''
                }`
              : ''}
          </span>
          {active && (
            <button className="btn btn-ghost btn-sm" type="button" onClick={onClear}>Clear</button>
          )}
        </div>
      </div>
    </div>
  );
}
