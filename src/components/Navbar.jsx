import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Wordmark from './Wordmark';
import { BOOKING_URL } from '../lib/booking';
import { track, EVENTS } from '../lib/analytics';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setIsOpen(false); }, [location.pathname]);

  const navigation = [
    { name: 'FAQs', href: '/faqs' },
    { name: 'Contact', href: '/contact' },
  ];
  const isActive = (path) => location.pathname === path;
  const onBrowse = () => track(EVENTS.BROWSE_ROOMS_CLICK, { source: 'navbar' });

  return (
    <nav className="fixed top-0 w-full z-50 bg-background/70 backdrop-blur-xl border-b border-border">
      <div className="flex justify-between items-center px-6 md:px-8 py-4 max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-10">
          <Link to="/" aria-label="Lazybee home"><Wordmark size="md" /></Link>
          <div className="hidden md:flex items-center gap-8">
            {navigation.map((item) => (
              <Link key={item.href} to={item.href}
                className={`font-display font-semibold tracking-tight transition-colors ${
                  isActive(item.href) ? 'text-accent' : 'text-foreground-variant hover:text-foreground'}`}>
                {item.name}
              </Link>
            ))}
          </div>
        </div>
        <div className="hidden md:flex items-center gap-5">
          <a href={BOOKING_URL} onClick={onBrowse} className="font-display font-semibold text-foreground-variant hover:text-foreground text-sm">Browse rooms</a>
          <a href="https://portal.lazybee.sg" className="font-display font-semibold text-foreground-variant hover:text-foreground text-sm">Portal</a>
          <Link to="/contact"
             className="bg-accent text-accent-foreground font-display font-bold px-6 py-2.5 rounded-full hover:opacity-90 active:scale-95 transition-all text-sm">
            List your unit →
          </Link>
        </div>
        <button className="md:hidden p-2 text-foreground active:scale-95" onClick={() => setIsOpen(!isOpen)} aria-label="Menu">
          <span className="material-symbols-outlined">{isOpen ? 'close' : 'menu'}</span>
        </button>
      </div>
      {isOpen && (
        <div className="md:hidden bg-surface/95 backdrop-blur-xl border-t border-border">
          <div className="px-6 py-4 space-y-1">
            {navigation.map((item) => (
              <Link key={item.href} to={item.href} onClick={() => setIsOpen(false)}
                className={`block px-4 py-3 rounded-xl font-display font-semibold ${
                  isActive(item.href) ? 'text-accent bg-surface-container' : 'text-foreground-variant hover:text-foreground hover:bg-surface-container'}`}>
                {item.name}
              </Link>
            ))}
            <div className="pt-4 space-y-3 border-t border-border mt-2">
              <a href={BOOKING_URL} onClick={() => { onBrowse(); setIsOpen(false); }} className="block text-center px-4 py-3 text-foreground-variant font-display font-semibold rounded-xl">Browse rooms</a>
              <a href="https://portal.lazybee.sg" onClick={() => setIsOpen(false)} className="block text-center px-4 py-3 text-foreground-variant font-display font-semibold rounded-xl">Portal</a>
              <Link to="/contact" onClick={() => setIsOpen(false)}
                 className="block text-center bg-accent text-accent-foreground font-display font-bold px-6 py-3 rounded-full">List your unit →</Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
export default Navbar;
