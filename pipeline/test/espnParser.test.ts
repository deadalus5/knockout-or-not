import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { scanForSpoilers } from '@ko/shared'
import { parseEspnEvent, type EspnEventBundle } from '../src/parse/espnEvent.js'
import { rewritePvtUrl } from '../src/fetch/espnSource.js'

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')

/**
 * Real (trimmed) ESPN API responses for UFC Fight Night: Fiziev vs. Torres.
 * Like the wiki HTML fixtures, it still carries the raw winner markers —
 * the parser, not the fixture, is what neutralizes them.
 */
function loadBundle(): EspnEventBundle {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, 'espn_event.json'), 'utf8'))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw fixture JSON
type Json = any

describe('parseEspnEvent', () => {
  it('parses event metadata and orders fights main-event-first', () => {
    const event = parseEspnEvent(loadBundle())!
    expect(event.espnId).toBe('600059254')
    expect(event.name).toBe('UFC Fight Night: Fiziev vs. Torres')
    expect(event.date).toBe('2026-06-27')
    expect(event.location).toBe('Baku, Azerbaijan')
    // matchNumber 1 = main event; the two prelims follow (matchNumber 12, 13).
    expect(event.fights.map((f) => [f.order, f.fighters, f.card])).toEqual([
      [1, ['Rafael Fiziev', 'Manuel Torres'], 'main'],
      [2, ['Bekzat Almakhan', 'Jean Matsumoto'], 'prelim'],
      [3, ['Tahir Abdullayev', 'Jefferson Nascimento'], 'prelim'],
    ])
  })

  it('maps methods and reveal fields, keeping detail only for finishes', () => {
    const [main, decision, ko] = parseEspnEvent(loadBundle())!.fights
    expect(main!.methodClass).toBe('KO/TKO')
    expect(main!.methodDetail).toBe('Punches')
    expect(main!.round).toBe(2)
    expect(main!.time).toBe('0:15')
    expect(main!.scheduledRounds).toBe(5)
    expect(main!.weightClass).toBe('Lightweight')
    expect(decision!.methodClass).toBe('Decision - Unanimous')
    expect(decision!.methodDetail).toBeNull()
    expect(decision!.round).toBe(3)
    expect(decision!.time).toBe('5:00')
    expect(decision!.scheduledRounds).toBe(3)
    expect(ko!.methodClass).toBe('KO/TKO')
  })

  it('sums both competitors into symmetric combined stats; missing stats stay null', () => {
    const [main, decision, ko] = parseEspnEvent(loadBundle())!.fights
    // The fixture deliberately carries no statistics for the main event.
    expect(main!.stats).toBeNull()
    expect(ko!.stats).toEqual({
      combinedKD: 0,
      combinedSigStrLanded: 37 + 35,
      combinedSigStrAttempted: 87 + 72,
      combinedTotalStr: 60 + 54,
      combinedTD: 2,
      combinedSubAtt: 0,
      combinedRev: 0,
      combinedCtrlSeconds: 192 + 33,
      roundsWithStats: 3,
    })
    expect(decision!.stats!.combinedKD).toBe(1)
    expect(decision!.stats!.combinedSigStrLanded).toBe(79 + 69)
    expect(decision!.stats!.combinedSigStrAttempted).toBe(229 + 159)
    expect(decision!.stats!.combinedCtrlSeconds).toBe(98 + 2)
  })

  it('is symmetric: flipping which competitor ESPN marks as winner is byte-identical (canary)', () => {
    const flipped = loadBundle()
    for (const doc of [flipped.scoreboard, flipped.detail] as Json[]) {
      for (const comp of doc.competitions) {
        comp.competitors.reverse()
        for (const competitor of comp.competitors) competitor.winner = !competitor.winner
      }
    }
    const a = parseEspnEvent(loadBundle())
    const b = parseEspnEvent(flipped)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('emits no forbidden spoiler patterns and no winner field', () => {
    const json = JSON.stringify(parseEspnEvent(loadBundle()))
    expect(scanForSpoilers(json)).toHaveLength(0)
    expect(json).not.toMatch(/winner/i)
  })

  it('maps unknown or missing results conservatively to Other with no detail', () => {
    const bundle = loadBundle() as Json
    bundle.statuses['401870065'].result = {
      id: 999,
      name: 'flying-armbar-into-the-crowd',
      displayName: 'Flying Armbar Into The Crowd',
      description: 'should not survive',
    }
    delete bundle.statuses['401872623'].result
    const [main, decision] = parseEspnEvent(bundle)!.fights
    expect(main!.methodClass).toBe('Other')
    expect(main!.methodDetail).toBeNull()
    expect(decision!.methodClass).toBe('Other')
  })

  it('maps draw-flavoured and NC-flavoured slugs before decision keywords', () => {
    const bundle = loadBundle() as Json
    bundle.statuses['401872623'].result = { name: 'majority-draw', displayName: 'Majority Draw' }
    bundle.statuses['401870065'].result = {
      name: 'no-contest',
      displayName: 'No Contest (Overturned)',
    }
    const [main, decision] = parseEspnEvent(bundle)!.fights
    expect(decision!.methodClass).toBe('Draw')
    expect(main!.methodClass).toBe('No Contest')
  })

  it("normalizes women's weight classes to the wiki/CSV vocabulary", () => {
    const bundle = loadBundle() as Json
    bundle.detail.competitions[0].type.text = 'W Strawweight'
    const fights = parseEspnEvent(bundle)!.fights
    expect(fights.find((f) => f.weightClass === "Women's Strawweight")).toBeDefined()
  })

  it('skips fights that are not final and returns null for a live event', () => {
    const notFinal = loadBundle() as Json
    notFinal.statuses['401870065'].type.completed = false
    expect(parseEspnEvent(notFinal)!.fights).toHaveLength(2)

    const liveEvent = loadBundle() as Json
    liveEvent.scoreboard.status.type.completed = false
    expect(parseEspnEvent(liveEvent)).toBeNull()
  })
})

describe('rewritePvtUrl', () => {
  it('rewrites the internal .pvt domain and forces https', () => {
    expect(
      rewritePvtUrl('http://sports.core.api.espn.pvt/v2/sports/mma/leagues/ufc/events/1?lang=en'),
    ).toBe('https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/events/1?lang=en')
    expect(rewritePvtUrl('https://sports.core.api.espn.com/v2/x')).toBe(
      'https://sports.core.api.espn.com/v2/x',
    )
  })
})
