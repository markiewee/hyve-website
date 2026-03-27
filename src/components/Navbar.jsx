import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { t, lang, setLanguage } = useLanguage();

  const navigation = [
    { name: t('public.nav.properties'), href: '/properties' },
    { name: t('public.nav.locations'), href: '/locations' },
    { name: t('public.nav.about'), href: '/about' },
    { name: t('public.nav.blog'), href: '/blog' },
  ];

  const isActive = (path) => location.pathname === path;

  const toggleLang = () => {
    setLanguage(lang === 'en' ? 'zh' : 'en');
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl shadow-sm">
      <div className="flex justify-between items-center px-8 py-4 max-w-screen-2xl mx-auto">
        {/* Left: Logo + Links */}
        <div className="flex items-center gap-12">
          <Link to="/">
            <img src="/hyve-logo.png" alt="Hyve" className="h-8" />
          </Link>
          <div className="hidden md:flex items-center gap-8">
            {navigation.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={`font-['Plus_Jakarta_Sans'] font-bold tracking-tight transition-colors duration-300 ${
                  isActive(item.href)
                    ? 'text-teal-700 border-b-2 border-teal-600 pb-1'
                    : 'text-slate-600 hover:text-teal-500'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={toggleLang}
            className="font-['Inter'] text-xs font-bold tracking-wide text-slate-500 hover:text-teal-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-teal-300 transition-all"
          >
            {lang === 'en' ? '中文' : 'EN'}
          </button>
          <Link
            to="/portal/login"
            className="font-['Plus_Jakarta_Sans'] font-bold tracking-tight text-slate-600 hover:text-teal-600 px-4 py-2 transition-all text-sm"
          >
            {t('public.nav.login')}
          </Link>
          <Link
            to="/contact"
            className="bg-[#006b5f] text-white font-['Plus_Jakarta_Sans'] font-bold tracking-tight px-6 py-2.5 rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-sm text-sm"
          >
            {t('public.nav.getInTouch')}
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2 text-slate-600 active:scale-95 transition-transform"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="material-symbols-outlined">
            {isOpen ? 'close' : 'menu'}
          </span>
        </button>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-t border-slate-100">
          <div className="px-6 py-4 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setIsOpen(false)}
                className={`block px-4 py-3 rounded-xl font-['Plus_Jakarta_Sans'] font-bold tracking-tight transition-colors ${
                  isActive(item.href)
                    ? 'text-teal-700 bg-teal-50'
                    : 'text-slate-600 hover:text-teal-500 hover:bg-slate-50'
                }`}
              >
                {item.name}
              </Link>
            ))}
            <div className="pt-4 space-y-3 border-t border-slate-100 mt-2">
              <button
                onClick={toggleLang}
                className="block w-full text-center px-4 py-3 font-['Inter'] text-sm font-bold text-slate-500 rounded-xl hover:bg-slate-50 border border-slate-200"
              >
                {lang === 'en' ? '切换中文' : 'Switch to English'}
              </button>
              <Link
                to="/portal/login"
                onClick={() => setIsOpen(false)}
                className="block text-center px-4 py-3 text-slate-600 font-['Plus_Jakarta_Sans'] font-bold rounded-xl hover:bg-slate-50"
              >
                {t('public.nav.login')}
              </Link>
              <Link
                to="/contact"
                onClick={() => setIsOpen(false)}
                className="block text-center bg-[#006b5f] text-white font-['Plus_Jakarta_Sans'] font-bold px-6 py-3 rounded-xl"
              >
                {t('public.nav.getInTouch')}
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
