import { applyLenientFitBands, applyLenientNeedBands } from '../model/needBands'
import { z } from 'zod'
import {
  TYPE_IDS,
  ZONING_STATUSES,
  type AreaMetricsFile,
  type AreaRecord,
  type DataManifest,
  type GeoJsonFeatureCollection,
  type SummaryArea,
  type TypeId,
  type ZoningMatrix,
  type ZoningRule,
  type ZoningStatus,
} from './types'

/** Paths are absolute from the site root; Vite serves `web/public` there. */
export const DATA_PATHS = {
  manifest: '/data/manifest.json',
  areaMetrics: '/data/area_metrics.json',
  zoningMatrix: '/data/zoning_matrix.json',
  analysisAreas: '/data/analysis_areas.geojson',
  municipalities: '/data/municipalities.geojson',
  neighborhoods: '/data/pittsburgh_neighborhoods.geojson',
  zoningDistricts: '/data/zoning_pittsburgh.geojson',
  floodZones: '/data/overlays/flood_zones.geojson',
  transitStops: '/data/overlays/transit_stops.geojson',
} as const

export type DataLoadFailure = 'network' | 'http' | 'parse' | 'schema'

/**
 * Every loader failure names the file that failed and why. The UI shows this
 * verbatim instead of falling back to substitute data.
 */
export class DataLoadError extends Error {
  readonly file: string
  readonly kind: DataLoadFailure
  readonly reason: string

  constructor(file: string, kind: DataLoadFailure, reason: string) {
    super(`${file}: ${reason}`)
    this.name = 'DataLoadError'
    this.file = file
    this.kind = kind
    this.reason = reason
  }
}

const nullableNumber = z.number().nullable()
const typeId = z.enum(TYPE_IDS)
const band = z.enum(['high', 'medium', 'low', 'uncertain'])
const zoningStatus = z.enum(ZONING_STATUSES)
const position = z.tuple([z.number(), z.number()])

const fitResult = z.object({
  band,
  parcels: z.number().int().nonnegative(),
  homes: z.tuple([z.number(), z.number()]),
})

const householdMeasures = z
  .object({
    total: nullableNumber,
    hh_1_2: nullableNumber,
    hh_5_plus: nullableNumber,
    senior_alone: nullableNumber,
    cost_burdened_renters: nullableNumber,
    overcrowded: nullableNumber,
    renter_share: nullableNumber,
  })
  .catchall(nullableNumber)

const stockMeasures = z
  .object({
    total_units: nullableNumber,
    br_0_1: nullableNumber,
    br_2: nullableNumber,
    br_3_plus: nullableNumber,
    units_1_detached: nullableNumber,
    units_1_attached: nullableNumber,
    units_2_to_4: nullableNumber,
    units_5_to_19: nullableNumber,
    units_20_plus: nullableNumber,
    vacant_share: nullableNumber,
    other_vacant_share: nullableNumber,
  })
  .catchall(nullableNumber)

const areaRisk = z.object({
  displacement: nullableNumber,
  floodShare: z.number(),
  floodwayShare: z.number(),
  floodway: z.boolean(),
  slopeShare: nullableNumber,
  undermined: nullableNumber,
})

const areaRecordSchema: z.ZodType<AreaRecord> = z.object({
  id: z.string().regex(/^\d{11}$/, 'expected an 11-digit tract GEOID'),
  kind: z.literal('tract'),
  name: z.string(),
  muni: z.string(),
  munis: z.array(z.string()),
  inCity: z.boolean(),
  neighborhood: z.string().nullable(),
  neighborhoods: z.array(z.string()),
  centroid: position,
  households: householdMeasures,
  stock: stockMeasures,
  moeFlags: z.array(z.string()),
  need: z.record(typeId, band),
  needScores: z.record(typeId, nullableNumber),
  fit: z.record(typeId, fitResult),
  allowed: z.record(typeId, zoningStatus),
  allowedShares: z.record(typeId, z.partialRecord(zoningStatus, z.number())),
  zoningDistricts: z.array(z.string()),
  risk: areaRisk,
  carbon: z.object({ vmtPerHh: nullableNumber }),
  transitTrips800m: z.number(),
  opportunity: z.object({
    medianHouseholdIncome: nullableNumber,
    countyMedianHouseholdIncome: nullableNumber,
    schoolDistrict: z.string().nullable(),
    schoolDistrictShare: nullableNumber,
    districtProficient: nullableNumber,
    mathProficient: nullableNumber,
    elaProficient: nullableNumber,
    schools: z.array(
      z.object({
        level: z.enum(['elementary', 'middle', 'high']),
        name: z.string().min(1),
        mathProficient: nullableNumber,
        elaProficient: nullableNumber,
        basis: z.enum(['attendance_zone', 'nearest_in_district']),
        coverage: nullableNumber,
        distanceMiles: nullableNumber,
      }),
    ),
  }),
  parcels: z.object({
    total: z.number(),
    residential: z.number(),
    vacant: z.number(),
    rehabCandidates: z.number(),
  }),
  confidence: z.number(),
})

const summaryAreaSchema: z.ZodType<SummaryArea> = z.object({
  id: z.string().min(1),
  kind: z.enum(['municipality', 'neighborhood']),
  label: z.string(),
  municipality: z.string(),
  members: z.array(
    z.object({ id: z.string(), weight: z.number().nonnegative() }),
  ),
  parcels: z.number(),
  centroid: position,
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
})

export const areaMetricsSchema: z.ZodType<AreaMetricsFile> = z.object({
  schemaVersion: z.literal(1),
  builtAt: z.string(),
  areas: z.array(areaRecordSchema),
  summaries: z.array(summaryAreaSchema),
})

const zoningRule = z.object({
  muni: z.string(),
  district: z.string(),
  type: typeId,
  status: zoningStatus,
  minLotSqft: nullableNumber,
  section: z.string(),
  quote: z.string(),
  verifiedBy: z.string().nullable(),
  verifiedAt: z.string().nullable(),
})

export const zoningMatrixSchema: z.ZodType<ZoningMatrix> = z.object({
  schemaVersion: z.literal(1),
  muni: z.string(),
  source: z.string(),
  verificationStatus: z.enum(['draft', 'verified']),
  districts: z.array(z.string()),
  rules: z.array(zoningRule),
})

const sourceRecord = z.object({
  id: z.string(),
  title: z.string(),
  publisher: z.string(),
  catalogUrl: z.string(),
  resourceUrl: z.string(),
  geography: z.string(),
  vintage: z.string(),
  retrievedAt: z.string(),
  sha256: z.string().nullable(),
  license: z.string(),
  fieldsRetained: z.array(z.string()),
  notes: z.string(),
  available: z.boolean(),
})

export const manifestSchema: z.ZodType<DataManifest> = z.object({
  schemaVersion: z.literal(1),
  builtAt: z.string(),
  modelVersion: z.string(),
  configHash: z.string(),
  coverage: z.object({
    county: z.string(),
    tractVintage: z.string(),
    acsVintage: z.string(),
    zoningMunicipalities: z.array(z.string()),
  }),
  files: z.record(
    z.string(),
    z.object({
      path: z.string(),
      bytes: z.number(),
      sha256: z.string(),
      rows: z.number().nullable(),
    }),
  ),
  sources: z.array(sourceRecord),
  nullCoverage: z.record(z.string(), z.number()),
  counts: z.object({
    tracts: z.number(),
    municipalities: z.number(),
    neighborhoods: z.number(),
    parcels: z.number(),
  }),
  parcelTiles: z
    .object({
      urlTemplate: z.string(),
      layer: z.string(),
      minZoom: z.number(),
      maxZoom: z.number(),
    })
    .nullable(),
})

/**
 * GeoJSON files can carry hundreds of thousands of coordinates, so the loader
 * validates structure and feature properties but only checks that geometry
 * coordinates are an array. deck.gl consumes the geometry directly.
 */
function featureCollectionSchema<P extends Record<string, unknown>>(
  properties: z.ZodType<P>,
) {
  return z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(
      z.object({
        type: z.literal('Feature'),
        id: z.union([z.string(), z.number()]).optional(),
        geometry: z.object({
          type: z.enum(['Polygon', 'MultiPolygon', 'Point']),
          coordinates: z.array(z.unknown()),
        }),
        properties,
      }),
    ),
  })
}

export const analysisAreaProperties = z
  .object({
    id: z.string(),
    name: z.string(),
    muni: z.string(),
    inCity: z.boolean(),
  })
  .loose()

export const summaryAreaProperties = z
  .object({
    id: z.string(),
    kind: z.enum(['municipality', 'neighborhood']),
    label: z.string(),
    municipality: z.string(),
  })
  .loose()

export const zoningDistrictProperties = z
  .object({ district: z.string(), label: z.string() })
  .loose()

export const floodZoneProperties = z
  .object({ zone: z.string(), sfha: z.boolean(), floodway: z.boolean() })
  .loose()

export const transitStopProperties = z
  .object({
    stopId: z.string(),
    name: z.string(),
    weekdayTrips: z.number(),
    routes: z.array(z.string()),
  })
  .loose()

export type FetchLike = (input: string) => Promise<Response>

function formatIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)'
      return `${path}: ${issue.message}`
    })
    .join('; ')
}

export async function fetchValidated<T>(
  path: string,
  schema: z.ZodType<T>,
  fetchImpl: FetchLike = (input) => fetch(input),
): Promise<T> {
  let response: Response
  try {
    response = await fetchImpl(path)
  } catch (error) {
    throw new DataLoadError(
      path,
      'network',
      error instanceof Error ? error.message : 'request failed',
    )
  }

  if (!response.ok) {
    throw new DataLoadError(
      path,
      'http',
      `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`,
    )
  }

  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    throw new DataLoadError(
      path,
      'parse',
      error instanceof Error ? error.message : 'invalid JSON',
    )
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw new DataLoadError(path, 'schema', formatIssues(parsed.error))
  }
  return parsed.data
}

export async function loadGeoJson<P extends Record<string, unknown>>(
  path: string,
  properties: z.ZodType<P>,
  fetchImpl?: FetchLike,
): Promise<GeoJsonFeatureCollection<P>> {
  const collection = await fetchValidated(
    path,
    featureCollectionSchema(properties),
    fetchImpl,
  )
  return collection as unknown as GeoJsonFeatureCollection<P>
}

export type LookupAllowed = (
  zone: string | null | undefined,
  type: TypeId,
) => ZoningStatus

function normalizeDistrict(zone: string): string {
  return zone.trim().toUpperCase()
}

/**
 * Resolves a parcel's zoning district against the reviewed matrix: exact
 * district first, then the family prefix (e.g. `R1D-L` falls back to `R1D`,
 * `R1D-VL` to `R1D`). Returns `unknown` when the zone is null (outside the
 * City) or no rule covers it.
 */
/**
 * The matrix row used for a parcel district: exact code first, then the
 * family prefix (e.g. `R1D-L` falls back to `R1D`). Null when the zone is
 * empty or no row covers it.
 */
export function findZoningRule(
  matrix: ZoningMatrix | null,
  zone: string | null | undefined,
  type: TypeId,
): ZoningRule | null {
  if (!matrix || zone == null || zone.trim() === '') return null
  const wanted = normalizeDistrict(zone)
  const rulesForType = matrix.rules.filter((rule) => rule.type === type)
  const exact = rulesForType.find(
    (rule) => normalizeDistrict(rule.district) === wanted,
  )
  if (exact) return exact

  const segments = wanted.split('-')
  for (let length = segments.length - 1; length >= 1; length -= 1) {
    const prefix = segments.slice(0, length).join('-')
    const family = rulesForType.find(
      (rule) => normalizeDistrict(rule.district) === prefix,
    )
    if (family) return family
  }

  return (
    rulesForType
      .filter((rule) => wanted.startsWith(normalizeDistrict(rule.district)))
      .sort((left, right) => right.district.length - left.district.length)[0] ??
    null
  )
}

export function matrixLookup(
  matrix: ZoningMatrix | null,
  zone: string | null | undefined,
  type: TypeId,
): ZoningStatus {
  return findZoningRule(matrix, zone, type)?.status ?? 'unknown'
}

/** Memoizing wrapper over `matrixLookup` for per-parcel accessors. */
export function createLookupAllowed(matrix: ZoningMatrix | null): LookupAllowed {
  const cache = new Map<string, ZoningStatus>()
  return (zone, type) => {
    const key = `${zone ?? ''}|${type}`
    const cached = cache.get(key)
    if (cached) return cached
    const status = matrixLookup(matrix, zone, type)
    cache.set(key, status)
    return status
  }
}

export interface Snapshot {
  manifest: DataManifest
  areas: AreaRecord[]
  areasById: Map<string, AreaRecord>
  summaries: SummaryArea[]
  summariesById: Map<string, SummaryArea>
  zoningMatrix: ZoningMatrix
  lookupAllowed: LookupAllowed
}

export function buildSnapshot(
  manifest: DataManifest,
  metrics: AreaMetricsFile,
  zoningMatrix: ZoningMatrix,
): Snapshot {
  applyLenientNeedBands(metrics.areas)
  applyLenientFitBands(metrics.areas)
  const areasById = new Map(metrics.areas.map((area) => [area.id, area]))
  if (areasById.size !== metrics.areas.length) {
    throw new DataLoadError(
      DATA_PATHS.areaMetrics,
      'schema',
      'duplicate tract GEOIDs in areas',
    )
  }
  const summariesById = new Map(
    metrics.summaries.map((summary) => [summary.id, summary]),
  )
  if (summariesById.size !== metrics.summaries.length) {
    throw new DataLoadError(
      DATA_PATHS.areaMetrics,
      'schema',
      'duplicate summary ids in summaries',
    )
  }
  return {
    manifest,
    areas: metrics.areas,
    areasById,
    summaries: metrics.summaries,
    summariesById,
    zoningMatrix,
    lookupAllowed: createLookupAllowed(zoningMatrix),
  }
}

/**
 * Loads the three core files in parallel. Any failure rejects with a
 * `DataLoadError` naming the file; nothing is substituted.
 */
export async function loadSnapshot(fetchImpl?: FetchLike): Promise<Snapshot> {
  const [manifest, metrics, zoningMatrix] = await Promise.all([
    fetchValidated(DATA_PATHS.manifest, manifestSchema, fetchImpl),
    fetchValidated(DATA_PATHS.areaMetrics, areaMetricsSchema, fetchImpl),
    fetchValidated(DATA_PATHS.zoningMatrix, zoningMatrixSchema, fetchImpl),
  ])
  return buildSnapshot(manifest, metrics, zoningMatrix)
}
