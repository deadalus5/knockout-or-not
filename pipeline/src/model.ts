import type { RevealMethod } from '@ko/shared'

/**
 * Internal pipeline model. Fighter arrays are in SOURCE order here (Wikipedia
 * lists the winner first), so everything in this file is treated as
 * winner-bearing and must only reach the published artifacts through
 * emit/sanitize.ts. Judge scorecards and per-fighter stats are discarded at
 * parse time and never appear even in this model.
 */

export interface CombinedStats {
  combinedKD: number
  combinedSigStrLanded: number
  combinedSigStrAttempted: number
  combinedTotalStr: number
  combinedTD: number
  combinedSubAtt: number
  combinedRev: number
  /** null when control time was not tracked ("--") */
  combinedCtrlSeconds: number | null
  roundsWithStats: number
}

export type Bonus = 'FOTN' | 'PERF'
export type CardSection = 'main' | 'prelim' | 'early'

export interface InternalFight {
  /** Source order — may encode the winner; sanitizer sorts alphabetically. */
  fighters: [string, string]
  order: number
  card: CardSection | null
  weightClass: string
  titleFight: boolean
  methodClass: RevealMethod
  methodDetail: string | null
  round: number | null
  time: string | null
  scheduledRounds: number | null
  roundLengthsMin: number[] | null
  legacyFormat: boolean
  stats: CombinedStats | null
  bonuses: Bonus[]
}

export interface InternalEvent {
  source: 'csv' | 'wiki' | 'merged' | 'espn'
  name: string
  date: string
  location: string | null
  fights: InternalFight[]
}
