import { normalizeName } from '@ko/shared'
import { MANUAL_EVENT_ALIASES } from '../config.js'

const STOPWORDS = new Set([
  'ufc', 'fight', 'night', 'on', 'espn', 'abc', 'fox', 'fx', 'fuel', 'tv',
  'ppv', 'vs', 'the', 'ultimate', 'finale', 'live',
])

export function eventNameTokens(name: string): Set<string> {
  return new Set(
    normalizeName(name)
      .split(/[\s:.-]+/)
      .filter((t) => t.length > 0 && !STOPWORDS.has(t)),
  )
}

export function nameSimilarity(a: string, b: string): number {
  const ta = eventNameTokens(a)
  const tb = eventNameTokens(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let overlap = 0
  for (const t of ta) if (tb.has(t)) overlap++
  return overlap / (ta.size + tb.size - overlap)
}

function dayOffsets(date: string): string[] {
  const d = new Date(`${date}T12:00:00Z`)
  const fmt = (x: Date) => x.toISOString().slice(0, 10)
  return [
    date,
    fmt(new Date(d.getTime() - 86400_000)),
    fmt(new Date(d.getTime() + 86400_000)),
  ]
}

export interface EventMatch<T> {
  wikiEvent: T
  similarity: number
  exactDate: boolean
}

/**
 * Match an event against candidates from another source: primary key is the
 * date (±1 day for time zones), tie-broken by event-name token similarity.
 * Written for CSV→Wikipedia matching; the ESPN pass reuses it as-is.
 */
export function matchEvent<T extends { name: string }>(
  csvName: string,
  csvDate: string,
  wikiByDate: Map<string, T[]>,
): EventMatch<T> | null {
  const alias = MANUAL_EVENT_ALIASES[normalizeName(csvName)]
  const candidates: EventMatch<T>[] = []
  for (const [i, date] of dayOffsets(csvDate).entries()) {
    for (const wikiEvent of wikiByDate.get(date) ?? []) {
      const target = alias ?? csvName
      candidates.push({
        wikiEvent,
        similarity:
          alias && normalizeName(wikiEvent.name) === alias
            ? 1
            : nameSimilarity(target, wikiEvent.name),
        exactDate: i === 0,
      })
    }
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.similarity - a.similarity || Number(b.exactDate) - Number(a.exactDate))
  const best = candidates[0]!
  // A lone exact-date candidate is trusted even with a weak name match (the
  // UFC runs at most one event per day; naming schemes differ across sources).
  if (best.exactDate && candidates.filter((c) => c.exactDate).length === 1) return best
  return best.similarity >= 0.4 ? best : null
}
