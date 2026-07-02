import type { RevealMethod } from '@ko/shared'

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
}

/** "May 16, 2026" → "2026-05-16" */
export function toIsoDate(text: string): string | null {
  const m = text.trim().match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/)
  if (!m) return null
  const month = MONTHS[m[1]!.toLowerCase()]
  if (!month) return null
  return `${m[3]}-${month}-${m[2]!.padStart(2, '0')}`
}

export interface WeightClassInfo {
  weightClass: string
  titleFight: boolean
}

/** "UFC Women's Strawweight Title Bout" → { weightClass: "Women's Strawweight", titleFight: true } */
export function parseWeightClass(raw: string): WeightClassInfo {
  const titleFight = /title|championship/i.test(raw)
  let wc = raw
    .replace(/\b(UFC|Interim|Title|Bout|Championship|Tournament|Ultimate Fighter|Superfight|Vacant|TUF)\b/gi, ' ')
    .replace(/\bBrazil\b|\bChina\b|\bLatin America\b|\bNations\b(\s*Canada vs\.? Australia)?/gi, ' ')
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (wc === '') wc = 'Open Weight'
  return { weightClass: wc, titleFight }
}

export interface MethodInfo {
  methodClass: RevealMethod
  methodDetail: string | null
}

/**
 * Normalize a ufcstats METHOD value. `outcome` is used only to detect the
 * symmetric draw/no-contest cases; the W/L direction is never returned.
 */
export function parseMethod(rawMethod: string, outcome: string | null): MethodInfo {
  const method = rawMethod.trim()
  const isDraw = outcome !== null && /^D\/D$/i.test(outcome.trim())
  const isNc = outcome !== null && /^NC\/NC$/i.test(outcome.trim())

  const decision = method.match(/^Decision\s*-\s*(Unanimous|Split|Majority)$/i)
  if (decision) {
    const kind = decision[1]!
    if (isDraw) return { methodClass: 'Draw', methodDetail: `${capitalize(kind)} draw` }
    return {
      methodClass: `Decision - ${capitalize(kind)}` as RevealMethod,
      methodDetail: null,
    }
  }
  if (isNc || /overturned/i.test(method)) {
    return { methodClass: 'No Contest', methodDetail: detailFrom(method, 'Overturned') }
  }
  if (isDraw) return { methodClass: 'Draw', methodDetail: null }
  if (/^KO\/TKO/i.test(method)) return { methodClass: 'KO/TKO', methodDetail: null }
  if (/^TKO/i.test(method)) {
    return { methodClass: 'KO/TKO', methodDetail: detailFrom(method, null) }
  }
  if (/^Submission/i.test(method)) return { methodClass: 'Submission', methodDetail: null }
  if (/^DQ/i.test(method)) return { methodClass: 'Disqualification', methodDetail: null }
  if (/could not continue/i.test(method)) {
    return { methodClass: 'No Contest', methodDetail: 'Could not continue' }
  }
  if (/^Decision/i.test(method)) {
    return isDraw
      ? { methodClass: 'Draw', methodDetail: null }
      : { methodClass: 'Decision - Unanimous', methodDetail: null }
  }
  return { methodClass: 'Other', methodDetail: method || null }
}

function detailFrom(method: string, fallback: string | null): string | null {
  const m = method.match(/-\s*(.+)$/)
  return m ? m[1]!.trim() : fallback
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

export interface TimeFormatInfo {
  scheduledRounds: number | null
  roundLengthsMin: number[] | null
  legacyFormat: boolean
}

/** "3 Rnd (5-5-5)" → { scheduledRounds: 3, roundLengthsMin: [5,5,5], legacyFormat: false } */
export function parseTimeFormat(raw: string): TimeFormatInfo {
  const m = raw.trim().match(/^(\d+)\s*Rnd\s*\(([\d-]+)\)$/i)
  if (m) {
    const lengths = m[2]!.split('-').map(Number)
    return { scheduledRounds: Number(m[1]), roundLengthsMin: lengths, legacyFormat: false }
  }
  // Legacy formats: "No Time Limit", "1 Rnd + OT (12-3)", "Unlimited Rnd", ...
  const ot = raw.trim().match(/^(\d+)\s*Rnd\s*\+\s*\d*OT\s*\(([\d-]+)\)$/i)
  if (ot) {
    const lengths = ot[2]!.split('-').map(Number)
    return { scheduledRounds: null, roundLengthsMin: lengths, legacyFormat: true }
  }
  return { scheduledRounds: null, roundLengthsMin: null, legacyFormat: true }
}

/** "1:44" → 104 seconds. Returns null for "--"/"---"/empty. */
export function toSeconds(text: string): number | null {
  const m = text.trim().match(/^(\d+):(\d{2})$/)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** "23 of 38" → { landed: 23, attempted: 38 }. Returns zeros for "---". */
export function parseOfPair(text: string): { landed: number; attempted: number } {
  const m = text.trim().match(/^(\d+)\s+of\s+(\d+)$/i)
  if (!m) return { landed: 0, attempted: 0 }
  return { landed: Number(m[1]), attempted: Number(m[2]) }
}
