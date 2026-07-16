import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadIndex } from '../lib/dataClient'
import { formatDate } from '../lib/format'

export function AboutPage() {
  const [freshness, setFreshness] = useState<{ generatedAt: string; events: number } | null>(null)

  useEffect(() => {
    loadIndex()
      .then((idx) => setFreshness({ generatedAt: idx.generatedAt, events: idx.events.length }))
      .catch(() => {})
  }, [])

  return (
    <div className="prose">
      <h1>How KnockoutOrNot protects you</h1>
      <p>
        KnockoutOrNot answers one question — <strong>is this fight worth watching?</strong> —
        without ever telling you who won.
      </p>

      <h2>The hard guarantee</h2>
      <p>
        Winner data <strong>does not exist in this app</strong>. The data pipeline strips
        win/loss results, judge scorecards, per-fighter statistics, and bonus recipient names
        before anything is published. Fighters are always listed alphabetically, so order can't
        hint at the result either. An automated audit scans every published file for
        winner-identifying patterns on every update — if it finds one, the update is blocked.
        Even if you open your browser's developer tools, there is no winner to find.
      </p>

      <h2>How revealing works</h2>
      <p>
        Every fight is a row of sealed cells, ordered left to right from vague to specific: the
        excitement rating, whether it was a stoppage, the method and its details, the combined
        fight stats — significant strikes landed and attempted, attempted strikes per 30
        seconds, and control time — and finally the round and the time. Tap a cell and{' '}
        <strong>only that cell</strong> is unsealed; tap a column header to unseal that column
        for every fight. You choose exactly how much you learn.
      </p>
      <p>
        All stats are <strong>combined totals for both fighters</strong>, so they describe the
        fight, never a fighter. "Control" is the share of the fight one fighter spent
        controlling the other in grappling — on the ground or pressed in the clinch. It's the
        closest available measure of how much of a fight was grappling rather than open
        striking; no data source records a pure ground-time clock.
      </p>
      <p>
        Reveals are never remembered: reload the page and everything is sealed again. Draws and
        no-contests are folded into the neutral "went the distance" and "stoppage" outcomes, so
        even those results can't be inferred without unsealing the method.
      </p>

      <h2>How the excitement score works</h2>
      <p>
        For fights with full statistics, the score combines: whether it ended inside the
        distance, combined striking pace (percentile-normalized against every UFC fight on
        record), knockdowns, submission threats, scrambles, post-fight bonus awards, and a
        penalty for long control-heavy stretches. Recent events start with a method-and-bonus
        based estimate ("ratings pending full stats") until full statistics land in the
        back-catalogue. The score is symmetric by construction — it never depends on{' '}
        <em>who</em> did the damage.
      </p>

      <h2>Data sources &amp; freshness</h2>
      <p>
        Results and bonus awards come from{' '}
        <a href="https://en.wikipedia.org/wiki/List_of_UFC_events">Wikipedia</a> (text under{' '}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>). Historical
        fight statistics come from the community dataset{' '}
        <a href="https://github.com/Greco1899/scrape_ufc_stats">scrape_ufc_stats</a> (original
        source: ufcstats.com). Data refreshes automatically every week.
        {freshness && (
          <>
            {' '}
            Currently covering <strong>{freshness.events} events</strong>, last updated{' '}
            <strong>{formatDate(freshness.generatedAt.slice(0, 10))}</strong>.
          </>
        )}
      </p>

      <h2>Roadmap</h2>
      <p>Boxing and other combat sports may join later — the data model is ready for them.</p>

      <Link to="/" className="back-link">
        ← All events
      </Link>
    </div>
  )
}
