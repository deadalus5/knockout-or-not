/** Name normalization used by fight matching, fighter sorting, and the spoiler audit. */

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'junior'])

const COMBINING_MARKS = /[̀-ͯ]/g

export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function nameTokens(name: string): string[] {
  return normalizeName(name)
    .split(/[\s-]+/)
    .filter((t) => t.length > 0 && !SUFFIXES.has(t))
}

export function lastNameKey(name: string): string {
  const tokens = nameTokens(name)
  return tokens[tokens.length - 1] ?? ''
}

/**
 * Sort key for the published fighters tuple. Alphabetical by last name, then
 * full name — a uniform rule that carries no information about the result.
 */
export function fighterSortKey(name: string): string {
  return `${lastNameKey(name)} ${normalizeName(name)}`
}

export function sortFighters(fighters: [string, string]): [string, string] {
  const sorted = [...fighters].sort((a, b) =>
    fighterSortKey(a) < fighterSortKey(b) ? -1 : fighterSortKey(a) > fighterSortKey(b) ? 1 : 0,
  )
  return [sorted[0]!, sorted[1]!]
}

/**
 * True when free text mentions any of the given fighters' name tokens.
 *
 * Upstream detail text sometimes arrives with glued whitespace (ufcstats
 * DETAILS, 2026-07-19: "toMcGregor knee injury"), which defeats exact
 * token matching — "tomcgregor" ≠ "mcgregor". Tokens of 4+ characters are
 * therefore matched as substrings of the normalized text; shorter tokens
 * stay exact-token to avoid false positives ("tan" inside "distance").
 * Verified against every published detail: catches all known glued leaks,
 * zero false drops.
 */
export function textMentionsFighter(text: string, fighters: readonly string[]): boolean {
  const normalized = normalizeName(text)
  const textTokens = new Set(nameTokens(text))
  for (const fighter of fighters) {
    for (const token of nameTokens(fighter)) {
      if (token.length >= 4 ? normalized.includes(token) : textTokens.has(token)) return true
    }
  }
  return false
}
