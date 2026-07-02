import { describe, expect, it } from 'vitest'
import {
  eventDetailSchema,
  fightSchema,
  lastNameKey,
  normalizeName,
  scanForSpoilers,
  sortFighters,
} from '@ko/shared'

const validFight = {
  id: 'f01',
  order: 1,
  card: 'main',
  weightClass: 'Lightweight',
  titleFight: true,
  fighters: ['Charles Oliveira', 'Ilia Topuria'],
  scheduledRounds: 5,
  resultClass: 'early',
  excitement: 93,
  stars: 5,
  pace: 'high',
  why: ['Ended inside the distance', 'Explosive striking exchanges'],
  scoreConfidence: 'full',
  stats: {
    combinedKD: 2,
    sigStrPerMin: 11.4,
    combinedTakedowns: 0,
    combinedSubAttempts: 0,
    controlPct: 3,
  },
  reveal: {
    round: 1,
    time: '2:27',
    method: 'KO/TKO',
    methodDetail: 'Punch',
    bonuses: ['PERF'],
  },
}

describe('published schema whitelist', () => {
  it('accepts a valid fight', () => {
    expect(fightSchema.parse(validFight)).toBeTruthy()
  })

  it('rejects unknown keys anywhere (strict whitelist)', () => {
    expect(() => fightSchema.parse({ ...validFight, winner: 'Ilia Topuria' })).toThrow()
    expect(() =>
      fightSchema.parse({ ...validFight, reveal: { ...validFight.reveal, outcome: 'W/L' } }),
    ).toThrow()
  })

  it('rejects free-text why phrases outside the vetted vocabulary', () => {
    expect(() => fightSchema.parse({ ...validFight, why: ['Topuria knocked him out'] })).toThrow()
  })

  it('accepts a valid event envelope', () => {
    const event = {
      schemaVersion: 1,
      id: '2026-06-27-ufc-event',
      sport: 'mma',
      org: 'ufc',
      name: 'UFC 317: Topuria vs. Oliveira',
      date: '2026-06-27',
      location: 'Las Vegas, Nevada, USA',
      dataQuality: 'full',
      fights: [validFight],
    }
    expect(eventDetailSchema.parse(event)).toBeTruthy()
  })
})

describe('name utilities', () => {
  it('strips diacritics and case', () => {
    expect(normalizeName('José Aldo')).toBe('jose aldo')
    expect(normalizeName('Antônio Rogério Nogueira')).toBe('antonio rogerio nogueira')
  })

  it('ignores generational suffixes for last-name keys', () => {
    expect(lastNameKey('Frank Mir Jr.')).toBe('mir')
    expect(lastNameKey('Khabib Nurmagomedov')).toBe('nurmagomedov')
  })

  it('sorts fighters deterministically by last name', () => {
    expect(sortFighters(['Ilia Topuria', 'Charles Oliveira'])).toEqual([
      'Charles Oliveira',
      'Ilia Topuria',
    ])
    expect(sortFighters(['Charles Oliveira', 'Ilia Topuria'])).toEqual([
      'Charles Oliveira',
      'Ilia Topuria',
    ])
  })
})

describe('forbidden pattern scanner', () => {
  it('flags winner-identifying notation', () => {
    expect(scanForSpoilers('Ilia Topuria def. Charles Oliveira')).not.toHaveLength(0)
    expect(scanForSpoilers('"outcome":"W/L"')).not.toHaveLength(0)
    expect(scanForSpoilers('48-47, 47-48, 48-47')).not.toHaveLength(0)
    expect(scanForSpoilers('the winner was crowned')).not.toHaveLength(0)
  })

  it('passes clean spoiler-safe content', () => {
    expect(scanForSpoilers(JSON.stringify(validFight))).toHaveLength(0)
  })
})
