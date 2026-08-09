// src/entry-server.jsx
//
// The server half of the build. `scripts/prerender.mjs` imports render() from the
// bundle Vite produces from this file and writes the result to dist/<route>/index.html,
// so that a crawler which does not execute JavaScript still gets a real page.
//
// Two deliberate decisions:
//
// 1. This file declares its own small route table instead of importing App.jsx.
//    App.jsx imports every portal page, which drags react-pdf, leaflet,
//    react-signature-canvas and the Supabase-backed auth tree into a Node bundle
//    that has no business loading any of it. The marketing routes are the only
//    ones we prerender, so the server only needs to know about the marketing
//    routes. The page components themselves are the real ones, imported directly,
//    so whatever HomePage renders is what gets prerendered.
//
// 2. The chrome rule mirrors AppContent exactly: the owner homepage ships its own
//    header and footer, every other public page gets the site Navbar and Footer.
//    If that rule changes in App.jsx it must change here too, and the link-count
//    check in the prerender script will catch it if it does not.

import { renderToString } from 'react-dom/server';
// react-router 7 moved StaticRouter into the framework-agnostic `react-router`
// package. `react-router-dom/server` no longer exists.
import { StaticRouter } from 'react-router';
import { HelmetProvider } from 'react-helmet-async';

import { LanguageProvider } from './i18n/LanguageContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './components/HomePage';
import FAQsPage from './components/FAQsPage';
import ContactPage from './components/ContactPage';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import CookiePolicy from './components/CookiePolicy';

export { ROUTE_META, PRERENDER_ROUTES, canonicalFor, BASE_URL, SITE_NAME, DEFAULT_OG_IMAGE, DEFAULT_DESCRIPTION } from './lib/siteMeta.js';

const PAGES = {
  '/': HomePage,
  '/faqs': FAQsPage,
  '/contact': ContactPage,
  '/privacy-policy': PrivacyPolicy,
  '/terms-of-service': TermsOfService,
  '/cookie-policy': CookiePolicy,
};

/**
 * Render one route to an HTML string.
 *
 * @param {string} url  a route path, e.g. '/faqs'
 * @returns {{ html: string, helmetApplied: boolean }}
 */
export function render(url) {
  const Page = PAGES[url];
  if (!Page) throw new Error(`entry-server: no page registered for ${url}`);

  // Same condition as AppContent: the owner homepage carries its own chrome.
  const bareChrome = url === '/';

  // Helmet is wired up so the <SEO> components inside the pages do not throw for
  // want of a provider. Whether it actually emits anything is reported, not
  // relied on: the head is written from src/lib/siteMeta.js either way.
  const helmetContext = {};

  const html = renderToString(
    <HelmetProvider context={helmetContext}>
      <LanguageProvider>
        <StaticRouter location={url}>
          <div className="min-h-screen bg-background">
            {!bareChrome && <Navbar />}
            <Page />
            {!bareChrome && <Footer />}
          </div>
        </StaticRouter>
      </LanguageProvider>
    </HelmetProvider>,
  );

  const helmetApplied = Boolean(helmetContext.helmet?.title?.toString?.().includes('<title'));

  return { html, helmetApplied };
}
