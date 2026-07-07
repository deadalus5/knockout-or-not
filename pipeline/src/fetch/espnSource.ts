import { ESPN_CORE_API, ESPN_SCOREBOARD_API, ESPN_THROTTLE_MS } from '../config.js'
import { cachedFetch, type FetchOptions } from './httpCache.js'
import type { EspnEventBundle } from '../parse/espnEvent.js'

let lastRequestAt = 0

async function throttle(): Promise<void> {
  const wait = lastRequestAt + ESPN_THROTTLE_MS - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastRequestAt = Date.now()
}

/** Some $ref URLs come back on ESPN's internal .pvt domain — rewrite to .com. */
export function rewritePvtUrl(url: string): string {
  return url.replace(/\bespn\.pvt\b/, 'espn.com').replace(/^http:\/\//, 'https://')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw untyped API JSON
async function espnJson(url: string, cacheKey: string, opts: FetchOptions = {}): Promise<any> {
  // Throttle only when a request actually goes out — cache hits are free.
  const body = await cachedFetch(rewritePvtUrl(url), cacheKey, { ...opts, beforeNetwork: throttle })
  return JSON.parse(body)
}

/** One scoreboard call covers all events in a date range (YYYYMMDD). */
export async function fetchEspnScoreboard(
  fromYmd: string,
  toYmd: string,
  opts: FetchOptions = {},
): Promise<unknown> {
  const url = `${ESPN_SCOREBOARD_API}?dates=${fromYmd}-${toYmd}`
  return espnJson(url, `espn_scoreboard_${fromYmd}_${toYmd}`, opts)
}

/**
 * Assemble everything the parser needs for one event: the core event detail
 * plus, per fight, the competition status (method/round/time) and both
 * competitors' statistics — those come only as $ref links. A fight whose
 * statistics fail to fetch is left out of the map (the parser emits it with
 * stats: null); a status that fails to fetch drops that fight entirely.
 */
export async function fetchEspnEventBundle(
  scoreboardEvent: unknown,
  opts: FetchOptions = {},
): Promise<EspnEventBundle> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw untyped API JSON
  const sbEvent = scoreboardEvent as any
  const eventId = String(sbEvent?.id ?? '')
  if (eventId === '') throw new Error('espn scoreboard event has no id')
  const detail = await espnJson(
    `${ESPN_CORE_API}/events/${eventId}?lang=en&region=us`,
    `espn_event_${eventId}`,
    opts,
  )

  const statuses: Record<string, unknown> = {}
  const statistics: Record<string, Record<string, unknown>> = {}
  const competitions = detail?.competitions
  for (const comp of Array.isArray(competitions) ? competitions : []) {
    const compId = String(comp?.id ?? '')
    const statusRef = comp?.status?.$ref
    if (compId === '' || typeof statusRef !== 'string') continue
    try {
      statuses[compId] = await espnJson(statusRef, `espn_status_${eventId}_${compId}`, opts)
    } catch (err) {
      console.warn(`espn: status fetch failed for ${eventId}/${compId}: ${(err as Error).message}`)
      continue
    }
    const competitors = Array.isArray(comp?.competitors) ? comp.competitors : []
    const perAthlete: Record<string, unknown> = {}
    for (const competitor of competitors) {
      const athleteId = String(competitor?.id ?? '')
      const statsRef = competitor?.statistics?.$ref
      if (athleteId === '' || typeof statsRef !== 'string') continue
      try {
        perAthlete[athleteId] = await espnJson(
          statsRef,
          `espn_stats_${eventId}_${compId}_${athleteId}`,
          opts,
        )
      } catch {
        // Stats are best-effort — the fight just scores as 'basic'.
      }
    }
    if (Object.keys(perAthlete).length > 0) statistics[compId] = perAthlete
  }

  return { scoreboard: scoreboardEvent, detail, statuses, statistics }
}
