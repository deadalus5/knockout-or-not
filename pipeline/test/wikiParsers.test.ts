import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseWikiEventList } from '../src/parse/wikiEventList.js'
import { parseWikiEventPage, parseWikiMethod } from '../src/parse/wikiEventPage.js'

const fixturesDir = path.join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures')
const fixture = (name: string) => fs.readFileSync(path.join(fixturesDir, name), 'utf8')

describe('parseWikiEventList', () => {
  const entries = parseWikiEventList(fixture('wiki_event_list.html'))

  it('parses past events with titles, ISO dates, and locations', () => {
    expect(entries.length).toBeGreaterThan(30)
    expect(entries[0]).toEqual({
      title: 'UFC Fight Night: Fiziev vs. Torres',
      name: 'UFC Fight Night: Fiziev vs. Torres',
      date: '2026-06-27',
      location: 'Baku, Azerbaijan',
    })
  })

  it('handles rowspan-shifted cells without misreading locations', () => {
    for (const e of entries) {
      if (e.location !== null) expect(e.location).toContain(',')
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})

describe('parseWikiEventPage', () => {
  it('parses a full fight night card with sorted fighters and no def. markers', () => {
    const { fights } = parseWikiEventPage(fixture('wiki_fiziev_torres.html'))
    expect(fights.length).toBeGreaterThanOrEqual(10)

    const main = fights[0]!
    expect(main.card).toBe('main')
    expect(main.order).toBe(1)
    expect(main.weightClass).toBe('Lightweight')
    // Wikipedia lists "Rafael Fiziev def. Manuel Torres" — output must be alphabetical
    expect(main.fighters).toEqual(['Rafael Fiziev', 'Manuel Torres'])
    expect(main.methodClass).toBe('KO/TKO')
    expect(main.methodDetail).toBe('spinning wheel kick and punches')
    expect(main.round).toBe(2)
    expect(main.time).toBe('0:15')

    const decision = fights[1]!
    expect(decision.methodClass).toBe('Decision - Unanimous')
    // scorecards must be stripped
    expect(JSON.stringify(fights)).not.toMatch(/\d{2}\s*[–—-]\s*\d{2}/)
    expect(JSON.stringify(fights)).not.toMatch(/def\./)
  })

  it('applies performance bonuses to the right fights and discards names', () => {
    const { fights } = parseWikiEventPage(fixture('wiki_fiziev_torres.html'))
    const main = fights[0]! // Fiziev got a Performance of the Night bonus
    expect(main.bonuses).toContain('PERF')
    const almabayev = fights.find((f) => f.fighters.some((n) => n.includes('Almabayev')))!
    expect(almabayev.bonuses).toContain('PERF')
    // FOTN was "No bonus awarded" on this card
    expect(fights.every((f) => !f.bonuses.includes('FOTN'))).toBe(true)
  })

  it('parses no-contest rows and champion markers on title fights', () => {
    const { fights } = parseWikiEventPage(fixture('wiki_ufc321.html'))
    const main = fights[0]!
    expect(main.fighters).toEqual(['Tom Aspinall', 'Ciryl Gane'])
    expect(main.methodClass).toBe('No Contest')
    expect(main.methodDetail).toBe('accidental eye poke')
    expect(main.titleFight).toBe(true)
    expect(main.fighters.every((n) => !n.includes('(c)'))).toBe(true)
  })

  it('is symmetric: flipping the listed winner produces identical output', () => {
    const row = (a: string, b: string) => `
      <table class="toccolours">
        <tr><th colspan="8">Main card</th></tr>
        <tr><th>Weight class</th><th></th><th></th><th></th><th>Method</th><th>Round</th><th>Time</th><th>Notes</th></tr>
        <tr><td>Lightweight</td><td>${a}</td><td>def.</td><td>${b}</td><td>KO (punch)</td><td>1</td><td>2:27</td><td></td></tr>
      </table>`
    const one = parseWikiEventPage(row('Ilia Topuria', 'Charles Oliveira'))
    const two = parseWikiEventPage(row('Charles Oliveira', 'Ilia Topuria'))
    expect(JSON.stringify(one)).toBe(JSON.stringify(two))
  })
})

describe('parseWikiMethod', () => {
  it('strips scorecards from decisions', () => {
    expect(parseWikiMethod('Decision (unanimous) (29–28, 29–28, 29–28)')).toEqual({
      methodClass: 'Decision - Unanimous',
      methodDetail: null,
    })
    expect(parseWikiMethod('Decision (split) (29–28, 27–30, 29–28)').methodClass).toBe(
      'Decision - Split',
    )
  })

  it('classifies draws without leaking scorecards', () => {
    expect(parseWikiMethod('Majority draw (28–28, 28–28, 29–27)')).toEqual({
      methodClass: 'Draw',
      methodDetail: 'Majority draw',
    })
  })

  it('classifies finishes with details', () => {
    expect(parseWikiMethod('KO (spinning wheel kick and punches)')).toEqual({
      methodClass: 'KO/TKO',
      methodDetail: 'spinning wheel kick and punches',
    })
    expect(parseWikiMethod('TKO (punches)').methodClass).toBe('KO/TKO')
    expect(parseWikiMethod('Technical Submission (rear-naked choke)')).toEqual({
      methodClass: 'Submission',
      methodDetail: 'rear-naked choke',
    })
    expect(parseWikiMethod('DQ (illegal knee)')).toEqual({
      methodClass: 'Disqualification',
      methodDetail: 'illegal knee',
    })
    expect(parseWikiMethod('NC (accidental eye poke)').methodClass).toBe('No Contest')
  })
})
