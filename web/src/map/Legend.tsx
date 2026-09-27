import type { MapMode } from './MapView'

const MATCH_ITEMS = [
  ['#0d9488', 'Ready match'],
  ['#f0a823', 'Needs approval'],
  ['#7e57c2', 'Blocked by zoning'],
  ['#347dbc', 'Needed but hard'],
  ['#adb5b5', 'Low priority'],
  ['#5c656e', 'Zoning unknown'],
  ['#c23f3f', 'Not recommended'],
  ['#68716b', 'Mixed results'],
  ['#d9ddd9', 'Not scored yet'],
]

const NEED_ITEMS = [
  ['#c73e3a', 'High need'],
  ['#ed9f30', 'Medium need'],
  ['#3e967c', 'Low need'],
  ['#7c7d82', 'Uncertain'],
  ['#68716b', 'Mixed results'],
  ['#d9ddd9', 'Not scored yet'],
]

export function Legend({ mode }: { mode: MapMode }) {
  const items = mode === 'match' ? MATCH_ITEMS : NEED_ITEMS
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
        Boundaries change as you zoom: neighborhoods → Census block groups.
      </p>
    </aside>
  )
}
