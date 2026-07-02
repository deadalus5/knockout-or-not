import { fetchCsvData } from './fetch/csvSource.js'
import { parseCsvEvents } from './parse/csvEvents.js'
import { parseCsvResults } from './parse/csvResults.js'
import { parseCsvStats, statsKey } from './parse/csvStats.js'

const cmd = process.argv[2] ?? 'run'
const flags = new Set(process.argv.slice(3))

async function stats() {
  const raw = await fetchCsvData({ offline: flags.has('--offline') })
  const events = parseCsvEvents(raw.events)
  const resultsByEvent = parseCsvResults(raw.results)
  const fightStats = await parseCsvStats(raw.stats)

  const allFights = [...resultsByEvent.values()].flat()
  let withStats = 0
  for (const [event, fights] of resultsByEvent) {
    for (const f of fights) {
      if (fightStats.has(statsKey(event, f.fighters[0], f.fighters[1]))) withStats++
    }
  }
  const legacy = allFights.filter((f) => f.legacyFormat).length
  const dates = events.map((e) => e.date).sort()

  console.log(`events:        ${events.length}`)
  console.log(`date range:    ${dates[0]} .. ${dates[dates.length - 1]}`)
  console.log(`fights:        ${allFights.length}`)
  console.log(`with stats:    ${withStats}`)
  console.log(`legacy format: ${legacy}`)
  console.log(
    `methods:       ${JSON.stringify(
      Object.fromEntries(
        [...allFights.reduce((m, f) => m.set(f.methodClass, (m.get(f.methodClass) ?? 0) + 1), new Map<string, number>())].sort(
          (a, b) => b[1] - a[1],
        ),
      ),
    )}`,
  )
}

async function main() {
  if (cmd === 'stats') return stats()
  if (cmd === 'run') {
    throw new Error('run: not implemented yet')
  }
  throw new Error(`unknown command: ${cmd}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
