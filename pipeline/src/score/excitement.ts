import type { WhyPhrase } from '@ko/shared'
import { SCORE } from '../config.js'
import type { InternalFight } from '../model.js'
import type { Percentiles } from './percentiles.js'

export interface FightScore {
  excitement: number | null
  stars: number | null
  pace: 'high' | 'medium' | 'low' | null
  why: WhyPhrase[]
  scoreConfidence: 'full' | 'basic' | 'none'
  /** derived, for the published stats block */
  sigStrPerMin: number | null
  controlPct: number | null
}

export function fightDurationMin(fight: InternalFight): number | null {
  if (fight.round === null || fight.time === null || fight.roundLengthsMin === null) return null
  const lengths = fight.roundLengthsMin
  if (fight.round > lengths.length) return null
  let minutes = 0
  for (let r = 0; r < fight.round - 1; r++) minutes += lengths[r]!
  const [mm, ss] = fight.time.split(':').map(Number)
  minutes += (mm ?? 0) + (ss ?? 0) / 60
  return minutes > 0 ? minutes : null
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

function isFinish(fight: InternalFight): boolean {
  return fight.methodClass === 'KO/TKO' || fight.methodClass === 'Submission'
}

function isDistance(fight: InternalFight): boolean {
  return fight.methodClass.startsWith('Decision') || fight.methodClass === 'Draw'
}

export function resultClass(fight: InternalFight): 'early' | 'distance' {
  return isDistance(fight) ? 'distance' : 'early'
}

export function scoreFight(fight: InternalFight, strPercentiles: Percentiles): FightScore {
  const duration = fightDurationMin(fight)
  const stats = fight.stats
  const notRatable = fight.methodClass === 'No Contest' || fight.methodClass === 'Other'

  if (!notRatable && stats && duration !== null && !fight.legacyFormat) {
    return fullScore(fight, stats, duration, strPercentiles)
  }
  if (!notRatable && !fight.legacyFormat) {
    return basicScore(fight)
  }
  // No-contests, legacy formats, and unclassifiable methods share one neutral
  // presentation so none of them is inferable from the other.
  return {
    excitement: null,
    stars: null,
    pace: null,
    why: ['Not enough data to rate'],
    scoreConfidence: 'none',
    sigStrPerMin: stats && duration ? round1(stats.combinedSigStrLanded / duration) : null,
    controlPct: null,
  }
}

function fullScore(
  fight: InternalFight,
  stats: NonNullable<InternalFight['stats']>,
  duration: number,
  strPercentiles: Percentiles,
): FightScore {
  const finish = isFinish(fight)
  const strRate = stats.combinedSigStrLanded / duration
  const pStr = strPercentiles.p(strRate)
  const kdRate5 = (stats.combinedKD / duration) * 5
  const subRate5 = (stats.combinedSubAtt / duration) * 5
  const ctrlPct =
    stats.combinedCtrlSeconds !== null ? Math.min(stats.combinedCtrlSeconds / (duration * 60), 1) : null

  const finishScore = finish
    ? SCORE.finishScore.finish
    : fight.methodClass === 'Disqualification'
      ? SCORE.finishScore.dq
      : SCORE.finishScore.decision

  let score = SCORE.finishWeight * finishScore
  score += SCORE.strPercentileWeight * pStr
  score += SCORE.kdWeight * Math.min(kdRate5 / SCORE.kdRate5Cap, 1)
  score += SCORE.subWeight * Math.min(subRate5 / SCORE.subRate5Cap, 1)
  score += SCORE.revWeight * Math.min(stats.combinedRev / SCORE.revCap, 1)
  if (finish && fight.round === 1) score += SCORE.round1FinishBonus
  if (finish && fight.scheduledRounds !== null && fight.round === fight.scheduledRounds)
    score += SCORE.finalRoundFinishBonus
  if (fight.bonuses.includes('FOTN')) score += SCORE.fotnBonus
  else if (fight.bonuses.includes('PERF')) score += SCORE.perfBonus

  let stalled = false
  if (!finish && ctrlPct !== null && ctrlPct > SCORE.stallCtrlThreshold) {
    const penalty = Math.min(
      (ctrlPct - SCORE.stallCtrlThreshold) * SCORE.stallSlope,
      SCORE.stallMaxPenalty,
    )
    if (penalty > 0) stalled = true
    score -= penalty
  }

  const excitement = clamp(Math.round(score), 1, 100)
  const why = buildWhy(fight, { finish, pStr, kd: stats.combinedKD, subRate5, rev: stats.combinedRev, stalled })
  return {
    excitement,
    stars: clamp(Math.ceil(excitement / 20), 1, 5),
    pace: pStr < SCORE.paceBands.low ? 'low' : pStr < SCORE.paceBands.medium ? 'medium' : 'high',
    why,
    scoreConfidence: 'full',
    sigStrPerMin: round1(strRate),
    controlPct: ctrlPct !== null ? Math.round(ctrlPct * 100) : null,
  }
}

function basicScore(fight: InternalFight): FightScore {
  const b = SCORE.basic
  const key = fight.methodClass.startsWith('Decision') ? 'Decision' : fight.methodClass
  const base = b.base[key]
  if (base === undefined) {
    return {
      excitement: null,
      stars: null,
      pace: null,
      why: ['Not enough data to rate'],
      scoreConfidence: 'none',
      sigStrPerMin: null,
      controlPct: null,
    }
  }
  const finish = isFinish(fight)
  let score = base
  if (finish && fight.round === 1) score += b.round1FinishBonus
  if (finish && fight.scheduledRounds !== null && fight.round === fight.scheduledRounds)
    score += b.finalRoundFinishBonus
  if (fight.bonuses.includes('FOTN')) score += b.fotnBonus
  else if (fight.bonuses.includes('PERF')) score += b.perfBonus

  const excitement = clamp(Math.round(score), 1, 100)
  return {
    excitement,
    stars: clamp(Math.ceil(excitement / 20), 1, 5),
    pace: null,
    why: buildWhy(fight, { finish, pStr: null, kd: 0, subRate5: 0, rev: 0, stalled: false }),
    scoreConfidence: 'basic',
    sigStrPerMin: null,
    controlPct: null,
  }
}

interface WhySignals {
  finish: boolean
  pStr: number | null
  kd: number
  subRate5: number
  rev: number
  stalled: boolean
}

/**
 * Spoiler-safe rating explanation. Phrases come exclusively from WHY_VOCAB:
 * no names, no rounds, no methods, no winner verbs. Round-timing bonuses are
 * deliberately unexplained (a "dramatic finish" phrase would invite round
 * inference at level 2).
 */
function buildWhy(fight: InternalFight, s: WhySignals): WhyPhrase[] {
  const why: WhyPhrase[] = []
  why.push(s.finish ? 'Ended inside the distance' : 'Went the distance')
  if (s.pStr !== null) {
    if (s.pStr > 0.85) why.push('Explosive striking exchanges')
    else if (s.pStr > 0.66) why.push('High-volume striking')
  }
  if (s.kd >= 2) why.push('Multiple knockdowns')
  else if (s.kd === 1) why.push('A knockdown scored')
  if (s.subRate5 >= 0.5) why.push('Active submission threats')
  if (s.rev >= 2) why.push('Wild scrambles')
  if (fight.bonuses.length > 0) why.push('Earned a post-fight bonus')
  if (s.stalled) why.push('Long stretches of control')
  if (fight.titleFight) why.push('Championship stakes')
  return why
}

function round1(x: number): number {
  return Math.round(x * 10) / 10
}
