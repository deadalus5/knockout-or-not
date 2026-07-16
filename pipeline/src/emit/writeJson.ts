import fs from 'node:fs/promises'
import path from 'node:path'
import {
  SCHEMA_VERSION,
  dataIndexSchema,
  searchIndexSchema,
  type DataIndex,
  type EventDetail,
  type SearchIndex,
} from '@ko/shared'
import { OUTPUT_DIR } from '../config.js'
import { toIndexEvent } from './sanitize.js'

const ATTRIBUTION = {
  wikipedia:
    'Event results and bonus data from Wikipedia (en.wikipedia.org), licensed CC BY-SA 4.0',
  stats:
    'Historical fight statistics via github.com/Greco1899/scrape_ufc_stats (source: ufcstats.com)',
}

/**
 * When nothing but the timestamp would change, keep the previous
 * generatedAt so index.json stays byte-identical and the CI commit step's
 * no-op guard actually engages instead of committing timestamp churn.
 */
async function stableGeneratedAt(indexPath: string, next: Omit<DataIndex, 'generatedAt'>): Promise<string | null> {
  try {
    const prev = JSON.parse(await fs.readFile(indexPath, 'utf8')) as DataIndex
    const { generatedAt, ...prevRest } = prev
    if (typeof generatedAt === 'string' && JSON.stringify(prevRest) === JSON.stringify(next)) {
      return generatedAt
    }
  } catch {
    // missing or unreadable previous index — fall through to a fresh timestamp
  }
  return null
}

/** Write index.json, search-index.json and events/*.json, all schema-validated. */
export async function writePublishedData(
  events: EventDetail[],
  outDir = OUTPUT_DIR,
): Promise<{ files: number }> {
  const eventsDir = path.join(outDir, 'events')
  await fs.rm(eventsDir, { recursive: true, force: true })
  await fs.mkdir(eventsDir, { recursive: true })

  const sorted = [...events].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  const indexPath = path.join(outDir, 'index.json')
  const indexBody: Omit<DataIndex, 'generatedAt'> = {
    schemaVersion: SCHEMA_VERSION,
    attribution: ATTRIBUTION,
    events: sorted.map(toIndexEvent),
  }
  const index: DataIndex = {
    schemaVersion: indexBody.schemaVersion,
    generatedAt: (await stableGeneratedAt(indexPath, indexBody)) ?? new Date().toISOString(),
    attribution: indexBody.attribution,
    events: indexBody.events,
  }
  dataIndexSchema.parse(index)

  const search: SearchIndex = sorted.map((ev) => ({
    e: ev.id,
    n: ev.name,
    d: ev.date,
    f: [...new Set(ev.fights.flatMap((f) => f.fighters))],
  }))
  searchIndexSchema.parse(search)

  await fs.writeFile(indexPath, JSON.stringify(index), 'utf8')
  await fs.writeFile(path.join(outDir, 'search-index.json'), JSON.stringify(search), 'utf8')
  for (const ev of sorted) {
    await fs.writeFile(path.join(eventsDir, `${ev.id}.json`), JSON.stringify(ev), 'utf8')
  }
  return { files: sorted.length + 2 }
}
