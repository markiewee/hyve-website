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
import { Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

import { LanguageProvider } from './i18n/LanguageContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './components/HomePage';
import FAQsPage from './components/FAQsPage';
import ReviewsPage from './components/ReviewsPage';
import DevelopersPage from './components/DevelopersPage';
import ContactPage from './components/ContactPage';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import CookiePolicy from './components/CookiePolicy';
import HiveIndexPage from './pages/hive/HiveIndexPage';
import HiveArticlePage from './pages/hive/HiveArticlePage';
import HiveTopicPage from './pages/hive/HiveTopicPage';

export { ROUTE_META, ALL_ROUTE_META, PRERENDER_ROUTES, canonicalFor, BASE_URL, SITE_NAME, DEFAULT_OG_IMAGE, DEFAULT_DESCRIPTION } from './lib/siteMeta.js';

const STATIC_PAGES = {
  '/': HomePage,
  '/faqs': FAQsPage,
  /* Unlisted, indexable. Only reached by the prerender when
     src/data/testimonials.js has a quote in it, but registered
     unconditionally: a page that exists in the router and not here fails the
     build with "no page registered", which is how this one was caught. */
  '/reviews': ReviewsPage,
  '/zh/reviews': ReviewsPage,
  '/developers': DevelopersPage,
  '/contact': ContactPage,
  '/privacy-policy': PrivacyPolicy,
  '/terms-of-service': TermsOfService,
  '/cookie-policy': CookiePolicy,
};

/** True for anything under the Hive, which is matched by pattern rather than looked up. */
const isHiveRoute = (url) => url === '/hive' || url.startsWith('/hive/');

/** A route is renderable if it is one of the flat pages or anywhere in the Hive. */
const isKnownRoute = (url) => Boolean(STATIC_PAGES[url]) || isHiveRoute(url);

/**
 * Render one route to an HTML string.
 *
 * @param {string} url  a route path, e.g. '/faqs'
 * @returns {{ html: string, helmetApplied: boolean }}
 */
export function render(url) {
  if (!isKnownRoute(url)) throw new Error(`entry-server: no page registered for ${url}`);

  // Same condition as AppContent: the owner homepage and the Hive carry their own chrome.
  const bareChrome = url === '/' || isHiveRoute(url);

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
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/faqs" element={<FAQsPage />} />
              <Route path="/reviews" element={<ReviewsPage lang="en" />} />
              <Route path="/zh/reviews" element={<ReviewsPage lang="zh" />} />
              <Route path="/developers" element={<DevelopersPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-service" element={<TermsOfService />} />
              <Route path="/cookie-policy" element={<CookiePolicy />} />
              {/* The Hive. Static segments first so /hive/page/2, /hive/topic/rules
                  and the language roots can never be read as an article slug. React
                  Router ranks static above dynamic anyway; the order is kept
                  explicit because the cost of getting it wrong is a whole language
                  silently resolving to a missing article. */}
              <Route path="/hive" element={<HiveIndexPage lang="en" />} />
              <Route path="/hive/page/:page" element={<HiveIndexPage lang="en" />} />
              <Route path="/hive/topic/:tag" element={<HiveTopicPage />} />
              <Route path="/hive/zh" element={<HiveIndexPage lang="zh" />} />
              <Route path="/hive/zh/page/:page" element={<HiveIndexPage lang="zh" />} />
              <Route path="/hive/zh/:slug" element={<HiveArticlePage lang="zh" />} />
              {/* Unlisted. Reachable by URL, in the sitemap, indexable, and linked
                  from nowhere on this site. See src/lib/hiveArticles.js. */}
              <Route path="/hive/my/:slug" element={<HiveArticlePage lang="my" />} />
              <Route path="/hive/bn/:slug" element={<HiveArticlePage lang="bn" />} />
              <Route path="/hive/:slug" element={<HiveArticlePage lang="en" />} />
            </Routes>
            {!bareChrome && <Footer />}
          </div>
        </StaticRouter>
      </LanguageProvider>
    </HelmetProvider>,
  );

  const helmetApplied = Boolean(helmetContext.helmet?.title?.toString?.().includes('<title'));

  return { html, helmetApplied };
}
