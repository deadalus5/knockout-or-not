import { REVEAL_METHODS, sortFighters, type RevealMethod } from '@ko/shared'
import type { CardSection, CombinedStats } from '../model.js'

/**
 * Parse ESPN's unofficial API JSON for one event.
 *
 * SPOILER SAFETY: ESPN marks winners on every competitor and ships a
 * play-by-play `details` array; both die here. Winner flags are never read,
 * `details` is never touched, fighters are re-sorted alphabetically, and both
 * competitors' statistics are summed into the symmetric combined totals the
 * internal model uses (mirroring parse/csvStats.ts — asymmetry dies at parse
 * time). ESPN has no judge scorecards in these endpoints and no bonus data.
 *
 * The API is undocumented and can change shape without notice: anything
 * unrecognized degrades (fight skipped or field null), never invented.
 */

export interface EspnFight {
  /** Alphabetically sorted — carries no information about the result. */
  fighters: [string, string]
  /** 1 = main event (ESPN's matchNumber counts up from the main event). */
  order: number
  card: CardSection | null
  weightClass: string
  titleFight: boolean
  methodClass: RevealMethod
  methodDetail: string | null
  round: number | null
  time: string | null
  scheduledRounds: number | null
  stats: CombinedStats | null
}

export interface EspnEvent {
  espnId: string
  name: string
  date: string
  location: string | null
  fights: EspnFight[]
}

/**
 * Everything the parser needs for one event, keyed the way the API delivers
 * it: the scoreboard event (inline athlete names), the core event detail
 * (cardSegment, matchNumber, format), and the per-competition status /
 * per-competitor statistics documents that only exist behind $ref links.
 */
export interface EspnEventBundle {
  scoreboard: unknown
  detail: unknown
  statuses: Record<string, unknown>
  statistics: Record<string, Record<string, unknown>>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw untyped API JSON
type Json = any

export function parseEspnEvent(bundle: EspnEventBundle): EspnEvent | null {
  const sb: Json = bundle.scoreboard
  const detail: Json = bundle.detail
  const espnId = String(sb?.id ?? '')
  const name = typeof sb?.name === 'string' ? sb.name : null
  const dateRaw = typeof sb?.date === 'string' ? sb.date : ''
  const date = dateRaw.slice(0, 10)
  if (espnId === '' || name === null || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  // Only completed events are usable — a live card would freeze mid-state.
  if (sb?.status?.type?.completed !== true) return null

  const namesByCompetition = new Map<string, Map<string, string>>()
  const sbCompetitions: Json[] = Array.isArray(sb?.competitions) ? sb.competitions : []
  for (const comp of sbCompetitions) {
    const byId = new Map<string, string>()
    for (const competitor of Array.isArray(comp?.competitors) ? comp.competitors : []) {
      const athleteName = competitor?.athlete?.displayName
      if (typeof athleteName === 'string') byId.set(String(competitor?.id), athleteName)
    }
    namesByCompetition.set(String(comp?.id), byId)
  }

  const competitions: Json[] = Array.isArray(detail?.competitions) ? detail.competitions : []
  const sorted = [...competitions].sort(
    (a, b) => (Number(a?.matchNumber) || 99) - (Number(b?.matchNumber) || 99),
  )

  const fights: EspnFight[] = []
  for (const comp of sorted) {
    const fight = parseCompetition(comp, namesByCompetition, bundle)
    if (fight) fights.push(fight)
  }
  fights.forEach((f, i) => (f.order = i + 1))

  return { espnId, name, date, location: parseLocation(sbCompetitions[0]?.venue), fights }
}

function parseCompetition(
  comp: Json,
  namesByCompetition: Map<string, Map<string, string>>,
  bundle: EspnEventBundle,
): EspnFight | null {
  const compId = String(comp?.id ?? '')
  const status: Json = bundle.statuses[compId]
  if (status?.type?.completed !== true) return null

  const names = namesByCompetition.get(compId)
  const competitors: Json[] = Array.isArray(comp?.competitors) ? comp.competitors : []
  if (competitors.length !== 2 || !names) return null
  const fighterA = names.get(String(competitors[0]?.id))
  const fighterB = names.get(String(competitors[1]?.id))
  if (!fighterA || !fighterB) return null

  const { methodClass, methodDetail } = parseEspnMethod(status?.result)
  const round = Number.isInteger(status?.period) && status.period >= 1 ? status.period : null
  const time =
    typeof status?.displayClock === 'string' && /^\d{1,2}:\d{2}$/.test(status.displayClock)
      ? status.displayClock
      : null
  const periods = comp?.format?.regulation?.periods
  const weightClass = typeof comp?.type?.text === 'string' ? comp.type.text : ''

  return {
    // ESPN's competitor order + winner flags die here.
    fighters: sortFighters([fighterA, fighterB]),
    order: 0, // assigned after all fights parse
    card: parseCardSegment(comp?.cardSegment?.description),
    weightClass: weightClass.replace(/^W\s+/, "Women's "),
    titleFight: /\btitle\b/i.test(weightClass),
    methodClass,
    methodDetail,
    round,
    time,
    scheduledRounds: Number.isInteger(periods) && periods >= 1 ? periods : null,
    stats: combineStats(bundle.statistics[compId], competitors, round),
  }
}

function parseCardSegment(description: unknown): CardSection | null {
  if (typeof description !== 'string') return null
  if (/early/i.test(description)) return 'early'
  if (/prelim/i.test(description)) return 'prelim'
  if (/main/i.test(description)) return 'main'
  return null
}

/**
 * Map ESPN's result object onto the reveal-method enum, conservatively:
 * exact displayName match first, then slug keywords, else 'Other' — never
 * invented detail text. The finish description ("Punches", "Rear Naked
 * Choke") is kept only for actual finishes, like the CSV parser does.
 */
function parseEspnMethod(result: Json): {
  methodClass: RevealMethod
  methodDetail: string | null
} {
  if (!result || typeof result !== 'object') return { methodClass: 'Other', methodDetail: null }

  const displayName = typeof result.displayName === 'string' ? result.displayName : ''
  const slug = typeof result.name === 'string' ? result.name.toLowerCase() : ''
  let methodClass: RevealMethod | null = REVEAL_METHODS.includes(displayName as RevealMethod)
    ? (displayName as RevealMethod)
    : null
  if (!methodClass) {
    const probe = `${slug} ${displayName.toLowerCase()}`
    if (/no.?contest|overturn/.test(probe)) methodClass = 'No Contest'
    else if (/disqualification|\bdq\b/.test(probe)) methodClass = 'Disqualification'
    else if (/draw/.test(probe)) methodClass = 'Draw'
    else if (/kotko|ko\/tko|\btko\b/.test(probe)) methodClass = 'KO/TKO'
    else if (/submission/.test(probe)) methodClass = 'Submission'
    else if (/decision/.test(probe) && /unanimous/.test(probe)) methodClass = 'Decision - Unanimous'
    else if (/decision/.test(probe) && /split/.test(probe)) methodClass = 'Decision - Split'
    else if (/decision/.test(probe) && /majority/.test(probe)) methodClass = 'Decision - Majority'
    else methodClass = 'Other'
  }

  const isFinish = methodClass === 'KO/TKO' || methodClass === 'Submission'
  const description = typeof result.description === 'string' ? result.description.trim() : ''
  const methodDetail =
    isFinish && description !== '' && description.length <= 120 ? description : null
  return { methodClass, methodDetail }
}

/** Stat names we take from ESPN's per-competitor "general" category. */
const STAT_NAMES = [
  'knockDowns',
  'sigStrikesLanded',
  'sigStrikesAttempted',
  'totalStrikesLanded',
  'takedownsLanded',
  'submissions',
  'reversals',
  'timeInControl',
] as const

/**
 * Sum both competitors' statistics into one symmetric CombinedStats.
 * Who out-landed whom dies here. Missing documents or missing significant-
 * strike counts yield null (the fight then scores as 'basic').
 */
function combineStats(
  perAthlete: Record<string, unknown> | undefined,
  competitors: Json[],
  round: number | null,
): CombinedStats | null {
  if (!perAthlete) return null
  const sums = new Map<string, number>()
  let ctrlTracked = false
  for (const competitor of competitors) {
    const doc: Json = perAthlete[String(competitor?.id)]
    if (!doc) return null
    const categories: Json[] = Array.isArray(doc?.splits?.categories) ? doc.splits.categories : []
    const general = categories.find((c: Json) => c?.name === 'general')
    if (!general || !Array.isArray(general.stats)) return null
    for (const stat of general.stats) {
      const statName = stat?.name
      if (!STAT_NAMES.includes(statName)) continue
      if (typeof stat?.value !== 'number' || !Number.isFinite(stat.value)) continue
      if (statName === 'timeInControl') ctrlTracked = true
      sums.set(statName, (sums.get(statName) ?? 0) + stat.value)
    }
  }
  if (!sums.has('sigStrikesLanded') || !sums.has('sigStrikesAttempted')) return null
  const total = (statName: string) => sums.get(statName) ?? 0
  return {
    combinedKD: total('knockDowns'),
    combinedSigStrLanded: total('sigStrikesLanded'),
    combinedSigStrAttempted: total('sigStrikesAttempted'),
    combinedTotalStr: total('totalStrikesLanded'),
    combinedTD: total('takedownsLanded'),
    combinedSubAtt: total('submissions'),
    combinedRev: total('reversals'),
    combinedCtrlSeconds: ctrlTracked ? total('timeInControl') : null,
    roundsWithStats: round ?? 0,
  }
}

function parseLocation(venue: Json): string | null {
  const address = venue?.address
  if (!address || typeof address !== 'object') return null
  const parts = [address.city, address.state, address.country].filter(
    (p): p is string => typeof p === 'string' && p.trim() !== '',
  )
  return parts.length > 0 ? parts.join(', ') : null
}
