import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import './App.css';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './components/HomePage';
import FAQsPage from './components/FAQsPage';
import ContactPage from './components/ContactPage';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import CookiePolicy from './components/CookiePolicy';
import StaffResourcePage from './components/StaffResourcePage';
import HiveIndexPage from './pages/hive/HiveIndexPage';
import HiveArticlePage from './pages/hive/HiveArticlePage';
import HiveTopicPage from './pages/hive/HiveTopicPage';

// Auth
import { AuthProvider } from './hooks/useAuth';
import AuthGuard from './components/portal/AuthGuard';
import LoginPage from './pages/portal/LoginPage';
import ResetPasswordPage from './pages/portal/ResetPasswordPage';
import SignupPage from './pages/portal/SignupPage';
import DashboardPage from './pages/portal/DashboardPage';
import LandlordPage from './pages/portal/LandlordPage';
import BillingPage from './pages/portal/BillingPage';
import IssuesPage from './pages/portal/IssuesPage';
import NewIssuePage from './pages/portal/NewIssuePage';
import PropertyOverviewPage from './pages/portal/PropertyOverviewPage';
import PropertyTicketsPage from './pages/portal/PropertyTicketsPage';
import PropertyTenantsPage from './pages/portal/PropertyTenantsPage';
import AdminDashboardPage from './pages/portal/AdminDashboardPage';
import AdminDevicesPage from './pages/portal/AdminDevicesPage';
import AdminOnboardingDetailPage from './pages/portal/AdminOnboardingDetailPage';
import AdminAnnouncementsPage from './pages/portal/AdminAnnouncementsPage';
import AdminRentPage from './pages/portal/AdminRentPage';
import AdminListingsPage from "./pages/portal/AdminListingsPage";
import AdminInvestorsPage from './pages/portal/AdminInvestorsPage';
import AdminExpenseImportPage from './pages/portal/AdminExpenseImportPage';
import AdminDocumentsPage from './pages/portal/AdminDocumentsPage';
import AdminLocksPage from './pages/portal/AdminLocksPage';
import AdminViewingsPage from './pages/portal/AdminViewingsPage';
import AdminViewingDetailPage from './pages/portal/AdminViewingDetailPage';
import CaptainClaimsPage from './pages/portal/CaptainClaimsPage';
import CaptainClaimFormPage from './pages/portal/CaptainClaimFormPage';
import TenantDocumentsPage from './pages/portal/TenantDocumentsPage';
import MemberSettingsPage from './pages/portal/MemberSettingsPage';
import HelpPage from './pages/portal/HelpPage';
import InvestorDashboardPage from './pages/portal/InvestorDashboardPage';
import InvestorReportsPage from './pages/portal/InvestorReportsPage';
import InvestorSignupPage from './pages/portal/InvestorSignupPage';
import OnboardingPage from './pages/portal/OnboardingPage';
import SigningConfirmationPage from './pages/portal/SigningConfirmationPage';
import PropertyGuidePage from './pages/portal/PropertyGuidePage';
import InvoiceDetailPage from "./pages/portal/InvoiceDetailPage";
import AdminInvoicesPage from "./pages/portal/AdminInvoicesPage";
import AdminOwnerDocumentsPage from "./pages/portal/AdminOwnerDocumentsPage";
import AdminMembersPage from './pages/portal/AdminMembersPage';
import AdminPastTenantsPage from './pages/portal/AdminPastTenantsPage';
import AdminInboxPage from './pages/portal/AdminInboxPage';
import AdminLeadsPage from './pages/portal/AdminLeadsPage';
import { ConfirmHost } from './lib/confirm';

function AppContent() {
  const location = useLocation();
  const isPortal = location.pathname.startsWith('/portal');
  const isViewing = false; // booking + viewing flows now live on book.lazybee.sg
  // The owner homepage ships its own header and footer, themed alabaster/tobacco.
  // The site chrome is dark terracotta, so bolting it on would put a dark bar top
  // and bottom of a light page. Its footer carries the legal links across.
  const isOwnerHome = location.pathname === '/';
  // The Hive is themed alabaster/tobacco like the owner homepage and ships the
  // same chrome, so the dark terracotta site Navbar and Footer stay off it too.
  const isHive = location.pathname === '/hive' || location.pathname.startsWith('/hive/');
  const bareChrome = isPortal || isViewing || isOwnerHome || isHive;

  // Presentation only. Stamps the Lazybee token scope on <html> for portal
  // routes so body-level Radix overlays (dialog, popover, select, toast)
  // inherit it too, and so marketing routes keep the existing palette.
  // See the html[data-surface="portal"] block in App.css.
  useEffect(() => {
    const root = document.documentElement;
    if (isPortal) root.setAttribute('data-surface', 'portal');
    else root.removeAttribute('data-surface');
    return () => root.removeAttribute('data-surface');
  }, [isPortal]);

  return (
      <div className="min-h-screen bg-background">
        {!bareChrome && <Navbar />}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/locations" element={<Navigate to="/" replace />} />
          {/* The old /blog never shipped content. The Hive replaces it, so the two
              legacy paths hand their link equity to the new archive rather than
              bouncing to the homepage. */}
          <Route path="/blog" element={<Navigate to="/hive" replace />} />
          <Route path="/blog/:slug" element={<Navigate to="/hive" replace />} />
          {/* The Hive. Ordered static segments first so /hive/page/2 and
              /hive/topic/rules can never be read as an article slug. */}
          <Route path="/hive" element={<HiveIndexPage />} />
          <Route path="/hive/page/:page" element={<HiveIndexPage />} />
          <Route path="/hive/topic/:tag" element={<HiveTopicPage />} />
          <Route path="/hive/:slug" element={<HiveArticlePage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/faqs" element={<FAQsPage />} />
          <Route path="/about" element={<Navigate to="/" replace />} />
          <Route path="/residents" element={<Navigate to="/" replace />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/cookie-policy" element={<CookiePolicy />} />
          <Route path="/staff" element={<StaffResourcePage />} />
          {/* Portal routes — no Navbar/Footer */}
          <Route path="/portal" element={<Navigate to="/portal/login" replace />} />
          <Route path="/portal/login" element={<LoginPage />} />
          <Route path="/portal/reset-password" element={<ResetPasswordPage />} />
          <Route path="/portal/signup" element={<SignupPage />} />
          <Route
            path="/portal/onboarding"
            element={
              <AuthGuard>
                <OnboardingPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/onboarding/signed"
            element={
              <AuthGuard>
                <SigningConfirmationPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/dashboard"
            element={
              <AuthGuard>
                <DashboardPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/landlord"
            element={
              <AuthGuard>
                <LandlordPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/documents"
            element={
              <AuthGuard>
                <TenantDocumentsPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/guide"
            element={
              <AuthGuard>
                <PropertyGuidePage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/settings"
            element={
              <AuthGuard>
                <MemberSettingsPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/billing"
            element={
              <AuthGuard>
                <BillingPage />
              </AuthGuard>
            }
          />
          <Route path="/portal/billing/:invoiceId" element={<AuthGuard><InvoiceDetailPage /></AuthGuard>} />
          <Route
            path="/portal/issues"
            element={
              <AuthGuard>
                <IssuesPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/issues/new"
            element={
              <AuthGuard>
                <NewIssuePage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/help"
            element={
              <AuthGuard>
                <HelpPage />
              </AuthGuard>
            }
          />
          {/* House Captain routes */}
          <Route
            path="/portal/property"
            element={
              <AuthGuard requiredRole="HOUSE_CAPTAIN">
                <PropertyOverviewPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/property/tickets"
            element={
              <AuthGuard requiredRole="HOUSE_CAPTAIN">
                <PropertyTicketsPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/property/tenants"
            element={
              <AuthGuard requiredRole="HOUSE_CAPTAIN">
                <PropertyTenantsPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/captain/claims"
            element={
              <AuthGuard requiredRole="HOUSE_CAPTAIN">
                <CaptainClaimsPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/captain/claims/new"
            element={
              <AuthGuard requiredRole="HOUSE_CAPTAIN">
                <CaptainClaimFormPage />
              </AuthGuard>
            }
          />
          {/* Admin routes */}
          <Route
            path="/portal/admin"
            element={
              <AuthGuard requiredRole="ADMIN">
                <AdminDashboardPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/admin/viewings"
            element={
              <AuthGuard requiredRole="ADMIN">
                <AdminViewingsPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/admin/viewings/:id"
            element={
              <AuthGuard requiredRole="ADMIN">
                <AdminViewingDetailPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/admin/locks"
            element={
              <AuthGuard requiredRole="ADMIN">
                <AdminLocksPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/admin/devices"
            element={
              <AuthGuard requiredRole="ADMIN">
                <AdminDevicesPage />
              </AuthGuard>
            }
          />
          {/* Onboarding/lifecycle merged into Members → /portal/admin/members (Lifecycle tab) */}
          <Route path="/portal/admin/onboarding" element={<Navigate to="/portal/admin/members" replace />} />
          <Route
            path="/portal/admin/onboarding/:id"
            element={
              <AuthGuard requiredRole="ADMIN">
                <AdminOnboardingDetailPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/admin/announcements"
            element={
              <AuthGuard requiredRole="ADMIN">
                <AdminAnnouncementsPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/admin/listings"
            element={
              <AuthGuard requiredRole="ADMIN">
                <AdminListingsPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/admin/rent"
            element={
              <AuthGuard requiredRole="ADMIN">
                <AdminRentPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/admin/investors"
            element={
              <AuthGuard requiredRole="ADMIN">
                <AdminInvestorsPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/admin/expenses/import"
            element={
              <AuthGuard requiredRole="ADMIN">
                <AdminExpenseImportPage />
              </AuthGuard>
            }
          />
          {/* Legacy money routes (Expense Tracking, P&L, Money hub) retired —
              redirect any old links to the live money pages. */}
          <Route path="/portal/admin/expenses" element={<Navigate to="/portal/admin/expenses/import" replace />} />
          <Route path="/portal/admin/financials" element={<Navigate to="/portal/admin/rent" replace />} />
          <Route path="/portal/admin/billing" element={<Navigate to="/portal/admin/rent" replace />} />
          <Route
            path="/portal/admin/documents"
            element={
              <AuthGuard requiredRole="ADMIN">
                <AdminDocumentsPage />
              </AuthGuard>
            }
          />
          <Route path="/portal/admin/invoices" element={<AuthGuard><AdminInvoicesPage /></AuthGuard>} />
          <Route
            path="/portal/admin/owner-documents"
            element={
              <AuthGuard requiredRole="ADMIN">
                <AdminOwnerDocumentsPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/admin/members"
            element={
              <AuthGuard requiredRole="ADMIN">
                <AdminMembersPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/admin/past-tenants"
            element={
              <AuthGuard requiredRole="ADMIN">
                <AdminPastTenantsPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/admin/tickets"
            element={
              <AuthGuard requiredRole="ADMIN">
                <PropertyTicketsPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/admin/inbox"
            element={
              <AuthGuard requiredRole="ADMIN">
                <AdminInboxPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/admin/leads"
            element={
              <AuthGuard requiredRole="ADMIN">
                <AdminLeadsPage />
              </AuthGuard>
            }
          />
          {/* Investor routes */}
          <Route path="/portal/investor/signup" element={<InvestorSignupPage />} />
          <Route
            path="/portal/investor/dashboard"
            element={
              <AuthGuard>
                <InvestorDashboardPage />
              </AuthGuard>
            }
          />
          <Route
            path="/portal/investor/reports"
            element={
              <AuthGuard>
                <InvestorReportsPage />
              </AuthGuard>
            }
          />
          <Route path="*" element={
            <div className="min-h-screen flex flex-col items-center justify-center py-20 bg-background text-foreground">
              <h1 className="font-display text-4xl font-bold tracking-display mb-4">Page not found</h1>
              <p className="text-foreground-variant mb-8">Sorry, that page doesn't exist.</p>
              <a href="/" className="text-accent hover:underline font-medium">Go back home</a>
            </div>
          } />
        </Routes>
        {!bareChrome && <Footer />}
      </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
        <ConfirmHost />
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
    </Router>
  );
}

export default App;

