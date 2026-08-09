import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  ssr: {
    // The prerender build (npm run build:ssr) runs the marketing pages through
    // react-dom/server in Node. These packages ship CommonJS only, so Node cannot
    // import their named exports from an ESM bundle. Bundling them instead of
    // externalising them lets Rollup handle the interop.
    noExternal: ['react-helmet-async', 'framer-motion', 'posthog-js'],
  },
})
