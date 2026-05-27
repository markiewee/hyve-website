import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Toaster } from 'sonner';
import './App.css';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './components/HomePage';
import LocationsPage from './components/LocationsPage';
import AboutPage from './components/AboutPage';
import FAQsPage from './components/FAQsPage';
import ResidentGuidePage from './components/ResidentGuidePage';
import ContactPage from './components/ContactPage';
import BlogPage from './components/BlogPage';
import BlogPostPage from './components/BlogPostPage';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import CookiePolicy from './components/CookiePolicy';
import StaffResourcePage from './components/StaffResourcePage';
import FloatingWhatsApp from './components/FloatingWhatsApp';

// Auth
import { AuthProvider } from './hooks/useAuth';
import AuthGuard from './components/portal/AuthGuard';
import LoginPage from './pages/portal/LoginPage';
import ResetPasswordPage from './pages/portal/ResetPasswordPage';
import SignupPage from './pages/portal/SignupPage';
import DashboardPage from './pages/portal/DashboardPage';
import BillingPage from './pages/portal/BillingPage';
import IssuesPage from './pages/portal/IssuesPage';
import NewIssuePage from './pages/portal/NewIssuePage';
import PropertyOverviewPage from './pages/portal/PropertyOverviewPage';
import PropertyTicketsPage from './pages/portal/PropertyTicketsPage';
import PropertyTenantsPage from './pages/portal/PropertyTenantsPage';
import AdminDashboardPage from './pages/portal/AdminDashboardPage';
import AdminDevicesPage from './pages/portal/AdminDevicesPage';
import AdminOnboardingPage from './pages/portal/AdminOnboardingPage';
import AdminOnboardingDetailPage from './pages/portal/AdminOnboardingDetailPage';
import AdminAnnouncementsPage from './pages/portal/AdminAnnouncementsPage';
import AdminRentPage from './pages/portal/AdminRentPage';
import AdminInvestorsPage from './pages/portal/AdminInvestorsPage';
import AdminExpensesPage from './pages/portal/AdminExpensesPage';
import AdminExpenseImportPage from './pages/portal/AdminExpenseImportPage';
import AdminFinancialsPage from './pages/portal/AdminFinancialsPage';
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
import AdminMembersPage from './pages/portal/AdminMembersPage';
import AdminInboxPage from './pages/portal/AdminInboxPage';
import AdminLeadsPage from './pages/portal/AdminLeadsPage';
import AdminBillingPage from './pages/portal/AdminBillingPage';
import { ConfirmHost } from './lib/confirm';

function AppContent() {
  const location = useLocation();
  const isPortal = location.pathname.startsWith('/portal');
  const isViewing = false; // booking + viewing flows now live on book.lazybee.sg

  const [searchFilters, setSearchFilters] = useState({
    location: '',
    priceRange: [0, 2500],
    availableFrom: '',
    roomType: ''
  });

  return (
      <div className="min-h-screen bg-background">
        {!isPortal && !isViewing && <Navbar />}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/locations" element={<LocationsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/faqs" element={<FAQsPage />} />
          <Route path="/residents" element={<ResidentGuidePage />} />
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
          <Route
            path="/portal/admin/onboarding"
            element={
              <AuthGuard requiredRole="ADMIN">
                <AdminOnboardingPage />
              </AuthGuard>
            }
          />
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
            path="/portal/admin/expenses"
            element={
              <AuthGuard requiredRole="ADMIN">
                <AdminExpensesPage />
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
          <Route
            path="/portal/admin/financials"
            element={
              <AuthGuard requiredRole="ADMIN">
                <AdminFinancialsPage />
              </AuthGuard>
            }
          />
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
            path="/portal/admin/members"
            element={
              <AuthGuard requiredRole="ADMIN">
                <AdminMembersPage />
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
          <Route
            path="/portal/admin/billing"
            element={
              <AuthGuard requiredRole="ADMIN">
                <AdminBillingPage />
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
        {!isPortal && !isViewing && <Footer />}
        {!isPortal && !isViewing && <FloatingWhatsApp />}
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

