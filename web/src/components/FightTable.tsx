import { useState, type ReactNode } from 'react'
import type { Fight } from '@ko/shared'
import { ExcitementBadge } from './ExcitementBadge'
import { sigStrAttemptedPer30 } from '../lib/format'

/**
 * The progressive-reveal table: one row per fight, one column per detail,
 * ordered left→right from "tells you almost nothing" to "exact finish".
 * Every cell starts sealed and holds exactly one value; clicking a cell
 * reveals ONLY that cell, and clicking a column header reveals that column
 * for every fight. Revealed values are not in the DOM until clicked, and
 * reveal state is transient component state — never persisted.
 *
 * Combined stats (winner-free totals) sit between details and round/time:
 * they say what kind of fight it was without pinpointing the finish. Their
 * coverage is near-complete since the ESPN fast path took over from the
 * stalled stats CSV; the remaining gaps (mostly the 1990s) render the
 * cell's empty state.
 */
export type CellKey =
  | 'rating'
  | 'finish'
  | 'method'
  | 'details'
  | 'landed'
  | 'attempted'
  | 'per30'
  | 'control'
  | 'round'
  | 'time'

export interface CellDef {
  key: CellKey
  /** Column header text. */
  label: string
  /** Spoken name for the sealed button ("Reveal <name> — A vs B"). */
  name: string
  /** Shown when value() returns null. */
  empty: string
  /** Revealed content; null → graceful empty state. */
  value: (fight: Fight) => ReactNode | null
}

export const CELL_DEFS: CellDef[] = [
  {
    key: 'rating',
    label: 'Rating',
    name: 'rating',
    empty: 'Not rated',
    value: (f) =>
      f.excitement === null || f.stars === null ? null : (
        <ExcitementBadge excitement={f.excitement} stars={f.stars} />
      ),
  },
  {
    key: 'finish',
    label: 'Finish',
    name: 'finish',
    empty: 'No data',
    value: (f) => (
      <span className={`chip ${f.resultClass}`}>
        <span className="dot" aria-hidden="true" />
        {f.resultClass === 'early' ? 'Stoppage' : 'Went the distance'}
      </span>
    ),
  },
  {
    key: 'method',
    label: 'Method',
    name: 'method',
    empty: 'No data',
    value: (f) => <span className="cell-strong">{f.reveal.method}</span>,
  },
  {
    key: 'details',
    label: 'Details',
    name: 'details',
    empty: 'None',
    value: (f) =>
      f.reveal.methodDetail === null && f.reveal.bonuses.length === 0 ? null : (
        <span className="cell-stack">
          {f.reveal.methodDetail && <span className="cell-sub">{f.reveal.methodDetail}</span>}
          {f.reveal.bonuses.length > 0 && (
            <span className="cell-sub bonus">
              {f.reveal.bonuses
                .map((b) => (b === 'FOTN' ? 'Fight of the Night' : 'Performance bonus'))
                .join(' · ')}
            </span>
          )}
        </span>
      ),
  },
  {
    key: 'landed',
    label: 'Sig. landed',
    name: 'significant strikes landed',
    empty: 'No data',
    value: (f) =>
      f.stats === null ? null : (
        <span className="cell-strong">{f.stats.combinedSigStrLanded}</span>
      ),
  },
  {
    key: 'attempted',
    label: 'Sig. attempted',
    name: 'significant strikes attempted',
    empty: 'No data',
    value: (f) =>
      f.stats === null ? null : (
        <span className="cell-strong">{f.stats.combinedSigStrAttempted}</span>
      ),
  },
  {
    key: 'per30',
    label: 'Per 30s',
    name: 'strike rate',
    empty: 'No data',
    value: (f) => {
      const per30 = sigStrAttemptedPer30(f)
      return per30 === null ? null : (
        <span className="cell-strong">
          {per30}
          <span className="cell-dim">/30s</span>
        </span>
      )
    },
  },
  {
    key: 'control',
    label: 'Control',
    name: 'control time',
    empty: 'Not recorded',
    value: (f) =>
      f.stats === null || f.stats.controlPct === null ? null : (
        <span className="control-cell">
          <span className="control-bar" aria-hidden="true">
            <span className="control-fill" style={{ width: `${f.stats.controlPct}%` }} />
          </span>
          <span className="cell-strong">{f.stats.controlPct}%</span>
        </span>
      ),
  },
  {
    key: 'round',
    label: 'Round',
    name: 'round',
    empty: 'Not recorded',
    value: (f) =>
      f.reveal.round === null ? null : <span className="cell-strong">R{f.reveal.round}</span>,
  },
  {
    key: 'time',
    label: 'Time',
    name: 'time',
    empty: 'Not recorded',
    value: (f) =>
      f.reveal.time === null ? null : <span className="cell-strong">{f.reveal.time}</span>,
  },
]

function FightTableRow({
  fight,
  revealed,
  onReveal,
}: {
  fight: Fight
  revealed: ReadonlySet<string>
  onReveal: (key: string) => void
}) {
  const [a, b] = fight.fighters
  return (
    <tr className="fight-tr" data-fight-id={fight.id}>
      <th scope="row" className="fight-col">
        <span className="fighters">
          {a}
          <span className="vs">vs</span>
          {b}
        </span>
        <span className="fight-meta">
          {fight.weightClass}
          {fight.titleFight && <span className="chip title-fight">Title</span>}
        </span>
      </th>
      {CELL_DEFS.map((def) => {
        const cellId = `${fight.id}:${def.key}`
        const isRevealed = revealed.has(cellId)
        return (
          <td key={def.key} className={`col-${def.key}`}>
            <button
              type="button"
              className={isRevealed ? 'cell open' : 'cell'}
              aria-pressed={isRevealed}
              aria-label={isRevealed ? undefined : `Reveal ${def.name} — ${a} vs ${b}`}
              onClick={() => onReveal(cellId)}
            >
              {isRevealed ? (
                <span className="cell-value">
                  {def.value(fight) ?? <span className="cell-empty">{def.empty}</span>}
                </span>
              ) : (
                <span className="cell-mask" aria-hidden="true" />
              )}
            </button>
          </td>
        )
      })}
    </tr>
  )
}

export function FightTable({ fights }: { fights: Fight[] }) {
  // Transient reveal state, keyed `${fightId}:${cellKey}` — resealed on
  // navigation/reload, by design.
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set())

  const reveal = (cellId: string) =>
    setRevealed((prev) => (prev.has(cellId) ? prev : new Set(prev).add(cellId)))

  const revealColumn = (key: CellKey) =>
    setRevealed((prev) => {
      const next = new Set(prev)
      for (const fight of fights) next.add(`${fight.id}:${key}`)
      return next
    })

  return (
    <div className="table-scroll">
      <table className="fight-table">
        <thead>
          <tr>
            <th scope="col" className="fight-col">
              Fight
            </th>
            {CELL_DEFS.map((def) => (
              <th scope="col" key={def.key} className={`col-${def.key}`}>
                <button
                  type="button"
                  className="col-reveal"
                  title="Reveal this column for every fight"
                  aria-label={`Reveal ${def.name} for all fights`}
                  onClick={() => revealColumn(def.key)}
                >
                  {def.label}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fights.map((fight) => (
            <FightTableRow key={fight.id} fight={fight} revealed={revealed} onReveal={reveal} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
