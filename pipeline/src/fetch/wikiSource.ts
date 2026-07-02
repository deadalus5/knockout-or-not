import { USER_AGENT, WIKI_API, WIKI_THROTTLE_MS } from '../config.js'
import { cachedFetch, type FetchOptions } from './httpCache.js'

let lastRequestAt = 0

async function throttle(): Promise<void> {
  const wait = lastRequestAt + WIKI_THROTTLE_MS - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastRequestAt = Date.now()
}

export interface WikiPage {
  title: string
  revid: number
  html: string
}

/**
 * Fetch a Wikipedia page's rendered HTML via the MediaWiki API.
 * Event pages are cached on disk by title; pass preferCache for pages whose
 * content we consider settled (past events already extracted).
 */
export async function fetchWikiPage(title: string, opts: FetchOptions = {}): Promise<WikiPage> {
  const url = `${WIKI_API}?action=parse&page=${encodeURIComponent(title)}&prop=text%7Crevid&format=json&formatversion=2&redirects=1`
  const cacheKey = `wiki_${title}`
  if (!opts.offline && !opts.preferCache) await throttle()
  const body = await cachedFetch(url, cacheKey, opts)
  const json = JSON.parse(body)
  if (json.error) throw new Error(`wiki API error for "${title}": ${json.error.info}`)
  return { title: json.parse.title, revid: json.parse.revid, html: json.parse.text }
}

const wikiFetchInfo = { userAgent: USER_AGENT }
export { wikiFetchInfo }
