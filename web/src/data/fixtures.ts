import { cellToBoundary } from 'h3-js'
import type {
  Band,
  FitResult,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  GeoJsonPolygonGeometry,
  GeoJsonPosition,
  HexRecord,
  IllustrativeParcelProperties,
  PlanningAreaProperties,
  SummaryAreaProperties,
  TypeId,
  ZoningStatus,
} from './types'
import { TYPE_IDS } from './types'

export const FIXTURE_DATA_NOTICE =
  'Illustrative local MVP fixture data. Values are plausible examples, not authoritative findings and not suitable for planning or zoning decisions.'

function typeRecord<T>(
  fallback: T,
  overrides: Partial<Record<TypeId, T>> = {},
): Record<TypeId, T> {
  return Object.fromEntries(
    TYPE_IDS.map((type) => [type, overrides[type] ?? fallback]),
  ) as Record<TypeId, T>
}

function needs(
  overrides: Partial<Record<TypeId, Band>> = {},
): Record<TypeId, Band> {
  return typeRecord<Band>('medium', overrides)
}

function allowances(
  fallback: ZoningStatus,
  overrides: Partial<Record<TypeId, ZoningStatus>> = {},
): Record<TypeId, ZoningStatus> {
  return typeRecord(fallback, overrides)
}

function fit(
  parcelScale: number,
  overrides: Partial<Record<TypeId, FitResult>> = {},
): Record<TypeId, FitResult> {
  const parcelCount = Math.max(1, Math.round(12 * parcelScale))
  const defaults: Record<TypeId, FitResult> = {
    adu: { band: 'high', parcels: parcelCount + 10, homes: [parcelCount, parcelCount + 10] },
    duplex_triplex: { band: 'high', parcels: parcelCount, homes: [parcelCount * 2, parcelCount * 3] },
    townhome: { band: 'medium', parcels: Math.round(parcelCount * 0.7), homes: [8, 24] },
    small_apartment: { band: 'medium', parcels: Math.round(parcelCount * 0.45), homes: [12, 48] },
    large_apartment: { band: 'low', parcels: Math.round(parcelCount * 0.12), homes: [0, 40] },
    senior_accessible: { band: 'medium', parcels: Math.round(parcelCount * 0.35), homes: [12, 36] },
    rehab_reuse: { band: 'high', parcels: Math.round(parcelCount * 0.8), homes: [8, 22] },
    detached_sf: { band: 'medium', parcels: Math.round(parcelCount * 0.65), homes: [5, 12] },
  }

  return { ...defaults, ...overrides }
}

type FixtureHexInput = Omit<HexRecord, 'households' | 'stock' | 'moeFlags' | 'carbon'> & {
  households?: Record<string, number>
  stock?: Record<string, number>
  moeFlags?: string[]
  carbon?: HexRecord['carbon']
}

function fixtureHex(input: FixtureHexInput): HexRecord {
  return {
    ...input,
    households: {
      hh_1_2: 0.61,
      hh_5_plus: 0.08,
      senior_alone: 0.16,
      cost_burdened_renters: 0.43,
      ...input.households,
    },
    stock: {
      br_0_1: 0.19,
      br_3_plus: 0.36,
      units_2_to_4: 0.17,
      units_20_plus: 0.12,
      ...input.stock,
    },
    moeFlags: input.moeFlags ?? [],
    carbon: input.carbon ?? { vmtPerHh: 12_500 },
  }
}

/**
 * H3 indexes are real resolution-8 cells. All demographic, parcel, zoning,
 * hazard, transit, and carbon values below are explicitly illustrative.
 */
export const ILLUSTRATIVE_HEXES: readonly HexRecord[] = [
  fixtureHex({
    h3: '882a847267fffff',
    muni: 'Pittsburgh',
    inCity: true,
    neighborhood: 'Homewood North',
    tract: '42003130700',
    need: needs({ adu: 'high', duplex_triplex: 'high', rehab_reuse: 'high' }),
    fit: fit(1.25),
    allowed: allowances('by_right', {
      large_apartment: 'conditional_use',
      townhome: 'special_exception',
    }),
    risk: {
      displacement: 0.68,
      floodShare: 0.01,
      floodway: false,
      slopeShare: 0.04,
      undermined: 0.31,
    },
    transitTrips800m: 1_940,
    confidence: 0.86,
  }),
  fixtureHex({
    h3: '882a847221fffff',
    muni: 'Pittsburgh',
    inCity: true,
    neighborhood: 'Homewood South',
    tract: '42003141200',
    households: { hh_1_2: 0.64, cost_burdened_renters: 0.49 },
    stock: { br_0_1: 0.16, units_2_to_4: 0.21 },
    need: needs({ duplex_triplex: 'high', small_apartment: 'high', rehab_reuse: 'high' }),
    fit: fit(1.5),
    allowed: allowances('special_exception', {
      adu: 'by_right',
      large_apartment: 'conditional_use',
      detached_sf: 'by_right',
    }),
    risk: {
      displacement: 0.72,
      floodShare: 0,
      floodway: false,
      slopeShare: 0.03,
      undermined: 0.27,
    },
    transitTrips800m: 2_180,
    confidence: 0.84,
  }),
  fixtureHex({
    h3: '882a847225fffff',
    muni: 'Pittsburgh',
    inCity: true,
    neighborhood: 'Point Breeze North',
    tract: '42003140400',
    households: { hh_1_2: 0.49, cost_burdened_renters: 0.23 },
    stock: { br_0_1: 0.31, br_3_plus: 0.29 },
    need: needs({ duplex_triplex: 'low', townhome: 'low', detached_sf: 'low' }),
    fit: fit(0.75),
    allowed: allowances('by_right', { large_apartment: 'not_permitted' }),
    risk: {
      displacement: 0.46,
      floodShare: 0,
      floodway: false,
      slopeShare: 0.08,
      undermined: 0.12,
    },
    transitTrips800m: 1_220,
    confidence: 0.91,
  }),
  fixtureHex({
    h3: '882a847357fffff',
    muni: 'Pittsburgh',
    inCity: true,
    neighborhood: 'East Liberty',
    tract: '42003111500',
    households: { hh_1_2: 0.7, cost_burdened_renters: 0.4 },
    stock: { br_0_1: 0.37, units_20_plus: 0.34 },
    need: needs({ duplex_triplex: 'high', senior_accessible: 'high' }),
    fit: fit(0.85),
    allowed: allowances('not_permitted', {
      small_apartment: 'by_right',
      large_apartment: 'by_right',
      senior_accessible: 'conditional_use',
    }),
    risk: {
      displacement: 0.82,
      floodShare: 0,
      floodway: false,
      slopeShare: 0.02,
      undermined: 0.08,
    },
    transitTrips800m: 4_860,
    confidence: 0.9,
  }),
  fixtureHex({
    h3: '882a84735bfffff',
    muni: 'Pittsburgh',
    inCity: true,
    neighborhood: 'Larimer',
    tract: '42003120900',
    need: needs({ duplex_triplex: 'high', townhome: 'high', rehab_reuse: 'high' }),
    fit: fit(0.65, {
      duplex_triplex: { band: 'low', parcels: 2, homes: [4, 6] },
      townhome: { band: 'low', parcels: 1, homes: [4, 8] },
    }),
    allowed: allowances('by_right', { large_apartment: 'conditional_use' }),
    risk: {
      displacement: 0.76,
      floodShare: 0.03,
      floodway: false,
      slopeShare: 0.18,
      undermined: 0.42,
    },
    transitTrips800m: 2_730,
    confidence: 0.79,
  }),
  fixtureHex({
    h3: '882a84722bfffff',
    muni: 'Wilkinsburg',
    inCity: false,
    neighborhood: 'Wilkinsburg West',
    tract: '42003560400',
    need: needs({ duplex_triplex: 'high', rehab_reuse: 'high', senior_accessible: 'high' }),
    fit: fit(1.15),
    allowed: allowances('unknown'),
    risk: {
      displacement: 0.61,
      floodShare: 0,
      floodway: false,
      slopeShare: null,
      undermined: 0.36,
    },
    transitTrips800m: 2_420,
    confidence: 0.7,
  }),
  fixtureHex({
    h3: '882a847207fffff',
    muni: 'Wilkinsburg',
    inCity: false,
    neighborhood: 'Wilkinsburg Central',
    tract: '42003564800',
    households: { senior_alone: 0.21, cost_burdened_renters: 0.51 },
    need: needs({ duplex_triplex: 'high', senior_accessible: 'high', rehab_reuse: 'high' }),
    fit: fit(1.4),
    allowed: allowances('unknown'),
    risk: {
      displacement: 0.67,
      floodShare: 0,
      floodway: false,
      slopeShare: null,
      undermined: 0.29,
    },
    transitTrips800m: 3_180,
    confidence: 0.68,
    moeFlags: ['senior_alone'],
  }),
  fixtureHex({
    h3: '882a847203fffff',
    muni: 'Wilkinsburg',
    inCity: false,
    neighborhood: 'Wilkinsburg East',
    tract: '42003561400',
    need: needs({ duplex_triplex: 'uncertain', rehab_reuse: 'high' }),
    fit: fit(0.95),
    allowed: allowances('unknown'),
    risk: {
      displacement: 0.54,
      floodShare: 0.02,
      floodway: false,
      slopeShare: null,
      undermined: 0.22,
    },
    transitTrips800m: 1_640,
    confidence: 0.62,
    moeFlags: ['hh_1_2', 'cost_burdened_renters'],
  }),
  fixtureHex({
    h3: '882a847233fffff',
    muni: 'Swissvale',
    inCity: false,
    neighborhood: 'Swissvale',
    tract: '42003515200',
    need: needs({ townhome: 'high', small_apartment: 'high' }),
    fit: fit(0.8),
    allowed: allowances('unknown'),
    risk: {
      displacement: 0.43,
      floodShare: 0.05,
      floodway: false,
      slopeShare: null,
      undermined: 0.18,
    },
    transitTrips800m: 1_370,
    confidence: 0.67,
  }),
  fixtureHex({
    h3: '882a847005fffff',
    muni: 'Pittsburgh',
    inCity: true,
    neighborhood: 'Hazelwood',
    tract: '42003562300',
    need: needs({ duplex_triplex: 'high', townhome: 'high', rehab_reuse: 'high' }),
    fit: fit(1.1),
    allowed: allowances('by_right', { large_apartment: 'conditional_use' }),
    risk: {
      displacement: 0.58,
      floodShare: 0.71,
      floodway: true,
      slopeShare: 0.11,
      undermined: 0.09,
    },
    transitTrips800m: 620,
    confidence: 0.82,
    carbon: { vmtPerHh: 14_900 },
  }),
] as const

export const FIXTURE_DATASET = {
  kind: 'illustrative_fixture',
  authoritative: false,
  notice: FIXTURE_DATA_NOTICE,
  geography: 'Homewood, Wilkinsburg, and nearby Pittsburgh-area places',
  hexResolution: 8,
  hexes: ILLUSTRATIVE_HEXES,
} as const

export const ILLUSTRATIVE_GEOMETRY_NOTICE =
  'Illustrative generalized fixture geometry derived from H3 cells; not cadastral, surveyed, legal, official, or authoritative.'

const ILLUSTRATIVE_GEOMETRY_METADATA = {
  authoritative: false,
  geometryStatus: 'illustrative_not_cadastral',
  geometryNotice: ILLUSTRATIVE_GEOMETRY_NOTICE,
} as const

function h3Boundary(h3: string): GeoJsonPosition[] {
  const points = cellToBoundary(h3, true).map(
    ([longitude, latitude]) => [longitude, latitude] as const,
  )

  if (
    points.length > 1 &&
    points[0][0] === points.at(-1)?.[0] &&
    points[0][1] === points.at(-1)?.[1]
  ) {
    points.pop()
  }

  return points
}

function cross(
  origin: GeoJsonPosition,
  a: GeoJsonPosition,
  b: GeoJsonPosition,
): number {
  return (
    (a[0] - origin[0]) * (b[1] - origin[1]) -
    (a[1] - origin[1]) * (b[0] - origin[0])
  )
}

/**
 * A deterministic convex envelope is sufficient for these generalized
 * fixtures and avoids implying the precision of an administrative boundary.
 */
function convexHull(points: readonly GeoJsonPosition[]): GeoJsonPosition[] {
  const unique = [
    ...new Map(points.map((point) => [`${point[0]},${point[1]}`, point])).values(),
  ].sort((a, b) => a[0] - b[0] || a[1] - b[1])

  if (unique.length <= 3) {
    return unique
  }

  const lower: GeoJsonPosition[] = []
  for (const point of unique) {
    while (
      lower.length >= 2 &&
      cross(lower.at(-2)!, lower.at(-1)!, point) <= 0
    ) {
      lower.pop()
    }
    lower.push(point)
  }

  const upper: GeoJsonPosition[] = []
  for (const point of [...unique].reverse()) {
    while (
      upper.length >= 2 &&
      cross(upper.at(-2)!, upper.at(-1)!, point) <= 0
    ) {
      upper.pop()
    }
    upper.push(point)
  }

  lower.pop()
  upper.pop()
  return [...lower, ...upper]
}

function closedPolygon(points: readonly GeoJsonPosition[]): GeoJsonPolygonGeometry {
  if (points.length < 3) {
    throw new Error('An illustrative polygon requires at least three positions.')
  }

  return {
    type: 'Polygon',
    coordinates: [[...points, points[0]]],
  }
}

function envelopeForHexes(h3s: readonly string[]): GeoJsonPolygonGeometry {
  return closedPolygon(convexHull(h3s.flatMap(h3Boundary)))
}

function feature<
  Properties extends Record<string, unknown>,
>(
  id: string,
  geometry: GeoJsonPolygonGeometry,
  properties: Properties,
): GeoJsonFeature<Properties> {
  return {
    type: 'Feature',
    id,
    geometry,
    properties,
  }
}

function slug(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-|-$/g, '')
}

function groupHexes(
  keyForHex: (hex: HexRecord) => string,
): Map<string, HexRecord[]> {
  const groups = new Map<string, HexRecord[]>()

  for (const hex of ILLUSTRATIVE_HEXES) {
    const key = keyForHex(hex)
    groups.set(key, [...(groups.get(key) ?? []), hex])
  }

  return groups
}

const neighborhoodSummaryFeatures = [
  ...groupHexes((hex) => `${hex.muni}::${hex.neighborhood ?? hex.tract}`),
].map(([groupKey, hexes]) => {
  const first = hexes[0]
  const label = first.neighborhood ?? `Tract ${first.tract}`
  const areaId = `neighborhood-${slug(groupKey)}`
  const properties: SummaryAreaProperties = {
    ...ILLUSTRATIVE_GEOMETRY_METADATA,
    kind: 'summary_area',
    summaryLevel: 'neighborhood',
    areaId,
    label,
    municipality: first.muni,
    parentH3s: hexes.map((hex) => hex.h3),
  }
  return feature(areaId, envelopeForHexes(properties.parentH3s), properties)
})

const municipalitySummaryFeatures = [
  ...groupHexes((hex) => hex.muni),
].map(([municipality, hexes]) => {
  const areaId = `municipality-${slug(municipality)}`
  const properties: SummaryAreaProperties = {
    ...ILLUSTRATIVE_GEOMETRY_METADATA,
    kind: 'summary_area',
    summaryLevel: 'municipality',
    areaId,
    label: municipality,
    municipality,
    parentH3s: hexes.map((hex) => hex.h3),
  }
  return feature(areaId, envelopeForHexes(properties.parentH3s), properties)
})

/**
 * Small-scale summary geography. Boundaries are generalized envelopes of the
 * fixture cells, not real neighborhood or municipal boundaries.
 */
export const ILLUSTRATIVE_SUMMARY_AREAS: GeoJsonFeatureCollection<SummaryAreaProperties> = {
  type: 'FeatureCollection',
  features: [...neighborhoodSummaryFeatures, ...municipalitySummaryFeatures],
}

const PLANNING_AREA_GROUPS = [
  {
    id: 'greater-homewood',
    label: 'Greater Homewood fixture area',
    parentH3s: ['882a847267fffff', '882a847221fffff'],
  },
  {
    id: 'east-end',
    label: 'East End fixture area',
    parentH3s: ['882a847225fffff', '882a847357fffff', '882a84735bfffff'],
  },
  {
    id: 'wilkinsburg',
    label: 'Wilkinsburg fixture area',
    parentH3s: ['882a84722bfffff', '882a847207fffff', '882a847203fffff'],
  },
  {
    id: 'swissvale',
    label: 'Swissvale fixture area',
    parentH3s: ['882a847233fffff'],
  },
  {
    id: 'hazelwood',
    label: 'Hazelwood fixture area',
    parentH3s: ['882a847005fffff'],
  },
] as const

/**
 * Medium-scale illustrative planning areas. These group fixture cells for
 * display only and do not represent adopted planning-area boundaries.
 */
export const ILLUSTRATIVE_PLANNING_AREAS: GeoJsonFeatureCollection<PlanningAreaProperties> = {
  type: 'FeatureCollection',
  features: PLANNING_AREA_GROUPS.map((group) => {
    const parentRecords = group.parentH3s.map((h3) => {
      const record = ILLUSTRATIVE_HEXES.find((hex) => hex.h3 === h3)
      if (!record) {
        throw new Error(`Missing fixture parent H3 ${h3}.`)
      }
      return record
    })
    const properties: PlanningAreaProperties = {
      ...ILLUSTRATIVE_GEOMETRY_METADATA,
      kind: 'planning_area',
      planningAreaId: group.id,
      label: group.label,
      municipalities: [...new Set(parentRecords.map((hex) => hex.muni))],
      parentH3s: group.parentH3s,
    }
    return feature(
      `planning-area-${group.id}`,
      envelopeForHexes(group.parentH3s),
      properties,
    )
  }),
}

function interpolate(
  from: GeoJsonPosition,
  to: GeoJsonPosition,
  amount: number,
): GeoJsonPosition {
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
  ]
}

function centroid(points: readonly GeoJsonPosition[]): GeoJsonPosition {
  const totals = points.reduce(
    (sum, point) => [sum[0] + point[0], sum[1] + point[1]] as GeoJsonPosition,
    [0, 0] as GeoJsonPosition,
  )
  return [totals[0] / points.length, totals[1] / points.length]
}

export const ILLUSTRATIVE_PARCELS_PER_CELL = 6

/**
 * Large-scale parcel-like geometry. The deterministic inset wedges are useful
 * for interaction demos but are explicitly not cadastral parcel boundaries.
 */
export const ILLUSTRATIVE_PARCELS: GeoJsonFeatureCollection<IllustrativeParcelProperties> = {
  type: 'FeatureCollection',
  features: ILLUSTRATIVE_HEXES.flatMap((hex) => {
    const boundary = h3Boundary(hex.h3)
    const center = centroid(boundary)

    return Array.from({ length: ILLUSTRATIVE_PARCELS_PER_CELL }, (_, index) => {
      const start = boundary[index % boundary.length]
      const end = boundary[(index + 1) % boundary.length]
      const ordinal = index + 1
      const parcelId = `${hex.h3}-parcel-${String(ordinal).padStart(2, '0')}`
      const properties: IllustrativeParcelProperties = {
        ...ILLUSTRATIVE_GEOMETRY_METADATA,
        kind: 'illustrative_parcel',
        parcelId,
        parentH3: hex.h3,
        parentMunicipality: hex.muni,
        parentNeighborhood: hex.neighborhood ?? null,
        parentTract: hex.tract,
        fixtureOrdinal: ordinal,
      }
      const parcelRing = [
        interpolate(center, start, 0.2),
        interpolate(center, start, 0.62),
        interpolate(center, end, 0.62),
        interpolate(center, end, 0.2),
      ]

      return feature(parcelId, closedPolygon(parcelRing), properties)
    })
  }),
}

export const ILLUSTRATIVE_MULTISCALE_GEOGRAPHY = {
  kind: 'illustrative_multiscale_geography',
  authoritative: false,
  notice: ILLUSTRATIVE_GEOMETRY_NOTICE,
  summaryAreas: ILLUSTRATIVE_SUMMARY_AREAS,
  planningAreas: ILLUSTRATIVE_PLANNING_AREAS,
  parcels: ILLUSTRATIVE_PARCELS,
} as const
