export const TYPE_IDS = [
  'adu',
  'duplex_triplex',
  'townhome',
  'small_apartment',
  'large_apartment',
  'senior_accessible',
  'rehab_reuse',
  'detached_sf',
] as const

export type TypeId = (typeof TYPE_IDS)[number]

export type Band = 'high' | 'medium' | 'low' | 'uncertain'

export type ZoningStatus =
  | 'by_right'
  | 'special_exception'
  | 'conditional_use'
  | 'not_permitted'
  | 'unknown'

export type Provenance =
  | 'observed'
  | 'derived'
  | 'assumption'
  | 'law'
  | 'user'

export type MatchStatus =
  | 'not_recommended'
  | 'low_priority'
  | 'needed_but_hard'
  | 'ready_match'
  | 'needs_approval'
  | 'blocked_by_zoning'
  | 'zoning_unknown'
  | 'insufficient_data'

export interface FitResult {
  band: Band
  parcels: number
  homes: [number, number]
}

export interface HexRecord {
  h3: string
  muni: string
  inCity: boolean
  neighborhood?: string
  tract: string
  households: Record<string, number>
  stock: Record<string, number>
  moeFlags: string[]
  need: Record<TypeId, Band>
  fit: Record<TypeId, FitResult>
  allowed: Record<TypeId, ZoningStatus>
  risk: {
    displacement: number
    floodShare: number
    floodway: boolean
    slopeShare: number | null
    undermined: number | null
  }
  carbon: {
    vmtPerHh: number | null
  }
  transitTrips800m: number
  confidence: number
}

export interface ZoningRule {
  muni: string
  district: string
  type: TypeId
  status: ZoningStatus
  minLotSqft: number | null
  section: string
  quote: string
  verifiedBy: string | null
  verifiedAt: string | null
}

export interface ZoningCounts {
  h3: string
  rows: Array<{
    district: string
    lotBand: 'lt3k' | '3to5k' | '5to10k' | 'gt10k'
    use: 'vacant' | 'sf_detached' | 'sf_attached' | 'other'
    count: number
  }>
}

/**
 * Minimal GeoJSON-compatible contracts used by local fixtures. Keeping these
 * contracts here avoids requiring a runtime GeoJSON dependency.
 */
export type GeoJsonPosition = readonly [longitude: number, latitude: number]

export interface GeoJsonPolygonGeometry {
  type: 'Polygon'
  coordinates: readonly (readonly GeoJsonPosition[])[]
}

export interface GeoJsonFeature<
  Properties extends Record<string, unknown>,
  Geometry extends GeoJsonPolygonGeometry = GeoJsonPolygonGeometry,
> {
  type: 'Feature'
  id: string
  geometry: Geometry
  properties: Properties
}

export interface GeoJsonFeatureCollection<
  Properties extends Record<string, unknown>,
  Geometry extends GeoJsonPolygonGeometry = GeoJsonPolygonGeometry,
> {
  type: 'FeatureCollection'
  features: readonly GeoJsonFeature<Properties, Geometry>[]
}

export interface IllustrativeGeometryProperties
  extends Record<string, unknown> {
  authoritative: false
  geometryStatus: 'illustrative_not_cadastral'
  geometryNotice: string
}

export interface SummaryAreaProperties
  extends IllustrativeGeometryProperties {
  kind: 'summary_area'
  summaryLevel: 'neighborhood' | 'municipality'
  areaId: string
  label: string
  municipality: string
  parentH3s: readonly string[]
}

export interface PlanningAreaProperties
  extends IllustrativeGeometryProperties {
  kind: 'planning_area'
  planningAreaId: string
  label: string
  municipalities: readonly string[]
  parentH3s: readonly string[]
}

export interface IllustrativeParcelProperties
  extends IllustrativeGeometryProperties {
  kind: 'illustrative_parcel'
  parcelId: string
  parentH3: string
  parentMunicipality: string
  parentNeighborhood: string | null
  parentTract: string
  fixtureOrdinal: number
}
