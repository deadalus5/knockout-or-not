import type { CsvEvent } from '../parse/csvEvents.js'
import type { CombinedStats, InternalEvent, InternalFight } from '../model.js'
import type { WikiExtract, WikiExtractEvent } from '../parse/wikiExtract.js'
import type { WikiFight } from '../parse/wikiEventPage.js'
import { statsKey } from '../parse/csvStats.js'
import { matchEvent } from './matchEvents.js'
import { matchFight } from './matchFights.js'

export interface MergeReport {
  csvEvents: number
  wikiEvents: number
  matchedEvents: number
  csvOnlyEvents: string[]
  wikiOnlyEvents: string[]
  lowSimilarityMatches: { csv: string; wiki: string; similarity: number }[]
  unmatchedWikiFights: { event: string; fighters: string }[]
}

export interface MergedData {
  events: InternalEvent[]
  report: MergeReport
}

export function mergeAll(
  csvEvents: CsvEvent[],
  csvFightsByEvent: Map<string, InternalFight[]>,
  stats: Map<string, CombinedStats>,
  wikiExtract: WikiExtract,
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

  events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return { events, report }
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
