// src/components/staff/MyBookings.jsx
//
// Every booking made with this PIN and how far each student has got. The
// link comes back only while it can still be used (desk_bookings_for_pin).

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../i18n/LanguageContext';
import { deskStage } from '../../lib/deskBooking';
import { formatDate } from '../../lib/staffRooms';

const STAGE_BADGE = {
  linkSent: 'badge', signedUp: 'badge', details: 'badge', id: 'badge',
  agreement: 'badge badge-ok', deposit: 'badge badge-ok',
  expired: 'badge badge-warn', cancelled: 'badge badge-warn',
};

export default function MyBookings({ pin }) {
  const { t, lang } = useLanguage();
  const [rows, setRows] = useState(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    supabase.rpc('desk_bookings_for_pin', { p_pin: pin }).then(({ data }) => setRows(data || []));
  }, [pin]);

  if (rows === null) return <div className="skeleton" style={{ height: 200 }} />;
  if (rows.length === 0) return <div className="empty"><div className="h3">{t('staff.mine.none')}</div></div>;

  return (
    <div className="mybookings">
      {rows.map((r) => {
        const stage = deskStage(r);
        return (
          <div className="mybooking" key={r.id}>
            <div>
              <b>{r.applicant_name}</b>
              <div className="small">{r.unit_code}, {formatDate(r.move_in, lang)}, {t('staff.mine.months', { n: r.duration_months })}</div>
            </div>
            <span className={STAGE_BADGE[stage]}>{t(`staff.mine.stage.${stage}`)}</span>
            {r.invite_url && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={async () => {
                try { await navigator.clipboard.writeText(r.invite_url); setCopied(r.id); } catch { /* nothing to do */ }
              }}>
                {copied === r.id ? t('staff.book.copied') : t('staff.mine.copyLink')}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
