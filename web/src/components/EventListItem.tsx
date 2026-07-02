import { Link } from 'react-router-dom'
import type { IndexEvent } from '@ko/shared'
import { formatDate, heatColor, starString } from '../lib/format'
import { useSpoilerLevel } from '../lib/spoilerLevel'

export function EventListItem({ event, index }: { event: IndexEvent; index: number }) {
  const { level } = useSpoilerLevel()
  return (
    <Link
      to={`/event/${event.id}`}
      className="event-item"
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      <div className="bout" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <span className="name">{event.name}</span>
        {level >= 2 && event.topExcitement !== null && (
          <span
            className="heat-badge"
            style={{ '--heat-color': heatColor(event.topExcitement) } as React.CSSProperties}
            title="Best fight on the card"
          >
            <span className="stars" aria-hidden="true">
              {starString(Math.min(5, Math.max(1, Math.ceil(event.topExcitement / 20))))}
            </span>
            {event.topExcitement}
          </span>
        )}
      </div>
      <div className="meta">
        <span>{formatDate(event.date)}</span>
        {event.location && <span>{event.location}</span>}
        <span>{event.fightCount} fights</span>
        {event.dataQuality === 'basic' && <span>ratings pending full stats</span>}
      </div>
    </Link>
  )
}
