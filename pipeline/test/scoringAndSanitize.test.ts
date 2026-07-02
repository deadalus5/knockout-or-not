import { describe, expect, it } from 'vitest'
import { scanForSpoilers } from '@ko/shared'
import type { InternalEvent, InternalFight } from '../src/model.js'
import { Percentiles } from '../src/score/percentiles.js'
import { fightDurationMin, resultClass, scoreFight } from '../src/score/excitement.js'
import { sanitizeEvent } from '../src/emit/sanitize.js'
import { matchEvent } from '../src/merge/matchEvents.js'
import { matchFight } from '../src/merge/matchFights.js'

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
    stats: {
      combinedKD: 2,
      combinedSigStrLanded: 30,
      combinedSigStrAttempted: 60,
      combinedTotalStr: 40,
      combinedTD: 0,
      combinedSubAtt: 0,
      combinedRev: 0,
      combinedCtrlSeconds: 10,
      roundsWithStats: 1,
    },
    bonuses: ['PERF'],
    ...overrides,
  }
}

describe('duration and result class', () => {
  it('computes duration across rounds', () => {
    expect(fightDurationMin(makeFight())).toBeCloseTo(2.45, 2)
    expect(fightDurationMin(makeFight({ round: 3, time: '5:00' }))).toBe(15)
  })

  it('maps draws to distance and NC/DQ to early', () => {
    expect(resultClass(makeFight({ methodClass: 'Draw' }))).toBe('distance')
    expect(resultClass(makeFight({ methodClass: 'Decision - Split' }))).toBe('distance')
    expect(resultClass(makeFight({ methodClass: 'No Contest' }))).toBe('early')
    expect(resultClass(makeFight({ methodClass: 'Disqualification' }))).toBe('early')
    expect(resultClass(makeFight({ methodClass: 'KO/TKO' }))).toBe('early')
  })
})

describe('scoring', () => {
  it('scores a violent round-1 title finish very high', () => {
    const s = scoreFight(makeFight(), basePercentiles)
    expect(s.scoreConfidence).toBe('full')
    expect(s.excitement).toBe(83) // 30 finish + 22 pace + 18 KD + 6 R1 + 7 PERF
    expect(s.stars).toBe(5)
    expect(s.pace).toBe('high')
    expect(s.why).toContain('Ended inside the distance')
    expect(s.why).toContain('Multiple knockdowns')
    expect(s.why).toContain('Championship stakes')
  })

  it('scores a control-heavy decision low with a stall explanation', () => {
    const s = scoreFight(
      makeFight({
        methodClass: 'Decision - Unanimous',
        titleFight: false,
        bonuses: [],
        round: 3,
        time: '5:00',
        scheduledRounds: 3,
        roundLengthsMin: [5, 5, 5],
        stats: {
          combinedKD: 0,
          combinedSigStrLanded: 40,
          combinedSigStrAttempted: 90,
          combinedTotalStr: 120,
          combinedTD: 5,
          combinedSubAtt: 0,
          combinedRev: 0,
          combinedCtrlSeconds: 12 * 60,
          roundsWithStats: 3,
        },
      }),
      basePercentiles,
    )
    expect(s.excitement!).toBeLessThan(40)
    expect(s.why).toContain('Went the distance')
    expect(s.why).toContain('Long stretches of control')
  })

  it('gives no-contests and legacy fights a null rating with a neutral phrase', () => {
    const nc = scoreFight(makeFight({ methodClass: 'No Contest' }), basePercentiles)
    expect(nc.excitement).toBeNull()
    expect(nc.why).toEqual(['Not enough data to rate'])
    const legacy = scoreFight(makeFight({ legacyFormat: true, stats: null }), basePercentiles)
    expect(legacy.excitement).toBeNull()
    expect(legacy.why).toEqual(['Not enough data to rate'])
  })

  it('scores wiki-only fights on the basic scale', () => {
    const s = scoreFight(makeFight({ stats: null }), basePercentiles)
    expect(s.scoreConfidence).toBe('basic')
    expect(s.pace).toBeNull()
    expect(s.excitement).toBe(62 + 10 + 10) // KO base + R1 + PERF
  })
})

describe('sanitizeEvent — the spoiler firewall', () => {
  function makeEvent(fight: InternalFight): InternalEvent {
    return {
      source: 'merged',
      name: 'UFC 317: Topuria vs. Oliveira',
      date: '2026-06-27',
      location: 'Las Vegas, Nevada, USA',
      fights: [fight],
    }
  }

  it('produces byte-identical output regardless of internal fighter order (canary)', () => {
    const a = sanitizeEvent(
      makeEvent(makeFight({ fighters: ['Ilia Topuria', 'Charles Oliveira'] })),
      basePercentiles,
    )
    const b = sanitizeEvent(
      makeEvent(makeFight({ fighters: ['Charles Oliveira', 'Ilia Topuria'] })),
      basePercentiles,
    )
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(a.fights[0]!.fighters).toEqual(['Charles Oliveira', 'Ilia Topuria'])
  })

  it('emits no forbidden patterns and validates against the strict schema', () => {
    const published = sanitizeEvent(makeEvent(makeFight()), basePercentiles)
    expect(scanForSpoilers(JSON.stringify(published))).toHaveLength(0)
  })

  it('drops method details that quote a fighter', () => {
    const published = sanitizeEvent(
      makeEvent(makeFight({ methodDetail: 'Topuria landed a punch' })),
      basePercentiles,
    )
    expect(published.fights[0]!.reveal.methodDetail).toBeNull()
  })
})

describe('event and fight matching', () => {
  const wikiEvent = {
    title: 'UFC on ABC 6',
    revid: 1,
    name: 'UFC on ABC: Whittaker vs. Aliskerov',
    date: '2024-06-22',
    location: 'Riyadh, Saudi Arabia',
    fights: [],
  }

  it('accepts a lone exact-date candidate despite weak name similarity', () => {
    const byDate = new Map([['2024-06-22', [wikiEvent]]])
    const m = matchEvent('UFC Fight Night: Whittaker vs. Aliskerov', '2024-06-22', byDate)
    expect(m?.wikiEvent).toBe(wikiEvent)
  })

  it('rejects ±1-day candidates with weak similarity', () => {
    const byDate = new Map([['2024-06-23', [wikiEvent]]])
    const m = matchEvent('UFC 303: Pereira vs. Prochazka', '2024-06-22', byDate)
    expect(m).toBeNull()
  })

  it('accepts ±1-day candidates with strong similarity (timezone shift)', () => {
    const byDate = new Map([['2024-06-23', [wikiEvent]]])
    const m = matchEvent('UFC on ABC: Whittaker vs. Aliskerov', '2024-06-22', byDate)
    expect(m?.wikiEvent).toBe(wikiEvent)
  })

  it('matches fights by surname sets regardless of order and diacritics', () => {
    const wiki = {
      fighters: ['José Aldo', 'Chan Sung Jung'] as [string, string],
      order: 1, card: 'main' as const, weightClass: 'Featherweight', titleFight: false,
      methodClass: 'KO/TKO' as const, methodDetail: null, round: 4, time: '2:00', bonuses: [],
    }
    const m = matchFight(['Chan Sung Jung', 'Jose Aldo'], [wiki], new Set())
    expect(m).toBe(wiki)
  })
})
