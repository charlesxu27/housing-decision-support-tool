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

export const ZONING_STATUSES = [
  'by_right',
  'special_exception',
  'conditional_use',
  'not_permitted',
  'unknown',
] as const

export type ZoningStatus = (typeof ZONING_STATUSES)[number]

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
  /** Count of parcels that pass the type's fit rule (floodway parcels excluded). */
  parcels: number
  /** Homes-possible range across those parcels. */
  homes: [number, number]
}

/**
 * Household-side measures for one analysis area. All values are shares in
 * 0..1 except `total`, which is the count of occupied households. `null` means
 * the source did not publish a usable estimate; the UI must not substitute a
 * default.
 */
export interface HouseholdMeasures {
  total: number | null
  hh_1_2: number | null
  hh_5_plus: number | null
  senior_alone: number | null
  cost_burdened_renters: number | null
  overcrowded: number | null
  renter_share: number | null
  [key: string]: number | null
}

/**
 * Housing-stock measures for one analysis area. Shares in 0..1 except
 * `total_units` (count).
 */
export interface StockMeasures {
  total_units: number | null
  br_0_1: number | null
  br_2: number | null
  br_3_plus: number | null
  units_1_detached: number | null
  units_1_attached: number | null
  units_2_to_4: number | null
  units_5_to_19: number | null
  units_20_plus: number | null
  vacant_share: number | null
  other_vacant_share: number | null
  [key: string]: number | null
}

export interface AreaRisk {
  /** Derived 0..1 displacement-pressure index; null when inputs are missing. */
  displacement: number | null
  /** Share of parcels intersecting a FEMA special flood hazard area. */
  floodShare: number
  /** Share of parcels intersecting a FEMA regulatory floodway. */
  floodwayShare: number
  /** True only when the area is predominantly floodway (hard gate). */
  floodway: boolean
  /** Share of parcels intersecting mapped >=25% slopes; null outside the City layer. */
  slopeShare: number | null
  /** Share of parcels intersecting mapped undermined areas; null outside coverage. */
  undermined: number | null
}

export interface AreaParcelCounts {
  total: number
  residential: number
  vacant: number
  rehabCandidates: number
}

export type SchoolLevel = 'elementary' | 'middle' | 'high'

export type SchoolAssignment = 'attendance_zone' | 'nearest_in_district'

/** A public school whose score is shown for this tract. */
export interface TractSchool {
  level: SchoolLevel
  name: string
  /** Share proficient or advanced in math/algebra, 0..1. Null when suppressed. */
  mathProficient: number | null
  /** Share proficient or advanced in ELA/literature, 0..1. Null when suppressed. */
  elaProficient: number | null
  /** Attendance zone inside Pittsburgh; nearest school of that level in other districts. */
  basis: SchoolAssignment
  /** Share of the tract inside this attendance zone. Null for a nearest-school assignment. */
  coverage: number | null
  /** Miles from the tract centroid to the school. Null for an attendance-zone assignment. */
  distanceMiles: number | null
}

/**
 * One Census tract in Allegheny County. Tracts are the analysis unit because
 * ACS household measures are published there; parcel-derived Fit and Allowed
 * results are aggregated up to the tract.
 */
export interface AreaRecord {
  /** 11-digit Census tract GEOID, e.g. "42003130700". */
  id: string
  kind: 'tract'
  /** Human label, e.g. "Tract 1307". */
  name: string
  /** Municipality holding the most parcels in the tract. */
  muni: string
  /** All municipalities with parcels in the tract. */
  munis: string[]
  /** True when `muni` is the City of Pittsburgh. */
  inCity: boolean
  /** Dominant City neighborhood, or null outside the City. */
  neighborhood: string | null
  neighborhoods: string[]
  centroid: [longitude: number, latitude: number]
  households: HouseholdMeasures
  stock: StockMeasures
  /** Keys in `households`/`stock` whose estimate is unreliable (CV > threshold). */
  moeFlags: string[]
  need: Record<TypeId, Band>
  /** 0..1 derived need score behind each band; null when it could not be computed. */
  needScores: Record<TypeId, number | null>
  fit: Record<TypeId, FitResult>
  /** Dominant zoning status across the tract's residential-capable parcels. */
  allowed: Record<TypeId, ZoningStatus>
  /** Parcel-share breakdown behind `allowed`. */
  allowedShares: Record<TypeId, Partial<Record<ZoningStatus, number>>>
  /** Pittsburgh zoning districts present in the tract (empty outside the City). */
  zoningDistricts: string[]
  risk: AreaRisk
  carbon: {
    /** Vehicle-miles per household; null until a location-affordability source is wired. */
    vmtPerHh: number | null
  }
  /** Weekday scheduled transit trips at stops within 800 m of the tract centroid. */
  transitTrips800m: number
  /**
   * Place context for the map sidebar. These facts do not change Need, Fit,
   * or Allowed. School scores are the assigned school's result, not a district average.
   */
  opportunity: {
    /** ACS B19013 median household income in dollars. Null when unpublished. */
    medianHouseholdIncome: number | null
    /** Same ACS median for Allegheny County. */
    countyMedianHouseholdIncome: number | null
    /** Unified school district covering the largest share of the tract. */
    schoolDistrict: string | null
    /** Share of the tract's land inside `schoolDistrict`. */
    schoolDistrictShare: number | null
    /**
     * Enrollment-weighted mean of the district's school math and reading shares, 0..1.
     * The same value for every tract in the district.
     */
    districtProficient: number | null
    /**
     * Elementary school's share proficient or advanced in math/algebra, 0..1.
     * Mirrors `schools`. Null when that school did not publish a percent.
     */
    mathProficient: number | null
    /** Elementary school's share proficient or advanced in ELA/literature, 0..1. */
    elaProficient: number | null
    /** Elementary, middle, and high school assigned to this tract. */
    schools: TractSchool[]
  }
  parcels: AreaParcelCounts
  /** 0..1 share of required inputs present and reliable. */
  confidence: number
}

export interface SummaryMember {
  /** Tract GEOID. */
  id: string
  /** Number of parcels of the tract that fall inside this summary area. */
  weight: number
}

/**
 * A municipality or City neighborhood shown at summary zoom. Summaries carry
 * no scores of their own; the UI aggregates member tracts weighted by parcel
 * overlap and shows a breakdown rather than a single collapsed status.
 */
export interface SummaryArea {
  /** "muni:<county code>" or "hood:<slug>". */
  id: string
  kind: 'municipality' | 'neighborhood'
  label: string
  municipality: string
  members: SummaryMember[]
  parcels: number
  centroid: [longitude: number, latitude: number]
  bbox: [west: number, south: number, east: number, north: number]
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

export interface ZoningMatrix {
  schemaVersion: 1
  muni: string
  source: string
  /** 'draft' until every rule carries a reviewer; 'verified' otherwise. */
  verificationStatus: 'draft' | 'verified'
  districts: string[]
  rules: ZoningRule[]
}

export interface SourceRecord {
  id: string
  title: string
  publisher: string
  catalogUrl: string
  resourceUrl: string
  geography: string
  vintage: string
  retrievedAt: string
  sha256: string | null
  license: string
  fieldsRetained: string[]
  notes: string
  /** false when the source could not be fetched and its metrics are null. */
  available: boolean
}

export interface ManifestFile {
  path: string
  bytes: number
  sha256: string
  rows: number | null
}

export interface DataManifest {
  schemaVersion: 1
  builtAt: string
  modelVersion: string
  configHash: string
  coverage: {
    county: string
    tractVintage: string
    acsVintage: string
    zoningMunicipalities: string[]
  }
  files: Record<string, ManifestFile>
  sources: SourceRecord[]
  /** Share of tracts with a null value, per key metric. */
  nullCoverage: Record<string, number>
  counts: {
    tracts: number
    municipalities: number
    neighborhoods: number
    parcels: number
  }
  parcelTiles: {
    urlTemplate: string
    layer: string
    minZoom: number
    maxZoom: number
  } | null
}

export interface AreaMetricsFile {
  schemaVersion: 1
  builtAt: string
  areas: AreaRecord[]
  summaries: SummaryArea[]
}

/**
 * Attributes carried by each parcel feature in the vector tiles. Integers are
 * used for booleans (0/1) and -1 means "not covered by the source layer".
 */
export interface ParcelTileProperties {
  pin: string
  tract: string
  muni: string
  hood: string | null
  /** Lot area in square feet. */
  lot: number
  /** Assessment use class. */
  use: 'vacant' | 'sf_detached' | 'sf_attached' | 'two_family' | 'three_family' | 'multi_unit' | 'other'
  /** Pittsburgh zoning district or null outside the City. */
  zone: string | null
  bldg: 0 | 1
  flood: 0 | 1
  floodway: 0 | 1
  slope: -1 | 0 | 1
  mine: -1 | 0 | 1
  rehab: 0 | 1
  f_adu: 0 | 1
  f_duplex_triplex: 0 | 1
  f_townhome: 0 | 1
  f_small_apartment: 0 | 1
  f_large_apartment: 0 | 1
  f_senior_accessible: 0 | 1
  f_rehab_reuse: 0 | 1
  f_detached_sf: 0 | 1
}

/** Minimal GeoJSON contracts so the app does not need a runtime GeoJSON dependency. */
export type GeoJsonPosition = [longitude: number, latitude: number]

export interface GeoJsonPolygonGeometry {
  type: 'Polygon'
  coordinates: GeoJsonPosition[][]
}

export interface GeoJsonMultiPolygonGeometry {
  type: 'MultiPolygon'
  coordinates: GeoJsonPosition[][][]
}

export interface GeoJsonPointGeometry {
  type: 'Point'
  coordinates: GeoJsonPosition
}

export type GeoJsonGeometry =
  | GeoJsonPolygonGeometry
  | GeoJsonMultiPolygonGeometry
  | GeoJsonPointGeometry

export interface GeoJsonFeature<
  Properties extends Record<string, unknown>,
  Geometry extends GeoJsonGeometry = GeoJsonGeometry,
> {
  type: 'Feature'
  id?: string | number
  geometry: Geometry
  properties: Properties
}

export interface GeoJsonFeatureCollection<
  Properties extends Record<string, unknown>,
  Geometry extends GeoJsonGeometry = GeoJsonGeometry,
> {
  type: 'FeatureCollection'
  features: GeoJsonFeature<Properties, Geometry>[]
}

export interface AnalysisAreaProperties extends Record<string, unknown> {
  id: string
  name: string
  muni: string
  inCity: boolean
}

export interface SummaryAreaProperties extends Record<string, unknown> {
  id: string
  kind: 'municipality' | 'neighborhood'
  label: string
  municipality: string
}

export interface ZoningDistrictProperties extends Record<string, unknown> {
  district: string
  label: string
}

export interface FloodZoneProperties extends Record<string, unknown> {
  zone: string
  sfha: boolean
  floodway: boolean
}

export interface TransitStopProperties extends Record<string, unknown> {
  stopId: string
  name: string
  weekdayTrips: number
  routes: string[]
}
