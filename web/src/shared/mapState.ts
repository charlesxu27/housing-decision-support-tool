import { TYPE_IDS, type HexRecord, type TypeId } from '../data/types'
import type { MapMode } from '../map/MapView'

export interface MapConfiguration {
  place: string
  type: TypeId
  view: MapMode
  dimension: '2d' | '3d'
}

export const DEFAULT_MAP_CONFIGURATION: MapConfiguration = {
  place: '',
  type: 'duplex_triplex',
  view: 'match',
  dimension: '2d',
}

export function parseMapConfiguration(
  search: string,
  places: readonly Pick<HexRecord, 'h3'>[],
): MapConfiguration {
  const params = new URLSearchParams(search)
  const requestedPlace = params.get('place')
  const requestedType = params.get('type')

  return {
    place:
      places.find((place) => place.h3 === requestedPlace)?.h3 ??
      places[0]?.h3 ??
      '',
    type: TYPE_IDS.includes(requestedType as TypeId)
      ? (requestedType as TypeId)
      : DEFAULT_MAP_CONFIGURATION.type,
    view: params.get('view') === 'need' ? 'need' : 'match',
    dimension: params.get('dimension') === '3d' ? '3d' : '2d',
  }
}

export function toMapSearch(configuration: MapConfiguration): string {
  const params = new URLSearchParams({
    place: configuration.place,
    type: configuration.type,
    view: configuration.view,
    dimension: configuration.dimension,
  })
  return `?${params.toString()}`
}
