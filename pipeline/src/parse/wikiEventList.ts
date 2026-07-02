import * as cheerio from 'cheerio'

export interface WikiEventListEntry {
  /** Wikipedia page title (from the event link) */
  title: string
  name: string
  date: string
  location: string | null
}

/**
 * Parse the "Past events" table of List_of_UFC_events. Rows carry an ISO date
 * in a data-sort-value attribute. Cells can be merged via rowspan (shared
 * venues/attendance), so location is extracted heuristically and is optional.
 */
export function parseWikiEventList(html: string): WikiEventListEntry[] {
  const $ = cheerio.load(html)
  const entries: WikiEventListEntry[] = []

  for (const table of $('table').toArray()) {
    const headers = $(table)
      .find('tr')
      .first()
      .find('th')
      .map((_, th) => $(th).text().trim())
      .get()
    if (!headers.includes('Event') || !headers.includes('Date')) continue
    // The past-events table is numbered; the scheduled-events table is not.
    if (headers[0] !== '#') continue

    for (const tr of $(table).find('tr').toArray()) {
      const tds = $(tr).find('td')
      if (tds.length < 3) continue
      const link = tds.eq(1).find('a').first()
      const title = link.attr('title') ?? null
      const name = link.text().trim() || tds.eq(1).text().trim()
      // Several cells can carry data-sort-value (event name, attendance);
      // pick the first one shaped like a date.
      let dateMatch: RegExpMatchArray | null = null
      for (const el of $(tr).find('[data-sort-value]').toArray()) {
        dateMatch = ($(el).attr('data-sort-value') ?? '').match(/(\d{4}-\d{2}-\d{2})/)
        if (dateMatch) break
      }
      if (!title || !name || !dateMatch) continue

      let location: string | null = null
      // Candidate cells after the date column; the location cell is the one
      // with a comma ("City, Country"), venues rarely have commas.
      for (let i = 3; i < tds.length; i++) {
        const text = tds.eq(i).text().replace(/\[\w+\]/g, '').trim()
        if (text.includes(',')) {
          location = text.replace(/\s+/g, ' ')
          break
        }
      }
      entries.push({ title, name, date: dateMatch[1]!, location })
    }
    if (entries.length > 0) break
  }
  return entries
}
