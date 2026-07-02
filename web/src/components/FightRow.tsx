import { useState } from 'react'
import type { Fight } from '@ko/shared'
import { useSpoilerLevel } from '../lib/spoilerLevel'
import { ExcitementBadge } from './ExcitementBadge'
import { RevealDialog } from './RevealDialog'

/**
 * Renders one fight at the current spoiler level.
 *  L1: fighters + weight class + "Ended early"/"Went the distance"
 *  L2: + excitement, pace, expandable "why this rating"
 *  Reveal (per fight, deliberate, unpersisted): round/time/method/bonuses
 */
export function FightRow({
  fight,
  revealed,
  onReveal,
}: {
  fight: Fight
  revealed: boolean
  onReveal: () => void
}) {
  const { level } = useSpoilerLevel()
  const [confirming, setConfirming] = useState(false)
  const [whyOpen, setWhyOpen] = useState(false)

  const [a, b] = fight.fighters
  return (
    <article className="fight-row" data-fight-id={fight.id}>
      <div className="bout">
        <h3 className="fighters">
          {a}
          <span className="vs">vs</span>
          {b}
        </h3>
        {level >= 2 && <ExcitementBadge excitement={fight.excitement} stars={fight.stars} />}
      </div>

      <div className="meta-line">
        <span className="wc">{fight.weightClass}</span>
        {fight.titleFight && <span className="chip title-fight">Title fight</span>}
        <span className={`chip ${fight.resultClass}`}>
          <span className="dot" aria-hidden="true" />
          {fight.resultClass === 'early' ? 'Ended early' : 'Went the distance'}
        </span>
        {level >= 2 && fight.pace !== null && (
          <span className="chip pace">{fight.pace} pace</span>
        )}
      </div>

      {level >= 2 && fight.why.length > 0 && (
        <div className="why">
          <button
            className="why-toggle"
            aria-expanded={whyOpen}
            onClick={() => setWhyOpen((o) => !o)}
          >
            {whyOpen ? '▾' : '▸'} Why this rating
          </button>
          {whyOpen && (
            <>
              <ul>
                {fight.why.map((phrase) => (
                  <li key={phrase}>{phrase}</li>
                ))}
              </ul>
              {fight.stats && (
                <div className="stat-line">
                  {fight.stats.sigStrPerMin !== null &&
                    `${fight.stats.sigStrPerMin} combined strikes/min · `}
                  {fight.stats.combinedKD} knockdowns · {fight.stats.combinedTakedowns} takedowns ·{' '}
                  {fight.stats.combinedSubAttempts} sub attempts
                  {fight.stats.controlPct !== null && ` · ${fight.stats.controlPct}% control`}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!revealed && (
        <button className="reveal-button" onClick={() => setConfirming(true)}>
          <span aria-hidden="true">🔒</span> Reveal how it ended
        </button>
      )}

      {confirming && !revealed && (
        <RevealDialog
          onConfirm={() => {
            setConfirming(false)
            onReveal()
          }}
          onCancel={() => setConfirming(false)}
        />
      )}

      {revealed && (
        <div className="reveal-panel">
          <div className="row">
            <span>
              <span className="k">Method</span>
              <span className="v">{fight.reveal.method}</span>
            </span>
            {fight.reveal.round !== null && (
              <span>
                <span className="k">Round</span>
                <span className="v">{fight.reveal.round}</span>
              </span>
            )}
            {fight.reveal.time !== null && (
              <span>
                <span className="k">Time</span>
                <span className="v">{fight.reveal.time}</span>
              </span>
            )}
            {fight.reveal.methodDetail && (
              <span>
                <span className="k">Detail</span>
                <span className="v">{fight.reveal.methodDetail}</span>
              </span>
            )}
            {fight.reveal.bonuses.length > 0 && (
              <span>
                <span className="k">Bonus</span>
                <span className="v">
                  {fight.reveal.bonuses
                    .map((bx) => (bx === 'FOTN' ? 'Fight of the Night' : 'Performance bonus'))
                    .join(', ')}
                </span>
              </span>
            )}
          </div>
        </div>
      )}
    </article>
  )
}
