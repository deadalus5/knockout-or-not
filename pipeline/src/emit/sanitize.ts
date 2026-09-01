import {
  SCHEMA_VERSION,
  eventDetailSchema,
  hasGluedWords,
  sortFighters,
  textMentionsFighter,
  type EventDetail,
  type Fight,
  type IndexEvent,
} from '@ko/shared'
import type { InternalEvent, InternalFight } from '../model.js'
import { resultClass, scoreFight, type FightScore } from '../score/excitement.js'
import type { Percentiles } from '../score/percentiles.js'

/**
 * THE SPOILER FIREWALL.
 *
 * Maps the internal (potentially winner-bearing) model to the published
 * model. Every published field is constructed explicitly — no object spreads,
 * so a new internal field can never leak by accident. Fighter order is
 * re-sorted alphabetically here regardless of source order. The result is
 * validated against the strict whitelist schema before being returned.
 */
export function sanitizeEvent(event: InternalEvent, strPercentiles: Percentiles): EventDetail {
  const fights: Fight[] = event.fights.map((fight, i) => {
    const score = scoreFight(fight, strPercentiles)
    return sanitizeFight(fight, score, i + 1)
  })

  const published: EventDetail = {
    schemaVersion: SCHEMA_VERSION,
    id: eventId(event),
    sport: 'mma',
    org: 'ufc',
    name: event.name,
    date: event.date,
    location: event.location,
    dataQuality: dataQuality(event),
    fights,
  }
  return eventDetailSchema.parse(published)
}

/**
 * Wiki-only events have results but no stats. ESPN-only events count as
 * full-quality only when the stats actually came through; CSV-based events
 * stay 'full' as before (the back-catalogue's rating basis is the CSV stats).
 */
function dataQuality(event: InternalEvent): 'full' | 'basic' {
  if (event.source === 'wiki') return 'basic'
  if (event.source === 'espn') return event.fights.some((f) => f.stats !== null) ? 'full' : 'basic'
  return 'full'
}

function sanitizeFight(fight: InternalFight, score: FightScore, order: number): Fight {
  const fighters = sortFighters(fight.fighters)
  return {
    id: `f${String(order).padStart(2, '0')}`,
    order,
    card: fight.card,
    weightClass: fight.weightClass,
    titleFight: fight.titleFight,
    fighters,
    scheduledRounds: fight.scheduledRounds,
    resultClass: resultClass(fight),
    excitement: score.excitement,
    stars: score.stars,
    pace: score.pace,
    why: score.why,
    scoreConfidence: score.scoreConfidence,
    stats: fight.stats
      ? {
          combinedKD: fight.stats.combinedKD,
          combinedSigStrLanded: fight.stats.combinedSigStrLanded,
          combinedSigStrAttempted: fight.stats.combinedSigStrAttempted,
          sigStrPerMin: score.sigStrPerMin,
          combinedTakedowns: fight.stats.combinedTD,
          combinedSubAttempts: fight.stats.combinedSubAtt,
          controlPct: score.controlPct,
        }
      : null,
    reveal: {
      round: fight.round,
      time: fight.time,
      method: fight.methodClass,
      methodDetail: publishMethodDetail(fight.methodDetail, fighters),
      bonuses: [...fight.bonuses].sort(),
    },
  }
}

/**
 * Last word on the finish description. By the time text reaches here it is a
 * ufcstats taxonomy head (parse/csvResults.ts keeps only the head of the glued
 * DETAILS field and discards the note), a Wikipedia phrase chosen in the merge
 * (already checked against both sources' fighter spellings), or an ESPN
 * description. Three rules, in order:
 *  1. anything mentioning either fighter is dropped outright — never repaired,
 *     never partially kept (eponymous techniques included: "Von Flue choke" on
 *     Jason Von Flue's own fight stays null);
 *  2. anything still carrying a glued word boundary ("…ControlScottish…") is
 *     dropped — unreachable on the CSV path after the parse-time split, but
 *     the live guard for Wikipedia and ESPN text, which is never split;
 *     mirrored by the audit;
 *  3. the first character is upper-cased so Wikipedia's lowercase prose
 *     ("knee injury") reads like the rest of the column ("Majority draw").
 */
function publishMethodDetail(detail: string | null, fighters: [string, string]): string | null {
  const text = detail?.trim() ?? ''
  if (text === '') return null
  if (textMentionsFighter(text, fighters)) return null
  if (hasGluedWords(text)) return null
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function eventId(event: { date: string; name: string }): string {
  const slug = event.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  return `${event.date}-${slug}`
}

export function toIndexEvent(published: EventDetail): IndexEvent {
  const excitements = published.fights
    .map((f) => f.excitement)
    .filter((x): x is number => x !== null)
  return {
    id: published.id,
    sport: published.sport,
    org: published.org,
    name: published.name,
    date: published.date,
    location: published.location,
    fightCount: published.fights.length,
    topExcitement: excitements.length > 0 ? Math.max(...excitements) : null,
    dataQuality: published.dataQuality,
  }
}
