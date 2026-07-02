import {
  SCHEMA_VERSION,
  eventDetailSchema,
  nameTokens,
  sortFighters,
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
    dataQuality: event.source === 'wiki' ? 'basic' : 'full',
    fights,
  }
  return eventDetailSchema.parse(published)
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
      methodDetail: scrubMethodDetail(fight.methodDetail, fighters),
      bonuses: [...fight.bonuses].sort(),
    },
  }
}

/**
 * Finish details occasionally quote a fighter (rare referee notes). Any
 * detail containing either fighter's name tokens is dropped outright.
 */
function scrubMethodDetail(detail: string | null, fighters: [string, string]): string | null {
  if (detail === null) return null
  const detailTokens = new Set(nameTokens(detail))
  for (const fighter of fighters) {
    for (const token of nameTokens(fighter)) {
      if (detailTokens.has(token)) return null
    }
  }
  return detail
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
