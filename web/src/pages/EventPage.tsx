import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { EventDetail, Fight } from '@ko/shared'
import { loadEvent } from '../lib/dataClient'
import { CARD_LABELS, formatDate } from '../lib/format'
import { FightTable } from '../components/FightTable'

export function EventPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!eventId) return
    setEvent(null)
    loadEvent(eventId).then(setEvent).catch((err) => setError(String(err)))
  }, [eventId])

  const sections = useMemo(() => {
    if (!event) return []
    const bySection: { label: string | null; fights: Fight[] }[] = []
    for (const fight of event.fights) {
      const label = fight.card ? CARD_LABELS[fight.card]! : null
      const last = bySection[bySection.length - 1]
      if (last && last.label === label) last.fights.push(fight)
      else bySection.push({ label, fights: [fight] })
    }
    return bySection
  }, [event])

  if (error) return <div className="error-note">Could not load this event. {error}</div>
  if (!event) return <div className="loading">Loading…</div>

  return (
    <>
      <header className="event-head">
        <h1>{event.name}</h1>
        <div className="meta">
          <span>{formatDate(event.date)}</span>
          {event.location && <span>{event.location}</span>}
          {event.dataQuality === 'basic' && <span>ratings pending full stats</span>}
        </div>
        <p className="reveal-hint">Every cell is sealed. Tap one to reveal only that detail.</p>
      </header>

      {sections.map((section, si) => (
        <section key={si}>
          {section.label && <h2 className="card-section">{section.label}</h2>}
          <FightTable fights={section.fights} />
        </section>
      ))}

      <Link to="/" className="back-link">
        ← All events
      </Link>
    </>
  )
}
