import { lastNameKey, nameTokens } from '@ko/shared'
import type { WikiFight } from '../parse/wikiEventPage.js'

export function fightKey(fighters: [string, string]): string {
  return [lastNameKey(fighters[0]), lastNameKey(fighters[1])].sort().join('|')
}

/**
 * Find the wiki fight matching a CSV fight within one event. Primary key is
 * the sorted last-name pair; falls back to full-name token overlap for
 * multi-surname / transliteration differences.
 */
export function matchFight(
  fighters: [string, string],
  wikiFights: WikiFight[],
  used: Set<WikiFight>,
): WikiFight | null {
  const key = fightKey(fighters)
  const exact = wikiFights.filter((w) => !used.has(w) && fightKey(w.fighters) === key)
  if (exact.length === 1) return exact[0]!
  if (exact.length > 1) {
    // Same surname pair twice on one card — disambiguate by full-name tokens.
    const scored = exact
      .map((w) => ({ w, score: pairTokenOverlap(fighters, w.fighters) }))
      .sort((a, b) => b.score - a.score)
    return scored[0]?.w ?? null
  }

  let best: WikiFight | null = null
  let bestScore = 0
  for (const w of wikiFights) {
    if (used.has(w)) continue
    const score = pairTokenOverlap(fighters, w.fighters)
    if (score > bestScore) {
      best = w
      bestScore = score
    }
  }
  // Require both fighters to share at least one name token each.
  return bestScore >= 2 ? best : null
}

function pairTokenOverlap(a: [string, string], b: [string, string]): number {
  const overlaps = (x: string, y: string) => {
    const xt = new Set(nameTokens(x))
    return nameTokens(y).filter((t) => xt.has(t)).length
  }
  const direct = Math.min(overlaps(a[0], b[0]), 1) + Math.min(overlaps(a[1], b[1]), 1)
  const crossed = Math.min(overlaps(a[0], b[1]), 1) + Math.min(overlaps(a[1], b[0]), 1)
  return Math.max(direct, crossed)
}
