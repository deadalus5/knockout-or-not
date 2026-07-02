import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/big-shoulders-display/600.css'
import '@fontsource/big-shoulders-display/700.css'
import '@fontsource/schibsted-grotesk/400.css'
import '@fontsource/schibsted-grotesk/700.css'
import '@fontsource/spline-sans-mono/400.css'
import '@fontsource/spline-sans-mono/600.css'
import './styles.css'
import App from './App'

// Keys from the retired spoiler-level UI; harmless but stale.
try {
  localStorage.removeItem('ko.spoilerLevel')
  localStorage.removeItem('ko.promiseDismissed')
} catch {
  /* private mode */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
