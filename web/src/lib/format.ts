import type { Fight } from '@ko/shared'

const dateFmt = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

const monthFmt = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(`${iso}T00:00:00Z`))
}

export function formatMonth(iso: string): string {
  return monthFmt.format(new Date(`${iso}T00:00:00Z`))
}

/**
 * Elapsed fight time in minutes, derived from the published round/time.
 * Assumes 5-minute rounds — exact for any round-1 ending regardless of era,
 * and for the unified-era formats (3 or 5 scheduled rounds). Legacy
 * multi-round formats (early UFC overtimes etc.) return null rather than
 * a wrong number.
 */
export function fightDurationMin(fight: Fight): number | null {
  const { round, time } = fight.reveal
  if (round === null || time === null) return null
  if (round > 1 && fight.scheduledRounds !== 3 && fight.scheduledRounds !== 5) return null
  const [mm, ss] = time.split(':').map(Number)
  const minutes = (round - 1) * 5 + (mm ?? 0) + (ss ?? 0) / 60
  return minutes > 0 ? minutes : null
}

/** Combined significant strikes attempted per 30 seconds, to 1 decimal. */
export function sigStrAttemptedPer30(fight: Fight): number | null {
  if (fight.stats === null) return null
  const duration = fightDurationMin(fight)
  if (duration === null) return null
  return Math.round((fight.stats.combinedSigStrAttempted / (duration * 2)) * 10) / 10
}

/* ── revealed-value color buckets ──────────────────────────────────────────
   Thresholds come from the full published dataset (8,772 fights with stats):
   landed q25/med/q75/q90 = 28/61/104/154 · attempted = 58/133/240/351 ·
   per-30s = 4.8/7.4/10.6/14.2. Class names must stay single-digit-suffixed —
   a `NN-NN` token in rendered HTML would trip the scorecard spoiler regex. */

/** Temperature bucket, cold (0) → hot (4). */
export type HeatLevel = 0 | 1 | 2 | 3 | 4

/** Combined sig. strikes attempted per 30s: <5 cold, full red at 15+. */
export function per30HeatLevel(per30: number): HeatLevel {
  if (per30 < 5) return 0
  if (per30 < 8) return 1
  if (per30 < 11) return 2
  if (per30 < 15) return 3
  return 4
}

/** Combined sig. strikes landed, bucketed by dataset quartiles. */
export function landedHeatLevel(landed: number): HeatLevel {
  if (landed < 30) return 0
  if (landed < 65) return 1
  if (landed < 105) return 2
  if (landed < 155) return 3
  return 4
}

/** Combined sig. strikes attempted, bucketed by dataset quartiles. */
export function attemptedHeatLevel(attempted: number): HeatLevel {
  if (attempted < 60) return 0
  if (attempted < 135) return 1
  if (attempted < 240) return 2
  if (attempted < 350) return 3
  return 4
}

/** Reverse battery, quarter buckets: low control = open action = green. */
export function controlLevel(controlPct: number): 0 | 1 | 2 | 3 {
  if (controlPct < 25) return 0
  if (controlPct < 50) return 1
  if (controlPct < 75) return 2
  return 3
}

/** Method → color class. Draw/NC/Other share neutral gray; DQ is bronze. */
export function methodClass(method: string): string {
  if (method === 'KO/TKO') return 'm-ko'
  if (method === 'Submission') return 'm-sub'
  if (method.startsWith('Decision')) return 'm-dec'
  if (method === 'Draw') return 'm-draw'
  if (method === 'Disqualification') return 'm-dq'
  if (method === 'No Contest') return 'm-nc'
  return 'm-other'
}

/** Round → fixed identity hue; legacy rounds outside 1–5 stay neutral. */
export function roundClass(round: number): string {
  return round >= 1 && round <= 5 ? `rd-${round}` : 'rd-x'
}

/**
 * Marquee = numbered PPVs and named one-off specials; the recurring series
 * (Fight Night, UFC on <network>, TUF finales, UFC Live, Road to UFC) stay
 * plain. Inverse rule so future oddly-named specials highlight themselves.
 */
export function isMarqueeEvent(name: string): boolean {
  return !(
    /^UFC Fight Night/i.test(name) ||
    /^UFC on /i.test(name) ||
    /Ultimate Fighter/i.test(name) ||
    /^UFC Live/i.test(name) ||
    /Road to UFC/i.test(name)
  )
}

export const CARD_LABELS: Record<string, string> = {
  main: 'Main card',
  prelim: 'Preliminary card',
  early: 'Early prelims',
}
