import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { supabase } from '../lib/supabase';
import { BOOKING_URL } from '../lib/booking';
import { track, EVENTS } from '../lib/analytics';
import Wordmark from './Wordmark';

const Footer = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { t } = useLanguage();

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value) return;
    setSubmitting(true);
    try {
      // Upsert so repeat signups don't error on the unique constraint;
      // we'd rather quietly succeed than show a noisy error to the user.
      const { error } = await supabase
        .from('newsletter_subscribers')
        .upsert({ email: value, source: 'footer' }, { onConflict: 'email' });
      if (error) console.error('newsletter signup failed:', error.message);
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 6000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="bg-surface border-t border-border text-foreground-variant w-full py-12 px-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-7xl mx-auto">
        {/* Brand */}
        <div className="col-span-1 md:col-span-1">
          <Link to="/" className="block mb-4" aria-label="Lazybee home">
            <Wordmark size="md" variant="lazybee" />
          </Link>
          <p className="text-foreground-variant font-display text-sm leading-relaxed">
            Singapore co-living, productized — designed, leased and operated as a single product across every unit.
          </p>
          <p className="text-foreground-variant text-xs mt-2">Operated by Makery Pte. Ltd.</p>
          <div className="flex gap-4 mt-6">
            <a
              href="https://www.instagram.com/lazybee.singapore"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground-variant hover:text-accent transition-colors"
            >
              <span className="material-symbols-outlined">public</span>
            </a>
            <a
              href="mailto:hello@lazybee.sg"
              className="text-foreground-variant hover:text-accent transition-colors"
            >
              <span className="material-symbols-outlined">alternate_email</span>
            </a>
            <a
              href="https://wa.me/6580695410"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground-variant hover:text-accent transition-colors"
            >
              <span className="material-symbols-outlined">chat</span>
            </a>
          </div>
        </div>

        {/* Platform */}
        <div className="space-y-4">
          <h4 className="font-display text-xs uppercase tracking-widest text-foreground font-bold">{t('public.footer.platform')}</h4>
          <ul className="space-y-2">
            <li>
              <Link to="/contact" className="font-display text-xs uppercase tracking-widest text-foreground-variant hover:text-accent transition-colors duration-300">
                List your unit
              </Link>
            </li>
            <li>
              <Link to="/faqs" className="font-display text-xs uppercase tracking-widest text-foreground-variant hover:text-accent transition-colors duration-300">
                FAQs
              </Link>
            </li>
            <li>
              <Link to="/contact" className="font-display text-xs uppercase tracking-widest text-foreground-variant hover:text-accent transition-colors duration-300">
                Contact
              </Link>
            </li>
            <li>
              <a
                href={BOOKING_URL}
                onClick={() => track(EVENTS.BROWSE_ROOMS_CLICK, { source: 'footer' })}
                className="text-foreground-variant hover:text-accent font-display text-xs uppercase tracking-widest transition-colors duration-300"
              >
                Browse rooms →
              </a>
            </li>
          </ul>
        </div>

        {/* Legal */}
        <div className="space-y-4">
          <h4 className="font-display text-xs uppercase tracking-widest text-foreground font-bold">{t('public.footer.legal')}</h4>
          <ul className="space-y-2">
            <li>
              <Link to="/privacy-policy" className="font-display text-xs uppercase tracking-widest text-foreground-variant hover:text-accent transition-colors duration-300">
                {t('public.footer.privacy')}
              </Link>
            </li>
            <li>
              <Link to="/terms-of-service" className="font-display text-xs uppercase tracking-widest text-foreground-variant hover:text-accent transition-colors duration-300">
                {t('public.footer.terms')}
              </Link>
            </li>
            <li>
              <Link to="/cookie-policy" className="font-display text-xs uppercase tracking-widest text-foreground-variant hover:text-accent transition-colors duration-300">
                {t('public.footer.cookie')}
              </Link>
            </li>
          </ul>
        </div>

        {/* Newsletter */}
        <div className="space-y-4">
          <h4 className="font-display text-xs uppercase tracking-widest text-foreground font-bold">{t('public.footer.joinLazybee')}</h4>
          {subscribed ? (
            <p className="text-xs text-accent font-display py-3" role="status">
              Thanks! We&apos;ll keep you posted.
            </p>
          ) : (
            <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-surface-container border border-border text-foreground-variant text-xs p-3 rounded-lg w-full outline-1 outline-border focus:outline-accent placeholder:text-foreground-variant/50"
                placeholder={t('public.contact.email')}
              />
              <button
                type="submit"
                disabled={submitting}
                className="bg-accent text-white p-3 rounded-lg hover:opacity-90 transition-opacity flex-shrink-0 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="font-display text-xs uppercase tracking-widest text-foreground-variant">
          &copy; {new Date().getFullYear()} Lazybee. Operated by Makery Pte. Ltd. {t('public.footer.allRights')}.
        </p>
        <div className="flex gap-6">
          <a
            href="https://www.instagram.com/lazybee.singapore"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground-variant hover:text-accent transition-colors"
          >
            <span className="material-symbols-outlined">public</span>
          </a>
          <a
            href="mailto:hello@lazybee.sg"
            className="text-foreground-variant hover:text-accent transition-colors"
          >
            <span className="material-symbols-outlined">alternate_email</span>
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
