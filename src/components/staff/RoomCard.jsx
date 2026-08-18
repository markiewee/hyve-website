// One room, collapsed to the five facts a prospect asks for first and expanding
// to everything else.
//
// A native <details> rather than React state. It opens without JavaScript, it is
// keyboard operable for free, and the browser handles the ARIA. The old page used
// a click handler on a div plus framer-motion for the height, which meant the
// card was not reachable by keyboard at all.
//
// Every string here is keyed. The card used to hold two dozen English literals,
// which was invisible while only captains read it and obvious the moment a
// Chinese rental aggregator was given a PIN. Database values go through
// vocabKey, the enum columns through the small maps below, and the free-text
// description through its _zh column.

import { availabilityStatus, priceLadder, quotedOf, formatDate, daysUntil } from '../../lib/staffRooms';
import Caret from './Caret';
import { useLanguage } from '../../i18n/LanguageContext';
import { vocabKey, roomDisplayName } from '../../i18n/roomVocab';
import { localised } from '../../lib/localisedText';

const sgd = (n) => `S$${Number(n).toLocaleString('en-SG')}`;

// The enum columns. Small, closed, and stored snake_case, so they are mapped
// here rather than title-cased into whatever English the column happens to hold.
const ROOM_TYPE_KEY = {
  master: 'owner.vocab.masterRoom',
  premium: 'owner.vocab.premiumRoom',
  standard: 'owner.vocab.standardRoom',
};
const BED_KEY = {
  queen: 'owner.vocab.queenBed',
  super_single: 'owner.vocab.superSingleBed',
  single: 'owner.vocab.singleBed',
};
const FURNISHING_KEY = {
  fully_furnished: 'staff.room.fullyFurnished',
};

function TagRow({ label, list, t }) {
  if (!list?.length) return null;
  return (
    <div style={{ marginTop: 'var(--s5)' }}>
      <div className="label">{label}</div>
      <div className="chips">
        {list.map((a, i) => (
          <span key={i} className="chip chip-sm">{t(vocabKey(a))}</span>
        ))}
      </div>
    </div>
  );
}

export default function RoomCard({ room, property, today, channel }) {
  const { t, lang } = useLanguage();
  const status = availabilityStatus(room, today);
  // Both stamped by the desk once the channel behind the PIN is known. The
  // fallbacks are what an internal PIN gets, and are the pre-channel behaviour
  // unchanged.
  const price = quotedOf(room);
  const ladder = room.quoted_ladder ?? priceLadder(room.price_monthly);
  const opensLater = room.next_available && daysUntil(room.next_available, today) > 0;
  const date = (d) => formatDate(d, lang);

  const chips = [
    room.bed_size && t(BED_KEY[room.bed_size] ?? room.bed_size),
    room.max_occupancy > 1 && t('staff.room.sleeps', { n: room.max_occupancy }),
    room.has_private_bathroom && t('owner.vocab.ensuiteBathroom'),
  ].filter(Boolean);

  const specs = [
    [t('staff.room.spec.type'), room.room_type ? t(ROOM_TYPE_KEY[room.room_type] ?? room.room_type) : null],
    [t('staff.room.spec.size'), room.size_sqm ? t('staff.room.sqm', { n: room.size_sqm }) : null],
    [t('staff.room.spec.bed'), room.bed_size ? t(BED_KEY[room.bed_size] ?? room.bed_size) : null],
    [t('staff.room.spec.floor'), room.floor],
    [t('staff.room.spec.furnishing'), room.furnishing_level ? t(FURNISHING_KEY[room.furnishing_level] ?? room.furnishing_level) : null],
    [t('staff.room.spec.deposit'), room.deposit_months ? t('staff.room.monthsValue', { n: room.deposit_months }) : null],
    [t('staff.room.spec.minStay'), room.min_stay_months ? t('staff.room.monthsValue', { n: room.min_stay_months }) : null],
    [t('staff.room.spec.maxPax'), room.max_occupancy],
    [t('staff.room.spec.aircon'), room.has_aircon ? t('staff.room.yes') : null],
    [t('staff.room.spec.privateBathroom'), room.has_private_bathroom ? t('staff.room.yes') : t('staff.room.shared')],
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
            <p className="small" style={{ marginTop: 4, color: 'var(--ink)' }}>
              {roomDisplayName(room.name, t, lang)}
            </p>
          </div>
          <Caret />
        </div>
        <div className="roomline">
          <span className="price">{sgd(price)}</span>
          <span className="fine">{t('staff.room.perMonth')}</span>
          {/* Whose rate this is. A partner reading a number with no label has
              no way to tell our base from their own, and the whole risk of
              this change is somebody quoting the wrong one of the two. */}
          {channel && (
            <span className="chip chip-sm accent">
              {t('staff.room.channelRate', { channel: channel.name })}
            </span>
          )}
          {chips.map((c) => (
            <span key={c} className="chip chip-sm">{c}</span>
          ))}
        </div>
        <div style={{ marginTop: 'var(--s3)' }}>
          <span className={`badge badge-${status.tone}`}>
            {t(status.key, { date: status.date ? date(status.date) : '' })}
          </span>
        </div>
      </summary>

      <div className="roombody">
        {room.photos?.length > 0 && (
          <div className="strip">
            {room.photos.map((url, i) => (
              <a key={i} href={url} download={`${room.unit_code}-${i + 1}.jpg`}>
                <img src={url} alt={`${room.unit_code}, ${i + 1}`} loading="lazy" />
                <span className="dl">{t('staff.room.save')}</span>
              </a>
            ))}
          </div>
        )}

        {ladder && (
          <>
            <div className="label" style={{ marginTop: 'var(--s4)' }}>{t('staff.room.priceByLease')}</div>
            <div className="ladder">
              {ladder.map((rung) => (
                <div key={rung.months} className={rung.anchor ? 'on' : undefined}>
                  <div className="t">{t('staff.room.monthsShort', { n: rung.months })}</div>
                  <div className="p">{sgd(rung.price)}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {opensLater && (
          <div className="note" style={{ marginTop: 'var(--s4)' }}>
            {t('staff.room.earlyBird', { date: date(room.next_available) })}
          </div>
        )}

        {localised(room, 'description', lang) && (
          <p className="small" style={{ marginTop: 'var(--s5)' }}>
            {localised(room, 'description', lang)}
          </p>
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

        <TagRow label={t('staff.room.inTheRoom')} list={room.amenities} t={t} />
        <TagRow label={t('staff.room.fixtures')} list={room.facilities} t={t} />

        {room.available_until && (
          <div style={{ marginTop: 'var(--s5)' }}>
            <div className="label">{t('staff.room.bookedBehind')}</div>
            <div className="booking">
              <span>{t('staff.room.freeNowTo', { date: date(room.available_until) })}</span>
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
            {t('staff.room.tour3d')}
          </a>
        )}
      </div>
    </details>
  );
}
