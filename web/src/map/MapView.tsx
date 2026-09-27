import { useMemo, useState } from 'react'
import type { PickingInfo } from '@deck.gl/core'
import { GeoJsonLayer, PolygonLayer } from '@deck.gl/layers'
import DeckGL from '@deck.gl/react'
import { cellToLatLng } from 'h3-js'
import MapGL from 'react-map-gl/maplibre'
import { ILLUSTRATIVE_SUMMARY_AREAS } from '../data/fixtures'
import type { GeoJsonFeature, SummaryAreaProperties } from '../data/types'
import 'maplibre-gl/dist/maplibre-gl.css'

export type MapMode = 'match' | 'need'

export interface MapDatum {
  h3: string
  name: string
  muni: string
  tract: string
}

interface MapViewProps<T extends MapDatum> {
  cells: T[]
  selected: T
  mode: MapMode
  is3d: boolean
  getStatus: (cell: T) => string
  getNeed: (cell: T) => string
  getTooltip: (cell: T) => string
  onSelect: (cell: T) => void
}

interface NeighborhoodProperties {
  hood?: string
}

interface BlockGroupProperties {
  GEOID?: string
  TRACT?: string
  BLKGRP?: string
}

interface TooltipProperties {
  kind?: string
  label?: string
  parentH3s?: readonly string[]
  hood?: string
  GEOID?: string
}

const STATUS_COLORS: Record<string, [number, number, number]> = {
  ready_match: [13, 148, 136],
  needs_approval: [240, 168, 35],
  blocked_by_zoning: [126, 87, 194],
  needed_but_hard: [52, 125, 188],
  low_priority: [173, 181, 189],
  zoning_unknown: [92, 101, 110],
  not_recommended: [194, 63, 63],
  insufficient_data: [124, 125, 130],
}

const NEED_COLORS: Record<string, [number, number, number]> = {
  high: [199, 62, 58],
  medium: [237, 159, 48],
  low: [62, 150, 124],
  uncertain: [124, 125, 130],
}

const MATCH_LABELS: Record<string, string> = {
  ready_match: 'Ready match',
  needs_approval: 'Needs approval',
  blocked_by_zoning: 'Blocked by zoning',
  needed_but_hard: 'Needed but hard',
  low_priority: 'Low priority',
  zoning_unknown: 'Zoning unknown',
  not_recommended: 'Not recommended',
  insufficient_data: 'Insufficient data',
}

const NEED_LABELS: Record<string, string> = {
  high: 'High need',
  medium: 'Medium need',
  low: 'Low need',
  uncertain: 'Uncertain need',
}

const MAP_STYLE =
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const NEIGHBORHOODS_URL = '/wprdc-neighborhoods.geojson'
const BLOCK_GROUPS_URL = '/census-block-groups.geojson'
const NEIGHBORHOOD_MAX_ZOOM = 12.4

function polygonCoordinates(
  feature: GeoJsonFeature<Record<string, unknown>>,
): number[][][] {
  return feature.geometry.coordinates as unknown as number[][][]
}

export function MapView<T extends MapDatum>({
  cells,
  selected,
  mode,
  is3d,
  getStatus,
  getNeed,
  getTooltip,
  onSelect,
}: MapViewProps<T>) {
  const [basemapError, setBasemapError] = useState(false)
  const [viewState, setViewState] = useState(() => {
    const [latitude, longitude] = cellToLatLng(selected.h3)
    return {
      latitude,
      longitude,
      zoom: 11.2,
      pitch: is3d ? 38 : 0,
      bearing: 0,
    }
  })

  const cellsByH3 = useMemo(
    () => new Map(cells.map((cell) => [cell.h3, cell])),
    [cells],
  )
  const cellsByNeighborhood = useMemo(
    () =>
      new Map(
        cells
          .filter((cell) => cell.muni === 'Pittsburgh')
          .map((cell) => [cell.name.toLowerCase(), cell]),
      ),
    [cells],
  )
  const cellsByTract = useMemo(
    () => new Map(cells.map((cell) => [cell.tract, cell])),
    [cells],
  )

  const valueFor = (cell: T) =>
    mode === 'match' ? getStatus(cell) : getNeed(cell)

  const colorFor = (cell: T, alpha: number): [number, number, number, number] => {
    const palette = mode === 'match' ? STATUS_COLORS : NEED_COLORS
    const fallback =
      mode === 'match'
        ? STATUS_COLORS.insufficient_data
        : NEED_COLORS.uncertain
    return [...(palette[valueFor(cell)] ?? fallback), alpha]
  }

  const areaSummary = (parentH3s: readonly string[]) => {
    const parents = parentH3s
      .map((h3) => cellsByH3.get(h3))
      .filter((cell): cell is T => Boolean(cell))
    if (parents.length === 0) {
      return {
        color: [205, 211, 207, 35] as [number, number, number, number],
        label: 'No fixture score',
      }
    }
    const values = parents.map(valueFor)
    const counts = new Map<string, number>()
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
    if (counts.size === 1) {
      const value = values[0]
      return {
        color: colorFor(parents[0], 155),
        label:
          mode === 'match'
            ? (MATCH_LABELS[value] ?? value)
            : (NEED_LABELS[value] ?? value),
      }
    }
    const breakdown = [...counts]
      .map(
        ([value, count]) =>
          `${count} ${mode === 'match' ? (MATCH_LABELS[value] ?? value) : (NEED_LABELS[value] ?? value)}`,
      )
      .join(' · ')
    return {
      color: [104, 113, 107, 125] as [number, number, number, number],
      label: `Mixed results: ${breakdown}`,
    }
  }

  const outsideCitySummaries = useMemo(
    () =>
      ILLUSTRATIVE_SUMMARY_AREAS.features.filter(
        (feature) =>
          feature.properties.summaryLevel === 'neighborhood' &&
          feature.properties.municipality !== 'Pittsburgh',
      ),
    [],
  )

  const layers = [
    new GeoJsonLayer<NeighborhoodProperties>({
      id: 'pittsburgh-neighborhoods',
      data: NEIGHBORHOODS_URL,
      pickable: true,
      stroked: true,
      filled: viewState.zoom < NEIGHBORHOOD_MAX_ZOOM,
      getFillColor: (feature) => {
        const cell = cellsByNeighborhood.get(
          (feature.properties.hood ?? '').toLowerCase(),
        )
        return cell ? colorFor(cell, 135) : [235, 238, 234, 22]
      },
      getLineColor: (feature) => {
        const hasScore = cellsByNeighborhood.has(
          (feature.properties.hood ?? '').toLowerCase(),
        )
        return hasScore ? [52, 67, 59, 190] : [102, 113, 106, 95]
      },
      getLineWidth: 1,
      lineWidthUnits: 'pixels',
      onClick: ({ object }: PickingInfo) => {
        const feature = object as
          | { properties?: NeighborhoodProperties }
          | undefined
        const cell = cellsByNeighborhood.get(
          (feature?.properties?.hood ?? '').toLowerCase(),
        )
        if (cell) onSelect(cell)
      },
      updateTriggers: {
        getFillColor: [mode, getStatus, getNeed],
        getLineColor: [cellsByNeighborhood],
      },
    }),
    new PolygonLayer<GeoJsonFeature<SummaryAreaProperties>>({
      id: 'outside-city-summary-areas',
      data: [...outsideCitySummaries],
      visible: viewState.zoom < NEIGHBORHOOD_MAX_ZOOM,
      pickable: true,
      filled: true,
      stroked: true,
      getPolygon: polygonCoordinates,
      getFillColor: (feature) =>
        areaSummary(feature.properties.parentH3s).color,
      getLineColor: [52, 67, 59, 190],
      getLineWidth: 1,
      lineWidthUnits: 'pixels',
      onClick: ({ object }) => {
        const h3 = object?.properties.parentH3s[0]
        const cell = h3 ? cellsByH3.get(h3) : undefined
        if (cell) onSelect(cell)
      },
      updateTriggers: { getFillColor: [mode, getStatus, getNeed] },
    }),
    new GeoJsonLayer<BlockGroupProperties>({
      id: 'census-block-groups',
      data: BLOCK_GROUPS_URL,
      visible: viewState.zoom >= NEIGHBORHOOD_MAX_ZOOM,
      pickable: true,
      filled: true,
      stroked: true,
      extruded: is3d,
      getFillColor: (feature) => {
        const tract = (feature.properties.GEOID ?? '').slice(0, 11)
        const cell = cellsByTract.get(tract)
        return cell ? colorFor(cell, 160) : [205, 211, 207, 35]
      },
      getLineColor: [255, 255, 255, 220],
      getLineWidth: 2,
      lineWidthUnits: 'pixels',
      getElevation: is3d ? 65 : 0,
      onClick: ({ object }: PickingInfo) => {
        const feature = object as
          | { properties?: BlockGroupProperties }
          | undefined
        const tract = (feature?.properties?.GEOID ?? '').slice(0, 11)
        const cell = cellsByTract.get(tract)
        if (cell) onSelect(cell)
      },
      updateTriggers: {
        getFillColor: [mode, getStatus, getNeed],
        getElevation: [is3d],
      },
    }),
  ]

  const getMapTooltip = ({ object }: PickingInfo) => {
    if (!object) return null
    const properties = (object as { properties?: TooltipProperties }).properties
    if (!properties) return null

    if (properties.hood) {
      const cell = cellsByNeighborhood.get(properties.hood.toLowerCase())
      return {
        text: cell
          ? `${properties.hood}\n${getTooltip(cell)}`
          : `${properties.hood}\nNo fixture score yet`,
      }
    }
    if (properties.GEOID) {
      const tract = properties.GEOID.slice(0, 11)
      const cell = cellsByTract.get(tract)
      return {
        text: cell
          ? `Census block group ${properties.GEOID}\n${getTooltip(cell)}`
          : `Census block group ${properties.GEOID}\nNo fixture score yet`,
      }
    }
    if (properties.parentH3s) {
      return {
        text: `${properties.label ?? 'Planning area'}\n${areaSummary(properties.parentH3s).label}`,
      }
    }
    return null
  }

  const scaleLabel =
    viewState.zoom < NEIGHBORHOOD_MAX_ZOOM
      ? 'Neighborhood view'
      : 'Census block-group view'

  return (
    <div className="map-canvas" aria-label="Interactive housing match map">
      <DeckGL
        controller
        layers={layers}
        viewState={viewState}
        onViewStateChange={({ viewState: next }) =>
          setViewState(next as typeof viewState)
        }
        getTooltip={getMapTooltip}
      >
        <MapGL mapStyle={MAP_STYLE} onError={() => setBasemapError(true)} />
      </DeckGL>
      <div className="map-scale">
        <strong>{scaleLabel}</strong>
        <span>
          {viewState.zoom < NEIGHBORHOOD_MAX_ZOOM
            ? 'Zoom in for planning areas'
            : 'Shaded by tract score'}
        </span>
      </div>
      <div className="map-help">Drag to move · Scroll to zoom · Shift-drag to rotate</div>
      <div className="fixture-banner">Scores and detailed geometry are illustrative</div>
      {basemapError ? (
        <div className="map-error" role="alert">
          Street tiles could not load. Check your connection and refresh.
        </div>
      ) : null}
    </div>
  )
}
