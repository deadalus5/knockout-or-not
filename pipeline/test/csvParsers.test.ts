import { describe, expect, it } from 'vitest'
import { parseCsvEvents } from '../src/parse/csvEvents.js'
import { parseCsvResults } from '../src/parse/csvResults.js'
import { parseCsvStats, statsKey } from '../src/parse/csvStats.js'
import { parseMethod, parseTimeFormat, parseWeightClass, toIsoDate } from '../src/parse/common.js'

const EVENTS_CSV = `EVENT,URL,DATE,LOCATION
UFC Fight Night: Allen vs. Costa,http://ufcstats.com/event-details/73abb7a5c57fb443,"May 16, 2026","Las Vegas, Nevada, USA"
UFC Fight Night: Allen vs. Costa,http://ufcstats.com/event-details/73abb7a5c57fb443,"May 16, 2026","Las Vegas, Nevada, USA"
UFC 328: Chimaev vs. Strickland,http://ufcstats.com/event-details/9eedac48b497de5a,"May 09, 2026","Newark, New Jersey, USA"
`

const RESULTS_CSV = `EVENT,BOUT,OUTCOME,WEIGHTCLASS,METHOD,ROUND,TIME,TIME FORMAT,REFEREE,DETAILS,URL
UFC Fight Night: Allen vs. Costa ,Arnold Allen vs. Melquizael Costa,W/L,Featherweight Bout,Decision - Unanimous ,5,5:00,5 Rnd (5-5-5-5-5),Chris Tognoni,Eric Colon 45 - 50.David Lethaby 45 - 50.Sal D'amato 46 - 49.,http://ufcstats.com/fight-details/e4aa608124896794
UFC Fight Night: Allen vs. Costa ,Dooho Choi vs. Daniel Santos,W/L,Featherweight Bout,KO/TKO ,2,4:29,3 Rnd (5-5-5),Kerry Hatley,Punch to Body At Distance ,http://ufcstats.com/fight-details/fc1266e2892ed111
UFC Fight Night: Allen vs. Costa ,Malcolm Wellmaker vs. Juan Diaz,L/W,Bantamweight Bout,Submission ,2,4:08,3 Rnd (5-5-5),Eric McMahon,Rear Naked Choke ,http://ufcstats.com/fight-details/ecb7ff543dd41bf8
UFC 328: Chimaev vs. Strickland ,Fighter Alpha vs. Fighter Beta,D/D,Lightweight Bout,Decision - Majority ,3,5:00,3 Rnd (5-5-5),Herb Dean,Judge One 28 - 28.Judge Two 29 - 27.Judge Three 28 - 28.,http://ufcstats.com/fight-details/aaa
UFC 328: Chimaev vs. Strickland ,Fighter Gamma vs. Fighter Delta,NC/NC,Welterweight Bout,Overturned ,1,3:00,3 Rnd (5-5-5),Marc Goddard,Accidental Eye Poke,http://ufcstats.com/fight-details/bbb
UFC 328: Chimaev vs. Strickland ,Khamzat Chimaev vs. Sean Strickland,W/L,UFC Middleweight Title Bout,Submission ,3,2:01,5 Rnd (5-5-5-5-5),Herb Dean,Face Crank ,http://ufcstats.com/fight-details/ccc
`

const STATS_CSV = `EVENT,BOUT,ROUND,FIGHTER,KD,SIG.STR.,SIG.STR. %,TOTAL STR.,TD,TD %,SUB.ATT,REV.,CTRL,HEAD,BODY,LEG,DISTANCE,CLINCH,GROUND
UFC Fight Night: Allen vs. Costa,Arnold Allen vs. Melquizael Costa,Round 1,Arnold Allen,1,9 of 9,100%,18 of 20,2 of 2,100%,0,0,1:44,8 of 8,0 of 0,1 of 1,4 of 4,0 of 0,5 of 5
UFC Fight Night: Allen vs. Costa,Arnold Allen vs. Melquizael Costa,Round 1,Melquizael Costa,0,4 of 10,40%,6 of 12,0 of 1,0%,1,1,0:20,3 of 8,1 of 1,0 of 1,4 of 10,0 of 0,0 of 0
UFC Fight Night: Allen vs. Costa,Arnold Allen vs. Melquizael Costa,Round 2,Arnold Allen,0,23 of 38,60%,28 of 44,0 of 0,---,0,0,0:36,16 of 31,2 of 2,5 of 5,23 of 38,0 of 0,0 of 0
UFC Fight Night: Allen vs. Costa,Arnold Allen vs. Melquizael Costa,Round 2,Melquizael Costa,0,11 of 25,44%,12 of 26,0 of 0,---,0,0,--,9 of 21,1 of 2,1 of 2,11 of 25,0 of 0,0 of 0
`

describe('parseCsvEvents', () => {
  it('dedupes duplicate rows and converts dates to ISO', () => {
    const events = parseCsvEvents(EVENTS_CSV)
    expect(events).toHaveLength(2)
    expect(events[0]).toEqual({
      name: 'UFC Fight Night: Allen vs. Costa',
      date: '2026-05-16',
      location: 'Las Vegas, Nevada, USA',
      url: 'http://ufcstats.com/event-details/73abb7a5c57fb443',
    })
  })
})

describe('parseCsvResults', () => {
  const byEvent = parseCsvResults(RESULTS_CSV)

  it('groups fights by trimmed event name with order starting at the main event', () => {
    expect([...byEvent.keys()]).toEqual([
      'UFC Fight Night: Allen vs. Costa',
      'UFC 328: Chimaev vs. Strickland',
    ])
    const fights = byEvent.get('UFC Fight Night: Allen vs. Costa')!
    expect(fights).toHaveLength(3)
    expect(fights[0]!.order).toBe(1)
    expect(fights[0]!.fighters).toEqual(['Arnold Allen', 'Melquizael Costa'])
  })

  it('discards judge scorecards for decisions but keeps finish details', () => {
    const fights = byEvent.get('UFC Fight Night: Allen vs. Costa')!
    const decision = fights[0]!
    expect(decision.methodClass).toBe('Decision - Unanimous')
    expect(decision.methodDetail).toBeNull()
    const ko = fights[1]!
    expect(ko.methodClass).toBe('KO/TKO')
    expect(ko.methodDetail).toBe('Punch to Body At Distance')
    const sub = fights[2]!
    expect(sub.methodClass).toBe('Submission')
    expect(sub.methodDetail).toBe('Rear Naked Choke')
    // No fight retains any W/L information
    const all = JSON.stringify([...byEvent.values()])
    expect(all).not.toMatch(/\b[WL]\/[WL]\b/)
    expect(all).not.toMatch(/\b\d{2}\s*-\s*\d{2}\b/)
  })

  it('classifies draws and no-contests symmetrically', () => {
    const fights = byEvent.get('UFC 328: Chimaev vs. Strickland')!
    expect(fights[0]!.methodClass).toBe('Draw')
    expect(fights[0]!.methodDetail).toBe('Majority draw')
    expect(fights[1]!.methodClass).toBe('No Contest')
  })

  it('detects title fights and cleans weight class names', () => {
    const title = byEvent.get('UFC 328: Chimaev vs. Strickland')![2]!
    expect(title.titleFight).toBe(true)
    expect(title.weightClass).toBe('Middleweight')
    expect(title.scheduledRounds).toBe(5)
  })
})

describe('parseCsvStats', () => {
  it('aggregates per-round per-fighter rows into symmetric combined totals', async () => {
    const stats = await parseCsvStats(STATS_CSV)
    const key = statsKey('UFC Fight Night: Allen vs. Costa', 'Melquizael Costa', 'Arnold Allen')
    const agg = stats.get(key)!
    expect(agg).toBeTruthy()
    expect(agg.combinedKD).toBe(1)
    expect(agg.combinedSigStrLanded).toBe(9 + 4 + 23 + 11)
    expect(agg.combinedSigStrAttempted).toBe(9 + 10 + 38 + 25)
    expect(agg.combinedTD).toBe(2)
    expect(agg.combinedSubAtt).toBe(1)
    expect(agg.combinedRev).toBe(1)
    expect(agg.combinedCtrlSeconds).toBe(104 + 20 + 36)
    expect(agg.roundsWithStats).toBe(2)
  })

  it('produces the same key regardless of fighter order', () => {
    expect(statsKey('E', 'José Aldo', 'Chan Sung Jung')).toBe(
      statsKey('E', 'Chan Sung Jung', 'José Aldo'),
    )
  })
})

describe('field parsers', () => {
  it('parses dates', () => {
    expect(toIsoDate('May 09, 2026')).toBe('2026-05-09')
    expect(toIsoDate('November 12, 1993')).toBe('1993-11-12')
    expect(toIsoDate('garbage')).toBeNull()
  })

  it('parses time formats including legacy', () => {
    expect(parseTimeFormat('3 Rnd (5-5-5)')).toEqual({
      scheduledRounds: 3,
      roundLengthsMin: [5, 5, 5],
      legacyFormat: false,
    })
    expect(parseTimeFormat('No Time Limit').legacyFormat).toBe(true)
    expect(parseTimeFormat('1 Rnd + 2OT (15-3-3)')).toEqual({
      scheduledRounds: null,
      roundLengthsMin: [15, 3, 3],
      legacyFormat: true,
    })
  })

  it('parses methods', () => {
    expect(parseMethod('KO/TKO', 'W/L').methodClass).toBe('KO/TKO')
    expect(parseMethod("TKO - Doctor's Stoppage", 'W/L')).toEqual({
      methodClass: 'KO/TKO',
      methodDetail: "Doctor's Stoppage",
    })
    expect(parseMethod('DQ', 'W/L').methodClass).toBe('Disqualification')
    expect(parseMethod('Overturned', 'NC/NC').methodClass).toBe('No Contest')
    expect(parseMethod('Decision - Split', 'D/D')).toEqual({
      methodClass: 'Draw',
      methodDetail: 'Split draw',
    })
  })

  it('parses weight classes', () => {
    expect(parseWeightClass("UFC Women's Strawweight Title Bout")).toEqual({
      weightClass: "Women's Strawweight",
      titleFight: true,
    })
    expect(parseWeightClass('Catch Weight Bout')).toEqual({
      weightClass: 'Catch Weight',
      titleFight: false,
    })
  })
})
