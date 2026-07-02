import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'
import { nameTokens, sortFighters, type RevealMethod } from '@ko/shared'
import type { Bonus, CardSection } from '../model.js'
import { parseWeightClass } from './common.js'

/**
 * A fight extracted from a Wikipedia event page.
 *
 * SPOILER BOUNDARY: the results table lists the winner first ("X def. Y").
 * Fighters are re-sorted alphabetically before this struct is created, and
 * judge scorecards embedded in method text are stripped, so nothing returned
 * from this module carries winner information.
 */
export interface WikiFight {
  fighters: [string, string]
  order: number
  card: CardSection | null
  weightClass: string
  titleFight: boolean
  methodClass: RevealMethod
  methodDetail: string | null
  round: number | null
  time: string | null
  bonuses: Bonus[]
}

export interface WikiEventResults {
  fights: WikiFight[]
  /** fights for which a bonus was named but no matching fight row was found */
  unresolvedBonuses: number
}

export function parseWikiEventPage(html: string): WikiEventResults {
  const $ = cheerio.load(html)
  const fights = parseResultsTables($)
  const unresolvedBonuses = applyBonuses($, fights)
  return { fights, unresolvedBonuses }
}

function cellText($: cheerio.CheerioAPI, el: Element): string {
  const clone = $(el).clone()
  clone.find('sup, style, .reference').remove()
  return clone.text().replace(/\s+/g, ' ').trim()
}

function cleanFighterName(raw: string): string {
  return raw
    .replace(/\((i?c)\)/gi, '') // champion / interim champion markers
    .replace(/\s+/g, ' ')
    .trim()
}

function parseResultsTables($: cheerio.CheerioAPI): WikiFight[] {
  const fights: WikiFight[] = []
  let card: CardSection | null = null

  for (const table of $('table.toccolours').toArray()) {
    const text = $(table).text()
    if (!text.includes('Weight class') || !text.includes('Method')) continue

    for (const tr of $(table).find('tr').toArray()) {
      const sectionHeader = $(tr).find('th[colspan]').first()
      if (sectionHeader.length > 0 && $(tr).find('th').length === 1) {
        const label = sectionHeader.text().toLowerCase()
        if (label.includes('early prelim')) card = 'early'
        else if (label.includes('prelim')) card = 'prelim'
        else if (label.includes('main')) card = 'main'
        continue
      }
      const tds = $(tr).find('td')
      if (tds.length < 7) continue

      const weightRaw = cellText($, tds.get(0)!)
      const fighterA = cleanFighterName(cellText($, tds.get(1)!))
      const separator = cellText($, tds.get(2)!)
      const fighterB = cleanFighterName(cellText($, tds.get(3)!))
      const methodRaw = cellText($, tds.get(4)!)
      const roundRaw = cellText($, tds.get(5)!)
      const timeRaw = cellText($, tds.get(6)!)

      if (!fighterA || !fighterB || !/^(def\.?|vs\.?)$/i.test(separator)) continue

      const hasChampMarker = /\((i?c)\)/i.test($(tds.get(1)!).text() + $(tds.get(3)!).text())
      const { weightClass, titleFight } = parseWeightClass(weightRaw)
      const method = parseWikiMethod(methodRaw)
      const round = Number(roundRaw)
      // Winner-first order dies here: sort alphabetically before storing.
      fights.push({
        fighters: sortFighters([fighterA, fighterB]),
        order: fights.length + 1,
        card,
        weightClass,
        titleFight: titleFight || hasChampMarker,
        methodClass: method.methodClass,
        methodDetail: method.methodDetail,
        round: Number.isInteger(round) && round >= 1 ? round : null,
        time: /^\d{1,2}:\d{2}$/.test(timeRaw) ? timeRaw : null,
        bonuses: [],
      })
    }
    if (fights.length > 0) break
  }
  return fights
}

interface MethodInfo {
  methodClass: RevealMethod
  methodDetail: string | null
}

/** Strip parentheticals containing judge scorecards like (29–28, 29–28, 30–27). */
function stripScorecards(method: string): string {
  return method
    .replace(/\([^()]*\d+\s*[–—-]\s*\d+[^()]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseWikiMethod(raw: string): MethodInfo {
  const method = stripScorecards(raw)
  const paren = method.match(/\(([^()]+)\)/)?.[1]?.trim() ?? null

  if (/^technical draw|^draw|draw$/i.test(method.replace(/\(.*\)/, '').trim()) || /^draw/i.test(method)) {
    const kind = paren ?? (method.match(/\b(majority|split|unanimous|technical)\b/i)?.[1] ?? null)
    return { methodClass: 'Draw', methodDetail: kind ? `${capitalize(kind)} draw` : null }
  }
  if (/^(technical )?decision/i.test(method)) {
    const technical = /^technical/i.test(method)
    const kind = /unanimous/i.test(method)
      ? 'Unanimous'
      : /split/i.test(method)
        ? 'Split'
        : /majority/i.test(method)
          ? 'Majority'
          : 'Unanimous'
    return {
      methodClass: `Decision - ${kind}` as RevealMethod,
      methodDetail: technical ? 'Technical decision' : null,
    }
  }
  if (/^(t?ko|technical knockout)\b/i.test(method)) {
    return { methodClass: 'KO/TKO', methodDetail: paren }
  }
  if (/^(technical )?submission/i.test(method)) {
    return { methodClass: 'Submission', methodDetail: paren }
  }
  if (/^(nc|no contest)\b/i.test(method)) {
    return { methodClass: 'No Contest', methodDetail: paren }
  }
  if (/^(dq|disqualification)\b/i.test(method)) {
    return { methodClass: 'Disqualification', methodDetail: paren }
  }
  return { methodClass: 'Other', methodDetail: null }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

/**
 * Parse the "Bonus awards" section and attach FOTN/PERF markers to fights.
 * Recipient names are used only to locate the fight and are then discarded —
 * a Performance of the Night recipient is by definition the winner.
 */
function applyBonuses($: cheerio.CheerioAPI, fights: WikiFight[]): number {
  const heading = $('h2, h3')
    .filter((_, el) => /bonus/i.test($(el).attr('id') ?? '') || /bonus awards/i.test($(el).text()))
    .first()
  if (heading.length === 0) return 0

  const container = heading.closest('.mw-heading').length ? heading.closest('.mw-heading') : heading
  const list = container.nextAll('ul').first()
  if (list.length === 0) return 0

  let unresolved = 0
  for (const li of list.find('li').toArray()) {
    const text = $(li).text().replace(/\s+/g, ' ').trim()
    const m = text.match(
      /^(Fight of the Night|Performance of the Night|Knockout of the Night|Submission of the Night)s?\s*:\s*(.+)$/i,
    )
    if (!m) continue
    const kind: Bonus = /^fight of the night/i.test(m[1]!) ? 'FOTN' : 'PERF'
    const rest = m[2]!.trim()
    if (/no bonus(es)? awarded/i.test(rest) || /not awarded/i.test(rest)) continue

    if (kind === 'FOTN') {
      const pair = rest.split(/\s+vs\.?\s+/i)
      if (pair.length === 2) {
        const fight = findFightByPair(fights, pair[0]!, pair[1]!)
        if (fight) {
          addBonus(fight, 'FOTN')
          continue
        }
      }
      // Some pages list only one name per FOTN line or omit "vs."
      const fight = findFightByName(fights, rest)
      if (fight) addBonus(fight, 'FOTN')
      else unresolved++
      continue
    }

    // PERF: comma/"and"-separated recipient names
    const names = rest
      .split(/,|\band\b|&/i)
      .map((s) => s.replace(/\$[\d,]+/g, '').trim())
      .filter((s) => s.length > 1)
    for (const name of names) {
      const fight = findFightByName(fights, name)
      if (fight) addBonus(fight, 'PERF')
      else unresolved++
    }
  }
  return unresolved
}

function addBonus(fight: WikiFight, bonus: Bonus): void {
  if (!fight.bonuses.includes(bonus)) fight.bonuses.push(bonus)
}

function findFightByName(fights: WikiFight[], name: string): WikiFight | null {
  const tokens = nameTokens(name)
  if (tokens.length === 0) return null
  let best: WikiFight | null = null
  let bestScore = 0
  for (const fight of fights) {
    for (const fighter of fight.fighters) {
      const ft = new Set(nameTokens(fighter))
      const overlap = tokens.filter((t) => ft.has(t)).length
      const score = overlap / Math.max(tokens.length, 1)
      if (overlap >= 1 && score > bestScore) {
        best = fight
        bestScore = score
      }
    }
  }
  return bestScore >= 0.5 ? best : null
}

function findFightByPair(fights: WikiFight[], a: string, b: string): WikiFight | null {
  const fightA = findFightByName(fights, a)
  const fightB = findFightByName(fights, b)
  return fightA && fightA === fightB ? fightA : (fightA ?? fightB)
}
