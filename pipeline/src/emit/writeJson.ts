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

/** Write index.json, search-index.json and events/*.json, all schema-validated. */
export async function writePublishedData(events: EventDetail[]): Promise<{ files: number }> {
  const eventsDir = path.join(OUTPUT_DIR, 'events')
  await fs.rm(eventsDir, { recursive: true, force: true })
  await fs.mkdir(eventsDir, { recursive: true })

  const sorted = [...events].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  const index: DataIndex = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    attribution: ATTRIBUTION,
    events: sorted.map(toIndexEvent),
  }
  dataIndexSchema.parse(index)

  const search: SearchIndex = sorted.map((ev) => ({
    e: ev.id,
    n: ev.name,
    d: ev.date,
    f: [...new Set(ev.fights.flatMap((f) => f.fighters))],
  }))
  searchIndexSchema.parse(search)

  await fs.writeFile(path.join(OUTPUT_DIR, 'index.json'), JSON.stringify(index), 'utf8')
  await fs.writeFile(path.join(OUTPUT_DIR, 'search-index.json'), JSON.stringify(search), 'utf8')
  for (const ev of sorted) {
    await fs.writeFile(path.join(eventsDir, `${ev.id}.json`), JSON.stringify(ev), 'utf8')
  }
  return { files: sorted.length + 2 }
}
