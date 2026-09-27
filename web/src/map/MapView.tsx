import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WebMercatorViewport, type Layer, type PickingInfo } from '@deck.gl/core'
import { MVTLayer } from '@deck.gl/geo-layers'
import { GeoJsonLayer } from '@deck.gl/layers'
import DeckGL from '@deck.gl/react'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import MapGL from 'react-map-gl/maplibre'
import {
  DATA_PATHS,
  analysisAreaProperties,
  floodZoneProperties,
  summaryAreaProperties,
  transitStopProperties,
  zoningDistrictProperties,
  type Snapshot,
} from '../data/load'
import type {
  AnalysisAreaProperties,
  AreaRecord,
  FloodZoneProperties,
  GeoJsonFeatureCollection,
  ParcelTileProperties,
  SummaryArea,
  SummaryAreaProperties,
  TransitStopProperties,
  TypeId,
  ZoningDistrictProperties,
} from '../data/types'
import { dataVintageLabel } from '../data/vintage'
import { districtHoverText } from '../data/zoningGlossary'
import {
  areaStatus,
  heaviestMember,
  parcelStatus,
  summarize,
  summaryValueLabel,
  type SummaryBreakdown,
} from '../model/area'
import { STATUS_LABELS, TYPE_LABELS } from '../shared/labels'
import type { MapMode } from '../shared/mapState'
import { NEED_COLORS, STATUS_COLORS } from './colors'
import { useGeoJson } from './useGeoJson'
import 'maplibre-gl/dist/maplibre-gl.css'

export type { MapMode } from '../shared/mapState'

export interface MapFocus {
  /** Increment to request a camera move. */
  version: number
  /** Bounding box to fit; when null the selected tract centroid is centered. */
  bbox: [number, number, number, number] | null
}

export interface MapViewProps {
  snapshot: Snapshot
  selected: AreaRecord
  type: TypeId
  mode: MapMode
  is3d: boolean
  focus: MapFocus
  /** Parcel PIN to outline, when a lot is selected. */
  selectedPin: string | null
  onSelectArea: (id: string) => void
  onSelectParcel: (parcel: ParcelTileProperties) => void
}

type Rgba = [number, number, number, number]

const MAP_STYLE =
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
/** Below this zoom municipalities and neighborhoods are drawn. */
export const SUMMARY_MAX_ZOOM = 11.5
/** From here parcels are drawn from the vector tiles; tracts become outlines. */
export const PARCEL_MIN_ZOOM = 14
const NO_DATA: Rgba = [205, 211, 207, 60]
const CITY_NAMES = new Set(['pittsburgh', 'city of pittsburgh'])

type OverlayId = 'flood' | 'transit' | 'zoning'

const OVERLAYS: { id: OverlayId; label: string; description: string }[] = [
  {
    id: 'flood',
    label: 'FEMA flood zones',
    description:
      'Mapped flood hazard and floodway areas. Fit already excludes regulatory floodways from suitable sites—turn this on to see where risk shapes the map.',
  },
  {
    id: 'transit',
    label: 'Transit stops (PRT)',
    description:
      'Port Authority stops with weekday scheduled trips. Apartment and senior Fit prefer lots near frequent service—use this to check access by eye.',
  },
  {
    id: 'zoning',
    label: 'Pittsburgh zoning districts',
    description:
      'City zoning district boundaries behind Allowed status. Turn on when you need to see which district drives by-right, approval, or blocked results.',
  },
]

function asFeatureCollection<P extends Record<string, unknown>>(
  collection: GeoJsonFeatureCollection<P> | null,
): FeatureCollection<Geometry, P> | null {
  return collection as unknown as FeatureCollection<Geometry, P> | null
}

function paletteColor(value: string | null, mode: MapMode, alpha: number): Rgba {
  if (value == null) return NO_DATA
  const palette = mode === 'match' ? STATUS_COLORS : NEED_COLORS
  const fallback =
    mode === 'match' ? STATUS_COLORS.insufficient_data : NEED_COLORS.uncertain
  return [...(palette[value] ?? fallback), alpha]
}

function isCity(properties: SummaryAreaProperties): boolean {
  return (
    properties.kind === 'municipality' &&
    CITY_NAMES.has(properties.label.trim().toLowerCase())
  )
}

export function MapView({
  snapshot,
  selected,
  type,
  mode,
  is3d,
  focus,
  selectedPin,
  onSelectArea,
  onSelectParcel,
}: MapViewProps) {
  const { areasById, summariesById, manifest, lookupAllowed } = snapshot
  const containerRef = useRef<HTMLDivElement>(null)
  const [basemapError, setBasemapError] = useState(false)
  const [overlays, setOverlays] = useState<Record<OverlayId, boolean>>({
    flood: false,
    transit: false,
    zoning: false,
  })
  const [viewState, setViewState] = useState(() => ({
    longitude: selected.centroid[0],
    latitude: selected.centroid[1],
    zoom: 12.2,
    pitch: 38,
    bearing: 0,
  }))
  // 2D forces a flat camera; 3D restores the last pitch the user set.
  const cameraState = { ...viewState, pitch: is3d ? viewState.pitch || 38 : 0 }

  const tracts = useGeoJson(DATA_PATHS.analysisAreas, analysisAreaProperties)
  const municipalities = useGeoJson(DATA_PATHS.municipalities, summaryAreaProperties)
  const neighborhoods = useGeoJson(DATA_PATHS.neighborhoods, summaryAreaProperties)
  const flood = useGeoJson(DATA_PATHS.floodZones, floodZoneProperties, overlays.flood)
  const transit = useGeoJson(DATA_PATHS.transitStops, transitStopProperties, overlays.transit)
  const zoning = useGeoJson(DATA_PATHS.zoningDistricts, zoningDistrictProperties, overlays.zoning)

  const lastFocus = useRef(focus.version)
  useEffect(() => {
    if (focus.version === lastFocus.current) return
    lastFocus.current = focus.version
    setViewState((current) => {
      if (focus.bbox) {
        const width = containerRef.current?.clientWidth ?? 800
        const height = containerRef.current?.clientHeight ?? 600
        const fitted = new WebMercatorViewport({ ...current, width, height }).fitBounds(
          [
            [focus.bbox[0], focus.bbox[1]],
            [focus.bbox[2], focus.bbox[3]],
          ],
          { padding: 40, maxZoom: 13.5 },
        )
        return {
          ...current,
          longitude: fitted.longitude,
          latitude: fitted.latitude,
          // Land on the tract layer so the selected tract is visible.
          zoom: Math.max(fitted.zoom, SUMMARY_MAX_ZOOM + 0.1),
        }
      }
      return {
        ...current,
        longitude: selected.centroid[0],
        latitude: selected.centroid[1],
        zoom: Math.max(current.zoom, 12.5),
      }
    })
  }, [focus, selected])

  const summaryFeatures = useMemo(() => {
    const features: Feature<Geometry, SummaryAreaProperties>[] = []
    const munis = asFeatureCollection(municipalities.data)
    const hoods = asFeatureCollection(neighborhoods.data)
    if (munis) {
      features.push(...munis.features.filter((feature) => !isCity(feature.properties)))
    }
    if (hoods) features.push(...hoods.features)
    return features
  }, [municipalities.data, neighborhoods.data])

  const breakdowns = useMemo(() => {
    const result = new Map<string, SummaryBreakdown>()
    for (const summary of summariesById.values()) {
      result.set(summary.id, summarize(summary, areasById, type, mode))
    }
    return result
  }, [areasById, mode, summariesById, type])

  const tractValue = useCallback(
    (area: AreaRecord | undefined): string | null => {
      if (!area) return null
      return mode === 'match' ? areaStatus(area, type) : area.need[type]
    },
    [mode, type],
  )

  const selectedFeature = useMemo(() => {
    const collection = asFeatureCollection(tracts.data)
    const feature = collection?.features.find(
      (candidate) => candidate.properties.id === selected.id,
    )
    return feature ? [feature] : []
  }, [selected.id, tracts.data])

  const focusSummary = useCallback(
    (summary: SummaryArea) => {
      const tract = heaviestMember(summary, areasById)
      if (tract) onSelectArea(tract.id)
      setViewState((current) => {
        const width = containerRef.current?.clientWidth ?? 800
        const height = containerRef.current?.clientHeight ?? 600
        const fitted = new WebMercatorViewport({ ...current, width, height }).fitBounds(
          [
            [summary.bbox[0], summary.bbox[1]],
            [summary.bbox[2], summary.bbox[3]],
          ],
          { padding: 40, maxZoom: 13.5 },
        )
        return {
          ...current,
          longitude: fitted.longitude,
          latitude: fitted.latitude,
          zoom: Math.max(fitted.zoom, SUMMARY_MAX_ZOOM + 0.1),
        }
      })
    },
    [areasById, onSelectArea],
  )

  const zoom = viewState.zoom
  const showSummaries = zoom < SUMMARY_MAX_ZOOM
  const showParcels = zoom >= PARCEL_MIN_ZOOM && manifest.parcelTiles != null
  const showTractFill = !showSummaries && !showParcels

  const layers: Layer[] = [
    new GeoJsonLayer<SummaryAreaProperties>({
      id: 'summaries',
      data: summaryFeatures,
      visible: showSummaries,
      pickable: true,
      stroked: true,
      filled: true,
      getFillColor: (feature) => {
        const breakdown = breakdowns.get(feature.properties.id)
        if (!breakdown || breakdown.plurality == null) return NO_DATA
        return paletteColor(
          breakdown.plurality,
          mode,
          breakdown.pluralityShare < 0.5 ? 95 : 170,
        )
      },
      getLineColor: (feature) =>
        feature.properties.kind === 'neighborhood'
          ? [52, 67, 59, 150]
          : [52, 67, 59, 220],
      getLineWidth: (feature) => (feature.properties.kind === 'neighborhood' ? 1 : 1.5),
      lineWidthUnits: 'pixels',
      onClick: ({ object }) => {
        const feature = object as Feature<Geometry, SummaryAreaProperties> | undefined
        const summary = feature ? summariesById.get(feature.properties.id) : undefined
        if (summary) focusSummary(summary)
      },
      updateTriggers: { getFillColor: [breakdowns, mode] },
    }),
    new GeoJsonLayer<AnalysisAreaProperties>({
      id: 'tracts',
      data: asFeatureCollection(tracts.data) ?? [],
      visible: !showSummaries,
      pickable: showTractFill,
      stroked: true,
      filled: showTractFill,
      extruded: is3d && showTractFill,
      wireframe: false,
      getFillColor: (feature) =>
        paletteColor(tractValue(areasById.get(feature.properties.id)), mode, 165),
      getLineColor: showParcels ? [52, 67, 59, 200] : [255, 255, 255, 220],
      getLineWidth: showParcels ? 2 : 1.5,
      lineWidthUnits: 'pixels',
      getElevation: (feature) => {
        const area = areasById.get(feature.properties.id)
        return area ? Math.min(2_000, area.fit[type].parcels * 4) : 0
      },
      onClick: ({ object }) => {
        const feature = object as Feature<Geometry, AnalysisAreaProperties> | undefined
        if (feature && areasById.has(feature.properties.id)) {
          onSelectArea(feature.properties.id)
        }
      },
      updateTriggers: {
        getFillColor: [mode, type, areasById],
        getElevation: [type, areasById],
        getLineColor: [showParcels],
        getLineWidth: [showParcels],
      },
    }),
    new GeoJsonLayer<AnalysisAreaProperties>({
      id: 'selected-tract',
      data: selectedFeature,
      visible: !showSummaries,
      pickable: false,
      stroked: true,
      filled: false,
      getLineColor: [23, 34, 29, 255],
      getLineWidth: 3,
      lineWidthUnits: 'pixels',
    }),
  ]

  if (manifest.parcelTiles) {
    layers.push(
      new MVTLayer<ParcelTileProperties>({
        id: 'parcels',
        data: manifest.parcelTiles.urlTemplate,
        minZoom: manifest.parcelTiles.minZoom,
        maxZoom: manifest.parcelTiles.maxZoom,
        visible: showParcels,
        pickable: true,
        stroked: true,
        filled: true,
        uniqueIdProperty: 'pin',
        autoHighlight: true,
        highlightColor: [255, 255, 255, 90],
        getFillColor: (feature) => {
          const props = feature.properties
          const area = areasById.get(props.tract)
          if (mode === 'need') {
            return paletteColor(
              area?.need[type] ?? null,
              mode,
              props[`f_${type}`] === 1 ? 190 : 70,
            )
          }
          return paletteColor(
            parcelStatus(props, area, type, lookupAllowed),
            mode,
            190,
          )
        },
        getLineColor: (feature) =>
          feature.properties.pin === selectedPin
            ? [23, 34, 29, 255]
            : [255, 255, 255, 120],
        getLineWidth: (feature) => (feature.properties.pin === selectedPin ? 2.5 : 0.5),
        lineWidthUnits: 'pixels',
        onClick: ({ object }) => {
          const feature = object as Feature<Geometry, ParcelTileProperties> | undefined
          if (!feature) return
          onSelectParcel(feature.properties)
        },
        updateTriggers: {
          getFillColor: [mode, type, areasById, lookupAllowed],
          getLineColor: [selectedPin],
          getLineWidth: [selectedPin],
        },
      }),
    )
  }

  if (overlays.flood && flood.data) {
    layers.push(
      new GeoJsonLayer<FloodZoneProperties>({
        id: 'overlay-flood',
        data: asFeatureCollection(flood.data) ?? [],
        pickable: true,
        stroked: false,
        filled: true,
        getFillColor: (feature) =>
          feature.properties.floodway
            ? [194, 63, 63, 120]
            : feature.properties.sfha
              ? [52, 125, 188, 90]
              : [120, 140, 160, 50],
      }),
    )
  }

  if (overlays.transit && transit.data) {
    layers.push(
      new GeoJsonLayer<TransitStopProperties>({
        id: 'overlay-transit',
        data: asFeatureCollection(transit.data) ?? [],
        pickable: true,
        pointType: 'circle',
        pointRadiusUnits: 'pixels',
        getPointRadius: (feature) =>
          Math.max(2, Math.min(14, Math.sqrt(feature.properties.weekdayTrips) / 2)),
        getFillColor: [16, 73, 60, 190],
        getLineColor: [255, 255, 255, 220],
        getLineWidth: 1,
        lineWidthUnits: 'pixels',
        stroked: true,
      }),
    )
  }

  if (overlays.zoning && zoning.data) {
    layers.push(
      new GeoJsonLayer<ZoningDistrictProperties>({
        id: 'overlay-zoning',
        data: asFeatureCollection(zoning.data) ?? [],
        pickable: true,
        stroked: true,
        filled: true,
        getFillColor: [0, 0, 0, 0],
        getLineColor: [118, 82, 180, 200],
        getLineWidth: 1.25,
        lineWidthUnits: 'pixels',
        autoHighlight: true,
        highlightColor: [118, 82, 180, 60],
      }),
    )
  }

  const getTooltip = ({ object, layer }: PickingInfo) => {
    if (!object || !layer) return null
    const id = layer.id
    const properties = (object as { properties?: Record<string, unknown> }).properties
    if (!properties) return null

    if (id === 'summaries') {
      const summaryProps = properties as SummaryAreaProperties
      const breakdown = breakdowns.get(summaryProps.id)
      const kind = summaryProps.kind === 'neighborhood' ? 'Pittsburgh neighborhood' : 'Municipality'
      const lines = [`${summaryProps.label} · ${kind}`, `${TYPE_LABELS[type]}`]
      if (!breakdown || breakdown.plurality == null) {
        lines.push('No scored tracts')
      } else {
        for (const [value, share] of Object.entries(breakdown.shares)) {
          lines.push(`${Math.round(share * 100)}% ${summaryValueLabel(value, mode)}`)
        }
        if (breakdown.pluralityShare < 0.5) lines.push('Split result: no status covers half the parcels')
      }
      lines.push('Click to open its largest tract')
      return { text: lines.join('\n'), className: 'map-tooltip' }
    }

    if (id === 'tracts') {
      const tractProps = properties as AnalysisAreaProperties
      const area = areasById.get(tractProps.id)
      if (!area) {
        return { text: `${tractProps.name}\nNot in the loaded snapshot`, className: 'map-tooltip' }
      }
      const status = areaStatus(area, type)
      const fit = area.fit[type]
      return {
        text: `${area.name} · ${area.neighborhood ?? area.muni}\n${TYPE_LABELS[type]}: ${
          mode === 'match' ? STATUS_LABELS[status] : `${area.need[type]} need`
        }\n${fit.parcels} suitable parcels · ${fit.homes[0]}–${fit.homes[1]} homes\nClick to see why`,
        className: 'map-tooltip',
      }
    }

    if (id.startsWith('parcels')) {
      const props = properties as unknown as ParcelTileProperties
      const area = areasById.get(props.tract)
      const status = parcelStatus(props, area, type, lookupAllowed)
      return {
        text: `PIN ${props.pin}\n${props.use.replaceAll('_', ' ')} · ${Math.round(props.lot).toLocaleString()} sq ft\n${
          props.zone
            ? districtHoverText(props.zone, {
                typeLabel: TYPE_LABELS[type],
                status: lookupAllowed(props.zone, type),
              })
            : 'Zone unknown (outside the City)'
        }\nLot status: ${STATUS_LABELS[status]}\nClick to see why this color`,
        className: 'map-tooltip',
      }
    }

    if (id === 'overlay-flood') {
      const props = properties as FloodZoneProperties
      return {
        text: `FEMA zone ${props.zone}${props.floodway ? ' · regulatory floodway' : props.sfha ? ' · special flood hazard area' : ''}`,
        className: 'map-tooltip',
      }
    }

    if (id === 'overlay-transit') {
      const props = properties as TransitStopProperties
      return {
        text: `${props.name}\n${props.weekdayTrips.toLocaleString()} weekday trips · routes ${props.routes.join(', ')}`,
        className: 'map-tooltip',
      }
    }

    if (id === 'overlay-zoning') {
      const props = properties as ZoningDistrictProperties
      return {
        text: districtHoverText(props.district),
        className: 'map-tooltip',
      }
    }

    return null
  }

  const scaleLabel = showSummaries
    ? 'Municipalities and neighborhoods'
    : showParcels
      ? 'Parcels'
      : 'Census tracts'
  const scaleHint = showSummaries
    ? 'Zoom in for tracts'
    : showParcels
      ? 'Click a lot to see why it is this color'
      : manifest.parcelTiles
        ? 'Zoom in for parcels'
        : 'Parcel tiles not in this build'

  const layerErrors = [tracts.error, municipalities.error, neighborhoods.error]
    .concat(overlays.flood ? [flood.error] : [])
    .concat(overlays.transit ? [transit.error] : [])
    .concat(overlays.zoning ? [zoning.error] : [])
    .filter((error): error is NonNullable<typeof error> => error != null)

  return (
    <div
      className="map-canvas"
      ref={containerRef}
      role="region"
      aria-label="Interactive housing match map"
    >
      <DeckGL
        controller
        layers={layers}
        viewState={cameraState}
        onViewStateChange={({ viewState: next }) => {
          const nextState = next as typeof viewState
          setViewState((current) => ({
            ...nextState,
            pitch: is3d ? nextState.pitch : current.pitch,
          }))
        }}
        getTooltip={getTooltip}
      >
        <MapGL mapStyle={MAP_STYLE} onError={() => setBasemapError(true)} />
      </DeckGL>
      <div className="map-scale">
        <strong>{scaleLabel}</strong>
        <span>{scaleHint}</span>
      </div>
      <div className="map-help">Drag to move · Scroll to zoom · Shift-drag to rotate</div>
      <div className="map-overlays" role="group" aria-labelledby="map-overlays-heading">
        <p className="map-overlays__title" id="map-overlays-heading">
          Overlays
        </p>
        {OVERLAYS.map((overlay) => {
          const tipId = `map-overlay-tip-${overlay.id}`
          return (
            <label key={overlay.id} className="map-overlays__option">
              <input
                type="checkbox"
                checked={overlays[overlay.id]}
                aria-describedby={tipId}
                onChange={(event) =>
                  setOverlays((current) => ({
                    ...current,
                    [overlay.id]: event.target.checked,
                  }))
                }
              />
              <span className="map-overlays__text">
                <span className="map-overlays__label">{overlay.label}</span>
                <span className="map-overlays__tip" id={tipId} role="tooltip">
                  {overlay.description}
                </span>
              </span>
            </label>
          )
        })}
      </div>
      <div className="map-data-chip">Data: {dataVintageLabel(manifest)}</div>
      {basemapError ? (
        <div className="map-error" role="alert">
          Street tiles could not load. Check your connection and refresh.
        </div>
      ) : null}
      {layerErrors.length > 0 ? (
        <div className="map-error" role="alert">
          {layerErrors.map((error) => (
            <p key={error.file}>
              <code>{error.file}</code> {error.reason}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}
