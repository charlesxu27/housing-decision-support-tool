import { describe, expect, it } from 'vitest'
import {
  buildArea,
  buildAreaMetrics,
  buildManifest,
  buildZoningMatrix,
  mockSnapshotFetch,
} from '../test/builders'
import {
  DataLoadError,
  createLookupAllowed,
  loadGeoJson,
  loadSnapshot,
  matrixLookup,
  summaryAreaProperties,
} from './load'

describe('loadSnapshot', () => {
  it('loads and indexes a valid snapshot', async () => {
    const snapshot = await loadSnapshot(mockSnapshotFetch())

    expect(snapshot.areas).toHaveLength(1)
    expect(snapshot.areasById.get('42003130700')?.name).toBe('Tract 1307')
    expect(snapshot.summariesById.get('hood:homewood-north')?.label).toBe(
      'Homewood North',
    )
    expect(snapshot.manifest.coverage.acsVintage).toBe('2020-2024')
    expect(snapshot.lookupAllowed('R1D-L', 'adu')).toBe('by_right')
  })

  it('rejects a malformed manifest and names the file', async () => {
    const manifest = { ...buildManifest(), schemaVersion: 2 }
    const failure = await loadSnapshot(
      mockSnapshotFetch({ '/data/manifest.json': manifest }),
    ).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(DataLoadError)
    const loadError = failure as DataLoadError
    expect(loadError.file).toBe('/data/manifest.json')
    expect(loadError.kind).toBe('schema')
    expect(loadError.reason).toContain('schemaVersion')
  })

  it('rejects an area file with a substituted default instead of null', async () => {
    const area = buildArea()
    const broken = {
      ...buildAreaMetrics(),
      areas: [
        {
          ...area,
          households: { ...area.households, cost_burdened_renters: 'n/a' },
        },
      ],
    }
    const failure = await loadSnapshot(
      mockSnapshotFetch({ '/data/area_metrics.json': broken }),
    ).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(DataLoadError)
    expect((failure as DataLoadError).file).toBe('/data/area_metrics.json')
    expect((failure as DataLoadError).reason).toContain(
      'households.cost_burdened_renters',
    )
  })

  it('rejects an area record missing a housing type', async () => {
    const area = buildArea()
    const { adu: _adu, ...partialNeed } = area.need
    const broken = { ...buildAreaMetrics(), areas: [{ ...area, need: partialNeed }] }
    const failure = await loadSnapshot(
      mockSnapshotFetch({ '/data/area_metrics.json': broken }),
    ).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(DataLoadError)
    expect((failure as DataLoadError).reason).toContain('need')
  })

  it('reports HTTP failures with the failing path', async () => {
    const failure = await loadSnapshot(
      mockSnapshotFetch({ '/data/zoning_matrix.json': undefined }),
    ).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(DataLoadError)
    expect((failure as DataLoadError).file).toBe('/data/zoning_matrix.json')
    expect((failure as DataLoadError).kind).toBe('http')
    expect((failure as DataLoadError).message).toContain('404')
  })

  it('rejects duplicate tract ids', async () => {
    const broken = { ...buildAreaMetrics(), areas: [buildArea(), buildArea()] }
    const failure = await loadSnapshot(
      mockSnapshotFetch({ '/data/area_metrics.json': broken }),
    ).catch((error: unknown) => error)

    expect((failure as DataLoadError).reason).toContain('duplicate')
  })
})

describe('loadGeoJson', () => {
  it('validates feature properties against the contract', async () => {
    const fetchImpl = mockSnapshotFetch({
      '/data/municipalities.geojson': {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
            properties: { id: 'muni:x', kind: 'municipality', label: 'X' },
          },
        ],
      },
    })
    const failure = await loadGeoJson(
      '/data/municipalities.geojson',
      summaryAreaProperties,
      fetchImpl,
    ).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(DataLoadError)
    expect((failure as DataLoadError).reason).toContain('municipality')
  })
})

describe('matrixLookup', () => {
  const matrix = buildZoningMatrix()

  it('resolves an exact district first', () => {
    expect(matrixLookup(matrix, 'R1D-L', 'duplex_triplex')).toBe(
      'special_exception',
    )
  })

  it('falls back to the family prefix', () => {
    expect(matrixLookup(matrix, 'R1D-L', 'adu')).toBe('by_right')
    expect(matrixLookup(matrix, 'R1D-VL', 'duplex_triplex')).toBe('not_permitted')
  })

  it('returns unknown outside the City and for unlisted districts', () => {
    expect(matrixLookup(matrix, null, 'adu')).toBe('unknown')
    expect(matrixLookup(matrix, '', 'adu')).toBe('unknown')
    expect(matrixLookup(matrix, 'GI', 'adu')).toBe('unknown')
    expect(matrixLookup(matrix, 'LNC', 'adu')).toBe('unknown')
    expect(matrixLookup(null, 'R1D', 'adu')).toBe('unknown')
  })

  it('memoizes lookups without changing results', () => {
    const lookup = createLookupAllowed(matrix)
    expect(lookup('lnc', 'small_apartment')).toBe('by_right')
    expect(lookup('lnc', 'small_apartment')).toBe('by_right')
    expect(lookup(null, 'small_apartment')).toBe('unknown')
  })
})
