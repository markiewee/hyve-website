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
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import CookiePolicy from './components/CookiePolicy';

function App() {
  const [searchFilters, setSearchFilters] = useState({
    location: '',
    priceRange: [0, 2000],
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
          <Route path="/faqs" element={<FAQsPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/cookie-policy" element={<CookiePolicy />} />
        </Routes>
        <Footer />
      </div>
    </Router>
  );
}

export default App;

