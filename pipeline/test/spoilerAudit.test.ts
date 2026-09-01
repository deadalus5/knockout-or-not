import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { InternalEvent } from '../src/model.js'
import { Percentiles } from '../src/score/percentiles.js'
import { sanitizeEvent } from '../src/emit/sanitize.js'
import { writePublishedData } from '../src/emit/writeJson.js'
import { auditPublishedData } from '../src/audit/spoilerAudit.js'

/**
 * The audit is the CI gate that re-reads every published file from disk.
 * These cases inject values directly into an emitted file — bypassing the
 * firewall — to prove the gate itself rejects them.
 */

const percentiles = new Percentiles([2, 4, 6, 8, 10, 12])

function event(): InternalEvent {
  return {
    source: 'merged',
    name: 'UFC 329: McGregor vs. Holloway 2',
    date: '2026-07-11',
    location: 'Las Vegas, Nevada, USA',
    fights: [
      {
        fighters: ['Conor McGregor', 'Max Holloway'],
        order: 1,
        card: 'main',
        weightClass: 'Welterweight',
        titleFight: false,
        methodClass: 'KO/TKO',
        methodDetail: 'Knee injury',
        round: 1,
        time: '1:09',
        scheduledRounds: 5,
        roundLengthsMin: [5, 5, 5, 5, 5],
        legacyFormat: false,
        stats: null,
        bonuses: [],
      },
    ],
  }
}

describe('spoiler audit — methodDetail gates', () => {
  let dir: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ko-audit-'))
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  async function publishWithDetail(methodDetail: string | null): Promise<void> {
    const published = sanitizeEvent(event(), percentiles)
    await writePublishedData([published], dir)
    const file = path.join(dir, 'events', `${published.id}.json`)
    const json = JSON.parse(await fs.readFile(file, 'utf8'))
    json.fights[0].reveal.methodDetail = methodDetail
    await fs.writeFile(file, JSON.stringify(json), 'utf8')
  }

  it('passes a clean detail', async () => {
    await publishWithDetail('Knee injury')
    expect(await auditPublishedData(dir)).toEqual([])
  })

  it('fails a glued detail', async () => {
    await publishWithDetail('Twister From Back ControlScottish twister')
    const findings = await auditPublishedData(dir)
    expect(findings).toHaveLength(1)
    expect(findings[0]!.problem).toBe('f01: methodDetail has glued words')
  })

  it('fails a detail naming a fighter, including the glued 2026-07-19 leak', async () => {
    await publishWithDetail('toMcGregor knee injury')
    const problems = (await auditPublishedData(dir)).map((f) => f.problem)
    expect(problems).toContain('f01: methodDetail contains a fighter name')
  })
})
