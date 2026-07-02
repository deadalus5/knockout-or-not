import { parse } from 'csv-parse'
import { lastNameKey } from '@ko/shared'
import { parseOfPair, toSeconds } from './common.js'
import type { CombinedStats } from '../model.js'

/**
 * Key linking a stats record to a fight: event name + the fighters' last-name
 * keys in sorted order. Symmetric by construction.
 */
export function statsKey(event: string, fighterA: string, fighterB: string): string {
  const names = [lastNameKey(fighterA), lastNameKey(fighterB)].sort()
  return `${event.trim().toLowerCase()}|${names.join('|')}`
}

/**
 * Stream-parse ufc_fight_stats.csv, summing per-round per-fighter rows into
 * symmetric per-fight combined aggregates. Per-fighter values never leave
 * this function — asymmetry (who out-landed whom) dies here.
 */
export async function parseCsvStats(csv: string): Promise<Map<string, CombinedStats>> {
  const parser = parse(csv, { columns: true, skip_empty_lines: true, trim: true, relax_quotes: true })
  const byFight = new Map<string, CombinedStats>()
  const roundsSeen = new Map<string, Set<string>>()

  for await (const row of parser as AsyncIterable<Record<string, string>>) {
    const event = (row['EVENT'] ?? '').trim()
    const bout = (row['BOUT'] ?? '').trim()
    const parts = bout.split(/\s+vs\.?\s+/i)
    if (!event || parts.length !== 2) continue
    const key = statsKey(event, parts[0]!, parts[1]!)

    let agg = byFight.get(key)
    if (!agg) {
      agg = {
        combinedKD: 0,
        combinedSigStrLanded: 0,
        combinedSigStrAttempted: 0,
        combinedTotalStr: 0,
        combinedTD: 0,
        combinedSubAtt: 0,
        combinedRev: 0,
        combinedCtrlSeconds: null,
        roundsWithStats: 0,
      }
      byFight.set(key, agg)
      roundsSeen.set(key, new Set())
    }

    const sig = parseOfPair(row['SIG.STR.'] ?? '')
    const total = parseOfPair(row['TOTAL STR.'] ?? '')
    const td = parseOfPair(row['TD'] ?? '')
    agg.combinedKD += toInt(row['KD'])
    agg.combinedSigStrLanded += sig.landed
    agg.combinedSigStrAttempted += sig.attempted
    agg.combinedTotalStr += total.landed
    agg.combinedTD += td.landed
    agg.combinedSubAtt += toInt(row['SUB.ATT'])
    agg.combinedRev += toInt(row['REV.'])
    const ctrl = toSeconds(row['CTRL'] ?? '')
    if (ctrl !== null) agg.combinedCtrlSeconds = (agg.combinedCtrlSeconds ?? 0) + ctrl

    const rounds = roundsSeen.get(key)!
    const roundLabel = (row['ROUND'] ?? '').trim()
    if (roundLabel && !rounds.has(roundLabel)) {
      rounds.add(roundLabel)
      agg.roundsWithStats = rounds.size
    }
  }
  return byFight
}

function toInt(value: string | undefined): number {
  const n = Number((value ?? '').trim())
  return Number.isFinite(n) ? n : 0
}
