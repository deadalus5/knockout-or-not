/**
 * Forbidden patterns that must never appear in published data files or in
 * rendered UI at any spoiler level. Used by the pipeline audit and by
 * frontend component tests.
 */
export interface ForbiddenPattern {
  name: string
  re: RegExp
  why: string
}

export const FORBIDDEN_PATTERNS: ForbiddenPattern[] = [
  {
    name: 'def-abbreviation',
    re: /\bdef\s*\./i,
    why: 'Wikipedia results notation "X def. Y" identifies the winner',
  },
  {
    name: 'outcome-code',
    re: /\b[WL]\/[WL]\b/,
    why: 'ufcstats OUTCOME column (W/L relative to billing order)',
  },
  {
    // Excludes ISO dates ("2026-06-27") via the year lookbehind.
    name: 'scorecard',
    re: /(?<!\d{4}-)\b\d{2}\s*[-–—]\s*\d{2}\b(?!-\d)/,
    why: 'Judge scorecards (e.g. 48-47) reveal the decision winner',
  },
  {
    // "victor" (first name) and "winner" (Andre Winner, UFC 2009-2011) are
    // real fighter names and are excluded; winner FIELDS are impossible via
    // the strict schema, this pattern guards free-text values.
    name: 'winner-words',
    re: /\b(defeated|defeats|loser|losers|victorious)\b/i,
    why: 'Winner-identifying vocabulary',
  },
]

export function scanForSpoilers(text: string): ForbiddenPattern[] {
  return FORBIDDEN_PATTERNS.filter((p) => p.re.test(text))
}
