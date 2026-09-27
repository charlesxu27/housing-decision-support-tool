import type { MapMode } from '../map/MapView'

interface Option {
  value: string
  label: string
}

interface ToolbarProps {
  places: Option[]
  place: string
  onPlaceChange: (value: string) => void
  types: Option[]
  type: string
  onTypeChange: (value: string) => void
  mode: MapMode
  onModeChange: (mode: MapMode) => void
  is3d: boolean
  onDimensionChange: (is3d: boolean) => void
}

export function Toolbar({
  places,
  place,
  onPlaceChange,
  types,
  type,
  onTypeChange,
  mode,
  onModeChange,
  is3d,
  onDimensionChange,
}: ToolbarProps) {
  return (
    <div className="toolbar" aria-label="Map controls">
      <div className="field">
        <label htmlFor="place-select">Place</label>
        <select
          id="place-select"
          value={place}
          onChange={(event) => onPlaceChange(event.target.value)}
        >
          {places.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="type-select">Housing type</label>
        <select
          id="type-select"
          value={type}
          onChange={(event) => onTypeChange(event.target.value)}
        >
          {types.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="segmented" aria-label="Map view">
        <button
          className={mode === 'match' ? 'active' : ''}
          type="button"
          onClick={() => onModeChange('match')}
        >
          Match status
        </button>
        <button
          className={mode === 'need' ? 'active' : ''}
          type="button"
          onClick={() => onModeChange('need')}
        >
          What's missing
        </button>
      </div>
      <div className="segmented" aria-label="Map dimension">
        <button
          className={!is3d ? 'active' : ''}
          type="button"
          onClick={() => onDimensionChange(false)}
        >
          2D
        </button>
        <button
          className={is3d ? 'active' : ''}
          type="button"
          onClick={() => onDimensionChange(true)}
        >
          3D
        </button>
      </div>
    </div>
  )
}
