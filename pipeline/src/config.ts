import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgRoot = fileURLToPath(new URL('..', import.meta.url))

export const CACHE_DIR = path.join(pkgRoot, '.cache')
export const OUTPUT_DIR = path.join(pkgRoot, '..', 'web', 'public', 'data', 'v1')

export const CSV_BASE = 'https://raw.githubusercontent.com/Greco1899/scrape_ufc_stats/main/'
export const CSV_FILES = {
  events: 'ufc_event_details.csv',
  results: 'ufc_fight_results.csv',
  stats: 'ufc_fight_stats.csv',
} as const

export const WIKI_API = 'https://en.wikipedia.org/w/api.php'
export const WIKI_EVENT_LIST_PAGE = 'List_of_UFC_events'
export const USER_AGENT =
  'KnockoutOrNot/1.0 (personal spoiler-free fight guide; rbwcontent@gmail.com)'
export const WIKI_THROTTLE_MS = 1100

/** Excitement score weights — referenced by tests, keep in one place. */
export const SCORE = {
  finishWeight: 30,
  finishScore: { finish: 1.0, decision: 0.25, dq: 0.15 },
  strPercentileWeight: 22,
  kdWeight: 18,
  kdRate5Cap: 1.5,
  subWeight: 8,
  subRate5Cap: 1.0,
  revWeight: 6,
  revCap: 2,
  round1FinishBonus: 6,
  finalRoundFinishBonus: 4,
  fotnBonus: 14,
  perfBonus: 7,
  stallCtrlThreshold: 0.4,
  stallSlope: 40,
  stallMaxPenalty: 12,
  basic: {
    base: { 'KO/TKO': 62, Submission: 58, Decision: 38, Draw: 44, Disqualification: 25 } as Record<
      string,
      number
    >,
    round1FinishBonus: 10,
    finalRoundFinishBonus: 6,
    fotnBonus: 20,
    perfBonus: 10,
  },
  paceBands: { low: 0.33, medium: 0.66 },
} as const

/**
 * Manual event-name aliases for CSV↔Wikipedia matching stragglers.
 * Key: normalized CSV event name, value: normalized Wikipedia event name.
 */
export const MANUAL_EVENT_ALIASES: Record<string, string> = {}
