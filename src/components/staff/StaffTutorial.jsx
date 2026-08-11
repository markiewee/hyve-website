// The five step walkthrough, shown once on a browser's first visit to the desk
// and replayable from the ? in the header.
//
// A stepped panel rather than tooltips anchored to real elements. The desk is
// opened on a phone in a lift lobby as often as on a laptop, and anchored
// coach marks are the kind of thing that works until the layout moves and then
// points at nothing. This points at nothing by design.
//
// Copy lives in the dictionaries under staff.tour.*, one title and one body per
// step, so the tour is translated by the same parity tests as everything else.

import { useEffect, useRef, useState } from 'react';
import { TOUR_STEPS } from '../../lib/staffGreeting';
import { useLanguage } from '../../i18n/LanguageContext';

export default function StaffTutorial({ open, onClose }) {
  const { t } = useLanguage();
  const [i, setI] = useState(0);
  const panel = useRef(null);

  // Reopening from the header should start at the beginning, not wherever the
  // reader abandoned it last time.
  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // Move focus in, so the keyboard is inside the dialog and Escape is the
    // obvious way out.
    panel.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const last = i === TOUR_STEPS.length - 1;
  const step = TOUR_STEPS[i];

  return (
    <div
      className="tourwrap"
      onClick={(e) => {
        // Backdrop only. A click that started inside the panel must not close it.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="tour"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        tabIndex={-1}
        ref={panel}
      >
        <div className="tourhead">
          <div className="label">{t('staff.tour.title')}</div>
          <div className="label num">{i + 1} / {TOUR_STEPS.length}</div>
        </div>

        <h2 className="h3" id="tour-title" style={{ marginTop: 'var(--s4)' }}>
          {t(`${step}.title`)}
        </h2>
        <p className="small" style={{ marginTop: 'var(--s3)' }}>
          {t(`${step}.body`)}
        </p>

        <div className="tourdots" aria-hidden="true">
          {TOUR_STEPS.map((s, n) => (
            <span key={s} className={n === i ? 'on' : undefined} />
          ))}
        </div>

        <div className="tourfoot">
          {/* Skip disappears on the last step. Leaving it there put "Done" on
              both sides of the footer, which reads as a choice between two
              things that do the same thing. */}
          {last ? (
            <span />
          ) : (
            <button className="btn btn-ghost btn-sm" type="button" onClick={onClose}>
              {t('staff.tour.skip')}
            </button>
          )}
          <div style={{ display: 'flex', gap: 'var(--s3)' }}>
            {i > 0 && (
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => setI((n) => n - 1)}
              >
                {t('staff.tour.back')}
              </button>
            )}
            <button
              className="btn btn-accent btn-sm"
              type="button"
              onClick={() => (last ? onClose() : setI((n) => n + 1))}
            >
              {last ? t('staff.tour.done') : t('staff.tour.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
