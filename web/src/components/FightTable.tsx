import { useState, type ReactNode } from 'react'
import type { Fight } from '@ko/shared'
import {
  attemptedHeatLevel,
  controlLevel,
  landedHeatLevel,
  methodClass,
  per30HeatLevel,
  roundClass,
  sigStrAttemptedPer30,
  splitFighterName,
} from '../lib/format'

/**
 * A fighter's name with only the family part bold (the container supplies
 * the bold weight; the given part drops to normal via `.given`). Shared
 * with the masthead demo so both render names identically.
 */
export function FighterName({ name }: { name: string }) {
  const { given, family } = splitFighterName(name)
  return (
    <>
      {given && <span className="given">{given} </span>}
      <span className="family">{family}</span>
    </>
  )
}

/**
 * The progressive-reveal table: one row per fight, one column per detail,
 * ordered left→right from "tells you almost nothing" to "exact finish".
 * Every cell starts sealed and holds exactly one value; clicking a cell
 * toggles ONLY that cell (click again to reseal), clicking a column
 * header toggles that column for every fight, clicking the fighter
 * names toggles every cell of that fight, and clicking the "Fight"
 * header toggles the entire table (each reveals the remainder, or
 * reseals all once fully revealed). Revealed values are not in the DOM
 * while sealed, and reveal state is transient component state — never
 * persisted.
 *
 * Combined stats (winner-free totals) sit between method and round/time:
 * they say what kind of fight it was without pinpointing the finish;
 * details (method detail + bonuses) sit last. Their
 * coverage is near-complete since the ESPN fast path took over from the
 * stalled stats CSV; the remaining gaps (mostly the 1990s) render the
 * cell's empty state.
 */
export type CellKey =
  | 'finish'
  | 'method'
  | 'landed'
  | 'attempted'
  | 'per30'
  | 'control'
  | 'round'
  | 'time'
  | 'details'

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
    value: (f) => (
      <span className={`cell-strong ${methodClass(f.reveal.method)}`}>{f.reveal.method}</span>
    ),
  },
  {
    key: 'landed',
    label: 'Sig. landed',
    name: 'significant strikes landed',
    empty: 'No data',
    value: (f) =>
      f.stats === null ? null : (
        <span className={`cell-strong heat-${landedHeatLevel(f.stats.combinedSigStrLanded)}`}>
          {f.stats.combinedSigStrLanded}
        </span>
      ),
  },
  {
    key: 'attempted',
    label: 'Sig. attempted',
    name: 'significant strikes attempted',
    empty: 'No data',
    value: (f) =>
      f.stats === null ? null : (
        <span
          className={`cell-strong heat-${attemptedHeatLevel(f.stats.combinedSigStrAttempted)}`}
        >
          {f.stats.combinedSigStrAttempted}
        </span>
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
        <span className={`cell-strong heat-${per30HeatLevel(per30)}`}>
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
        <span className={`control-cell ctl-${controlLevel(f.stats.controlPct)}`}>
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
      f.reveal.round === null ? null : (
        <span className={`cell-strong ${roundClass(f.reveal.round)}`}>R{f.reveal.round}</span>
      ),
  },
  {
    key: 'time',
    label: 'Time',
    name: 'time',
    empty: 'Not recorded',
    value: (f) =>
      f.reveal.time === null ? null : <span className="cell-strong">{f.reveal.time}</span>,
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
]

function FightTableRow({
  fight,
  revealed,
  onReveal,
  onToggleRow,
}: {
  fight: Fight
  revealed: ReadonlySet<string>
  onReveal: (key: string) => void
  onToggleRow: (fightId: string) => void
}) {
  const [a, b] = fight.fighters
  const rowAllRevealed = CELL_DEFS.every((def) => revealed.has(`${fight.id}:${def.key}`))
  return (
    <tr className="fight-tr" data-fight-id={fight.id}>
      <th scope="row" className="fight-col">
        <button
          type="button"
          className="row-reveal"
          title={
            rowAllRevealed
              ? 'Hide every detail for this fight'
              : 'Reveal every detail for this fight'
          }
          aria-label={`${rowAllRevealed ? 'Hide' : 'Reveal'} every detail — ${a} vs ${b}`}
          onClick={() => onToggleRow(fight.id)}
        >
          <span className="fighters">
            <FighterName name={a} />
            <span className="vs">vs</span>
            <FighterName name={b} />
          </span>
          <span className="fight-meta">
            {fight.weightClass}
            {fight.titleFight && <span className="chip title-fight">Title</span>}
          </span>
        </button>
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
              aria-label={`${isRevealed ? 'Hide' : 'Reveal'} ${def.name} — ${a} vs ${b}`}
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

  const toggle = (cellId: string) =>
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(cellId)) next.delete(cellId)
      else next.add(cellId)
      return next
    })

  // Column header: reveal the remainder, or reseal all once fully revealed.
  const toggleColumn = (key: CellKey) =>
    setRevealed((prev) => {
      const next = new Set(prev)
      const ids = fights.map((fight) => `${fight.id}:${key}`)
      if (ids.every((id) => prev.has(id))) for (const id of ids) next.delete(id)
      else for (const id of ids) next.add(id)
      return next
    })

  // Fighter names: same semantics for the fight's whole row.
  const toggleRow = (fightId: string) =>
    setRevealed((prev) => {
      const next = new Set(prev)
      const ids = CELL_DEFS.map((def) => `${fightId}:${def.key}`)
      if (ids.every((id) => prev.has(id))) for (const id of ids) next.delete(id)
      else for (const id of ids) next.add(id)
      return next
    })

  // "Fight" header: same semantics for the entire table.
  const toggleAll = () =>
    setRevealed((prev) => {
      const next = new Set(prev)
      const ids = fights.flatMap((fight) => CELL_DEFS.map((def) => `${fight.id}:${def.key}`))
      if (ids.every((id) => prev.has(id))) for (const id of ids) next.delete(id)
      else for (const id of ids) next.add(id)
      return next
    })

  const everythingRevealed = fights.every((fight) =>
    CELL_DEFS.every((def) => revealed.has(`${fight.id}:${def.key}`)),
  )

  return (
    <div className="table-scroll">
      <table className="fight-table">
        <thead>
          <tr>
            <th scope="col" className="fight-col">
              <button
                type="button"
                className="col-reveal"
                title={
                  everythingRevealed
                    ? 'Hide every detail for every fight'
                    : 'Reveal every detail for every fight'
                }
                aria-label={`${everythingRevealed ? 'Hide' : 'Reveal'} every detail for all fights`}
                onClick={toggleAll}
              >
                Fight
              </button>
            </th>
            {CELL_DEFS.map((def) => {
              const allRevealed = fights.every((fight) => revealed.has(`${fight.id}:${def.key}`))
              return (
                <th scope="col" key={def.key} className={`col-${def.key}`}>
                  <button
                    type="button"
                    className="col-reveal"
                    title={
                      allRevealed
                        ? 'Hide this column for every fight'
                        : 'Reveal this column for every fight'
                    }
                    aria-label={`${allRevealed ? 'Hide' : 'Reveal'} ${def.name} for all fights`}
                    onClick={() => toggleColumn(def.key)}
                  >
                    {def.label}
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {fights.map((fight) => (
            <FightTableRow
              key={fight.id}
              fight={fight}
              revealed={revealed}
              onReveal={toggle}
              onToggleRow={toggleRow}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
