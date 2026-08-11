// The door on the staff room desk.
//
// Renders its children once this browser has been unlocked, and a single PIN
// field otherwise. A wrong PIN says only that it was not recognised, matching
// what redeem_staff_pin does in the database: a disabled PIN and a PIN that
// never existed look identical, so the form cannot be used to discover which
// codes are live.

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { LazybeeRoot } from '../../hooks/useLazybeeTheme';
import { buildUnlock, readUnlock, STORAGE_KEY } from '../../lib/staffPin';
import { useLanguage } from '../../i18n/LanguageContext';
import LangSwitch from '../../i18n/LangSwitch';

export default function StaffPinGate({ children }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(null); // null while storage is being read
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [bad, setBad] = useState(false);

  // Read in an effect, not in the useState initialiser. The prerender step runs
  // this in Node, where localStorage does not exist, and a mismatched first
  // render would either throw there or be discarded immediately.
  useEffect(() => {
    let raw = null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      /* private mode, or storage disabled. Treated as locked. */
    }
    setOpen(readUnlock(raw, Date.now()));
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (pin.length !== 6 || busy) return;
    setBusy(true);
    setBad(false);
    const { data, error } = await supabase.rpc('redeem_staff_pin', { p_pin: pin });
    setBusy(false);
    if (error || data !== true) {
      setBad(true);
      setPin('');
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(buildUnlock(Date.now())));
    } catch {
      /* not worth blocking entry over, they just retype it next visit */
    }
    setOpen(true);
  }

  if (open === null) return null;
  if (open) return children;

  return (
    <LazybeeRoot>
      <main
        className="wrap"
        style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}
      >
        <form onSubmit={submit} style={{ maxWidth: 380, margin: '0 auto', width: '100%' }}>
          {/* The switch lives on the gate too. Staff meet this screen before the
              desk, so a Chinese-reading captain would otherwise have to get past
              an English wall to reach the language button. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div className="label">{t('staff.brandNote')}</div>
            <LangSwitch />
          </div>
          <h1 className="h1" style={{ fontSize: 'clamp(26px,3vw,36px)', marginTop: 'var(--s3)' }}>
            {t('staff.roomDesk')}
          </h1>
          <p className="small" style={{ marginTop: 'var(--s3)' }}>
            {t('staff.pinPrompt')}
          </p>

          <div className="field" style={{ marginTop: 'var(--s5)' }}>
            <label className="label" htmlFor="staff-pin">{t('staff.pin')}</label>
            <input
              className="input"
              id="staff-pin"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              autoFocus
              aria-invalid={bad || undefined}
              aria-describedby={bad ? 'staff-pin-error' : undefined}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            {bad && (
              <div className="error" id="staff-pin-error" role="alert">
                {t('staff.pinBad')}
              </div>
            )}
          </div>

          <button
            className="btn btn-accent"
            type="submit"
            style={{ marginTop: 'var(--s5)', width: '100%' }}
            disabled={pin.length !== 6 || busy}
          >
            {busy ? t('staff.checking') : t('staff.openDesk')}
          </button>
        </form>
      </main>
    </LazybeeRoot>
  );
}
