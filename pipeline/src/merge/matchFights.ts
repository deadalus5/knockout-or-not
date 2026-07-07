import { lastNameKey, nameTokens, normalizeName } from '@ko/shared'
import { FIGHTER_ALIASES } from '../config.js'

function canonical(name: string): string {
  return FIGHTER_ALIASES[normalizeName(name)] ?? name
}

export function fightKey(fighters: [string, string]): string {
  return [lastNameKey(canonical(fighters[0])), lastNameKey(canonical(fighters[1]))].sort().join('|')
}

/**
 * Find the fight matching a fighter pair within one event's fights from
 * another source. Primary key is the sorted last-name pair; falls back to
 * full-name token overlap for multi-surname / transliteration differences.
 */
export function matchFight<T extends { fighters: [string, string] }>(
  fighters: [string, string],
  wikiFights: T[],
  used: Set<T>,
): T | null {
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

  let best: T | null = null
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

/** Levenshtein distance capped at `max+1` (early exit). */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const prev = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!
    prev[0] = i
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cur = Math.min(
        prev[j]! + 1,
        prev[j - 1]! + 1,
        diag + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
      diag = prev[j]!
      prev[j] = cur
      if (cur < rowMin) rowMin = cur
    }
    if (rowMin > max) return max + 1
  }
  return prev[b.length]!
}

/** Token equality tolerant of transliteration variants (Oleynik/Oleinik). */
function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length >= 5 && b.length >= 5) {
    const max = a.length >= 7 ? 2 : 1
    return editDistance(a, b, max) <= max
  }
  return false
}

function pairTokenOverlap(a: [string, string], b: [string, string]): number {
  const overlaps = (xRaw: string, yRaw: string) => {
    const x = canonical(xRaw)
    const y = canonical(yRaw)
    // Transliteration variants collapse under concatenation
    // ("Su Mudaerji" vs "Sumudaerji", "Yi Zha" vs "Yizha").
    const joined = (s: string) => nameTokens(s).join('')
    if (joined(x) !== '' && tokensMatch(joined(x), joined(y))) return 1
    const xt = nameTokens(x)
    return nameTokens(y).filter((t) => xt.some((xtok) => tokensMatch(xtok, t))).length
  }
  const direct = Math.min(overlaps(a[0], b[0]), 1) + Math.min(overlaps(a[1], b[1]), 1)
  const crossed = Math.min(overlaps(a[0], b[1]), 1) + Math.min(overlaps(a[1], b[0]), 1)
  return Math.max(direct, crossed)
}
