import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { WikiFight } from './wikiEventPage.js'

/**
 * The committed, spoiler-safe extract of Wikipedia event data
 * (pipeline/data/wikiExtract.json). Fighters are alphabetically sorted and
 * scorecards/bonus-recipient names are already stripped by the page parser,
 * so this file is safe to keep in a public repo. It exists so the one-time
 * ~800-page backfill never has to be re-fetched (e.g. in CI).
 */
export interface WikiExtractEvent {
  title: string
  revid: number
  name: string
  date: string
  location: string | null
  fights: WikiFight[]
}

export interface WikiExtract {
  extractVersion: 1
  events: WikiExtractEvent[]
}

const EXTRACT_PATH = path.join(
  fileURLToPath(new URL('../..', import.meta.url)),
  'data',
  'wikiExtract.json',
)

export async function readWikiExtract(): Promise<WikiExtract> {
  try {
    const raw = await fs.readFile(EXTRACT_PATH, 'utf8')
    return JSON.parse(raw) as WikiExtract
  } catch {
    return { extractVersion: 1, events: [] }
  }
}

export async function writeWikiExtract(extract: WikiExtract): Promise<void> {
  extract.events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  await fs.mkdir(path.dirname(EXTRACT_PATH), { recursive: true })
  await fs.writeFile(EXTRACT_PATH, JSON.stringify(extract, null, 1), 'utf8')
}
