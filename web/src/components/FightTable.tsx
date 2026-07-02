import { useState, type ReactNode } from 'react'
import type { Fight } from '@ko/shared'
import { ExcitementBadge } from './ExcitementBadge'

/**
 * The progressive-reveal table: one row per fight, one column per detail,
 * ordered left→right from "tells you almost nothing" to "full stat line".
 * Every cell starts sealed; clicking a cell reveals ONLY that cell.
 * Revealed values are not in the DOM until clicked, and reveal state is
 * transient component state — never persisted.
 */
export type CellKey =
  | 'rating'
  | 'finish'
  | 'method'
  | 'round'
  | 'strikes'
  | 'rate'
  | 'kd'
  | 'grappling'
  | 'control'

export interface CellDef {
  key: CellKey
  /** Column header text. */
  label: string
  /** Spoken name for the sealed button ("Reveal <name> — A vs B"). */
  name: string
  /** Shown when value() returns null. */
  empty: string
  /** Revealed content; null → graceful no-data state. */
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
        {f.resultClass === 'early' ? 'Ended early' : 'Went the distance'}
      </span>
    ),
  },
  {
    key: 'method',
    label: 'Method',
    name: 'method',
    empty: 'No data',
    value: (f) => (
      <span className="cell-stack">
        <span className="cell-strong">{f.reveal.method}</span>
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
    key: 'round',
    label: 'Round',
    name: 'round',
    empty: 'Not recorded',
    value: (f) =>
      f.reveal.round === null ? null : (
        <span className="cell-strong">
          R{f.reveal.round}
          {f.reveal.time !== null && <span className="cell-dim"> · {f.reveal.time}</span>}
        </span>
      ),
  },
  {
    key: 'strikes',
    label: 'Sig. strikes',
    name: 'significant strikes',
    empty: 'No data',
    value: (f) =>
      f.stats === null ? null : (
        <span className="cell-strong">
          {f.stats.combinedSigStrLanded}
          <span className="cell-dim"> of {f.stats.combinedSigStrAttempted}</span>
        </span>
      ),
  },
  {
    key: 'rate',
    label: 'Per min',
    name: 'strike rate',
    empty: 'No data',
    value: (f) =>
      f.stats === null || f.stats.sigStrPerMin === null ? null : (
        <span className="cell-strong">
          {f.stats.sigStrPerMin}
          <span className="cell-dim">/min</span>
        </span>
      ),
  },
  {
    key: 'kd',
    label: 'KD',
    name: 'knockdowns',
    empty: 'No data',
    value: (f) => (f.stats === null ? null : <span className="cell-strong">{f.stats.combinedKD}</span>),
  },
  {
    key: 'grappling',
    label: 'Grappling',
    name: 'grappling',
    empty: 'No data',
    value: (f) =>
      f.stats === null ? null : (
        <span className="cell-strong">
          {f.stats.combinedTakedowns}
          <span className="cell-dim"> TD · </span>
          {f.stats.combinedSubAttempts}
          <span className="cell-dim"> sub</span>
        </span>
      ),
  },
  {
    key: 'control',
    label: 'Control',
    name: 'control time',
    empty: 'No data',
    value: (f) =>
      f.stats === null || f.stats.controlPct === null ? null : (
        <span className="cell-strong">
          {f.stats.controlPct}
          <span className="cell-dim">%</span>
        </span>
      ),
  },
]

/**
 * "Why this rating" phrases restating the finish ("Ended inside the
 * distance" / "Went the distance") are filtered out: they would leak the
 * still-sealed Finish cell the moment the Rating cell is revealed.
 */
function whyForDisplay(fight: Fight): string[] {
  return fight.why.filter((p) => p !== 'Ended inside the distance' && p !== 'Went the distance')
}

function FightTableRow({ fight }: { fight: Fight }) {
  // Transient per-row reveal state — resealed on navigation/reload, by design.
  const [revealed, setRevealed] = useState<ReadonlySet<CellKey>>(new Set())
  const [a, b] = fight.fighters
  const why = whyForDisplay(fight)
  const showWhy = revealed.has('rating') && (fight.pace !== null || why.length > 0)

  return (
    <>
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
          const isRevealed = revealed.has(def.key)
          return (
            <td key={def.key} className={`col-${def.key}`}>
              <button
                type="button"
                className={isRevealed ? 'cell open' : 'cell'}
                aria-pressed={isRevealed}
                aria-label={isRevealed ? undefined : `Reveal ${def.name} — ${a} vs ${b}`}
                onClick={() =>
                  setRevealed((prev) => (prev.has(def.key) ? prev : new Set(prev).add(def.key)))
                }
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
      {showWhy && (
        <tr className="why-row">
          <td colSpan={CELL_DEFS.length + 1}>
            <div className="why-inner">
              <span className="why-k">Why this rating</span>
              {fight.pace !== null && <span className="chip pace">{fight.pace} pace</span>}
              {why.map((phrase) => (
                <span key={phrase} className="why-phrase">
                  {phrase}
                </span>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export function FightTable({ fights }: { fights: Fight[] }) {
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
                {def.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fights.map((fight) => (
            <FightTableRow key={fight.id} fight={fight} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
