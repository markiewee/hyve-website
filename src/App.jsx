import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import './App.css';

// Components
import Navbar from './components/Navbar';
import HomePage from './components/HomePage';
import PropertiesPage from './components/PropertiesPage';
import PropertyDetailPage from './components/PropertyDetailPage';
import LocationsPage from './components/LocationsPage';
import AboutPage from './components/AboutPage';
import ContactPage from './components/ContactPage';
import FAQsPage from './components/FAQsPage';

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
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/faqs" element={<FAQsPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

