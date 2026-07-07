import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { EspnEvent } from './espnEvent.js'

/**
 * The committed, spoiler-safe extract of ESPN event data
 * (pipeline/data/espnExtract.json). Fighters are alphabetically sorted,
 * winner flags/play-by-play were never read, and per-fighter stats are
 * already combined symmetrically by the parser, so this file is safe to keep
 * in a public repo. It exists because ESPN is only *fetched* for the last
 * few days (ESPN_LOOKBACK_DAYS) but is the sole stats source after the CSV
 * cutoff — without this file, an event's stats would vanish from the next
 * rebuild once it aged out of the fetch window.
 */
export interface EspnExtract {
  extractVersion: 1
  events: EspnEvent[]
}

const EXTRACT_PATH = path.join(
  fileURLToPath(new URL('../..', import.meta.url)),
  'data',
  'espnExtract.json',
)

export async function readEspnExtract(): Promise<EspnExtract> {
  try {
    const raw = await fs.readFile(EXTRACT_PATH, 'utf8')
    return JSON.parse(raw) as EspnExtract
  } catch {
    return { extractVersion: 1, events: [] }
  }
}

export async function writeEspnExtract(extract: EspnExtract): Promise<void> {
  extract.events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  await fs.mkdir(path.dirname(EXTRACT_PATH), { recursive: true })
  await fs.writeFile(EXTRACT_PATH, JSON.stringify(extract, null, 1), 'utf8')
}
