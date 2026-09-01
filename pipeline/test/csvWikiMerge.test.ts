import { describe, expect, it } from 'vitest'
import type { CsvEvent } from '../src/parse/csvEvents.js'
import type { InternalFight } from '../src/model.js'
import type { WikiExtract } from '../src/parse/wikiExtract.js'
import type { WikiFight } from '../src/parse/wikiEventPage.js'
import { chooseMethodDetail, mergeAll } from '../src/merge/mergeEvents.js'
import { sanitizeEvent } from '../src/emit/sanitize.js'
import { Percentiles } from '../src/score/percentiles.js'

/**
 * The CSV-base + Wikipedia merge path — the one that produced the glued
 * UFC 330 details on 2026-08-16 — had no test before this file (espnMerge
 * always runs without a CSV). Wikipedia must own the finish description on
 * merged events, and nothing but the detail may change.
 */

const percentiles = new Percentiles([2, 4, 6, 8, 10, 12])
const EVENT = 'UFC 330: Makhachev vs. Machado Garry'
const DATE = '2026-08-15'

/** ufcstats spelling + ufcstats (winner-bearing) order — exactly what parse/csvResults.ts emits. */
function csvFight(overrides: Partial<InternalFight> = {}): InternalFight {
  return {
    fighters: ['Charles Johnson', 'Eduardo Chapolin'],
    order: 1,
    card: null,
    weightClass: 'Catch Weight',
    titleFight: false,
    methodClass: 'Submission',
    methodDetail: 'Twister From Back Control',
    round: 3,
    time: '1:36',
    scheduledRounds: 3,
    roundLengthsMin: [5, 5, 5],
    legacyFormat: false,
    stats: null,
    bonuses: [],
    ...overrides,
  }
}

/** Wikipedia's spelling of the same fighter ("Eduardo Henrique"), alphabetical as the page parser emits. */
function wikiFight(overrides: Partial<WikiFight> = {}): WikiFight {
  return {
    fighters: ['Eduardo Henrique', 'Charles Johnson'],
    order: 7,
    card: 'prelim',
    weightClass: 'Catchweight',
    titleFight: false,
    methodClass: 'Submission',
    methodDetail: 'twister',
    round: 3,
    time: '1:36',
    bonuses: ['PERF'],
    ...overrides,
  }
}

function merge(fights: InternalFight[], wikiFights: WikiFight[]) {
  const csvEvents: CsvEvent[] = [
    { name: EVENT, date: DATE, location: 'Philadelphia, Pennsylvania, USA', url: 'http://ufcstats.com/event-details/x' },
  ]
  const wiki: WikiExtract = {
    extractVersion: 1,
    events: [
      { title: EVENT, revid: 1, name: EVENT, date: DATE, location: 'Philadelphia, Pennsylvania, U.S.', fights: wikiFights },
    ],
  }
  const { events, report } = mergeAll(csvEvents, new Map([[EVENT, fights]]), new Map(), wiki)
  const event = events[0]!
  return { event, report, published: sanitizeEvent(event, percentiles) }
}

describe('CSV-base + Wikipedia merge: method details', () => {
  it("replaces the ufcstats head with Wikipedia's phrase and still enriches card/bonuses", () => {
    const { event, report, published } = merge([csvFight()], [wikiFight()])
    expect(event.source).toBe('merged')
    expect(event.fights[0]!.methodDetail).toBe('twister')
    expect(published.fights[0]!.reveal.methodDetail).toBe('Twister')
    expect(published.fights[0]!.card).toBe('prelim')
    expect(published.fights[0]!.reveal.bonuses).toEqual(['PERF'])
    expect(published.fights[0]!.reveal.method).toBe('Submission')
    expect(report.wikiDetailFills).toBe(1)
    expect(report.wikiDetailRejected).toBe(0)
  })

  it('fills a blank injury template (null CSV detail) from Wikipedia', () => {
    const { published } = merge(
      [csvFight({ fighters: ['Conor McGregor', 'Max Holloway'], methodClass: 'KO/TKO', methodDetail: null })],
      [wikiFight({ fighters: ['Max Holloway', 'Conor McGregor'], methodClass: 'KO/TKO', methodDetail: 'knee injury' })],
    )
    expect(published.fights[0]!.reveal.methodDetail).toBe('Knee injury')
  })

  it('fills across the Submission/KO-TKO split ufcstats uses for injury stoppages', () => {
    const { published } = merge(
      [csvFight({ methodClass: 'Submission', methodDetail: null })],
      [wikiFight({ methodClass: 'KO/TKO', methodDetail: 'knee injury' })],
    )
    expect(published.fights[0]!.reveal.method).toBe('Submission')
    expect(published.fights[0]!.reveal.methodDetail).toBe('Knee injury')
  })

  it('does not fill when the outcome shapes disagree, and leaves Draw/NC values alone', () => {
    const decisionVsNc = merge(
      [csvFight({ methodClass: 'Decision - Unanimous', methodDetail: null })],
      [wikiFight({ methodClass: 'No Contest', methodDetail: 'overturned' })],
    )
    expect(decisionVsNc.published.fights[0]!.reveal.methodDetail).toBeNull()

    const nc = merge(
      [csvFight({ methodClass: 'No Contest', methodDetail: 'Overturned' })],
      [wikiFight({ methodClass: 'No Contest', methodDetail: 'accidental eye poke' })],
    )
    expect(nc.published.fights[0]!.reveal.methodDetail).toBe('Overturned')

    const draw = merge(
      [csvFight({ methodClass: 'Draw', methodDetail: 'Majority draw' })],
      [wikiFight({ methodClass: 'Draw', methodDetail: 'split draw' })],
    )
    expect(draw.published.fights[0]!.reveal.methodDetail).toBe('Majority draw')
    expect(draw.report.wikiDetailFills).toBe(0)
  })

  it('ignores a blank Wikipedia template and an over-long phrase, keeping the CSV head', () => {
    const blank = merge(
      [csvFight({ methodClass: 'KO/TKO', methodDetail: 'Knees to Head In Clinch' })],
      [wikiFight({ methodClass: 'KO/TKO', methodDetail: 'injury' })],
    )
    expect(blank.published.fights[0]!.reveal.methodDetail).toBe('Knees to Head In Clinch')
    expect(blank.report.wikiDetailFills).toBe(0)

    const blankOverNull = merge(
      [csvFight({ methodClass: 'KO/TKO', methodDetail: null })],
      [wikiFight({ methodClass: 'KO/TKO', methodDetail: 'injury' })],
    )
    expect(blankOverNull.published.fights[0]!.reveal.methodDetail).toBeNull()

    const long = merge([csvFight()], [wikiFight({ methodDetail: 'x'.repeat(121) })])
    expect(long.published.fights[0]!.reveal.methodDetail).toBe('Twister From Back Control')
  })

  it("drops a retained CSV head that names a fighter under Wikipedia's spelling", () => {
    const { published } = merge(
      [csvFight({ methodDetail: 'Henrique Choke From Mount' })],
      [wikiFight({ methodDetail: null })],
    )
    expect(published.fights[0]!.reveal.methodDetail).toBeNull()
  })

  it("rejects a Wikipedia phrase naming a fighter under either source's spelling", () => {
    // Sanitize and the audit only see "Eduardo Chapolin"; "Henrique" would pass them.
    const wikiSpelling = merge([csvFight()], [wikiFight({ methodDetail: 'Henrique knee injury' })])
    expect(wikiSpelling.published.fights[0]!.reveal.methodDetail).toBe('Twister From Back Control')
    expect(wikiSpelling.report.wikiDetailRejected).toBe(1)
    expect(wikiSpelling.report.wikiDetailFills).toBe(0)

    const csvSpelling = merge([csvFight()], [wikiFight({ methodDetail: 'Chapolin tapped' })])
    expect(csvSpelling.published.fights[0]!.reveal.methodDetail).toBe('Twister From Back Control')
    expect(csvSpelling.report.wikiDetailRejected).toBe(1)
  })

  it('fills disqualifications from Wikipedia (the CSV never publishes DQ details)', () => {
    const { published } = merge(
      [csvFight({ methodClass: 'Disqualification', methodDetail: null })],
      [wikiFight({ methodClass: 'Disqualification', methodDetail: 'illegal knee' })],
    )
    expect(published.fights[0]!.reveal.methodDetail).toBe('Illegal knee')
  })

  it('leaves the CSV detail alone when Wikipedia has no matching fight', () => {
    const { published, report } = merge(
      [csvFight()],
      [wikiFight({ fighters: ['Islam Makhachev', 'Ian Machado Garry'], methodDetail: 'punches' })],
    )
    expect(published.fights[0]!.reveal.methodDetail).toBe('Twister From Back Control')
    expect(report.wikiDetailFills).toBe(0)
  })

  it('winner-flip canary: reversing source order in both sources changes nothing published', () => {
    const a = merge([csvFight()], [wikiFight()])
    const b = merge(
      [csvFight({ fighters: ['Eduardo Chapolin', 'Charles Johnson'] })],
      [wikiFight({ fighters: ['Charles Johnson', 'Eduardo Henrique'] })],
    )
    expect(JSON.stringify(b.published)).toBe(JSON.stringify(a.published))
  })
})

describe('chooseMethodDetail', () => {
  const csv = { fighters: ['Charles Johnson', 'Eduardo Chapolin'] as [string, string], methodClass: 'Submission' as const, methodDetail: 'Twister From Back Control' }
  const wiki = { fighters: ['Eduardo Henrique', 'Charles Johnson'] as [string, string], methodClass: 'Submission' as const, methodDetail: 'twister' }

  it('prefers the wiki phrase for compatible finishes and DQs only', () => {
    expect(chooseMethodDetail(csv, wiki)).toEqual({ detail: 'twister', rejected: false })
    expect(chooseMethodDetail(csv, { ...wiki, methodDetail: null })).toEqual({ detail: 'Twister From Back Control', rejected: false })
    expect(chooseMethodDetail({ ...csv, methodClass: 'KO/TKO', methodDetail: null }, wiki)).toEqual({ detail: 'twister', rejected: false })
    expect(chooseMethodDetail({ ...csv, methodClass: 'Draw', methodDetail: 'Majority draw' }, { ...wiki, methodClass: 'Draw', methodDetail: 'split draw' })).toEqual({ detail: 'Majority draw', rejected: false })
    expect(chooseMethodDetail(csv, { ...wiki, methodDetail: 'Injury' })).toEqual({ detail: 'Twister From Back Control', rejected: false })
    expect(chooseMethodDetail(csv, { ...wiki, methodDetail: 'y'.repeat(121) })).toEqual({ detail: 'Twister From Back Control', rejected: false })
    expect(chooseMethodDetail({ ...csv, methodClass: 'Decision - Split', methodDetail: null }, { ...wiki, methodClass: 'Decision - Split', methodDetail: 'Technical decision' })).toEqual({ detail: null, rejected: false })
  })

  it('flags a name under either spelling as rejected', () => {
    expect(chooseMethodDetail(csv, { ...wiki, methodDetail: 'Henrique tapped' })).toEqual({ detail: 'Twister From Back Control', rejected: true })
    expect(chooseMethodDetail(csv, { ...wiki, methodDetail: 'Johnson tapped' })).toEqual({ detail: 'Twister From Back Control', rejected: true })
    expect(chooseMethodDetail({ ...csv, methodDetail: 'Henrique Choke' }, { ...wiki, methodDetail: null })).toEqual({ detail: null, rejected: false })
  })
})
