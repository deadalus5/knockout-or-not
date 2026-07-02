import type { SearchIndex } from '@ko/shared'
import { normalizeName } from '@ko/shared'

export interface SearchHit {
  id: string
  name: string
  date: string
  matchedFighter: string | null
}

/**
 * Dependency-free search over the lazy-loaded search index.
 * Scores: fighter-name prefix/substring matches above event-name matches.
 */
export function searchEvents(index: SearchIndex, query: string, limit = 20): SearchHit[] {
  const q = normalizeName(query)
  if (q.length < 2) return []

  const hits: (SearchHit & { score: number })[] = []
  for (const entry of index) {
    let score = 0
    let matchedFighter: string | null = null

    for (const fighter of entry.f) {
      const nf = normalizeName(fighter)
      if (nf.startsWith(q) || nf.split(' ').some((t) => t.startsWith(q))) {
        score = Math.max(score, 3)
        matchedFighter = fighter
      } else if (nf.includes(q)) {
        score = Math.max(score, 2.5)
        matchedFighter = fighter
      }
    }

    const ne = normalizeName(entry.n)
    if (ne.startsWith(q)) score = Math.max(score, 2.5)
    else if (ne.includes(q)) score = Math.max(score, 2)

    if (score > 0) hits.push({ id: entry.e, name: entry.n, date: entry.d, matchedFighter, score })
  }

  // Recent first within equal scores (index is already newest-first).
  return hits.sort((a, b) => b.score - a.score).slice(0, limit)
}
