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

export const CARD_LABELS: Record<string, string> = {
  main: 'Main card',
  prelim: 'Preliminary card',
  early: 'Early prelims',
}
