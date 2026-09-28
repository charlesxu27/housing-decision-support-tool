import type { MatchStatus, TypeId } from '../data/types'

export const TYPE_LABELS: Record<TypeId, string> = {
  adu: 'Accessory dwelling unit (ADU)',
  duplex_triplex: 'Duplex / triplex',
  townhome: 'Townhomes / rowhouses',
  small_apartment: 'Small apartment building',
  large_apartment: 'Mid-size / large apartments',
  senior_accessible: 'Senior / accessible housing',
  rehab_reuse: 'Renovate & reuse of vacant homes',
  detached_sf: 'Detached single-family',
}

export const STATUS_LABELS: Record<MatchStatus, string> = {
  ready_match: 'Ready match',
  needs_approval: 'Needs approval',
  blocked_by_zoning: 'Blocked by zoning',
  needed_but_hard: 'Needed but hard',
  low_priority: 'Low priority',
  zoning_unknown: 'Zoning unknown',
  not_recommended: 'Not recommended',
  insufficient_data: 'Insufficient data',
}
