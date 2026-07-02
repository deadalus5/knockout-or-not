import { useEffect, useMemo, useRef, useState } from 'react'
import type { DataIndex } from '@ko/shared'
import { loadIndex } from '../lib/dataClient'
import { formatMonth } from '../lib/format'
import { EventListItem } from '../components/EventListItem'
import { SearchBar } from '../components/SearchBar'
import { SpoilerLevelPicker } from '../components/SpoilerLevelPicker'

const PAGE_SIZE = 30
const PROMISE_KEY = 'ko.promiseDismissed'

export function HomePage() {
  const [index, setIndex] = useState<DataIndex | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [showPromise, setShowPromise] = useState(() => {
    try {
      return localStorage.getItem(PROMISE_KEY) !== '1'
    } catch {
      return true
    }
  })
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadIndex().then(setIndex).catch((err) => setError(String(err)))
  }, [])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setVisible((v) => v + PAGE_SIZE)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [index])

  const grouped = useMemo(() => {
    if (!index) return []
    const shown = index.events.slice(0, visible)
    const groups: { month: string; items: { event: (typeof shown)[number]; i: number }[] }[] = []
    shown.forEach((event, i) => {
      const month = formatMonth(event.date)
      const last = groups[groups.length - 1]
      if (last && last.month === month) last.items.push({ event, i })
      else groups.push({ month, items: [{ event, i }] })
    })
    return groups
  }, [index, visible])

  if (error) {
    return <div className="error-note">Could not load event data. {error}</div>
  }
  if (!index) {
    return <div className="loading">Loading events…</div>
  }

  return (
    <>
      {showPromise && (
        <aside className="promise-card">
          <button
            className="dismiss"
            aria-label="Dismiss"
            onClick={() => {
              setShowPromise(false)
              try {
                localStorage.setItem(PROMISE_KEY, '1')
              } catch {
                /* ignore */
              }
            }}
          >
            ×
          </button>
          <strong>Is the fight worth watching? Find out without finding out.</strong>{' '}
          Every fight shows whether it ended early or went the distance — and, if you dial up the
          detail, how exciting it was. <strong>Who won is never shown</strong>: that data isn't
          even in this app's files.
        </aside>
      )}

      <SearchBar />
      <SpoilerLevelPicker />

      {grouped.map((group) => (
        <section key={group.month}>
          <h2 className="month-header">{group.month}</h2>
          {group.items.map(({ event, i }) => (
            <EventListItem key={event.id} event={event} index={i} />
          ))}
        </section>
      ))}
      <div ref={sentinelRef} className="load-sentinel" />
    </>
  )
}
