import { describe, expect, it } from 'vitest'
import type { CombinedStats } from '../src/model.js'
import type { WikiExtract } from '../src/parse/wikiExtract.js'
import type { WikiFight } from '../src/parse/wikiEventPage.js'
import type { EspnEvent, EspnFight } from '../src/parse/espnEvent.js'
import type { EspnExtract } from '../src/parse/espnExtract.js'
import { mergeAll } from '../src/merge/mergeEvents.js'
import { sanitizeEvent } from '../src/emit/sanitize.js'
import { Percentiles } from '../src/score/percentiles.js'

const percentiles = new Percentiles([2, 4, 6, 8, 10, 12])

const combined: CombinedStats = {
  combinedKD: 1,
  combinedSigStrLanded: 72,
  combinedSigStrAttempted: 159,
  combinedTotalStr: 114,
  combinedTD: 2,
  combinedSubAtt: 0,
  combinedRev: 0,
  combinedCtrlSeconds: 225,
  roundsWithStats: 3,
}

function wikiFight(overrides: Partial<WikiFight> = {}): WikiFight {
  return {
    fighters: ['Manuel Torres', 'Rafael Fiziev'],
    order: 1,
    card: null,
    weightClass: 'Lightweight',
    titleFight: false,
    methodClass: 'KO/TKO',
    methodDetail: 'punches',
    round: 2,
    time: '0:15',
    bonuses: ['FOTN'],
    ...overrides,
  }
}

function espnFight(overrides: Partial<EspnFight> = {}): EspnFight {
  return {
    fighters: ['Manuel Torres', 'Rafael Fiziev'],
    order: 1,
    card: 'main',
    weightClass: 'Lightweight',
    titleFight: false,
    methodClass: 'KO/TKO',
    methodDetail: 'Punches',
    round: 2,
    time: '0:15',
    scheduledRounds: 5,
    stats: combined,
    ...overrides,
  }
}

function wikiExtract(fights: WikiFight[]): WikiExtract {
  return {
    extractVersion: 1,
    events: [
      {
        title: 'UFC Fight Night: Fiziev vs. Torres',
        revid: 1,
        name: 'UFC Fight Night: Fiziev vs. Torres',
        date: '2026-06-27',
        location: 'Baku, Azerbaijan',
        fights,
      },
    ],
  }
}

function espnExtract(event: Partial<EspnEvent> = {}): EspnExtract {
  return {
    extractVersion: 1,
    events: [
      {
        espnId: '600059254',
        name: 'UFC Fight Night: Fiziev vs. Torres',
        date: '2026-06-27',
        location: 'Baku, Azerbaijan',
        fights: [espnFight()],
        ...event,
      },
    ],
  }
}

const noCsv = { events: [], fightsByEvent: new Map(), stats: new Map() }

describe('merging the ESPN extract', () => {
  it('fills a wiki event with ESPN stats/card/format but keeps wiki results and bonuses', () => {
    const wiki = wikiExtract([
      wikiFight({ methodClass: 'Submission', methodDetail: 'armbar', round: 3, time: '1:11' }),
    ])
    const espn = espnExtract()
    const { events, report } = mergeAll(noCsv.events, noCsv.fightsByEvent, noCsv.stats, wiki, espn)

    expect(events).toHaveLength(1)
    const fight = events[0]!.fights[0]!
    // ESPN's unique contribution
    expect(fight.stats).toEqual(combined)
    expect(fight.card).toBe('main')
    expect(fight.scheduledRounds).toBe(5)
    expect(fight.roundLengthsMin).toEqual([5, 5, 5, 5, 5])
    // Wikipedia is the source of record — ESPN's differing method must not win.
    expect(fight.methodClass).toBe('Submission')
    expect(fight.methodDetail).toBe('armbar')
    expect(fight.round).toBe(3)
    expect(fight.time).toBe('1:11')
    expect(fight.bonuses).toEqual(['FOTN'])
    // Stats attached to a wiki event → promoted so dataQuality becomes 'full'.
    expect(events[0]!.source).toBe('merged')
    expect(report.espnStatsAttached).toBe(1)
    expect(report.espnOnlyEvents).toHaveLength(0)

    const published = sanitizeEvent(events[0]!, percentiles)
    expect(published.dataQuality).toBe('full')
    expect(published.fights[0]!.scoreConfidence).toBe('full')
  })

  it('keeps a wiki event basic when ESPN has no stats for it', () => {
    const wiki = wikiExtract([wikiFight()])
    const espn = espnExtract({ fights: [espnFight({ stats: null })] })
    const { events } = mergeAll(noCsv.events, noCsv.fightsByEvent, noCsv.stats, wiki, espn)
    expect(events[0]!.source).toBe('wiki')
    expect(sanitizeEvent(events[0]!, percentiles).dataQuality).toBe('basic')
  })

  it('emits a whole event from ESPN when Wikipedia does not have it yet', () => {
    const wiki: WikiExtract = { extractVersion: 1, events: [] }
    const { events, report } = mergeAll(
      noCsv.events,
      noCsv.fightsByEvent,
      noCsv.stats,
      wiki,
      espnExtract(),
    )
    expect(report.espnOnlyEvents).toEqual(['2026-06-27 UFC Fight Night: Fiziev vs. Torres'])
    expect(events[0]!.source).toBe('espn')
    expect(events[0]!.fights[0]!.bonuses).toEqual([]) // ESPN never provides bonuses
    expect(events[0]!.fights[0]!.legacyFormat).toBe(false)

    const published = sanitizeEvent(events[0]!, percentiles)
    expect(published.dataQuality).toBe('full')
    expect(published.fights[0]!.scoreConfidence).toBe('full')
    expect(published.fights[0]!.reveal.method).toBe('KO/TKO')
  })

  it('marks a stats-less ESPN-only event as basic quality', () => {
    const wiki: WikiExtract = { extractVersion: 1, events: [] }
    const espn = espnExtract({ fights: [espnFight({ stats: null })] })
    const { events } = mergeAll(noCsv.events, noCsv.fightsByEvent, noCsv.stats, wiki, espn)
    const published = sanitizeEvent(events[0]!, percentiles)
    expect(published.dataQuality).toBe('basic')
    expect(published.fights[0]!.scoreConfidence).toBe('basic')
  })

  it('appends ESPN fights missing from a half-edited wiki results table', () => {
    const wiki = wikiExtract([wikiFight()])
    const extra = espnFight({
      fighters: ['Jean Matsumoto', 'Bekzat Almakhan'],
      order: 2,
      card: 'prelim',
      methodClass: 'Decision - Unanimous',
      methodDetail: null,
      round: 3,
      time: '5:00',
      scheduledRounds: 3,
    })
    const espn = espnExtract({ fights: [espnFight(), extra] })
    const { events } = mergeAll(noCsv.events, noCsv.fightsByEvent, noCsv.stats, wiki, espn)
    expect(events[0]!.fights).toHaveLength(2)
    expect(events[0]!.fights[1]!.fighters).toEqual(['Jean Matsumoto', 'Bekzat Almakhan'])
    expect(events[0]!.fights[1]!.methodClass).toBe('Decision - Unanimous')
  })
})
