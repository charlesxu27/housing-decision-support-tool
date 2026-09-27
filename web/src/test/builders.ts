/**
 * Small synthetic records for tests only. Production code must never import
 * this module; the app renders exclusively from the loaded snapshot.
 */
import {
  TYPE_IDS,
  type AreaMetricsFile,
  type AreaRecord,
  type Band,
  type DataManifest,
  type FitResult,
  type ParcelTileProperties,
  type SummaryArea,
  type TypeId,
  type ZoningMatrix,
  type ZoningStatus,
} from '../data/types'

export function typeRecord<T>(
  fallback: T,
  overrides: Partial<Record<TypeId, T>> = {},
): Record<TypeId, T> {
  return Object.fromEntries(
    TYPE_IDS.map((type) => [type, type in overrides ? overrides[type] : fallback]),
  ) as Record<TypeId, T>
}

type DeepPartialArea = Partial<
  Omit<
    AreaRecord,
    | 'need'
    | 'needScores'
    | 'fit'
    | 'allowed'
    | 'allowedShares'
    | 'risk'
    | 'households'
    | 'stock'
    | 'opportunity'
  >
> & {
  need?: Partial<Record<TypeId, Band>>
  needScores?: Partial<Record<TypeId, number | null>>
  fit?: Partial<Record<TypeId, FitResult>>
  allowed?: Partial<Record<TypeId, ZoningStatus>>
  allowedShares?: Partial<Record<TypeId, Partial<Record<ZoningStatus, number>>>>
  risk?: Partial<AreaRecord['risk']>
  households?: Partial<AreaRecord['households']>
  stock?: Partial<AreaRecord['stock']>
  opportunity?: Partial<AreaRecord['opportunity']>
}

export function buildArea(overrides: DeepPartialArea = {}): AreaRecord {
  const inCity = overrides.inCity ?? true
  const defaultFit: FitResult = { band: 'high', parcels: 24, homes: [24, 48] }
  return {
    id: '42003130700',
    kind: 'tract',
    name: 'Tract 1307',
    muni: inCity ? 'Pittsburgh' : 'Wilkinsburg',
    munis: [inCity ? 'Pittsburgh' : 'Wilkinsburg'],
    inCity,
    neighborhood: inCity ? 'Homewood North' : null,
    neighborhoods: inCity ? ['Homewood North'] : [],
    centroid: [-79.8957, 40.4571],
    moeFlags: [],
    zoningDistricts: inCity ? ['R1D-L', 'LNC'] : [],
    carbon: { vmtPerHh: null },
    transitTrips800m: 1_940,
    parcels: { total: 1_200, residential: 980, vacant: 140, rehabCandidates: 60 },
    confidence: 0.86,
    ...overrides,
    households: {
      total: 1_450,
      hh_1_2: 0.61,
      hh_5_plus: 0.08,
      senior_alone: 0.16,
      cost_burdened_renters: 0.43,
      overcrowded: 0.02,
      renter_share: 0.55,
      ...overrides.households,
    },
    stock: {
      total_units: 1_700,
      br_0_1: 0.19,
      br_2: 0.4,
      br_3_plus: 0.36,
      units_1_detached: 0.45,
      units_1_attached: 0.2,
      units_2_to_4: 0.17,
      units_5_to_19: 0.06,
      units_20_plus: 0.12,
      vacant_share: 0.15,
      other_vacant_share: 0.09,
      ...overrides.stock,
    },
    need: typeRecord<Band>('medium', overrides.need),
    needScores: typeRecord<number | null>(0.5, overrides.needScores),
    fit: typeRecord<FitResult>(defaultFit, overrides.fit),
    allowed: typeRecord<ZoningStatus>(inCity ? 'by_right' : 'unknown', overrides.allowed),
    allowedShares: typeRecord<Partial<Record<ZoningStatus, number>>>(
      inCity ? { by_right: 1 } : { unknown: 1 },
      overrides.allowedShares,
    ),
    risk: {
      displacement: 0.6,
      floodShare: 0.02,
      floodwayShare: 0,
      floodway: false,
      slopeShare: inCity ? 0.04 : null,
      undermined: 0.3,
      ...overrides.risk,
    },
    opportunity: {
      medianHouseholdIncome: 41_200,
      countyMedianHouseholdIncome: 78_548,
      schoolDistrict: 'Pittsburgh School District',
      schoolDistrictShare: 1,
      districtProficient: 0.36,
      mathProficient: 0.71,
      elaProficient: 0.78,
      schools: [
        {
          level: 'elementary',
          name: 'Pittsburgh Colfax K-8',
          mathProficient: 0.71,
          elaProficient: 0.78,
          basis: 'attendance_zone',
          coverage: 1,
          distanceMiles: null,
        },
        {
          level: 'middle',
          name: 'Pittsburgh Sterrett 6-8',
          mathProficient: 0.46,
          elaProficient: 0.62,
          basis: 'attendance_zone',
          coverage: 0.88,
          distanceMiles: null,
        },
        {
          level: 'high',
          name: 'Pittsburgh Allderdice HS',
          mathProficient: 0.54,
          elaProficient: 0.69,
          basis: 'attendance_zone',
          coverage: 1,
          distanceMiles: null,
        },
      ],
      ...overrides.opportunity,
    },
  }
}

export function buildSummary(overrides: Partial<SummaryArea> = {}): SummaryArea {
  return {
    id: 'hood:homewood-north',
    kind: 'neighborhood',
    label: 'Homewood North',
    municipality: 'Pittsburgh',
    members: [{ id: '42003130700', weight: 1_200 }],
    parcels: 1_200,
    centroid: [-79.8957, 40.4571],
    bbox: [-79.91, 40.45, -79.88, 40.465],
    ...overrides,
  }
}

export function buildZoningMatrix(
  overrides: Partial<ZoningMatrix> = {},
): ZoningMatrix {
  return {
    schemaVersion: 1,
    muni: 'Pittsburgh',
    source: 'pipeline/zoning/pittsburgh_matrix.csv',
    verificationStatus: 'draft',
    districts: ['R1D', 'R1D-L', 'LNC'],
    rules: [
      {
        muni: 'Pittsburgh',
        district: 'R1D',
        type: 'adu',
        status: 'by_right',
        minLotSqft: 5_000,
        section: '911.02',
        quote: 'Accessory dwelling unit: P',
        verifiedBy: null,
        verifiedAt: null,
      },
      {
        muni: 'Pittsburgh',
        district: 'R1D',
        type: 'duplex_triplex',
        status: 'not_permitted',
        minLotSqft: null,
        section: '911.02',
        quote: 'Two-unit residential: N',
        verifiedBy: null,
        verifiedAt: null,
      },
      {
        muni: 'Pittsburgh',
        district: 'R1D-L',
        type: 'duplex_triplex',
        status: 'special_exception',
        minLotSqft: null,
        section: '911.02',
        quote: 'Two-unit residential: S',
        verifiedBy: null,
        verifiedAt: null,
      },
      {
        muni: 'Pittsburgh',
        district: 'LNC',
        type: 'small_apartment',
        status: 'by_right',
        minLotSqft: null,
        section: '911.02',
        quote: 'Multi-unit residential: P',
        verifiedBy: null,
        verifiedAt: null,
      },
    ],
    ...overrides,
  }
}

export function buildManifest(overrides: Partial<DataManifest> = {}): DataManifest {
  return {
    schemaVersion: 1,
    builtAt: '2026-09-27T14:00:00Z',
    modelVersion: '1.0.0',
    configHash: 'abc123',
    coverage: {
      county: 'Allegheny County, PA',
      tractVintage: '2024',
      acsVintage: '2020-2024',
      zoningMunicipalities: ['Pittsburgh'],
    },
    files: {
      area_metrics: {
        path: 'area_metrics.json',
        bytes: 1_024,
        sha256: 'deadbeef',
        rows: 1,
      },
    },
    sources: [
      {
        id: 'acs5',
        title: 'ACS 5-year 2020-2024 summary file',
        publisher: 'U.S. Census Bureau',
        catalogUrl: 'https://example.org/catalog/acs',
        resourceUrl: 'https://example.org/acs',
        geography: 'tract',
        vintage: '2020-2024',
        retrievedAt: '2026-09-20',
        sha256: null,
        license: 'Public domain',
        fieldsRetained: ['B11016', 'B25041'],
        notes: '',
        available: true,
      },
      {
        id: 'chas',
        title: 'HUD CHAS 2018-2022 tract tables',
        publisher: 'HUD',
        catalogUrl: 'https://example.org/catalog/chas',
        resourceUrl: 'https://example.org/chas',
        geography: 'tract',
        vintage: '2018-2022',
        retrievedAt: '',
        sha256: null,
        license: 'Public domain',
        fieldsRetained: [],
        notes: 'Not supplied; cost burden falls back to ACS.',
        available: false,
      },
    ],
    nullCoverage: { 'households.cost_burdened_renters': 0.02 },
    counts: { tracts: 1, municipalities: 1, neighborhoods: 1, parcels: 1_200 },
    parcelTiles: {
      urlTemplate: '/data/tiles/parcels/{z}/{x}/{y}.pbf',
      layer: 'parcels',
      minZoom: 13,
      maxZoom: 16,
    },
    ...overrides,
  }
}

export function buildAreaMetrics(
  overrides: Partial<AreaMetricsFile> = {},
): AreaMetricsFile {
  return {
    schemaVersion: 1,
    builtAt: '2026-09-27T14:00:00Z',
    areas: [buildArea()],
    summaries: [buildSummary()],
    ...overrides,
  }
}

export function buildParcel(
  overrides: Partial<ParcelTileProperties> = {},
): ParcelTileProperties {
  return {
    pin: '0125N00120000000',
    tract: '42003130700',
    muni: 'Pittsburgh',
    hood: 'Homewood North',
    lot: 5_400,
    use: 'sf_detached',
    zone: 'R1D-L',
    bldg: 1,
    flood: 0,
    floodway: 0,
    slope: 0,
    mine: 0,
    rehab: 0,
    f_adu: 1,
    f_duplex_triplex: 1,
    f_townhome: 0,
    f_small_apartment: 0,
    f_large_apartment: 0,
    f_senior_accessible: 0,
    f_rehab_reuse: 0,
    f_detached_sf: 0,
    ...overrides,
  }
}

/** A `fetch` stand-in serving the three core snapshot files. */
export function mockSnapshotFetch(
  files: Partial<Record<string, unknown>> = {},
): (input: string) => Promise<Response> {
  const defaults: Record<string, unknown> = {
    '/data/manifest.json': buildManifest(),
    '/data/area_metrics.json': buildAreaMetrics(),
    '/data/zoning_matrix.json': buildZoningMatrix(),
  }
  const table = { ...defaults, ...files }
  return async (input: string) => {
    if (table[input] === undefined) {
      return new Response('not found', { status: 404, statusText: 'Not Found' })
    }
    return new Response(JSON.stringify(table[input]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
