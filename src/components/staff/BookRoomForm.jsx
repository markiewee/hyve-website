// src/components/staff/BookRoomForm.jsx
//
// Book a room for a student and get their onboarding link. The server prices
// it; this form never sends a price. Spec 2026-09-25-staff-desk-booking-link.

import { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { validateDeskBooking, MIN_MONTHS, MAX_MONTHS } from '../../lib/deskBooking';

const EMPTY = { name: '', email: '', phone: '', nationality: '', move_in: '', months: 12 };

export default function BookRoomForm({ room, pin, onClose }) {
  const { t } = useLanguage();
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [failed, setFailed] = useState(null);
  const [copied, setCopied] = useState(false);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const bad = (k) => errors.includes(k);

  async function submit(e) {
    e.preventDefault();
    const body = {
      pin, room_id: room.id, move_in: f.move_in, months: Number(f.months),
      student: { name: f.name, email: f.email, phone: f.phone, nationality: f.nationality },
    };
    const v = validateDeskBooking(body);
    if (!v.ok) { setErrors(v.errors); return; }
    setErrors([]); setBusy(true); setFailed(null);
    try {
      const r = await fetch('/api/booking/desk-book', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v.value),
      });
      const j = await r.json();
      if (!r.ok) {
        if (j.fields) setErrors(j.fields);
        setFailed(t('staff.book.failed'));
      } else setResult(j);
    } catch {
      setFailed(t('staff.book.failed'));
    }
    setBusy(false);
  }

  async function copy() {
    try { await navigator.clipboard.writeText(result.invite_url); setCopied(true); } catch { /* the link is on screen to copy by hand */ }
  }

  if (result) {
    const wa = `https://wa.me/?text=${encodeURIComponent(t('staff.book.shareText', { unit: room.unit_code, url: result.invite_url }))}`;
    return (
      <div className="bookform done">
        <div className="h3">{t('staff.book.doneTitle', { name: f.name })}</div>
        <p className="small">{t('staff.book.doneBody')}</p>
        <input className="input" readOnly value={result.invite_url} onFocus={(e) => e.target.select()} />
        <div className="bookform-actions">
          <button type="button" className="btn btn-sm" onClick={copy}>{copied ? t('staff.book.copied') : t('staff.book.copy')}</button>
          <a className="btn btn-ghost btn-sm" href={wa} target="_blank" rel="noopener noreferrer">{t('staff.book.whatsapp')}</a>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>{t('staff.book.close')}</button>
        </div>
        <p className="small">{t('staff.book.expires')}</p>
      </div>
    );
  }

  return (
    <form className="bookform" onSubmit={submit} noValidate>
      <div className="h3">{t('staff.book.title', { unit: room.unit_code })}</div>
      <label className={`field${bad('name') ? ' bad' : ''}`}>
        <span className="label">{t('staff.book.name')}</span>
        <input className="input" value={f.name} onChange={set('name')} autoComplete="off" />
      </label>
      <label className={`field${bad('email') ? ' bad' : ''}`}>
        <span className="label">{t('staff.book.email')}</span>
        <input className="input" type="email" value={f.email} onChange={set('email')} autoComplete="off" />
      </label>
      <label className="field">
        <span className="label">{t('staff.book.phone')}</span>
        <input className="input" value={f.phone} onChange={set('phone')} autoComplete="off" />
      </label>
      <label className="field">
        <span className="label">{t('staff.book.nationality')}</span>
        <input className="input" value={f.nationality} onChange={set('nationality')} autoComplete="off" />
      </label>
      <div className="bookform-row">
        <label className={`field${bad('move_in') ? ' bad' : ''}`}>
          <span className="label">{t('staff.book.moveIn')}</span>
          <input className="input" type="date" value={f.move_in} onChange={set('move_in')} />
        </label>
        <label className={`field${bad('months') ? ' bad' : ''}`}>
          <span className="label">{t('staff.book.months')}</span>
          <input className="input" type="number" min={MIN_MONTHS} max={MAX_MONTHS} value={f.months} onChange={set('months')} />
        </label>
      </div>
      {errors.length > 0 && <div className="note note-bad">{t('staff.book.fix')}</div>}
      {failed && <div className="note note-bad">{failed}</div>}
      <div className="bookform-actions">
        <button type="submit" className="btn btn-sm" disabled={busy}>{busy ? t('staff.book.working') : t('staff.book.submit')}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>{t('staff.book.cancel')}</button>
      </div>
    </form>
  );
}
