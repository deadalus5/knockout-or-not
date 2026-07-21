import { useState } from 'react'
import {
  attemptedHeatLevel,
  controlLevel,
  landedHeatLevel,
  methodClass,
  per30HeatLevel,
  roundClass,
} from '../lib/format'

const DISMISS_KEY = 'ko.explainerDismissed'

/**
 * Static first-run explainer: how the reveal table works, demonstrated on
 * one famous card everyone argued about in 2018. Purely presentational —
 * the demo cells are not interactive and the sealed ones contain no values.
 * Never names a winner; nothing here may trip the spoiler patterns.
 * Color classes come from the same helpers as the real table so the demo
 * can never drift from what the table shows.
 */
const DEMO_CELLS: { label: string; value?: string; kind?: 'early'; cls?: string }[] = [
  { label: 'Finish', value: 'Stoppage', kind: 'early' },
  { label: 'Method', value: 'Submission', cls: methodClass('Submission') },
  { label: 'Sig. landed', value: '121', cls: `heat-${landedHeatLevel(121)}` },
  { label: 'Sig. attempted', value: '200', cls: `heat-${attemptedHeatLevel(200)}` },
  { label: 'Per 30s', value: '5.5', cls: `heat-${per30HeatLevel(5.5)}` },
  { label: 'Control', value: '68%', cls: `ctl-${controlLevel(68)}` },
  { label: 'Round', value: 'R4', cls: roundClass(4) },
  { label: 'Time', value: '3:03' },
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
        <strong>only that detail</strong> is revealed — tap it again to reseal it.{' '}
        <strong>The winner is never shown</strong> — it isn&rsquo;t even in this app&rsquo;s data.
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
                <span
                  className={['cell-value', cell.kind === 'early' ? 'chip early' : '', cell.cls ?? '']
                    .filter(Boolean)
                    .join(' ')}
                >
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
          Fully unsealed: 121 of 200 significant strikes between the two, with 68% of the fight
          spent in grappling control, ending by submission at 3:03 of round 4. Who won stays
          sealed forever.
        </p>
      </div>
    </aside>
  )
}
