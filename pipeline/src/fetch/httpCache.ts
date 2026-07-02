import fs from 'node:fs/promises'
import path from 'node:path'
import { CACHE_DIR, USER_AGENT } from '../config.js'

interface CacheMeta {
  url: string
  etag?: string
  fetchedAt: string
}

function cachePaths(cacheKey: string) {
  const safe = cacheKey.replace(/[^a-zA-Z0-9._-]/g, '_')
  return {
    body: path.join(CACHE_DIR, safe),
    meta: path.join(CACHE_DIR, `${safe}.meta.json`),
  }
}

async function readIfExists(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, 'utf8')
  } catch {
    return null
  }
}

export interface FetchOptions {
  /** Serve from cache without any network request when present. */
  preferCache?: boolean
  /** Never hit the network (offline mode); throws if not cached. */
  offline?: boolean
}

/**
 * GET with a disk cache. Uses ETag revalidation when we have a cached copy,
 * and falls back to the cached copy on network failure.
 */
export async function cachedFetch(
  url: string,
  cacheKey: string,
  opts: FetchOptions = {},
): Promise<string> {
  const { body: bodyPath, meta: metaPath } = cachePaths(cacheKey)
  const cachedBody = await readIfExists(bodyPath)
  const cachedMetaRaw = await readIfExists(metaPath)
  const cachedMeta: CacheMeta | null = cachedMetaRaw ? JSON.parse(cachedMetaRaw) : null

  if (cachedBody !== null && (opts.offline || opts.preferCache)) return cachedBody
  if (opts.offline) throw new Error(`offline mode and no cache for ${url}`)

  const headers: Record<string, string> = { 'user-agent': USER_AGENT }
  if (cachedBody !== null && cachedMeta?.etag) headers['if-none-match'] = cachedMeta.etag

  let res: Response
  try {
    res = await fetch(url, { headers })
  } catch (err) {
    if (cachedBody !== null) {
      console.warn(`network error for ${url}; using cached copy`)
      return cachedBody
    }
    throw err
  }

  if (res.status === 304 && cachedBody !== null) return cachedBody
  if (!res.ok) {
    if (cachedBody !== null) {
      console.warn(`HTTP ${res.status} for ${url}; using cached copy`)
      return cachedBody
    }
    throw new Error(`HTTP ${res.status} for ${url}`)
  }

  const body = await res.text()
  await fs.mkdir(CACHE_DIR, { recursive: true })
  await fs.writeFile(bodyPath, body, 'utf8')
  const meta: CacheMeta = {
    url,
    etag: res.headers.get('etag') ?? undefined,
    fetchedAt: new Date().toISOString(),
  }
  await fs.writeFile(metaPath, JSON.stringify(meta), 'utf8')
  return body
}
