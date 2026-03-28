import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useState } from 'react';
import './App.css';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './components/HomePageWithSanity';
import PropertiesPage from './components/PropertiesPageWithSanity';
import PropertyDetailPage from './components/PropertyDetailPageWithSanity';
import LocationsPage from './components/LocationsPageWithSanity';
import AboutPage from './components/AboutPage';
import FAQsPage from './components/FAQsPageWithSanity';
import ContactPage from './components/ContactPage';
import BlogPage from './components/BlogPage';
import BlogPostPage from './components/BlogPostPage';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import CookiePolicy from './components/CookiePolicy';
import FloatingWhatsApp from './components/FloatingWhatsApp';

// Auth
import { AuthProvider } from './hooks/useAuth';
import AuthGuard from './components/portal/AuthGuard';
import LoginPage from './pages/portal/LoginPage';
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
import ViewingPage from './pages/ViewingPage';
import AdminTasksPage from './pages/portal/AdminTasksPage';
import TenantDocumentsPage from './pages/portal/TenantDocumentsPage';
import MemberSettingsPage from './pages/portal/MemberSettingsPage';
import HelpPage from './pages/portal/HelpPage';
import MaintenanceSchedulePage from './pages/portal/MaintenanceSchedulePage';
import InvestorDashboardPage from './pages/portal/InvestorDashboardPage';
import InvestorSignupPage from './pages/portal/InvestorSignupPage';
import OnboardingPage from './pages/portal/OnboardingPage';
import SigningConfirmationPage from './pages/portal/SigningConfirmationPage';

function AppContent() {
  const location = useLocation();
  const isPortal = location.pathname.startsWith('/portal');
  const isViewing = location.pathname.startsWith('/view/');

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
          <Route 
            path="/" 
            element={
              <HomePage 
                searchFilters={searchFilters}
                setSearchFilters={setSearchFilters}
              />
            } 
          />
          <Route 
            path="/properties" 
            element={
              <PropertiesPage 
                searchFilters={searchFilters}
                setSearchFilters={setSearchFilters}
              />
            } 
          />
          <Route path="/property/:id" element={<PropertyDetailPage />} />
          <Route path="/locations" element={<LocationsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/faqs" element={<FAQsPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/cookie-policy" element={<CookiePolicy />} />
          {/* Portal routes — no Navbar/Footer */}
          <Route path="/portal/login" element={<LoginPage />} />
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
            path="/portal/maintenance"
            element={
              <AuthGuard>
                <MaintenanceSchedulePage />
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
            path="/portal/admin/tasks"
            element={
              <AuthGuard requiredRole="ADMIN">
                <AdminTasksPage />
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
          {/* Public viewing page — no auth */}
          <Route path="/view/:token" element={<ViewingPage />} />
          <Route path="*" element={
            <div className="min-h-screen flex flex-col items-center justify-center py-20">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">Page not found</h1>
              <p className="text-lg text-gray-600 mb-8">Sorry, the page you're looking for doesn't exist.</p>
              <a href="/" className="text-teal-600 hover:text-teal-700 font-medium">Go back home</a>
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
      </AuthProvider>
    </Router>
  );
}

export default App;

