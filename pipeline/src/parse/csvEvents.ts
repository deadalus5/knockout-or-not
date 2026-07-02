import { parse } from 'csv-parse/sync'
import { toIsoDate } from './common.js'

export interface CsvEvent {
  name: string
  date: string
  location: string | null
  url: string
}

/** Parse ufc_event_details.csv — dedupes rows (the dataset contains duplicates). */
export function parseCsvEvents(csv: string): CsvEvent[] {
  const rows: Record<string, string>[] = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })
  const byUrl = new Map<string, CsvEvent>()
  for (const row of rows) {
    const url = (row['URL'] ?? '').trim()
    const name = (row['EVENT'] ?? '').trim()
    const date = toIsoDate(row['DATE'] ?? '')
    if (!url || !name || !date) continue
    if (!byUrl.has(url)) {
      byUrl.set(url, { name, date, location: (row['LOCATION'] ?? '').trim() || null, url })
    }
  }
  return [...byUrl.values()]
}
