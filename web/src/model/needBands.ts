import type { AreaRecord, Band } from '../data/types'
import { TYPE_IDS } from '../data/types'
import { pct } from '../shared/format'

/**
 * The published snapshot labels the bottom third of county scores as low need.
 * That band blocks a match before fit and zoning are considered, so a large
 * share of tracts with suitable lots stay gray. Only the bottom tenth now
 * counts as low. The top third stays high.
 */
export const LOW_NEED_QUANTILE = 0.1
export const HIGH_NEED_QUANTILE = 2 / 3

function quantile(sorted: readonly number[], p: number): number {
  const index = (sorted.length - 1) * p
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]!
  const weight = index - lower
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight
}

function bandForScore(score: number, lowCut: number, highCut: number): Band {
  if (score > highCut) return 'high'
  if (score > lowCut) return 'medium'
  return 'low'
}

/**
 * Rewrites tract fit bands. The snapshot marks the bottom third of suitable-lot
 * counts as low, which colors the tract blue ("needed but hard") even when it
 * still has lots to review. Blue is reserved for tracts with no suitable lots.
 * Tracts with at least one suitable lot fall through to zoning.
 */
export function applyLenientFitBands(areas: readonly AreaRecord[]): void {
  for (const type of TYPE_IDS) {
    const positive = areas
      .map((area) => area.fit[type].parcels)
      .filter((count) => count > 0)
      .sort((left, right) => left - right)
    const highCut =
      positive.length >= 2 ? quantile(positive, HIGH_NEED_QUANTILE) : Number.POSITIVE_INFINITY
    for (const area of areas) {
      const count = area.fit[type].parcels
      area.fit[type].band =
        count <= 0 ? 'low' : count > highCut ? 'high' : 'medium'
    }
  }
}

/** Rewrites `area.need` from published scores. Missing scores keep their band. */
export function applyLenientNeedBands(areas: readonly AreaRecord[]): void {
  for (const type of TYPE_IDS) {
    const scores = areas
      .map((area) => area.needScores[type])
      .filter((score): score is number => score != null)
      .sort((left, right) => left - right)
    if (scores.length < 2 || scores[0] === scores[scores.length - 1]) continue
    const lowCut = quantile(scores, LOW_NEED_QUANTILE)
    const highCut = quantile(scores, HIGH_NEED_QUANTILE)
    for (const area of areas) {
      const score = area.needScores[type]
      if (score == null) continue
      area.need[type] = bandForScore(score, lowCut, highCut)
    }
  }
}

/** Homes the small-household gap actually compares against: studios through 2 bedrooms. */
export function smallHomeShare(area: AreaRecord): number | null {
  const studios = area.stock.br_0_1
  const twoBedroom = area.stock.br_2
  if (studios == null || twoBedroom == null) return null
  return studios + twoBedroom
}

export function describeSmallHouseholdGap(area: AreaRecord): string {
  return `1–2 person households ${pct(area.households.hh_1_2)} vs. 0–2 bedroom homes ${pct(smallHomeShare(area))}`
}

export function describeNeedScore(score: number | null): string {
  const shown = score == null ? 'not available' : score.toFixed(2)
  return `Need score: ${shown}. Low need is the lowest 10% of Allegheny County scores for this housing type.`
}
