import type { LookupAllowed } from '../data/load'
import type {
  AreaRecord,
  Band,
  MatchStatus,
  ParcelTileProperties,
  SummaryArea,
  TypeId,
} from '../data/types'
import { deriveMatchStatus } from './match'

export type SummaryMode = 'match' | 'need'

/** Match status for one housing type in one tract. */
export function areaStatus(area: AreaRecord, type: TypeId): MatchStatus {
  return deriveMatchStatus({
    need: area.need[type],
    fit: area.fit[type].band,
    allowed: area.allowed[type],
    floodway: area.risk.floodway,
  })
}

/** Match status for one parcel from its tile attributes plus its tract. */
export function parcelStatus(
  props: ParcelTileProperties,
  area: AreaRecord | undefined,
  type: TypeId,
  lookupAllowed: LookupAllowed,
): MatchStatus {
  const fitFlag = props[`f_${type}`]
  return deriveMatchStatus({
    need: area?.need[type] ?? null,
    fit: fitFlag === 1 ? 'high' : 'low',
    allowed: lookupAllowed(props.zone, type),
    floodway: props.floodway === 1,
  })
}

export interface SummaryBreakdown {
  /** Weighted counts by match status or need band. */
  counts: Record<string, number>
  /** Same keys as `counts`, as shares of the total weight (0..1). */
  shares: Record<string, number>
  /** Sum of member weights that resolved to a loaded tract. */
  totalWeight: number
  /** Value with the largest weight, or null when no member resolved. */
  plurality: string | null
  /** Share (0..1) of the total weight held by the plurality value. */
  pluralityShare: number
  /** Member tracts that were not present in the loaded areas. */
  missingMembers: number
  /** Human summary such as "62% Ready match · 38% Needs approval". */
  label: string
}

const STATUS_TEXT: Record<string, string> = {
  ready_match: 'Ready match',
  needs_approval: 'Needs approval',
  blocked_by_zoning: 'Blocked by zoning',
  needed_but_hard: 'Needed but hard',
  low_priority: 'Low priority',
  zoning_unknown: 'Zoning unknown',
  not_recommended: 'Not recommended',
  insufficient_data: 'Insufficient data',
}

const BAND_TEXT: Record<Band, string> = {
  high: 'High need',
  medium: 'Medium need',
  low: 'Low need',
  uncertain: 'Uncertain need',
}

export function summaryValueLabel(value: string, mode: SummaryMode): string {
  return mode === 'match'
    ? (STATUS_TEXT[value] ?? value)
    : (BAND_TEXT[value as Band] ?? value)
}

/**
 * Aggregates a municipality or neighborhood from its member tracts, weighted
 * by parcel overlap. The result always carries the full breakdown; callers
 * must show `pluralityShare` next to any single collapsed value.
 */
export function summarize(
  summary: SummaryArea,
  areasById: ReadonlyMap<string, AreaRecord>,
  type: TypeId,
  mode: SummaryMode,
): SummaryBreakdown {
  const counts: Record<string, number> = {}
  let totalWeight = 0
  let missingMembers = 0

  for (const member of summary.members) {
    const area = areasById.get(member.id)
    if (!area) {
      missingMembers += 1
      continue
    }
    if (member.weight <= 0) continue
    const value = mode === 'match' ? areaStatus(area, type) : area.need[type]
    counts[value] = (counts[value] ?? 0) + member.weight
    totalWeight += member.weight
  }

  const ordered = Object.entries(counts).sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  )
  const shares = Object.fromEntries(
    ordered.map(([value, weight]) => [value, weight / totalWeight]),
  )
  const top = ordered[0]

  if (!top || totalWeight === 0) {
    return {
      counts,
      shares,
      totalWeight,
      plurality: null,
      pluralityShare: 0,
      missingMembers,
      label: 'No scored tracts',
    }
  }

  const label = ordered
    .map(
      ([value, weight]) =>
        `${Math.round((weight / totalWeight) * 100)}% ${summaryValueLabel(value, mode)}`,
    )
    .join(' · ')

  return {
    counts,
    shares,
    totalWeight,
    plurality: top[0],
    pluralityShare: top[1] / totalWeight,
    missingMembers,
    label,
  }
}

/** The member tract holding the most parcels of the summary area. */
export function heaviestMember(
  summary: SummaryArea,
  areasById: ReadonlyMap<string, AreaRecord>,
): AreaRecord | undefined {
  const ranked = [...summary.members].sort(
    (left, right) => right.weight - left.weight || left.id.localeCompare(right.id),
  )
  for (const member of ranked) {
    const area = areasById.get(member.id)
    if (area) return area
  }
  return undefined
}

/** "Homewood North, Pittsburgh" or "Wilkinsburg". */
export function areaPlace(area: AreaRecord): string {
  return area.neighborhood ? `${area.neighborhood}, ${area.muni}` : area.muni
}

/** "Tract 1307 · Homewood North, Pittsburgh". */
export function areaLabel(area: AreaRecord): string {
  return `${area.name} · ${areaPlace(area)}`
}

/** Summaries the tract belongs to, for showing context next to a selection. */
export function summariesForArea(
  area: AreaRecord,
  summaries: readonly SummaryArea[],
): SummaryArea[] {
  return summaries.filter((summary) =>
    summary.members.some((member) => member.id === area.id),
  )
}
