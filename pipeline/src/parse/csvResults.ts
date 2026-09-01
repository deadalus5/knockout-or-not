import { parse } from 'csv-parse/sync'
import { parseFinishDetail, parseMethod, parseTimeFormat, parseWeightClass } from './common.js'
import type { InternalFight } from '../model.js'

/**
 * Parse ufc_fight_results.csv into internal fights grouped by event name.
 *
 * Spoiler handling at this boundary:
 * - OUTCOME (W/L direction) is read only to classify symmetric draw/NC rows
 *   and is dropped before this function returns.
 * - DETAILS for decisions contains judge scorecards — discarded here, never
 *   stored. For KO/TKO and Submission it is ufcstats' finish description,
 *   which the upstream scrape glues to a free-text note without whitespace
 *   ("Twister From Back ControlScottish twister", "toMcGregor knee injury").
 *   parseFinishDetail keeps only the taxonomy head, discards the note (where
 *   fighter names appear), drops any value naming a fighter, and nulls blank
 *   injury templates. DQ rows never use DETAILS — 17 of 23 name the
 *   disqualified fighter in the head. Wikipedia's phrase replaces the head in
 *   the merge (mergeEvents.ts chooseMethodDetail).
 */
export function parseCsvResults(csv: string): Map<string, InternalFight[]> {
  const rows: Record<string, string>[] = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
  })

  const byEvent = new Map<string, InternalFight[]>()
  for (const row of rows) {
    const event = (row['EVENT'] ?? '').trim()
    const bout = (row['BOUT'] ?? '').trim()
    const parts = bout.split(/\s+vs\.?\s+/i)
    if (!event || parts.length !== 2) continue

    const outcome = (row['OUTCOME'] ?? '').trim() || null
    const { methodClass, methodDetail: methodDetailFromMethod } = parseMethod(
      row['METHOD'] ?? '',
      outcome,
    )
    const { weightClass, titleFight } = parseWeightClass(row['WEIGHTCLASS'] ?? '')
    const timeFormat = parseTimeFormat(row['TIME FORMAT'] ?? '')

    const fighters: [string, string] = [parts[0]!.trim(), parts[1]!.trim()]
    // DETAILS is consulted only for KO/TKO and Submission. Decisions carry
    // judge scorecards (discarded, never stored); DQ rows name the
    // disqualified fighter in the head ("Headbutt by X") where the note-drop
    // inside parseFinishDetail cannot reach; NC/Draw/Other/Doctor's Stoppage
    // already derived their detail from METHOD above.
    const isFinish = methodClass === 'KO/TKO' || methodClass === 'Submission'
    const finishDetail = isFinish ? parseFinishDetail(row['DETAILS'] ?? '', fighters) : null

    const round = Number(row['ROUND'] ?? '')
    const time = (row['TIME'] ?? '').trim()

    const fight: InternalFight = {
      fighters,
      order: 0,
      card: null,
      weightClass,
      titleFight,
      methodClass,
      methodDetail: methodDetailFromMethod ?? truncateDetail(finishDetail),
      round: Number.isInteger(round) && round >= 1 ? round : null,
      time: /^\d{1,2}:\d{2}$/.test(time) ? time : null,
      scheduledRounds: timeFormat.scheduledRounds,
      roundLengthsMin: timeFormat.roundLengthsMin,
      legacyFormat: timeFormat.legacyFormat,
      stats: null,
      bonuses: [],
    }

    const list = byEvent.get(event) ?? []
    fight.order = list.length + 1 // results are listed main event first
    list.push(fight)
    byEvent.set(event, list)
  }
  return byEvent
}

function truncateDetail(detail: string | null): string | null {
  if (detail === null) return null
  return detail.length > 120 ? `${detail.slice(0, 117)}...` : detail
}
