import { useEffect, useRef, useState } from 'react';
import { FAQ } from '../../data/ownerPage';
import { useLanguage } from '../../i18n/LanguageContext';

/**
 * One open at a time, animated on max-height exactly as the prototype does it.
 * The height is measured rather than guessed because these answers wrap to very
 * different heights between a 320px phone and a desktop, and a fixed max-height
 * would clip the long ones on a phone.
 */
export default function FaqSection() {
  const { t, lang } = useLanguage();
  const [open, setOpen] = useState(-1);
  const answers = useRef([]);

  useEffect(() => {
    const apply = () => answers.current.forEach((el, i) => {
      if (!el) return;
      el.style.maxHeight = i === open ? `${el.scrollHeight}px` : '';
    });
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
    /* `lang` is a dependency because a Chinese answer wraps to a different
       height than the English one, and the open panel's max-height is a measured
       pixel value that would otherwise clip after a language switch. */
  }, [open, lang]);

  return (
    <section className="wrap sec rule" id="faq">
      <h2 className="h1 rv">{t('owner.faq.title')}</h2>
      <div className="qs">
        {FAQ.map(([q, a], i) => (
          /* The open state rides on a data attribute, not on className. The reveal
             observer adds .in to these nodes imperatively, and React rewrites the
             class attribute whenever the className prop changes, which would wipe
             .in and leave an opened question invisible. */
          <div className="q rv" data-open={open === i ? 'true' : undefined} key={q}>
            <button
              type="button"
              aria-expanded={open === i}
              onClick={() => setOpen(open === i ? -1 : i)}
            >
              {t(q)}
            </button>
            <div className="a" ref={(el) => { answers.current[i] = el; }}>
              <p>{t(a)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
