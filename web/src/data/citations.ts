import type { SourceRecord } from './types'

/** Short labels for insight citations. Full titles stay on the source catalog. */
export const SOURCE_LABELS: Record<string, string> = {
  acs5: 'ACS 5-year',
  tiger_tracts: 'Census tracts',
  chas: 'HUD CHAS',
  parcels: 'County parcels',
  assessments: 'Property assessments',
  delinquency: 'Tax delinquency',
  condemned: 'Condemned properties',
  city_owned: 'City-owned properties',
  zoning: 'Pittsburgh zoning',
  municipalities: 'Municipal boundaries',
  neighborhoods: 'Neighborhoods',
  flood: 'FEMA flood hazard',
  slopes: 'Steep slopes',
  undermined: 'Undermined areas',
  gtfs: 'PRT transit schedule',
  future_ready: 'Future Ready PA',
  school_districts: 'School districts',
  pps_attendance: 'PPS attendance zones',
}

/** Source ids behind each map check. Order is the citation order. */
export const CHECK_SOURCE_IDS = {
  need: ['acs5', 'chas'],
  floodway: ['flood'],
  fit: [
    'parcels',
    'assessments',
    'delinquency',
    'condemned',
    'city_owned',
    'slopes',
    'undermined',
    'gtfs',
  ],
  allowed: ['zoning'],
} as const

export function sourceLabel(source: SourceRecord): string {
  return SOURCE_LABELS[source.id] ?? source.title
}

/** Sources from the snapshot, in the requested order. Unknown ids are skipped. */
export function citeSources(
  sources: readonly SourceRecord[],
  ids: readonly string[],
): SourceRecord[] {
  const byId = new Map(sources.map((source) => [source.id, source]))
  const seen = new Set<string>()
  return ids.flatMap((id) => {
    if (seen.has(id)) return []
    seen.add(id)
    const source = byId.get(id)
    return source ? [source] : []
  })
}
