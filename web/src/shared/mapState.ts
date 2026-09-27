import { TYPE_IDS, type AreaRecord, type TypeId } from '../data/types'

export type MapMode = 'match' | 'need'

export interface MapConfiguration {
  /** Census tract GEOID of the selected analysis area. */
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

/**
 * Parses a shared map URL. `place` must be a loaded tract id; otherwise the
 * first loaded tract is used so a stale deep link still opens the workspace.
 */
export function parseMapConfiguration(
  search: string,
  places: readonly Pick<AreaRecord, 'id'>[],
): MapConfiguration {
  const params = new URLSearchParams(search)
  const requestedPlace = params.get('place')
  const requestedType = params.get('type')

  return {
    place:
      places.find((place) => place.id === requestedPlace)?.id ??
      places[0]?.id ??
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
