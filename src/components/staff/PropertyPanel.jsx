// One property: what it is, how you get there, what the rules are, and every
// room in it.
//
// The housemates block tells the truth about why it is empty. tenant_profiles is
// RLS-protected and the anon key cannot read it, so a signed-out viewer gets an
// explanation rather than a section that silently disappears. Signed in as staff,
// the same block fills with the real roster.

import RoomCard from './RoomCard';
import { isLettable } from '../../lib/staffRooms';
import { useLanguage } from '../../i18n/LanguageContext';

const sgd = (n) => `S$${Number(n).toLocaleString('en-SG')}`;

export default function PropertyPanel({ property, today }) {
  const { t } = useLanguage();
  const rooms = (property.rooms || []).filter(isLettable);
  const openNow = rooms.filter(
    (r) => !r.next_available || new Date(r.next_available) <= today,
  ).length;
  const roll = rooms.reduce((s, r) => s + (r.price_monthly || 0), 0);
  const housemates = rooms.flatMap((r) => r.tenant_profiles || []);

  return (
    <>
      <div className="prop">
        <div className="label">{property.code}</div>
        <div className="place" style={{ marginTop: 8 }}>{property.name}</div>
        <p className="small" style={{ marginTop: 6 }}>{property.address}</p>

        <div className="propmeta">
          <div className="stat"><div className="n">{rooms.length}</div><div className="l">{t('staff.prop.rooms')}</div></div>
          <div className="stat"><div className="n">{openNow}</div><div className="l">{t('staff.prop.openToday')}</div></div>
          <div className="stat"><div className="n">{property.num_bathrooms}</div><div className="l">{t('staff.prop.bathrooms')}</div></div>
          <div className="stat"><div className="n">{sgd(roll)}</div><div className="l">{t('staff.prop.rollAtAsking')}</div></div>
        </div>

        {property.description && (
          <p className="body" style={{ marginTop: 'var(--s5)', fontSize: 15.5 }}>{property.description}</p>
        )}

        <div className="subsec">
          <div className="label">{t('staff.prop.housemates')}</div>
          {housemates.length > 0 ? (
            <div className="rows" style={{ marginTop: 'var(--s3)' }}>
              {housemates.map((t, i) => (
                <div className="row" key={i}>
                  <span>{t.tenant_details?.full_name || t.username}</span>
                  <b>{t.tenant_details?.nationality || ''}</b>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="empty"
              style={{ marginTop: 'var(--s3)', padding: 'var(--s5)', textAlign: 'left' }}
            >
              <p className="small" style={{ margin: 0 }}>
                Signed out. The roster reads <span className="num">tenant_profiles</span>, which the
                anon key cannot see, so this stays empty until a staff account is signed in.
              </p>
            </div>
          )}
        </div>

        <div className="subsec">
          <div className="grid g3" style={{ gap: 'var(--s6)' }}>
            <div>
              <div className="label">{t('staff.prop.nearestMrt')}</div>
              <ul className="bullets">
                {(property.nearby_mrt || []).map((m, i) => (
                  <li key={i}>
                    <b style={{ color: 'var(--ink)', fontWeight: 400 }}>{m.station}</b>, {m.line},{' '}
                    {m.walking_minutes} min walk
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="label">{t('staff.prop.nearby')}</div>
              <ul className="bullets">
                {(property.nearby_amenities || []).map((a, i) => (
                  <li key={i}>
                    <b style={{ color: 'var(--ink)', fontWeight: 400 }}>{a.name}</b>,{' '}
                    {a.walking_minutes} min walk
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="label">{t('staff.prop.facilities')}</div>
              <div className="chips">
                {(property.facilities || []).map((f, i) => (
                  <span key={i} className="chip chip-sm">{f}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="subsec">
          <div className="grid g2" style={{ gap: 'var(--s6)' }}>
            <div>
              <div className="label">{t('staff.prop.houseRules')}</div>
              <ul className="bullets">
                {(property.house_rules || []).map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
            <div>
              <div className="label">{t('staff.room.inEveryRoom')}</div>
              <div className="chips">
                {(property.amenities || []).map((a, i) => (
                  <span key={i} className="chip chip-sm">{a}</span>
                ))}
              </div>
              <div className="label" style={{ marginTop: 'var(--s5)' }}>{t('staff.prop.commonAreas')}</div>
              <p className="small" style={{ marginTop: 6 }}>{property.common_areas}</p>
            </div>
          </div>
        </div>

        {property.images?.length > 0 && (
          <div className="subsec">
            <div className="label">{t('staff.prop.commonPhotos')}</div>
            <div className="strip">
              {property.images.map((url, i) => (
                <a key={i} href={url} download={`${property.code}-common-${i + 1}.jpg`}>
                  <img src={url} alt={`${property.name}, common area ${i + 1}`} loading="lazy" />
                  <span className="dl">Save</span>
                </a>
              ))}
            </div>
          </div>
        )}

        <div
          className="subsec"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--s4)',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div className="label">{t('staff.prop.location')}</div>
            <p className="small" style={{ marginTop: 6 }}>{property.address}</p>
            <p className="fine num" style={{ marginTop: 4 }}>
              {property.latitude}, {property.longitude}
            </p>
          </div>
          <a
            className="btn btn-ghost btn-sm"
            target="_blank"
            rel="noopener noreferrer"
            href={`https://www.google.com/maps/search/?api=1&query=${property.latitude},${property.longitude}`}
          >
            Open in maps
          </a>
        </div>
      </div>

      <div style={{ marginTop: 'var(--s7)' }}>
        <div className="label">Rooms, {rooms.length}</div>
        <div className="rooms">
          {rooms.map((r) => <RoomCard key={r.id} room={r} today={today} />)}
        </div>
      </div>
    </>
  );
}
