/**
 * Smoke test: builds must already exist (`npm run build`). Starts vite
 * preview, then verifies the app shell, data files, PWA artifacts, and that
 * no published data file contains forbidden spoiler patterns.
 */
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 4199
const BASE = `http://localhost:${PORT}`

function fail(msg) {
  console.error(`SMOKE FAIL: ${msg}`)
  process.exit(1)
}

// detached → own process group, so we can kill npm AND the vite child it
// spawns. Killing only npm leaves an orphaned vite holding the stdio pipes,
// which keeps this process (and CI) alive forever.
const preview = spawn('npm', ['-w', 'web', 'run', 'preview', '--', '--port', String(PORT), '--strictPort'], {
  stdio: 'pipe',
  detached: true,
})
preview.on('error', (err) => fail(`preview failed to start: ${err}`))

try {
  let up = false
  for (let i = 0; i < 30; i++) {
    await sleep(500)
    try {
      const res = await fetch(BASE)
      if (res.ok) {
        up = true
        break
      }
    } catch {
      /* not up yet */
    }
  }
  if (!up) fail('preview server never came up')

  const shell = await fetch(BASE).then((r) => r.text())
  if (!shell.includes('id="root"')) fail('app shell missing #root')
  if (!shell.includes('manifest.webmanifest')) fail('manifest link missing from shell')

  const manifest = await fetch(`${BASE}/manifest.webmanifest`)
  if (!manifest.ok) fail(`manifest.webmanifest: HTTP ${manifest.status}`)

  const sw = await fetch(`${BASE}/sw.js`)
  if (!sw.ok) fail(`sw.js: HTTP ${sw.status}`)

  const index = await fetch(`${BASE}/data/v1/index.json`)
  if (!index.ok) fail(`index.json: HTTP ${index.status}`)
  const indexData = await index.json()
  if (indexData.schemaVersion !== 1) fail('index.json schemaVersion mismatch')
  if (!Array.isArray(indexData.events) || indexData.events.length < 700)
    fail(`suspiciously few events: ${indexData.events?.length}`)

  const first = indexData.events[0]
  const event = await fetch(`${BASE}/data/v1/events/${first.id}.json`)
  if (!event.ok) fail(`event chunk: HTTP ${event.status}`)
  const eventData = await event.json()
  if (!Array.isArray(eventData.fights) || eventData.fights.length === 0)
    fail('event chunk has no fights')

  const raw = JSON.stringify(eventData)
  for (const pattern of [/\bdef\s*\./i, /\b[WL]\/[WL]\b/, /\b(defeated|defeats|loser)\b/i]) {
    if (pattern.test(raw)) fail(`forbidden pattern in served event data: ${pattern}`)
  }
  for (const fight of eventData.fights) {
    if ('winner' in fight || 'outcome' in fight) fail('winner-ish key in served data')
  }

  const search = await fetch(`${BASE}/data/v1/search-index.json`)
  if (!search.ok) fail(`search-index.json: HTTP ${search.status}`)

  console.log(
    `smoke ✓  shell, manifest, sw, index (${indexData.events.length} events), event chunk (${eventData.fights.length} fights), search index`,
  )
} finally {
  try {
    process.kill(-preview.pid)
  } catch {
    preview.kill()
  }
}
process.exit(0)
