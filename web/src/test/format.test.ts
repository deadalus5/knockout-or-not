import { describe, expect, it } from 'vitest'
import type { Fight } from '@ko/shared'
import { fightDurationMin, sigStrAttemptedPer30 } from '../lib/format'

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
