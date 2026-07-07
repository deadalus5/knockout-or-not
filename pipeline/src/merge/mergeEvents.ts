import type { CsvEvent } from '../parse/csvEvents.js'
import type { CombinedStats, InternalEvent, InternalFight } from '../model.js'
import type { WikiExtract, WikiExtractEvent } from '../parse/wikiExtract.js'
import type { WikiFight } from '../parse/wikiEventPage.js'
import type { EspnEvent, EspnFight } from '../parse/espnEvent.js'
import type { EspnExtract } from '../parse/espnExtract.js'
import { statsKey } from '../parse/csvStats.js'
import { matchEvent } from './matchEvents.js'
import { matchFight } from './matchFights.js'

export interface MergeReport {
  csvEvents: number
  wikiEvents: number
  matchedEvents: number
  csvOnlyEvents: string[]
  wikiOnlyEvents: string[]
  espnOnlyEvents: string[]
  espnStatsAttached: number
  lowSimilarityMatches: { csv: string; wiki: string; similarity: number }[]
  unmatchedWikiFights: { event: string; fighters: string }[]
}

export interface MergedData {
  events: InternalEvent[]
  report: MergeReport
}

const EMPTY_ESPN_EXTRACT: EspnExtract = { extractVersion: 1, events: [] }

export function mergeAll(
  csvEvents: CsvEvent[],
  csvFightsByEvent: Map<string, InternalFight[]>,
  stats: Map<string, CombinedStats>,
  wikiExtract: WikiExtract,
  espnExtract: EspnExtract = EMPTY_ESPN_EXTRACT,
): MergedData {
  const wikiByDate = new Map<string, WikiExtractEvent[]>()
  for (const ev of wikiExtract.events) {
    const list = wikiByDate.get(ev.date) ?? []
    list.push(ev)
    wikiByDate.set(ev.date, list)
  }

  const report: MergeReport = {
    csvEvents: csvEvents.length,
    wikiEvents: wikiExtract.events.length,
    matchedEvents: 0,
    csvOnlyEvents: [],
    wikiOnlyEvents: [],
    espnOnlyEvents: [],
    espnStatsAttached: 0,
    lowSimilarityMatches: [],
    unmatchedWikiFights: [],
  }

  const usedWikiEvents = new Set<WikiExtractEvent>()
  const events: InternalEvent[] = []

  for (const csvEvent of csvEvents) {
    const fights = (csvFightsByEvent.get(csvEvent.name) ?? []).map((f) => ({ ...f }))
    if (fights.length === 0) continue

    for (const fight of fights) {
      fight.stats = stats.get(statsKey(csvEvent.name, fight.fighters[0], fight.fighters[1])) ?? null
    }

    let match = matchEvent(csvEvent.name, csvEvent.date, wikiByDate)
    // A weak-name exact-date match (dual-event days, renamed cards) must be
    // corroborated by the fights themselves actually overlapping.
    if (match && match.similarity < 0.15 && fightOverlap(fights, match.wikiEvent) < 0.3) {
      match = null
    }
    if (match && !usedWikiEvents.has(match.wikiEvent)) {
      usedWikiEvents.add(match.wikiEvent)
      report.matchedEvents++
      if (match.similarity < 0.4) {
        report.lowSimilarityMatches.push({
          csv: csvEvent.name,
          wiki: match.wikiEvent.name,
          similarity: Number(match.similarity.toFixed(2)),
        })
      }
      enrichFromWiki(fights, match.wikiEvent, report)
    } else {
      report.csvOnlyEvents.push(`${csvEvent.date} ${csvEvent.name}`)
    }

    events.push({
      source: match ? 'merged' : 'csv',
      name: csvEvent.name,
      date: csvEvent.date,
      location: csvEvent.location,
      fights,
    })
  }

  for (const wikiEvent of wikiExtract.events) {
    if (usedWikiEvents.has(wikiEvent)) continue
    if (wikiEvent.fights.length === 0) continue
    report.wikiOnlyEvents.push(`${wikiEvent.date} ${wikiEvent.name}`)
    events.push({
      source: 'wiki',
      name: wikiEvent.name,
      date: wikiEvent.date,
      location: wikiEvent.location,
      fights: wikiEvent.fights.map((w, i) => wikiFightToInternal(w, i + 1, wikiEvent.date)),
    })
  }

  // ESPN pass: Wikipedia stays the source of record for results/bonuses;
  // ESPN fills in stats (its unique contribution) and whole events Wikipedia
  // doesn't have yet.
  const eventsByDate = new Map<string, InternalEvent[]>()
  for (const ev of events) {
    const list = eventsByDate.get(ev.date) ?? []
    list.push(ev)
    eventsByDate.set(ev.date, list)
  }
  for (const espnEvent of espnExtract.events) {
    if (espnEvent.fights.length === 0) continue
    const match = matchEvent(espnEvent.name, espnEvent.date, eventsByDate)
    if (match) {
      enrichFromEspn(match.wikiEvent, espnEvent, report)
    } else {
      report.espnOnlyEvents.push(`${espnEvent.date} ${espnEvent.name}`)
      events.push({
        source: 'espn',
        name: espnEvent.name,
        date: espnEvent.date,
        location: espnEvent.location,
        fights: espnEvent.fights.map((f, i) => espnFightToInternal(f, i + 1)),
      })
    }
  }

  events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return { events, report }
}

/**
 * Fill an event (usually wiki-sourced) with what only ESPN has: combined
 * stats, card segment when missing, and the real scheduled-rounds format
 * (better than the wiki-only 5-for-main-event inference). Never overrides
 * method/round/time/bonuses — Wikipedia is the source of record.
 */
function enrichFromEspn(target: InternalEvent, espnEvent: EspnEvent, report: MergeReport): void {
  const used = new Set<EspnFight>()
  let statsAttached = 0
  for (const fight of target.fights) {
    const espn = matchFight(fight.fighters, espnEvent.fights, used)
    if (!espn) continue
    used.add(espn)
    if (fight.stats === null && espn.stats !== null) {
      fight.stats = espn.stats
      statsAttached++
    }
    if (fight.card === null) fight.card = espn.card
    fight.titleFight = fight.titleFight || espn.titleFight
    if (espn.scheduledRounds !== null && !fight.legacyFormat) {
      fight.scheduledRounds = espn.scheduledRounds
      fight.roundLengthsMin = Array(espn.scheduledRounds).fill(5)
    }
  }
  // A half-edited wiki results table can lag ESPN — append what it's missing.
  for (const espn of espnEvent.fights) {
    if (!used.has(espn)) target.fights.push(espnFightToInternal(espn, target.fights.length + 1))
  }
  report.espnStatsAttached += statsAttached
  if (target.source === 'wiki' && statsAttached > 0) target.source = 'merged'
}

/** ESPN covers only the modern era — real format data, never legacy. */
function espnFightToInternal(f: EspnFight, order: number): InternalFight {
  return {
    fighters: f.fighters,
    order,
    card: f.card,
    weightClass: f.weightClass,
    titleFight: f.titleFight,
    methodClass: f.methodClass,
    methodDetail: f.methodDetail,
    round: f.round,
    time: f.time,
    scheduledRounds: f.scheduledRounds,
    roundLengthsMin: f.scheduledRounds !== null ? Array(f.scheduledRounds).fill(5) : null,
    legacyFormat: false,
    stats: f.stats,
    bonuses: [],
  }
}

function fightOverlap(fights: InternalFight[], wikiEvent: WikiExtractEvent): number {
  if (fights.length === 0) return 0
  const used = new Set<WikiFight>()
  let matched = 0
  for (const fight of fights) {
    const wiki = matchFight(fight.fighters, wikiEvent.fights, used)
    if (wiki) {
      used.add(wiki)
      matched++
    }
  }
  return matched / fights.length
}

function enrichFromWiki(
  fights: InternalFight[],
  wikiEvent: WikiExtractEvent,
  report: MergeReport,
): void {
  const used = new Set<WikiFight>()
  for (const fight of fights) {
    const wiki = matchFight(fight.fighters, wikiEvent.fights, used)
    if (!wiki) continue
    used.add(wiki)
    fight.card = wiki.card
    fight.titleFight = fight.titleFight || wiki.titleFight
    fight.bonuses = wiki.bonuses
  }
  for (const wiki of wikiEvent.fights) {
    if (!used.has(wiki)) {
      report.unmatchedWikiFights.push({
        event: wikiEvent.name,
        fighters: wiki.fighters.join(' / '),
      })
    }
  }
}

/**
 * Wiki-only events (recent cards past the CSV cutoff, or historic gaps like
 * UFC 1) — no stats available. Scheduled rounds are inferred for the modern
 * era only.
 */
function wikiFightToInternal(w: WikiFight, order: number, eventDate: string): InternalFight {
  const modern = eventDate >= '2001-01-01'
  const scheduledRounds = modern ? (w.titleFight || w.order === 1 ? 5 : 3) : null
  return {
    fighters: w.fighters,
    order,
    card: w.card,
    weightClass: w.weightClass,
    titleFight: w.titleFight,
    methodClass: w.methodClass,
    methodDetail: w.methodDetail,
    round: w.round,
    time: w.time,
    scheduledRounds,
    roundLengthsMin: modern && scheduledRounds ? Array(scheduledRounds).fill(5) : null,
    legacyFormat: !modern,
    stats: null,
    bonuses: w.bonuses,
  }
}
