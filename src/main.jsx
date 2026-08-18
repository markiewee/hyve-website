// Self-hosted fonts. These used to be four render-blocking <link> tags to
// fonts.googleapis.com in index.html. That host is blocked in mainland China,
// so a visitor there stared at an unstyled stall while the browser waited out
// the firewall. Same families, same weights, now served from our own origin,
// which we have verified loads fine from inside China. font-display: swap is
// baked into the @fontsource CSS.
import '@fontsource/hanken-grotesk/400.css'
import '@fontsource/hanken-grotesk/600.css'
import '@fontsource/hanken-grotesk/700.css'
import '@fontsource/hanken-grotesk/800.css'
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/cormorant-garamond/300.css'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/italiana/400.css'
import '@fontsource/inter-tight/300.css'
import '@fontsource/inter-tight/400.css'
import '@fontsource/inter-tight/500.css'
import '@fontsource/inter-tight/600.css'
import '@fontsource/inter-tight/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/700.css'
// The icon font. Provides the .material-symbols-outlined class the site
// already uses in 58 components.
import 'material-symbols/outlined.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { LanguageProvider } from './i18n/LanguageContext'
import { initAnalytics } from './lib/analytics'
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
