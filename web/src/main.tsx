import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
