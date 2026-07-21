import { Link } from 'react-router-dom'
import type { IndexEvent } from '@ko/shared'
import { formatDate, isMarqueeEvent } from '../lib/format'

export function EventListItem({ event, index }: { event: IndexEvent; index: number }) {
  return (
    <Link
      to={`/event/${event.id}`}
      className={isMarqueeEvent(event.name) ? 'event-item marquee' : 'event-item'}
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      <span className="name">{event.name}</span>
      <div className="meta">
        <span>{formatDate(event.date)}</span>
        {event.location && <span>{event.location}</span>}
        <span>{event.fightCount} fights</span>
        {event.dataQuality === 'basic' && <span>full stats pending</span>}
      </div>
    </Link>
  )
}
