import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { ThemeProvider } from './contexts/ThemeContext'
import App from './App'
import './i18n/config'
import './index.css'

// After a deploy, a tab still running the old build asks for chunk hashes that
// no longer exist. Reload once to pick up the new index.html; the timestamp
// guard stops a reload loop if the chunk is genuinely missing.
window.addEventListener('vite:preloadError', (event) => {
  const key = 'afaq:chunk-reload'
  let last = 0
  try { last = Number(sessionStorage.getItem(key)) || 0 } catch {}
  if (Date.now() - last < 10000) return
  try { sessionStorage.setItem(key, String(Date.now())) } catch {}
  event.preventDefault()
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
)
