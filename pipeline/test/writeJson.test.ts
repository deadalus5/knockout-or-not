import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { InternalEvent, InternalFight } from '../src/model.js'
import { Percentiles } from '../src/score/percentiles.js'
import { sanitizeEvent } from '../src/emit/sanitize.js'
import { writePublishedData } from '../src/emit/writeJson.js'

const basePercentiles = new Percentiles([2, 4, 6, 8, 10, 12])

function makeFight(overrides: Partial<InternalFight> = {}): InternalFight {
  return {
    fighters: ['Ilia Topuria', 'Charles Oliveira'],
    order: 1,
    card: 'main',
    weightClass: 'Lightweight',
    titleFight: true,
    methodClass: 'KO/TKO',
    methodDetail: 'Punch',
    round: 1,
    time: '2:27',
    scheduledRounds: 5,
    roundLengthsMin: [5, 5, 5, 5, 5],
    legacyFormat: false,
    stats: null,
    bonuses: [],
    ...overrides,
  }
}

function makeEvent(name: string, date: string): InternalEvent {
  return {
    source: 'merged',
    name,
    date,
    location: 'Las Vegas, Nevada, USA',
    fights: [makeFight()],
  }
}

describe('writePublishedData — index.json stability', () => {
  let dir: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ko-writejson-'))
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('re-emitting the same events keeps index.json byte-identical (generatedAt reused)', async () => {
    const events = [sanitizeEvent(makeEvent('UFC 317: Topuria vs. Oliveira', '2026-06-27'), basePercentiles)]
    await writePublishedData(events, dir)
    const first = await fs.readFile(path.join(dir, 'index.json'), 'utf8')
    await new Promise((r) => setTimeout(r, 5)) // ensure a fresh timestamp would differ
    await writePublishedData(events, dir)
    const second = await fs.readFile(path.join(dir, 'index.json'), 'utf8')
    expect(second).toBe(first)
  })

  it('re-stamps generatedAt when the event list actually changes', async () => {
    const first = [sanitizeEvent(makeEvent('UFC 317: Topuria vs. Oliveira', '2026-06-27'), basePercentiles)]
    await writePublishedData(first, dir)
    const before = JSON.parse(await fs.readFile(path.join(dir, 'index.json'), 'utf8'))
    await new Promise((r) => setTimeout(r, 5))
    const grown = [
      ...first,
      sanitizeEvent(makeEvent('UFC Fight Night: Whittaker vs. de Ridder', '2026-07-26'), basePercentiles),
    ]
    await writePublishedData(grown, dir)
    const after = JSON.parse(await fs.readFile(path.join(dir, 'index.json'), 'utf8'))
    expect(after.events).toHaveLength(2)
    expect(after.generatedAt).not.toBe(before.generatedAt)
  })

  it('handles a corrupt previous index.json by writing fresh', async () => {
    await fs.writeFile(path.join(dir, 'index.json'), '{not json', 'utf8')
    const events = [sanitizeEvent(makeEvent('UFC 317: Topuria vs. Oliveira', '2026-06-27'), basePercentiles)]
    await writePublishedData(events, dir)
    const index = JSON.parse(await fs.readFile(path.join(dir, 'index.json'), 'utf8'))
    expect(index.events).toHaveLength(1)
    expect(typeof index.generatedAt).toBe('string')
  })
})
