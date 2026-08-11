// One room, collapsed to the five facts a prospect asks for first and expanding
// to everything else.
//
// A native <details> rather than React state. It opens without JavaScript, it is
// keyboard operable for free, and the browser handles the ARIA. The old page used
// a click handler on a div plus framer-motion for the height, which meant the
// card was not reachable by keyboard at all.

import { availabilityStatus, priceLadder, formatDate, daysUntil } from '../../lib/staffRooms';
import Caret from './Caret';
import { useLanguage } from '../../i18n/LanguageContext';

const sgd = (n) => `S$${Number(n).toLocaleString('en-SG')}`;
const title = (s) => (s ? s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '');

function TagRow({ label, list }) {
  if (!list?.length) return null;
  return (
    <div style={{ marginTop: 'var(--s5)' }}>
      <div className="label">{label}</div>
      <div className="chips">
        {list.map((a, i) => (
          <span key={i} className="chip chip-sm">{a}</span>
        ))}
      </div>
    </div>
  );
}

export default function RoomCard({ room, property, today }) {
  const { t } = useLanguage();
  const status = availabilityStatus(room, today);
  const ladder = priceLadder(room.price_monthly);
  const opensLater = room.next_available && daysUntil(room.next_available, today) > 0;

  const chips = [
    room.bed_size && title(room.bed_size),
    room.max_occupancy > 1 && `Sleeps ${room.max_occupancy}`,
    room.has_private_bathroom && 'Ensuite',
  ].filter(Boolean);

  const specs = [
    ['Type', title(room.room_type)],
    ['Size', room.size_sqm ? `${room.size_sqm} sqm` : null],
    ['Bed', title(room.bed_size)],
    ['Floor', room.floor],
    ['Furnishing', title(room.furnishing_level)],
    ['Deposit', room.deposit_months ? `${room.deposit_months} month${room.deposit_months > 1 ? 's' : ''}` : null],
    ['Minimum stay', room.min_stay_months ? `${room.min_stay_months} months` : null],
    ['Maximum pax', room.max_occupancy],
    ['Aircon', room.has_aircon ? 'Yes' : null],
    ['Private bathroom', room.has_private_bathroom ? 'Yes' : 'Shared'],
  ].filter(([, v]) => v !== null && v !== undefined && v !== '');

  return (
    <details className="room">
      <summary>
        <div className="roomtop">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="code">{room.unit_code}</span>
              {property && (
                <span className="label accent" style={{ fontSize: 10 }}>{property.name}</span>
              )}
            </div>
            <p className="small" style={{ marginTop: 4, color: 'var(--ink)' }}>{room.name}</p>
          </div>
          <Caret />
        </div>
        <div className="roomline">
          <span className="price">{sgd(room.price_monthly)}</span>
          <span className="fine">per month</span>
          {chips.map((c) => (
            <span key={c} className="chip chip-sm">{c}</span>
          ))}
        </div>
        <div style={{ marginTop: 'var(--s3)' }}>
          <span className={`badge badge-${status.tone}`}>{status.label}</span>
        </div>
      </summary>

      <div className="roombody">
        {room.photos?.length > 0 && (
          <div className="strip">
            {room.photos.map((url, i) => (
              <a key={i} href={url} download={`${room.unit_code}-${i + 1}.jpg`}>
                <img src={url} alt={`${room.unit_code}, photo ${i + 1}`} loading="lazy" />
                <span className="dl">Save</span>
              </a>
            ))}
          </div>
        )}

        {ladder && (
          <>
            <div className="label" style={{ marginTop: 'var(--s4)' }}>{t('staff.room.priceByLease')}</div>
            <div className="ladder">
              {ladder.map((t) => (
                <div key={t.months} className={t.anchor ? 'on' : undefined}>
                  <div className="t">{t.months} mo</div>
                  <div className="p">{sgd(t.price)}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {opensLater && (
          <div className="note" style={{ marginTop: 'var(--s4)' }}>
            Early bird, S$50 off the first two months if they commit before{' '}
            {formatDate(room.next_available)}. Total saving S$100.
          </div>
        )}

        {room.description && (
          <p className="small" style={{ marginTop: 'var(--s5)' }}>{room.description}</p>
        )}

        {/* .staffspecs, not .specs. The design system already has a .specs:
            the owner page two-column grid, which laid these rows out side by
            side and clipped every value. */}
        <div className="staffspecs">
          {specs.map(([k, v]) => (
            <div className="row" key={k}>
              <span>{k}</span>
              <b>{v}</b>
            </div>
          ))}
        </div>

        <TagRow label="In the room" list={room.amenities} />
        <TagRow label="Fixtures" list={room.facilities} />

        {room.available_until && (
          <div style={{ marginTop: 'var(--s5)' }}>
            <div className="label">{t('staff.room.bookedBehind')}</div>
            <div className="booking">
              <span>Free now to {formatDate(room.available_until)}</span>
              <span className="badge badge-warn">{t('staff.room.bridgedGap')}</span>
            </div>
          </div>
        )}

        {room.video_tour_url && (
          <a
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 'var(--s5)' }}
            href={room.video_tour_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            3D tour
          </a>
        )}
      </div>
    </details>
  );
}
