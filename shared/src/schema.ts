/**
 * The strict whitelist schema for everything KnockoutOrNot may ever publish.
 *
 * This is the trust boundary of the entire app: winner-identifying data
 * (W/L outcomes, "def." notation, judge scorecards, per-fighter stats,
 * bonus recipient names, meaningful fighter ordering) has no representation
 * here and therefore cannot exist in any published artifact. Every emitted
 * file is validated against these schemas with unknown keys rejected, both
 * by the pipeline before writing and by the standalone audit in CI.
 */
import { z } from 'zod'

export const SCHEMA_VERSION = 1

/** Fixed, spoiler-vetted vocabulary for the "why this rating" breakdown. */
export const WHY_VOCAB = [
  'Ended inside the distance',
  'Went the distance',
  'Explosive striking exchanges',
  'High-volume striking',
  'Multiple knockdowns',
  'A knockdown scored',
  'Active submission threats',
  'Wild scrambles',
  'Earned a post-fight bonus',
  'Long stretches of control',
  'Championship stakes',
  'Not enough data to rate',
] as const

export const REVEAL_METHODS = [
  'KO/TKO',
  'Submission',
  'Decision - Unanimous',
  'Decision - Split',
  'Decision - Majority',
  'Draw',
  'Disqualification',
  'No Contest',
  'Other',
] as const

export const whyPhraseSchema = z.enum(WHY_VOCAB)

export const fightStatsSchema = z
  .object({
    combinedKD: z.number().int().min(0),
    sigStrPerMin: z.number().min(0).nullable(),
    combinedTakedowns: z.number().int().min(0),
    combinedSubAttempts: z.number().int().min(0),
    controlPct: z.number().min(0).max(100).nullable(),
  })
  .strict()

export const revealSchema = z
  .object({
    round: z.number().int().min(1).nullable(),
    time: z
      .string()
      .regex(/^\d{1,2}:\d{2}$/)
      .nullable(),
    method: z.enum(REVEAL_METHODS),
    methodDetail: z.string().max(120).nullable(),
    bonuses: z.array(z.enum(['FOTN', 'PERF'])),
  })
  .strict()

export const fightSchema = z
  .object({
    id: z.string().min(1),
    order: z.number().int().min(1),
    card: z.enum(['main', 'prelim', 'early']).nullable(),
    weightClass: z.string().min(1),
    titleFight: z.boolean(),
    /** Always sorted alphabetically by last name — order carries no result information. */
    fighters: z.tuple([z.string().min(1), z.string().min(1)]),
    scheduledRounds: z.number().int().min(1).nullable(),
    /** The only outcome fact visible at spoiler level 1. Draws and NCs fold into these two. */
    resultClass: z.enum(['early', 'distance']),
    excitement: z.number().int().min(1).max(100).nullable(),
    stars: z.number().int().min(1).max(5).nullable(),
    pace: z.enum(['high', 'medium', 'low']).nullable(),
    why: z.array(whyPhraseSchema),
    scoreConfidence: z.enum(['full', 'basic', 'none']),
    stats: fightStatsSchema.nullable(),
    reveal: revealSchema,
  })
  .strict()

export const eventDetailSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: z.string().min(1),
    sport: z.string().min(1),
    org: z.string().min(1),
    name: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    location: z.string().nullable(),
    dataQuality: z.enum(['full', 'basic']),
    fights: z.array(fightSchema),
  })
  .strict()

export const indexEventSchema = z
  .object({
    id: z.string().min(1),
    sport: z.string().min(1),
    org: z.string().min(1),
    name: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    location: z.string().nullable(),
    fightCount: z.number().int().min(0),
    topExcitement: z.number().int().min(1).max(100).nullable(),
    dataQuality: z.enum(['full', 'basic']),
  })
  .strict()

export const dataIndexSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    generatedAt: z.string().datetime(),
    attribution: z
      .object({
        wikipedia: z.string(),
        stats: z.string(),
      })
      .strict(),
    events: z.array(indexEventSchema),
  })
  .strict()

export const searchIndexSchema = z.array(
  z
    .object({
      /** event id */
      e: z.string().min(1),
      /** event name */
      n: z.string().min(1),
      /** event date */
      d: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      /** all fighters on the card */
      f: z.array(z.string().min(1)),
    })
    .strict(),
)

export type WhyPhrase = z.infer<typeof whyPhraseSchema>
export type RevealMethod = (typeof REVEAL_METHODS)[number]
export type FightStats = z.infer<typeof fightStatsSchema>
export type Reveal = z.infer<typeof revealSchema>
export type Fight = z.infer<typeof fightSchema>
export type EventDetail = z.infer<typeof eventDetailSchema>
export type IndexEvent = z.infer<typeof indexEventSchema>
export type DataIndex = z.infer<typeof dataIndexSchema>
export type SearchIndex = z.infer<typeof searchIndexSchema>
