import {
  dataIndexSchema,
  eventDetailSchema,
  searchIndexSchema,
  type DataIndex,
  type EventDetail,
  type SearchIndex,
} from '@ko/shared'

/**
 * Loads published data. Everything fetched is re-validated against the strict
 * whitelist schema — defense in depth: even a compromised or stale data file
 * cannot introduce winner fields past this point.
 */

const base = `${import.meta.env.BASE_URL}data/v1`

let indexCache: Promise<DataIndex> | null = null
const eventCache = new Map<string, Promise<EventDetail>>()
let searchCache: Promise<SearchIndex> | null = null

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`)
  return res.json()
}

export function loadIndex(): Promise<DataIndex> {
  indexCache ??= fetchJson(`${base}/index.json`).then((d) => dataIndexSchema.parse(d))
  return indexCache
}

export function loadEvent(id: string): Promise<EventDetail> {
  if (!/^[a-z0-9-]+$/.test(id)) return Promise.reject(new Error('bad event id'))
  let cached = eventCache.get(id)
  if (!cached) {
    cached = fetchJson(`${base}/events/${id}.json`).then((d) => eventDetailSchema.parse(d))
    eventCache.set(id, cached)
  }
  return cached
}

export function loadSearchIndex(): Promise<SearchIndex> {
  searchCache ??= fetchJson(`${base}/search-index.json`).then((d) => searchIndexSchema.parse(d))
  return searchCache
}
