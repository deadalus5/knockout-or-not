import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadEvent } from '../lib/dataClient'

// Hosts with a single-page-app fallback (Cloudflare Workers static assets)
// answer a missing file with index.html and HTTP 200, so the loader must
// check the content type, not just the status. Each test uses a distinct
// event id because loadEvent caches per id.

const eventsDir = path.resolve(process.cwd(), 'public', 'data', 'v1', 'events')

afterEach(() => vi.unstubAllGlobals())

describe('dataClient content-type guard', () => {
  it('rejects an HTML page served with status 200 (SPA fallback for a missing file)', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response('<!doctype html><html><body><div id="root"></div></body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
    )
    await expect(loadEvent('guard-test-html-200')).rejects.toThrow(/not json/i)
  })

  it('still reports a real HTTP 404', async () => {
    vi.stubGlobal('fetch', async () => new Response('not found', { status: 404 }))
    await expect(loadEvent('guard-test-404')).rejects.toThrow(/HTTP 404/)
  })

  it('accepts application/json with a charset parameter', async () => {
    const first = fs.readdirSync(eventsDir).find((f) => f.endsWith('.json'))!
    const body = fs.readFileSync(path.join(eventsDir, first), 'utf8')
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(body, {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        }),
    )
    const event = await loadEvent('guard-test-json-ok')
    expect(Array.isArray(event.fights)).toBe(true)
  })
})
