import { describe, expect, it } from 'vitest'
import {
  ILLUSTRATIVE_GEOMETRY_NOTICE,
  ILLUSTRATIVE_HEXES,
  ILLUSTRATIVE_MULTISCALE_GEOGRAPHY,
  ILLUSTRATIVE_PARCELS,
  ILLUSTRATIVE_PARCELS_PER_CELL,
  ILLUSTRATIVE_PLANNING_AREAS,
  ILLUSTRATIVE_SUMMARY_AREAS,
} from './fixtures'
import { TYPE_IDS, type GeoJsonPolygonGeometry } from './types'

const allFeatures = [
  ...ILLUSTRATIVE_SUMMARY_AREAS.features,
  ...ILLUSTRATIVE_PLANNING_AREAS.features,
  ...ILLUSTRATIVE_PARCELS.features,
]

function expectValidClosedPolygon(geometry: GeoJsonPolygonGeometry): void {
  expect(geometry.type).toBe('Polygon')
  expect(geometry.coordinates.length).toBeGreaterThan(0)

  for (const ring of geometry.coordinates) {
    expect(ring.length).toBeGreaterThanOrEqual(4)
    expect(ring.at(-1)).toEqual(ring[0])

    for (const [longitude, latitude] of ring) {
      expect(Number.isFinite(longitude)).toBe(true)
      expect(Number.isFinite(latitude)).toBe(true)
      expect(longitude).toBeGreaterThanOrEqual(-180)
      expect(longitude).toBeLessThanOrEqual(180)
      expect(latitude).toBeGreaterThanOrEqual(-90)
      expect(latitude).toBeLessThanOrEqual(90)
    }
  }
}

describe('illustrative multi-scale geography fixtures', () => {
  it('generates valid closed polygons at every display scale', () => {
    expect(allFeatures.length).toBeGreaterThan(0)

    for (const item of allFeatures) {
      expectValidClosedPolygon(item.geometry)
    }
  })

  it('has deterministic feature counts and stable unique IDs', () => {
    const neighborhoodCount = new Set(
      ILLUSTRATIVE_HEXES.map(
        (hex) => `${hex.muni}::${hex.neighborhood ?? hex.tract}`,
      ),
    ).size
    const municipalityCount = new Set(
      ILLUSTRATIVE_HEXES.map((hex) => hex.muni),
    ).size

    expect(ILLUSTRATIVE_SUMMARY_AREAS.features).toHaveLength(
      neighborhoodCount + municipalityCount,
    )
    expect(ILLUSTRATIVE_PLANNING_AREAS.features).toHaveLength(5)
    expect(ILLUSTRATIVE_PARCELS.features).toHaveLength(
      ILLUSTRATIVE_HEXES.length * ILLUSTRATIVE_PARCELS_PER_CELL,
    )

    const ids = allFeatures.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('links every generated geography back to fixture H3 records', () => {
    const recordsByH3 = new Map(
      ILLUSTRATIVE_HEXES.map((hex) => [hex.h3, hex]),
    )

    for (const area of ILLUSTRATIVE_SUMMARY_AREAS.features) {
      expect(area.properties.parentH3s.length).toBeGreaterThan(0)
      for (const h3 of area.properties.parentH3s) {
        expect(recordsByH3.has(h3), `${area.id}: ${h3}`).toBe(true)
      }
    }

    const planningParents = ILLUSTRATIVE_PLANNING_AREAS.features.flatMap(
      (area) => area.properties.parentH3s,
    )
    expect(new Set(planningParents)).toEqual(new Set(recordsByH3.keys()))

    for (const parcel of ILLUSTRATIVE_PARCELS.features) {
      const parent = recordsByH3.get(parcel.properties.parentH3)
      expect(parent, parcel.id).toBeDefined()
      expect(parcel.properties.parentMunicipality).toBe(parent?.muni)
      expect(parcel.properties.parentNeighborhood).toBe(
        parent?.neighborhood ?? null,
      )
      expect(parcel.properties.parentTract).toBe(parent?.tract)

      for (const typeId of TYPE_IDS) {
        expect(parent?.need[typeId]).toBeDefined()
        expect(parent?.fit[typeId]).toBeDefined()
        expect(parent?.allowed[typeId]).toBeDefined()
      }
    }
  })

  it('labels every generated geometry illustrative and not cadastral', () => {
    expect(ILLUSTRATIVE_MULTISCALE_GEOGRAPHY.authoritative).toBe(false)
    expect(ILLUSTRATIVE_GEOMETRY_NOTICE.toLowerCase()).toContain('illustrative')
    expect(ILLUSTRATIVE_GEOMETRY_NOTICE.toLowerCase()).toContain(
      'not cadastral',
    )
    expect(JSON.stringify(ILLUSTRATIVE_MULTISCALE_GEOGRAPHY)).not.toContain(
      '"authoritative":true',
    )

    for (const item of allFeatures) {
      expect(item.properties.authoritative).toBe(false)
      expect(item.properties.geometryStatus).toBe(
        'illustrative_not_cadastral',
      )
      expect(item.properties.geometryNotice).toBe(
        ILLUSTRATIVE_GEOMETRY_NOTICE,
      )
    }
  })
})
