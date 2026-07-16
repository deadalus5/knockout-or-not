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

/** Excitement → heat color (slate → amber → hot orange-red). */
export function heatColor(excitement: number): string {
  if (excitement >= 85) return '#ff6a3d'
  if (excitement >= 70) return '#f5a623'
  if (excitement >= 55) return '#d9c67a'
  if (excitement >= 40) return '#9aa3b5'
  return '#7d8aa5'
}

export function starString(stars: number): string {
  return '★'.repeat(stars) + '☆'.repeat(5 - stars)
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

export const CARD_LABELS: Record<string, string> = {
  main: 'Main card',
  prelim: 'Preliminary card',
  early: 'Early prelims',
}
