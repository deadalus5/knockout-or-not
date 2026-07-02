import { fetchCsvData } from './fetch/csvSource.js'
import { fetchWikiPage } from './fetch/wikiSource.js'
import { parseCsvEvents } from './parse/csvEvents.js'
import { parseCsvResults } from './parse/csvResults.js'
import { parseCsvStats, statsKey } from './parse/csvStats.js'
import { parseWikiEventList } from './parse/wikiEventList.js'
import { parseWikiEventPage } from './parse/wikiEventPage.js'
import { readWikiExtract, writeWikiExtract, type WikiExtractEvent } from './parse/wikiExtract.js'
import { mergeAll } from './merge/mergeEvents.js'
import { fightDurationMin } from './score/excitement.js'
import { Percentiles } from './score/percentiles.js'
import { sanitizeEvent } from './emit/sanitize.js'
import { writePublishedData } from './emit/writeJson.js'
import { auditPublishedData } from './audit/spoilerAudit.js'
import { WIKI_EVENT_LIST_PAGE } from './config.js'

const cmd = process.argv[2] ?? 'run'
const flags = new Set(process.argv.slice(3))
const offline = flags.has('--offline')

async function loadCsv() {
  const raw = await fetchCsvData({ offline })
  return {
    events: parseCsvEvents(raw.events),
    resultsByEvent: parseCsvResults(raw.results),
    stats: await parseCsvStats(raw.stats),
  }
}

/** Refresh the committed wiki extract with any event pages we don't have yet. */
async function refreshWikiExtract(csvMaxDate: string): Promise<void> {
  if (offline) return
  const extract = await readWikiExtract()
  const known = new Map(extract.events.map((e) => [e.title, e]))
  const listPage = await fetchWikiPage(WIKI_EVENT_LIST_PAGE, { preferCache: false })
  const entries = parseWikiEventList(listPage.html)
  const today = new Date().toISOString().slice(0, 10)
  const recentCutoff = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10)
  const backfill = flags.has('--backfill-bonuses')

  const toFetch = entries.filter((e) => {
    if (e.date > today) return false
    const have = known.get(e.title)
    // Recent pages get re-fetched for ~2 weeks (late bonus/result edits).
    if (have) return e.date >= recentCutoff
    return backfill || e.date > csvMaxDate
  })

  console.log(`wiki: ${entries.length} past events listed, fetching ${toFetch.length} page(s)`)
  let done = 0
  for (const entry of toFetch) {
    try {
      const page = await fetchWikiPage(entry.title, {
        preferCache: !known.has(entry.title) || entry.date < recentCutoff,
      })
      const { fights, unresolvedBonuses } = parseWikiEventPage(page.html)
      if (fights.length === 0) {
        console.warn(`wiki: no results table parsed for "${entry.title}" — skipped`)
        continue
      }
      if (unresolvedBonuses > 0) {
        console.warn(`wiki: ${unresolvedBonuses} unresolved bonus name(s) on "${entry.title}"`)
      }
      const event: WikiExtractEvent = {
        title: entry.title,
        revid: page.revid,
        name: entry.name,
        date: entry.date,
        location: entry.location,
        fights,
      }
      const idx = extract.events.findIndex((e) => e.title === entry.title)
      if (idx >= 0) extract.events[idx] = event
      else extract.events.push(event)
    } catch (err) {
      console.warn(`wiki: failed "${entry.title}": ${(err as Error).message}`)
    }
    done++
    if (done % 25 === 0) console.log(`wiki: ${done}/${toFetch.length}`)
  }
  await writeWikiExtract(extract)
}

async function run() {
  const csv = await loadCsv()
  const csvMaxDate = csv.events.map((e) => e.date).sort().at(-1) ?? '1993-01-01'
  console.log(`csv: ${csv.events.length} events through ${csvMaxDate}`)

  await refreshWikiExtract(csvMaxDate)
  const extract = await readWikiExtract()
  console.log(`wiki extract: ${extract.events.length} events`)

  const { events, report } = mergeAll(csv.events, csv.resultsByEvent, csv.stats, extract)

  // Percentile basis: every full-stats, non-legacy fight with a computable duration.
  const strRates: number[] = []
  for (const ev of events) {
    for (const f of ev.fights) {
      if (!f.stats || f.legacyFormat) continue
      const dur = fightDurationMin(f)
      if (dur !== null) strRates.push(f.stats.combinedSigStrLanded / dur)
    }
  }
  const percentiles = new Percentiles(strRates)
  console.log(`scoring basis: ${percentiles.size} full-stats fights`)

  const published = events.map((ev) => sanitizeEvent(ev, percentiles))
  const { files } = await writePublishedData(published)
  console.log(`emitted ${files} files`)

  console.log(
    `merge: ${report.matchedEvents}/${report.csvEvents} csv events matched to wiki; ` +
      `${report.wikiOnlyEvents.length} wiki-only; ${report.csvOnlyEvents.length} csv-only`,
  )
  if (report.lowSimilarityMatches.length > 0) {
    console.log('low-similarity matches (accepted by exact date):')
    for (const m of report.lowSimilarityMatches.slice(0, 15))
      console.log(`  ${m.similarity} ${m.csv}  ↔  ${m.wiki}`)
  }
  if (report.csvOnlyEvents.length > 0) {
    console.log(`csv-only events (no wiki match): ${report.csvOnlyEvents.slice(0, 10).join(' | ')}`)
  }
  if (report.wikiOnlyEvents.length > 0) {
    console.log(`wiki-only events: ${report.wikiOnlyEvents.slice(0, 10).join(' | ')}`)
  }
  if (report.unmatchedWikiFights.length > 0) {
    console.log(`unmatched wiki fights: ${report.unmatchedWikiFights.length}`)
    for (const f of report.unmatchedWikiFights.slice(0, 10))
      console.log(`  ${f.event}: ${f.fighters}`)
  }

  const findings = await auditPublishedData()
  if (findings.length > 0) {
    console.error(`SPOILER AUDIT FAILED: ${findings.length} finding(s)`)
    for (const f of findings.slice(0, 50)) console.error(` ${f.file}: ${f.problem}`)
    process.exit(1)
  }
  console.log('spoiler audit: clean ✓')
}

async function stats() {
  const csv = await loadCsv()
  const allFights = [...csv.resultsByEvent.values()].flat()
  let withStats = 0
  for (const [event, fights] of csv.resultsByEvent) {
    for (const f of fights) {
      if (csv.stats.has(statsKey(event, f.fighters[0], f.fighters[1]))) withStats++
    }
  }
  const dates = csv.events.map((e) => e.date).sort()
  console.log(`events:        ${csv.events.length}`)
  console.log(`date range:    ${dates[0]} .. ${dates[dates.length - 1]}`)
  console.log(`fights:        ${allFights.length}`)
  console.log(`with stats:    ${withStats}`)
  console.log(`legacy format: ${allFights.filter((f) => f.legacyFormat).length}`)
}

async function main() {
  if (cmd === 'stats') return stats()
  if (cmd === 'run') return run()
  throw new Error(`unknown command: ${cmd}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
