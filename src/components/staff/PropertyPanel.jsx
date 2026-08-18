// One property: what it is, how you get there, what the rules are, and every
// room in it.
//
// Two things this panel deliberately does not show, because a channel partner
// reads it on a dedicated PIN alongside our own captains.
//
// No roll at asking. It was the fourth stat tile and it is our monthly revenue
// if every room lets, which is nobody's business but ours.
//
// No housemate names. The roster arrives from housemates_for_staff_pin as
// nationality, gender and lease end, which is what somebody choosing a room
// actually wants to know and is the most a six digit code should ever unlock.

import RoomCard from './RoomCard';
import { isLettable } from '../../lib/staffRooms';
import { useLanguage } from '../../i18n/LanguageContext';
import { localised, localisedList } from '../../lib/localisedText';
import { nationalityKey, genderKey } from '../../i18n/nationalityVocab';
import { vocabKey } from '../../i18n/roomVocab';

export default function PropertyPanel({ property, today, channel }) {
  const { t, lang } = useLanguage();
  const rooms = (property.rooms || []).filter(isLettable);
  const openNow = rooms.filter(
    (r) => !r.next_available || new Date(r.next_available) <= today,
  ).length;
  const housemates = rooms.flatMap((r) => r.housemates || []);

  // 2027年3月 in Chinese, March 2027 in English.
  const untilLabel = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    return lang === 'zh'
      ? `${dt.getFullYear()}年${dt.getMonth() + 1}月`
      : dt.toLocaleDateString('en-SG', { month: 'short', year: 'numeric' });
  };

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
        </div>

        {localised(property, 'description', lang) && (
          <p className="body" style={{ marginTop: 'var(--s5)', fontSize: 15.5 }}>
            {localised(property, 'description', lang)}
          </p>
        )}

        <div className="subsec">
          <div className="label">{t('staff.prop.housemates')}</div>
          {housemates.length > 0 ? (
            <div className="rows" style={{ marginTop: 'var(--s3)' }}>
              {housemates.map((m, i) => (
                <div className="row" key={`${m.unit_code}-${i}`}>
                  <span>{t(nationalityKey(m.nationality))}</span>
                  <span className="small">{t(genderKey(m.gender))}</span>
                  <b className="num">{untilLabel(m.lease_end)}</b>
                </div>
              ))}
            </div>
          ) : (
            <p className="small" style={{ marginTop: 'var(--s3)' }}>
              {t('staff.prop.noHousemates')}
            </p>
          )}
        </div>

        <div className="subsec">
          <div className="grid g3" style={{ gap: 'var(--s6)' }}>
            <div>
              <div className="label">{t('staff.prop.nearestMrt')}</div>
              <ul className="bullets">
                {(property.nearby_mrt || []).map((m, i) => (
                  <li key={i}>
                    <b style={{ color: 'var(--ink)', fontWeight: 400 }}>{t(vocabKey(m.station))}</b>,{' '}
                    {m.line}, {t('staff.prop.minWalk', { n: m.walking_minutes })}
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
                    {t('staff.prop.minWalk', { n: a.walking_minutes })}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="label">{t('staff.prop.facilities')}</div>
              <div className="chips">
                {(property.facilities || []).map((f, i) => (
                  <span key={i} className="chip chip-sm">{t(vocabKey(f))}</span>
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
                {localisedList(property, 'house_rules', lang).map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
            <div>
              <div className="label">{t('staff.room.inEveryRoom')}</div>
              <div className="chips">
                {(property.amenities || []).map((a, i) => (
                  <span key={i} className="chip chip-sm">{t(vocabKey(a))}</span>
                ))}
              </div>
              <div className="label" style={{ marginTop: 'var(--s5)' }}>{t('staff.prop.commonAreas')}</div>
              <p className="small" style={{ marginTop: 6 }}>{t(vocabKey(property.common_areas))}</p>
            </div>
          </div>
        </div>

        {property.images?.length > 0 && (
          <div className="subsec">
            <div className="label">{t('staff.prop.commonPhotos')}</div>
            <div className="strip">
              {property.images.map((url, i) => (
                <a key={i} href={url} download={`${property.code}-common-${i + 1}.jpg`}>
                  <img src={url} alt={`${property.name}, ${i + 1}`} loading="lazy" />
                  <span className="dl">{t('staff.room.save')}</span>
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
            {t('staff.prop.openInMaps')}
          </a>
        </div>
      </div>

      <div style={{ marginTop: 'var(--s7)' }}>
        <div className="label">{t('staff.prop.roomsCount', { n: rooms.length })}</div>
        <div className="rooms">
          {rooms.map((r) => <RoomCard key={r.id} room={r} today={today} channel={channel} />)}
        </div>
      </div>
    </>
  );
}
