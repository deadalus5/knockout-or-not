import { useState } from 'react'

const DISMISS_KEY = 'ko.explainerDismissed'

/**
 * Static first-run explainer: how the reveal table works, demonstrated on
 * one famous card everyone argued about in 2018. Purely presentational —
 * the demo cells are not interactive and the sealed ones contain no values.
 * Never names a winner; nothing here may trip the spoiler patterns.
 */
const DEMO_CELLS: { label: string; value?: string; kind?: 'early' }[] = [
  { label: 'Rating' },
  { label: 'Finish', value: 'Ended early', kind: 'early' },
  { label: 'Method', value: 'Submission' },
  { label: 'Round', value: 'R4 · 3:03' },
  { label: 'Sig. strikes' },
]

export function ExplainerMasthead() {
  const [show, setShow] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) !== '1'
    } catch {
      return true
    }
  })
  if (!show) return null

  return (
    <aside className="masthead" aria-label="How KnockoutOrNot works">
      <button
        className="dismiss"
        aria-label="Dismiss explainer"
        onClick={() => {
          setShow(false)
          try {
            localStorage.setItem(DISMISS_KEY, '1')
          } catch {
            /* private mode */
          }
        }}
      >
        ×
      </button>
      <h2>
        Is the fight worth watching?
        <br />
        Find out — without finding out.
      </h2>
      <p>
        Every fight is a row of sealed cells, ordered from vague to specific. Tap a cell and{' '}
        <strong>only that detail</strong> is revealed. <strong>The winner is never shown</strong> —
        it isn&rsquo;t even in this app&rsquo;s data.
      </p>

      <div className="demo">
        <div className="demo-head">
          <span className="fighters">
            Khabib Nurmagomedov
            <span className="vs">vs</span>
            Conor McGregor
          </span>
          <span className="demo-meta">UFC 229 · Oct 2018 · Lightweight</span>
        </div>
        <div className="demo-grid" aria-hidden="true">
          {DEMO_CELLS.map((cell) => (
            <span key={cell.label} className={cell.value ? 'demo-cell open' : 'demo-cell'}>
              <span className="demo-label">{cell.label}</span>
              {cell.value ? (
                <span className={cell.kind === 'early' ? 'cell-value chip early' : 'cell-value'}>
                  {cell.kind === 'early' && <span className="dot" aria-hidden="true" />}
                  {cell.value}
                </span>
              ) : (
                <span className="cell-mask" />
              )}
            </span>
          ))}
        </div>
        <p className="demo-caption">
          Three cells unsealed: it ended by submission in round 4. The rating and the stats stay
          sealed until you tap them — who won stays sealed forever.
        </p>
      </div>
    </aside>
  )
}
