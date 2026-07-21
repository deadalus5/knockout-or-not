import { describe, expect, it } from 'vitest'
import type { Fight } from '@ko/shared'
import { REVEAL_METHODS, scanForSpoilers } from '@ko/shared'
import {
  attemptedHeatLevel,
  controlLevel,
  fightDurationMin,
  isMarqueeEvent,
  landedHeatLevel,
  methodClass,
  per30HeatLevel,
  roundClass,
  sigStrAttemptedPer30,
} from '../lib/format'

const base: Fight = {
  id: 'f01',
  order: 1,
  card: 'main',
  weightClass: 'Lightweight',
  titleFight: false,
  fighters: ['Charles Oliveira', 'Ilia Topuria'],
  scheduledRounds: 3,
  resultClass: 'early',
  excitement: 80,
  stars: 4,
  pace: 'high',
  why: ['Ended inside the distance'],
  scoreConfidence: 'full',
  stats: {
    combinedKD: 1,
    combinedSigStrLanded: 100,
    combinedSigStrAttempted: 160,
    sigStrPerMin: 12.5,
    combinedTakedowns: 0,
    combinedSubAttempts: 0,
    controlPct: 10,
  },
  reveal: { round: 2, time: '3:00', method: 'KO/TKO', methodDetail: null, bonuses: [] },
}

const withReveal = (round: number | null, time: string | null, scheduledRounds: number | null): Fight => ({
  ...base,
  scheduledRounds,
  reveal: { ...base.reveal, round, time },
})

describe('fightDurationMin', () => {
  it('sums completed 5-minute rounds plus the final-round time', () => {
    expect(fightDurationMin(withReveal(2, '3:00', 3))).toBe(8)
    expect(fightDurationMin(withReveal(5, '5:00', 5))).toBe(25)
  })

  it('is exact for round-1 endings regardless of format', () => {
    expect(fightDurationMin(withReveal(1, '2:27', 1))).toBeCloseTo(2.45)
    expect(fightDurationMin(withReveal(1, '30:00', null))).toBe(30)
  })

  it('returns null for legacy multi-round formats rather than guessing', () => {
    expect(fightDurationMin(withReveal(2, '3:00', 1))).toBeNull()
    expect(fightDurationMin(withReveal(2, '3:00', 2))).toBeNull()
    expect(fightDurationMin(withReveal(3, '1:00', null))).toBeNull()
  })

  it('returns null when round, time, or elapsed time is missing', () => {
    expect(fightDurationMin(withReveal(null, '3:00', 3))).toBeNull()
    expect(fightDurationMin(withReveal(2, null, 3))).toBeNull()
    expect(fightDurationMin(withReveal(1, '0:00', 3))).toBeNull()
  })
})

describe('sigStrAttemptedPer30', () => {
  it('divides combined attempted strikes across 30-second windows', () => {
    // 160 attempted over 8 minutes = 16 half-minutes → 10.0
    expect(sigStrAttemptedPer30(base)).toBe(10)
  })

  it('rounds to one decimal', () => {
    const f = withReveal(1, '2:27', 5)
    expect(sigStrAttemptedPer30({ ...f, stats: { ...f.stats!, combinedSigStrAttempted: 301 } })).toBe(61.4)
  })

  it('returns null without stats or a derivable duration', () => {
    expect(sigStrAttemptedPer30({ ...base, stats: null })).toBeNull()
    expect(sigStrAttemptedPer30(withReveal(2, '3:00', 1))).toBeNull()
  })
})

describe('temperature buckets', () => {
  it('per30HeatLevel: cold below 5, full red at 15+', () => {
    expect(per30HeatLevel(0)).toBe(0)
    expect(per30HeatLevel(4.9)).toBe(0)
    expect(per30HeatLevel(5)).toBe(1)
    expect(per30HeatLevel(7.9)).toBe(1)
    expect(per30HeatLevel(8)).toBe(2)
    expect(per30HeatLevel(10.9)).toBe(2)
    expect(per30HeatLevel(11)).toBe(3)
    expect(per30HeatLevel(14.9)).toBe(3)
    expect(per30HeatLevel(15)).toBe(4)
    expect(per30HeatLevel(61.4)).toBe(4)
  })

  it('landedHeatLevel: quartile boundaries at 30/65/105/155', () => {
    expect(landedHeatLevel(0)).toBe(0)
    expect(landedHeatLevel(29)).toBe(0)
    expect(landedHeatLevel(30)).toBe(1)
    expect(landedHeatLevel(64)).toBe(1)
    expect(landedHeatLevel(65)).toBe(2)
    expect(landedHeatLevel(104)).toBe(2)
    expect(landedHeatLevel(105)).toBe(3)
    expect(landedHeatLevel(154)).toBe(3)
    expect(landedHeatLevel(155)).toBe(4)
    expect(landedHeatLevel(578)).toBe(4)
  })

  it('attemptedHeatLevel: quartile boundaries at 60/135/240/350', () => {
    expect(attemptedHeatLevel(0)).toBe(0)
    expect(attemptedHeatLevel(59)).toBe(0)
    expect(attemptedHeatLevel(60)).toBe(1)
    expect(attemptedHeatLevel(134)).toBe(1)
    expect(attemptedHeatLevel(135)).toBe(2)
    expect(attemptedHeatLevel(239)).toBe(2)
    expect(attemptedHeatLevel(240)).toBe(3)
    expect(attemptedHeatLevel(349)).toBe(3)
    expect(attemptedHeatLevel(350)).toBe(4)
    expect(attemptedHeatLevel(1027)).toBe(4)
  })

  it('controlLevel: reverse battery in quarter buckets', () => {
    expect(controlLevel(0)).toBe(0)
    expect(controlLevel(3)).toBe(0)
    expect(controlLevel(24)).toBe(0)
    expect(controlLevel(25)).toBe(1)
    expect(controlLevel(49)).toBe(1)
    expect(controlLevel(50)).toBe(2)
    expect(controlLevel(68)).toBe(2)
    expect(controlLevel(74)).toBe(2)
    expect(controlLevel(75)).toBe(3)
    expect(controlLevel(99)).toBe(3)
  })
})

describe('methodClass', () => {
  it('maps every published method to a color class', () => {
    expect(methodClass('KO/TKO')).toBe('m-ko')
    expect(methodClass('Submission')).toBe('m-sub')
    expect(methodClass('Decision - Unanimous')).toBe('m-dec')
    expect(methodClass('Decision - Split')).toBe('m-dec')
    expect(methodClass('Decision - Majority')).toBe('m-dec')
    expect(methodClass('Draw')).toBe('m-draw')
    expect(methodClass('Disqualification')).toBe('m-dq')
    expect(methodClass('No Contest')).toBe('m-nc')
    expect(methodClass('Other')).toBe('m-other')
  })

  it('covers the full REVEAL_METHODS enum without falling through', () => {
    for (const method of REVEAL_METHODS) {
      const cls = methodClass(method)
      expect(cls).toMatch(/^m-[a-z]+$/)
      if (method !== 'Other') expect(cls).not.toBe('m-other')
    }
  })
})

describe('roundClass', () => {
  it('assigns fixed identity classes for rounds 1–5', () => {
    expect(roundClass(1)).toBe('rd-1')
    expect(roundClass(2)).toBe('rd-2')
    expect(roundClass(3)).toBe('rd-3')
    expect(roundClass(4)).toBe('rd-4')
    expect(roundClass(5)).toBe('rd-5')
  })

  it('falls back to neutral for legacy formats', () => {
    expect(roundClass(7)).toBe('rd-x')
    expect(roundClass(0)).toBe('rd-x')
  })
})

describe('isMarqueeEvent', () => {
  it('highlights numbered PPVs and named specials', () => {
    expect(isMarqueeEvent('UFC 329: McGregor vs. Holloway 2')).toBe(true)
    expect(isMarqueeEvent('UFC 5: The Return of the Beast')).toBe(true)
    expect(isMarqueeEvent('UFC - Ultimate Japan')).toBe(true)
    expect(isMarqueeEvent("UFC - Ultimate Ultimate '96")).toBe(true)
    expect(isMarqueeEvent('UFC Freedom 250')).toBe(true)
    expect(isMarqueeEvent('Ortiz vs Shamrock 3: The Final Chapter')).toBe(true)
  })

  it('leaves recurring series plain', () => {
    expect(isMarqueeEvent('UFC Fight Night: Fiziev vs. Torres')).toBe(false)
    expect(isMarqueeEvent('UFC on ESPN: Emmett vs. Murphy')).toBe(false)
    expect(isMarqueeEvent('UFC on Fox: Velasquez vs. dos Santos')).toBe(false)
    expect(isMarqueeEvent('The Ultimate Fighter: Heavy Hitters Finale')).toBe(false)
    expect(isMarqueeEvent('UFC Live: Cruz vs Johnson')).toBe(false)
    expect(isMarqueeEvent('UFC - Road to UFC 4.6')).toBe(false)
  })
})

describe('color classes are spoiler-safe', () => {
  it('no generated class name trips a forbidden pattern', () => {
    const classes = [
      ...REVEAL_METHODS.map((m) => methodClass(m)),
      ...[0, 4.9, 5, 8, 11, 15, 100].map((v) => `heat-${per30HeatLevel(v)}`),
      ...[0, 29, 65, 105, 155].map((v) => `heat-${landedHeatLevel(v)}`),
      ...[0, 60, 135, 240, 350].map((v) => `heat-${attemptedHeatLevel(v)}`),
      ...[0, 25, 50, 75, 99].map((v) => `ctl-${controlLevel(v)}`),
      ...[1, 2, 3, 4, 5, 7].map((r) => roundClass(r)),
    ]
    expect(scanForSpoilers(classes.join(' '))).toEqual([])
  })
})
