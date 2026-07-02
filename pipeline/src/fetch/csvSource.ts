import { CSV_BASE, CSV_FILES } from '../config.js'
import { cachedFetch, type FetchOptions } from './httpCache.js'

export interface RawCsvData {
  events: string
  results: string
  stats: string
}

export async function fetchCsvData(opts: FetchOptions = {}): Promise<RawCsvData> {
  const [events, results, stats] = await Promise.all([
    cachedFetch(CSV_BASE + CSV_FILES.events, CSV_FILES.events, opts),
    cachedFetch(CSV_BASE + CSV_FILES.results, CSV_FILES.results, opts),
    cachedFetch(CSV_BASE + CSV_FILES.stats, CSV_FILES.stats, opts),
  ])
  return { events, results, stats }
}
