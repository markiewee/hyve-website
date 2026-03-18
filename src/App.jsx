import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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

function App() {
  const [searchFilters, setSearchFilters] = useState({
    location: '',
    priceRange: [0, 2500],
    availableFrom: '',
    roomType: ''
  });

  return (
    <Router>
      <div className="min-h-screen bg-background">
        <Navbar />
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
          <Route path="*" element={
            <div className="min-h-screen flex flex-col items-center justify-center py-20">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">Page not found</h1>
              <p className="text-lg text-gray-600 mb-8">Sorry, the page you're looking for doesn't exist.</p>
              <a href="/" className="text-teal-600 hover:text-teal-700 font-medium">Go back home</a>
            </div>
          } />
        </Routes>
        <Footer />
        <FloatingWhatsApp />
      </div>
    </Router>
  );
}

export default App;

