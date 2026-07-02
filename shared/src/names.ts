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
