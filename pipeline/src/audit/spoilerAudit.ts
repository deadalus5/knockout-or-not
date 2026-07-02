import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  dataIndexSchema,
  eventDetailSchema,
  fighterSortKey,
  nameTokens,
  scanForSpoilers,
  searchIndexSchema,
} from '@ko/shared'
import { OUTPUT_DIR } from '../config.js'

export interface AuditFinding {
  file: string
  problem: string
}

/**
 * Standalone audit of the published data directory. Independent of the
 * pipeline's own validation: re-reads every emitted file from disk, strict-
 * parses it against the whitelist schema, regex-scans the raw text for
 * winner-identifying notation, and re-verifies the structural spoiler rules.
 * Run directly (`npm run audit`), as the pipeline's final gate, and in CI.
 */
export async function auditPublishedData(dir = OUTPUT_DIR): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = []
  const add = (file: string, problem: string) => findings.push({ file, problem })

  const indexPath = path.join(dir, 'index.json')
  const indexRaw = await fs.readFile(indexPath, 'utf8').catch(() => null)
  if (indexRaw === null) return [{ file: indexPath, problem: 'missing index.json' }]

  scanText(indexPath, indexRaw, add)
  const indexParsed = dataIndexSchema.safeParse(JSON.parse(indexRaw))
  if (!indexParsed.success) add(indexPath, `schema: ${indexParsed.error.issues[0]?.message}`)

  const searchPath = path.join(dir, 'search-index.json')
  const searchRaw = await fs.readFile(searchPath, 'utf8').catch(() => null)
  if (searchRaw === null) {
    add(searchPath, 'missing search-index.json')
  } else {
    scanText(searchPath, searchRaw, add)
    const parsed = searchIndexSchema.safeParse(JSON.parse(searchRaw))
    if (!parsed.success) add(searchPath, `schema: ${parsed.error.issues[0]?.message}`)
  }

  const eventsDir = path.join(dir, 'events')
  const files = await fs.readdir(eventsDir).catch(() => [] as string[])
  if (files.length === 0) add(eventsDir, 'no event files emitted')

  for (const file of files) {
    const filePath = path.join(eventsDir, file)
    const raw = await fs.readFile(filePath, 'utf8')
    scanText(filePath, raw, add)

    const parsed = eventDetailSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      add(filePath, `schema: ${parsed.error.issues[0]?.message}`)
      continue
    }
    for (const fight of parsed.data.fights) {
      // Fighter order must be the uniform alphabetical rule — order that
      // deviates could encode the winner.
      const [a, b] = fight.fighters
      if (fighterSortKey(a) > fighterSortKey(b)) {
        add(filePath, `${fight.id}: fighters not in canonical order (${a} / ${b})`)
      }
      // Method details must never quote a participant.
      if (fight.reveal.methodDetail) {
        const detailTokens = new Set(nameTokens(fight.reveal.methodDetail))
        for (const fighter of fight.fighters) {
          if (nameTokens(fighter).some((t) => detailTokens.has(t))) {
            add(filePath, `${fight.id}: methodDetail contains a fighter name`)
          }
        }
      }
    }
  }
  return findings
}

function scanText(file: string, text: string, add: (f: string, p: string) => void): void {
  for (const hit of scanForSpoilers(text)) {
    add(file, `forbidden pattern "${hit.name}": ${hit.why}`)
  }
}

const isMain = process.argv[1] && fileURLToPath(new URL(import.meta.url)).endsWith(path.basename(process.argv[1]))
if (isMain) {
  const findings = await auditPublishedData()
  if (findings.length === 0) {
    console.log('spoiler audit: clean ✓')
  } else {
    console.error(`spoiler audit: ${findings.length} finding(s)`)
    for (const f of findings.slice(0, 50)) console.error(` ${f.file}: ${f.problem}`)
    process.exit(1)
  }
}
