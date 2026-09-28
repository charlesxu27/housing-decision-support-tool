import type { MatchStatus } from '../data/types'
import { STATUS_LABELS } from '../shared/labels'
import type { MapMode } from '../shared/mapState'
import { EMPTY_TRACT_RGB, NEED_COLORS, STATUS_COLORS, rgbCss } from './colors'

const MATCH_ORDER: readonly MatchStatus[] = [
  'ready_match',
  'needs_approval',
  'blocked_by_zoning',
  'needed_but_hard',
  'low_priority',
  'zoning_unknown',
  'not_recommended',
]

const NEED_ORDER = ['high', 'medium', 'low', 'uncertain'] as const

const NEED_LABELS: Record<(typeof NEED_ORDER)[number], string> = {
  high: 'High need',
  medium: 'Medium need',
  low: 'Low need',
  uncertain: 'Uncertain',
}

export function Legend({ mode }: { mode: MapMode }) {
  const items =
    mode === 'match'
      ? MATCH_ORDER.map(
          (status) => [rgbCss(STATUS_COLORS[status]), STATUS_LABELS[status]] as const,
        )
      : [
          ...NEED_ORDER.map(
            (band) => [rgbCss(NEED_COLORS[band]!), NEED_LABELS[band]] as const,
          ),
          [rgbCss(EMPTY_TRACT_RGB), 'No loaded tracts'] as const,
        ]

  return (
    <aside className="map-legend" aria-label="Map legend">
      <h3>{mode === 'match' ? 'Match status' : 'Local need'}</h3>
      {items.map(([color, label]) => (
        <div className="legend-row" key={label}>
          <span className="legend-swatch" style={{ background: color }} />
          <span>{label}</span>
        </div>
      ))}
      <p className="legend-note">
        The color is the check that settled the result. Later checks stay on
        the card, but they do not recolor the tract or parcel.
      </p>
      {mode === 'match' ? (
        <p className="legend-note">
          Zoning unknown also covers a missing required fact and tracts that
          are not in the loaded snapshot.
        </p>
      ) : null}
      <p className="legend-note">
        Boundaries change as you zoom: municipalities and neighborhoods →
        Census tracts → parcels. Summary areas fade when no single result
        covers half their parcels.
      </p>
    </aside>
  )
}
