import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';

const Footer = () => {
  const [email, setEmail] = useState('');
  const { t } = useLanguage();

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    // Future: integrate with mailing list
    setEmail('');
  };

  return (
    <footer className="bg-slate-50 w-full py-12 px-8 border-t-0">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-7xl mx-auto">
        {/* Brand */}
        <div className="col-span-1 md:col-span-1">
          <Link to="/" className="block mb-4">
            <img src="/hyve-logo.png" alt="Hyve" className="h-8" />
          </Link>
          <p className="text-slate-400 font-['Manrope'] text-sm leading-relaxed">
            Pioneering the future of collective living through architectural innovation and community design.
          </p>
          <div className="flex gap-4 mt-6">
            <a
              href="https://www.instagram.com/hyve.sg"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-teal-500 transition-colors"
            >
              <span className="material-symbols-outlined">public</span>
            </a>
            <a
              href="mailto:hello@hyve.sg"
              className="text-slate-400 hover:text-teal-500 transition-colors"
            >
              <span className="material-symbols-outlined">alternate_email</span>
            </a>
          </div>
        </div>

        {/* Platform */}
        <div className="space-y-4">
          <h4 className="font-['Inter'] text-xs uppercase tracking-widest text-teal-600 font-bold">{t('public.footer.platform')}</h4>
          <ul className="space-y-2">
            <li>
              <Link to="/properties" className="font-['Inter'] text-xs uppercase tracking-widest text-slate-400 hover:text-teal-500 transition-colors duration-300 underline-offset-4 hover:underline decoration-teal-500/30">
                {t('public.footer.properties')}
              </Link>
            </li>
            <li>
              <Link to="/locations" className="font-['Inter'] text-xs uppercase tracking-widest text-slate-400 hover:text-teal-500 transition-colors duration-300 underline-offset-4 hover:underline decoration-teal-500/30">
                {t('public.footer.locations')}
              </Link>
            </li>
            <li>
              <Link to="/blog" className="font-['Inter'] text-xs uppercase tracking-widest text-slate-400 hover:text-teal-500 transition-colors duration-300 underline-offset-4 hover:underline decoration-teal-500/30">
                {t('public.footer.blog')}
              </Link>
            </li>
          </ul>
        </div>

        {/* Legal */}
        <div className="space-y-4">
          <h4 className="font-['Inter'] text-xs uppercase tracking-widest text-teal-600 font-bold">{t('public.footer.legal')}</h4>
          <ul className="space-y-2">
            <li>
              <Link to="/privacy-policy" className="font-['Inter'] text-xs uppercase tracking-widest text-slate-400 hover:text-teal-500 transition-colors duration-300 underline-offset-4 hover:underline decoration-teal-500/30">
                {t('public.footer.privacy')}
              </Link>
            </li>
            <li>
              <Link to="/terms-of-service" className="font-['Inter'] text-xs uppercase tracking-widest text-slate-400 hover:text-teal-500 transition-colors duration-300 underline-offset-4 hover:underline decoration-teal-500/30">
                {t('public.footer.terms')}
              </Link>
            </li>
            <li>
              <Link to="/cookie-policy" className="font-['Inter'] text-xs uppercase tracking-widest text-slate-400 hover:text-teal-500 transition-colors duration-300 underline-offset-4 hover:underline decoration-teal-500/30">
                {t('public.footer.cookie')}
              </Link>
            </li>
          </ul>
        </div>

        {/* Newsletter */}
        <div className="space-y-4">
          <h4 className="font-['Inter'] text-xs uppercase tracking-widest text-teal-600 font-bold">{t('public.footer.joinHyve')}</h4>
          <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white border-none text-xs p-3 rounded-lg w-full outline-1 outline-[rgba(187,202,198,0.15)] focus:outline-[#006b5f]"
              placeholder={t('public.contact.email')}
            />
            <button
              type="submit"
              className="bg-[#006b5f] text-white p-3 rounded-lg hover:opacity-90 transition-opacity flex-shrink-0"
            >
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </form>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="font-['Inter'] text-xs uppercase tracking-widest text-slate-400">
          &copy; {new Date().getFullYear()} Hyve Living Systems. {t('public.footer.allRights')}.
        </p>
        <div className="flex gap-6">
          <a
            href="https://www.instagram.com/hyve.sg"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-[#006b5f] transition-colors"
          >
            <span className="material-symbols-outlined">public</span>
          </a>
          <a
            href="mailto:hello@hyve.sg"
            className="text-slate-400 hover:text-[#006b5f] transition-colors"
          >
            <span className="material-symbols-outlined">alternate_email</span>
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
