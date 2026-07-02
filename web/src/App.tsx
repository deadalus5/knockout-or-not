import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { SpoilerProvider } from './lib/spoilerLevel'
import { HomePage } from './pages/HomePage'
import { EventPage } from './pages/EventPage'
import { AboutPage } from './pages/AboutPage'

export default function App() {
  return (
    <SpoilerProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <header className="site-header">
          <Link to="/" className="wordmark">
            <span className="ko-mark">KO</span>
            Knockout<span className="q">Or</span>Not
          </Link>
          <nav className="header-nav">
            <Link to="/about">How it works</Link>
          </nav>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/event/:eventId" element={<EventPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<div className="error-note">Page not found.</div>} />
          </Routes>
        </main>

        <footer className="site-footer">
          Spoiler-free by design: winner data never leaves the build pipeline.{' '}
          <Link to="/about">How it works</Link>
          <br />
          Results &amp; bonuses from Wikipedia (CC BY-SA 4.0) · stats via scrape_ufc_stats /
          ufcstats.com · not affiliated with the UFC
        </footer>
      </BrowserRouter>
    </SpoilerProvider>
  )
}
