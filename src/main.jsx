import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { LanguageProvider } from './i18n/LanguageContext'
import { initAnalytics } from './lib/analytics'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.jsx'

initAnalytics();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </HelmetProvider>
  </StrictMode>,
)
