import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { SearchIndex } from '@ko/shared'
import { loadSearchIndex } from '../lib/dataClient'
import { formatDate } from '../lib/format'
import { searchEvents, type SearchHit } from '../lib/search'

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState<SearchIndex | null>(null)
  const [hits, setHits] = useState<SearchHit[]>([])
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Lazy-load the search index on first focus.
  const ensureIndex = () => {
    if (index === null) loadSearchIndex().then(setIndex).catch(() => {})
  }

  useEffect(() => {
    if (index === null || query.trim().length < 2) {
      setHits([])
      return
    }
    setHits(searchEvents(index, query))
  }, [query, index])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="search-wrap" ref={wrapRef}>
      <input
        className="search-input"
        type="search"
        placeholder="Search events or fighters…"
        value={query}
        onFocus={() => {
          ensureIndex()
          setOpen(true)
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && hits.length > 0) {
            navigate(`/event/${hits[0]!.id}`)
            setOpen(false)
            setQuery('')
          }
        }}
        aria-label="Search events or fighters"
      />
      {open && query.trim().length >= 2 && (
        <div className="search-results">
          {hits.length === 0 && <div className="empty">No events found.</div>}
          {hits.map((hit) => (
            <Link
              key={hit.id}
              to={`/event/${hit.id}`}
              onClick={() => {
                setOpen(false)
                setQuery('')
              }}
            >
              <div>{hit.name}</div>
              <div className="sub">
                {formatDate(hit.date)}
                {hit.matchedFighter && ` · ${hit.matchedFighter}`}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
