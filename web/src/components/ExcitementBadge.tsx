import { heatColor, starString } from '../lib/format'

export function ExcitementBadge({
  excitement,
  stars,
}: {
  excitement: number | null
  stars: number | null
}) {
  if (excitement === null || stars === null) {
    return <span className="unrated">Not rated</span>
  }
  return (
    <span
      className="heat-badge"
      style={{ '--heat-color': heatColor(excitement) } as React.CSSProperties}
      aria-label={`Excitement ${excitement} out of 100`}
    >
      <span className="stars" aria-hidden="true">
        {starString(stars)}
      </span>
      {excitement}
    </span>
  )
}
